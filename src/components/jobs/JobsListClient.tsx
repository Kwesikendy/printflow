'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { Search, FileText, User, Calendar, Trash2, Filter, Check } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { searchCustomers } from '@/app/actions/customers'
import { startNewDayAction, deleteJobAction } from '@/app/actions/jobs'
import { toast } from 'sonner'

export const STATUS_FILTERS = [
  { id: 'all', label: 'All Jobs' },
  { id: 'in_production', label: 'In Production', statuses: ['in_production', 'ready_to_print', 'printing', 'preflight'] },
  { id: 'completed', label: 'Completed', statuses: ['completed'] },
  { id: 'picked_up', label: 'Picked Up', statuses: ['picked_up', 'ready_for_pickup'] },
  { id: 'awaiting_payment', label: 'Awaiting Payment', statuses: ['awaiting_payment', 'pending_review'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

export function JobsListClient({ 
  initialJobs, 
  initialQuery, 
  initialStatus = 'all',
  lastResetTime,
  currentPage = 1,
  totalPages = 1,
  role = 'front_desk'
}: { 
  initialJobs: any[], 
  initialQuery: string, 
  initialStatus?: string,
  lastResetTime?: string,
  currentPage?: number,
  totalPages?: number,
  role?: string
}) {
  const router = useRouter()
  const [jobsList, setJobsList] = useState(initialJobs)
  const [isFocused, setIsFocused] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showTodayOnly, setShowTodayOnly] = useState(true) // Default to true!
  const [isResetting, setIsResetting] = useState(false)
  
  // Sync state if initialJobs or initialStatus prop changes from server
  useEffect(() => {
    setJobsList(initialJobs)
  }, [initialJobs])

  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus)
    }
  }, [initialStatus])

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<{customer_name: string}[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // AWAITING_PAYMENT statuses that must always be visible even in prior shifts
  const UNPAID_STATUSES = ['awaiting_payment', 'pending_review']

  // Base filtered jobs based on search & shift
  const baseJobs = jobsList.filter(job => {
    const matchesSearch = !query || 
      job.job_number.toLowerCase().includes(query.toLowerCase()) || 
      job.customer_name.toLowerCase().includes(query.toLowerCase())

    if (!matchesSearch) return false;

    if (showTodayOnly && lastResetTime && !query) {
      const jobDate = new Date(job.created_at).getTime();
      const resetTime = new Date(lastResetTime).getTime();
      // Always show unpaid jobs from ANY shift so payment never gets missed
      if (jobDate < resetTime && !UNPAID_STATUSES.includes(job.status)) return false;
    }

    return true;
  })

  const getFilterCount = (filterId: string) => {
    if (filterId === 'all') return baseJobs.length;
    const f = STATUS_FILTERS.find(x => x.id === filterId);
    if (!f) return 0;
    if (f.statuses) {
      return baseJobs.filter(j => f.statuses.includes(j.status)).length;
    }
    return baseJobs.filter(j => j.status === filterId).length;
  }

  // Local instant filtering for active status filter
  const visibleJobs = baseJobs.filter(job => {
    if (statusFilter !== 'all') {
      const activeFilter = STATUS_FILTERS.find(f => f.id === statusFilter);
      if (activeFilter?.statuses) {
        if (!activeFilter.statuses.includes(job.status)) return false;
      } else if (job.status !== statusFilter) {
        return false;
      }
    }

    return true;
  })

  // Debounced search for autocomplete dropdown
  useEffect(() => {
    if (query.length >= 2 && isFocused) {
      const timer = setTimeout(async () => {
        const results = await searchCustomers(query)
        setSuggestions(results)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSuggestions([])
    }
  }, [query, isFocused])

  // Handle outside click for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSuggestions([])
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectStatus = (newStatus: string) => {
    setStatusFilter(newStatus)
    setShowStatusDropdown(false)
    startTransition(() => {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (newStatus !== 'all') params.set('status', newStatus)
      router.push(params.toString() ? `/dashboard/jobs?${params.toString()}` : '/dashboard/jobs')
    })
  }

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    setSuggestions([])
    setIsFocused(false)
    
    startTransition(() => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      router.push(params.toString() ? `/dashboard/jobs?${params.toString()}` : '/dashboard/jobs')
    })
  }

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (newPage > 1) params.set('page', newPage.toString())
      router.push(`/dashboard/jobs?${params.toString()}`)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  const handleStartNewDay = async () => {
    if (!window.confirm("Are you sure you want to start a new day? This will reset the sequence counter to 1 and filter out previous jobs.")) {
      return;
    }
    setIsResetting(true)
    try {
      const res = await startNewDayAction()
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("New day started! Sequence reset to 1.")
        setShowTodayOnly(true)
        router.refresh()
      }
    } catch (e) {
      toast.error("Failed to start new day")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between relative z-20">
        {/* Floating Modern Search Bar */}
        <div className="relative w-full max-w-2xl" ref={dropdownRef}>
          <motion.div 
          animate={{
            boxShadow: isFocused 
              ? '0 10px 25px -5px rgba(99, 102, 241, 0.15), 0 8px 10px -6px rgba(99, 102, 241, 0.1)' 
              : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
          }}
          className="relative bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl overflow-visible transition-colors"
        >
          <div className="flex items-center px-4 py-3">
            <motion.div 
              animate={{ color: isFocused ? '#4f46e5' : '#94a3b8', scale: isFocused ? 1.05 : 1 }}
              className="mr-3"
            >
              <Search className={`w-5 h-5 ${isPending ? 'animate-pulse text-indigo-500' : ''}`} />
            </motion.div>
            <form onSubmit={handleSubmit} className="flex-1 flex">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Job No. or Customer..."
                className="w-full bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none text-base"
                onFocus={() => setIsFocused(true)}
                autoComplete="off"
              />
              <button type="submit" className="hidden">Search</button>
            </form>
          </div>
          
          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {suggestions.length > 0 && isFocused && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
              >
                <div className="py-2">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
                      onMouseDown={(e) => {
                        // Use onMouseDown instead of onClick so it fires before onBlur
                        e.preventDefault()
                        handleSearch(s.customer_name)
                      }}
                    >
                      <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-slate-700">{s.customer_name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Filter / Actions */}
      <div className="flex items-center gap-3">
        <Button 
          variant="outline"
          onClick={handleStartNewDay}
          loading={isResetting}
          className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm"
        >
          Start New Day
        </Button>

        <Button 
          variant={showTodayOnly ? "primary" : "outline"}
          onClick={() => setShowTodayOnly(!showTodayOnly)}
          className={`flex items-center gap-2 transition-all ${showTodayOnly ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' : 'bg-white/80 backdrop-blur-xl border-slate-200/80 hover:bg-slate-50 text-slate-700'}`}
        >
          <Calendar className="w-4 h-4" />
          {showTodayOnly ? "Showing Today's Shift" : "Show Today's Shift Only"}
        </Button>
      </div>
      </div>

      {/* Status Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id;
          const count = getFilterCount(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => handleSelectStatus(f.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-xs border",
                isActive
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-100 shadow-md"
                  : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border-slate-200/80"
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Jobs List Container */}
      <div className="bg-white/60 backdrop-blur-2xl rounded-2xl shadow-premium-card border border-white/80 overflow-hidden relative z-10">
        <div className="table-container" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
          <table className="table-standard w-full">
            <thead className="bg-slate-50/50 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10">
              <tr>
                <th className="pl-6">Job No.</th>
                <th>Customer</th>
                <th>Product</th>
                <th className="text-right">Total</th>
                <th className="relative">
                  <div 
                    ref={statusDropdownRef}
                    className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 group py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStatusDropdown(!showStatusDropdown);
                    }}
                    title="Filter jobs by status"
                  >
                    <span>Status</span>
                    <Filter className={cn("w-3.5 h-3.5 transition-colors", statusFilter !== 'all' ? "text-indigo-600 fill-indigo-100" : "text-slate-400 group-hover:text-indigo-600")} />
                    {statusFilter !== 'all' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {showStatusDropdown && (
                    <div 
                      className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 font-normal text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        Filter by Status
                      </div>
                      {STATUS_FILTERS.map((f) => {
                        const count = getFilterCount(f.id);
                        const isActive = statusFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleSelectStatus(f.id)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 transition-colors",
                              isActive ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center", isActive ? "text-indigo-600" : "opacity-0")}>
                                <Check className="w-3.5 h-3.5" />
                              </div>
                              <span>{f.label}</span>
                            </div>
                            <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full font-medium", isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </th>
                <th>Created</th>
                <th>Completed</th>
                {role === 'admin' && <th className="pr-6 text-right">Actions</th>}
              </tr>
            </thead>
            
            <AnimatePresence mode="wait">
              {visibleJobs.length === 0 ? (
                <tbody>
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={role === 'admin' ? 8 : 7} className="p-0 border-none">
                      <EmptyState 
                        icon={<FileText />}
                        title="No jobs found"
                        description={query || statusFilter !== 'all' ? "No jobs matched your filter criteria." : "Get started by creating your first print job."}
                        action={
                          statusFilter !== 'all' ? (
                            <Button variant="outline" onClick={() => handleSelectStatus('all')}>
                              Clear Status Filter
                            </Button>
                          ) : !query ? (
                            <Link href="/dashboard/jobs/new">
                              <Button variant="outline">Create Job</Button>
                            </Link>
                          ) : undefined
                        }
                      />
                    </td>
                  </motion.tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100/50">
                  {visibleJobs.map((job, index) => (
                    <motion.tr 
                      key={job.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                      whileHover={{ 
                        backgroundColor: "rgba(248, 250, 252, 0.8)",
                        scale: 1.002,
                        transition: { duration: 0.15 }
                      }}
                      onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                      className={cn(
                        "group cursor-pointer",
                        // Highlight cross-shift unpaid jobs with amber left border
                        UNPAID_STATUSES.includes(job.status) && lastResetTime && new Date(job.created_at).getTime() < new Date(lastResetTime).getTime()
                          ? 'border-l-4 border-l-amber-400 bg-amber-50/30'
                          : ''
                      )}
                    >
                      <td className="pl-6 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        <div className="flex items-center gap-2">
                          <span>{job.job_number}</span>
                          {job.group_id && (
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60" title="Part of multi-job order">
                              Multi
                            </span>
                          )}
                          {/* Show 'Prior Shift' tag for cross-shift awaiting_payment jobs */}
                          {UNPAID_STATUSES.includes(job.status) && lastResetTime && new Date(job.created_at).getTime() < new Date(lastResetTime).getTime() && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-300" title="Payment pending from a prior shift">
                              Prior Shift
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="font-medium text-slate-700">{job.customer_name}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200/60 shadow-sm">
                          {job.product_types?.name}
                        </span>
                      </td>
                      <td className="text-right font-bold text-emerald-600">
                        {formatCurrency(job.line_total)}
                      </td>
                      <td>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectStatus(job.status);
                          }}
                          title="Click to filter by this status"
                          className="inline-block hover:scale-105 active:scale-95 transition-transform"
                        >
                          <StatusBadge status={job.status} />
                        </div>
                      </td>
                      <td className="text-slate-500 text-sm">
                        {formatDateTime(job.created_at)}
                      </td>
                      <td className="text-slate-500 text-sm">
                        {job.status === 'completed' || job.status === 'picked_up' ? formatDateTime(job.updated_at) : '-'}
                      </td>
                      {role === 'admin' && (
                        <td className="pr-6 text-right">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (window.confirm('Are you sure you want to permanently delete this job? This will delete all payments and invoices associated with it.')) {
                                toast.loading('Deleting job...', { id: 'delete-job' })
                                const previousJobs = [...jobsList]
                                setJobsList(prev => prev.filter(j => j.id !== job.id))
                                try {
                                  const res = await deleteJobAction(job.id)
                                  if (res.error) {
                                    setJobsList(previousJobs)
                                    toast.error('Failed to delete job: ' + res.error, { id: 'delete-job' })
                                  } else {
                                    toast.success('Job deleted successfully!', { id: 'delete-job' })
                                    router.refresh()
                                  }
                                } catch (err: any) {
                                  setJobsList(previousJobs)
                                  toast.error('Failed to delete job: ' + (err?.message || 'Unexpected error'), { id: 'delete-job' })
                                }
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Job"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              )}
            </AnimatePresence>
          </table>
        </div>
      </div>
      
      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-sm font-medium text-slate-500">
          Showing Page {currentPage} of {Math.max(1, totalPages)}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={currentPage <= 1 || isPending}
            onClick={() => handlePageChange(currentPage - 1)}
            className="bg-white shadow-sm"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => handlePageChange(currentPage + 1)}
            className="bg-white shadow-sm"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
