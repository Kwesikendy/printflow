'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Search, FileText, User } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { searchCustomers } from '@/app/actions/customers'

export function JobsListClient({ initialJobs, initialQuery }: { initialJobs: any[], initialQuery: string }) {
  const router = useRouter()
  const [isFocused, setIsFocused] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<{customer_name: string}[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Local instant filtering for jobs already on screen
  const visibleJobs = initialJobs.filter(job => 
    !query || 
    job.job_number.toLowerCase().includes(query.toLowerCase()) || 
    job.customer_name.toLowerCase().includes(query.toLowerCase())
  )

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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    setSuggestions([])
    setIsFocused(false)
    
    // Soft navigation to fetch from server without triggering the loading skeleton
    startTransition(() => {
      if (searchQuery) {
        router.push(`/dashboard/jobs?q=${encodeURIComponent(searchQuery)}`)
      } else {
        router.push('/dashboard/jobs')
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  return (
    <div className="space-y-6">
      {/* Floating Modern Search Bar */}
      <div className="relative max-w-2xl z-20" ref={dropdownRef}>
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
                <th>Status</th>
                <th>Created</th>
                <th className="pr-6">Completed</th>
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
                    <td colSpan={7} className="p-0 border-none">
                      <EmptyState 
                        icon={<FileText />}
                        title="No jobs found"
                        description={query ? "No jobs matched your search criteria." : "Get started by creating your first print job."}
                        action={
                          !query && (
                            <Link href="/dashboard/jobs/new">
                              <Button variant="outline">Create Job</Button>
                            </Link>
                          )
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
                      className="group cursor-pointer"
                    >
                      <td className="pl-6 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {job.job_number}
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
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="text-slate-500 text-sm">
                        {formatDateTime(job.created_at)}
                      </td>
                      <td className="text-slate-500 text-sm pr-6">
                        {job.status === 'completed' || job.status === 'picked_up' ? formatDateTime(job.updated_at) : '-'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              )}
            </AnimatePresence>
          </table>
        </div>
      </div>
    </div>
  )
}
