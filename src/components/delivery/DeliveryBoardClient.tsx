'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  dispatchDeliveryJobAction,
  markJobDeliveredAction,
  revertDeliveryToPendingAction,
  getDeliveryJobsAction
} from '@/app/actions/delivery'
import {
  Truck,
  MapPin,
  Phone,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Copy,
  Check,
  Send,
  RotateCcw,
  RefreshCw,
  Package
} from 'lucide-react'
import type { Job } from '@/types/database'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useRealtime } from '@/contexts/RealtimeContext'

interface DeliveryBoardClientProps {
  initialJobs: Job[]
  userEmail?: string
}

type TabType = 'pending' | 'dispatched' | 'delivered' | 'all'

export function DeliveryBoardClient({ initialJobs, userEmail }: DeliveryBoardClientProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Modal states
  const [dispatchModalJob, setDispatchModalJob] = useState<Job | null>(null)
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [dispatchNotes, setDispatchNotes] = useState('')

  const [deliveredModalJob, setDeliveredModalJob] = useState<Job | null>(null)
  const [deliveredNotes, setDeliveredNotes] = useState('')

  const { subscribeToJobs } = useRealtime()

  // Realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToJobs((payload) => {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const updated = payload.new as Job
        if (updated.delivery_method === 'delivery') {
          setJobs(prev => {
            const exists = prev.some(j => j.id === updated.id)
            if (exists) {
              return prev.map(j => (j.id === updated.id ? { ...j, ...updated } : j))
            } else {
              return [updated, ...prev]
            }
          })
          if (updated.status === 'completed' && updated.delivery_status === 'pending') {
            toast.info(`New completed delivery order: Job ${updated.job_number}`)
          }
        }
      }
    })
    return unsubscribe
  }, [subscribeToJobs])

  const refreshJobs = async () => {
    setIsRefreshing(true)
    const res = await getDeliveryJobsAction()
    setIsRefreshing(false)
    if (res.success && res.data) {
      setJobs(res.data)
      toast.success('Delivery queue refreshed')
    } else if (res.error) {
      toast.error(res.error)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filtered jobs by search and tab
  const tabCounts = useMemo(() => {
    const pending = jobs.filter(j => (!j.delivery_status || j.delivery_status === 'pending') && j.status !== 'cancelled').length
    const dispatched = jobs.filter(j => j.delivery_status === 'dispatched' && j.status !== 'cancelled').length
    const delivered = jobs.filter(j => j.delivery_status === 'delivered').length
    return { pending, dispatched, delivered, all: jobs.length }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Tab filter
      if (activeTab === 'pending') {
        if (job.delivery_status && job.delivery_status !== 'pending') return false
        if (job.status === 'cancelled') return false
      } else if (activeTab === 'dispatched') {
        if (job.delivery_status !== 'dispatched') return false
        if (job.status === 'cancelled') return false
      } else if (activeTab === 'delivered') {
        if (job.delivery_status !== 'delivered') return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNumber = job.job_number.toLowerCase().includes(q)
        const matchCustomer = job.customer_name.toLowerCase().includes(q)
        const matchPhone = (job.delivery_phone || job.customer_phone || '').includes(q)
        const matchAddress = (job.delivery_address || '').toLowerCase().includes(q)
        const matchRider = (job.delivery_rider_name || '').toLowerCase().includes(q)
        const matchProduct = (job.product_types?.name || '').toLowerCase().includes(q)
        return matchNumber || matchCustomer || matchPhone || matchAddress || matchRider || matchProduct
      }

      return true
    })
  }, [jobs, activeTab, searchQuery])

  // Open dispatch modal
  const handleOpenDispatch = (job: Job) => {
    setDispatchModalJob(job)
    setRiderName(job.delivery_rider_name || '')
    setRiderPhone(job.delivery_rider_phone || '')
    setDispatchNotes('')
  }

  // Submit dispatch
  const handleConfirmDispatch = () => {
    if (!dispatchModalJob) return
    if (!riderName.trim()) {
      toast.error('Please enter Rider or Courier name')
      return
    }
    if (!riderPhone.trim()) {
      toast.error('Please enter Rider phone number')
      return
    }

    startTransition(async () => {
      const res = await dispatchDeliveryJobAction(
        dispatchModalJob.id,
        riderName,
        riderPhone,
        dispatchNotes
      )
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Job ${dispatchModalJob.job_number} dispatched to ${riderName}`)
        setJobs(prev =>
          prev.map(j =>
            j.id === dispatchModalJob.id
              ? {
                  ...j,
                  delivery_status: 'dispatched',
                  delivery_rider_name: riderName.trim(),
                  delivery_rider_phone: riderPhone.trim(),
                  delivery_dispatched_at: new Date().toISOString()
                }
              : j
          )
        )
        setDispatchModalJob(null)
      }
    })
  }

  // Open delivered modal
  const handleOpenDelivered = (job: Job) => {
    setDeliveredModalJob(job)
    setDeliveredNotes('')
  }

  // Submit delivered
  const handleConfirmDelivered = () => {
    if (!deliveredModalJob) return

    startTransition(async () => {
      const res = await markJobDeliveredAction(deliveredModalJob.id, deliveredNotes)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Job ${deliveredModalJob.job_number} marked as Delivered!`)
        setJobs(prev =>
          prev.map(j =>
            j.id === deliveredModalJob.id
              ? {
                  ...j,
                  delivery_status: 'delivered',
                  status: 'picked_up',
                  delivery_delivered_at: new Date().toISOString()
                }
              : j
          )
        )
        setDeliveredModalJob(null)
      }
    })
  }

  // Revert back to pending
  const handleRevertToPending = (jobId: string, jobNumber: string) => {
    if (!confirm(`Reset Job ${jobNumber} dispatch back to pending?`)) return

    startTransition(async () => {
      const res = await revertDeliveryToPendingAction(jobId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Job ${jobNumber} reset to pending dispatch`)
        setJobs(prev =>
          prev.map(j =>
            j.id === jobId
              ? {
                  ...j,
                  delivery_status: 'pending',
                  delivery_rider_name: null,
                  delivery_rider_phone: null,
                  delivery_dispatched_at: null
                }
              : j
          )
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and Quick Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Delivery Dispatch Hub</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage rider dispatches and monitor courier deliveries across Accra.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshJobs}
            disabled={isRefreshing}
            className="flex items-center gap-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Pill Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
            activeTab === 'pending'
              ? 'bg-amber-500/10 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ready for Rider</p>
              <h3 className="text-2xl font-black text-slate-900">{tabCounts.pending}</h3>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
            Awaiting Dispatch
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dispatched')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
            activeTab === 'dispatched'
              ? 'bg-indigo-500/10 border-indigo-300 ring-2 ring-indigo-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Out for Delivery</p>
              <h3 className="text-2xl font-black text-slate-900">{tabCounts.dispatched}</h3>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full">
            In Transit
          </span>
        </button>

        <button
          onClick={() => setActiveTab('delivered')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
            activeTab === 'delivered'
              ? 'bg-emerald-500/10 border-emerald-300 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered</p>
              <h3 className="text-2xl font-black text-slate-900">{tabCounts.delivered}</h3>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            Completed
          </span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ready for Rider ({tabCounts.pending})
          </button>
          <button
            onClick={() => setActiveTab('dispatched')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'dispatched'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Out for Delivery ({tabCounts.dispatched})
          </button>
          <button
            onClick={() => setActiveTab('delivered')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'delivered'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Delivered ({tabCounts.delivered})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Orders ({tabCounts.all})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Job #, customer, address, phone..."
            className="input-standard pl-9 py-2 text-sm bg-white border-slate-200"
          />
        </div>
      </div>

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'pending'
              ? 'No jobs waiting for riders'
              : activeTab === 'dispatched'
              ? 'No packages currently in transit'
              : activeTab === 'delivered'
              ? 'No delivered orders in record'
              : 'No delivery orders found'
          }
          description={
            searchQuery
              ? 'Try modifying your search keywords'
              : activeTab === 'pending'
              ? 'Jobs marked for courier delivery will appear here as soon as printing is complete.'
              : 'All dispatched orders have been delivered or none have been assigned.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredJobs.map((job) => {
              const effectivePhone = job.delivery_phone || job.customer_phone
              const isDispatched = job.delivery_status === 'dispatched'
              const isDelivered = job.delivery_status === 'delivered'
              const isReady = !isDispatched && !isDelivered

              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`h-full flex flex-col border transition-all hover:shadow-md ${
                      isDispatched
                        ? 'border-indigo-200 bg-indigo-50/20'
                        : isDelivered
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : 'border-amber-200 bg-amber-50/20'
                    }`}
                  >
                    <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Top Job Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-bold text-slate-900">
                                {job.job_number}
                              </span>
                              {job.group_id && (
                                <Link
                                  href={`/dashboard/jobs/group/${job.group_id}`}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  title="View full order group"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDateTime(job.updated_at || job.created_at)}
                            </p>
                          </div>

                          {/* Status Pill */}
                          {isDelivered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                            </span>
                          ) : isDispatched ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 animate-pulse">
                              <Truck className="w-3.5 h-3.5" /> Out with Rider
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              <Package className="w-3.5 h-3.5" /> Ready for Rider
                            </span>
                          )}
                        </div>

                        {/* Customer & Destination Card */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm space-y-2.5 mt-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {job.customer_name}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                              {job.source.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Address / Landmark */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-start gap-2 text-xs">
                              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-800">Delivery Address:</p>
                                <p className="text-slate-600 font-medium break-words mt-0.5">
                                  {job.delivery_address || 'No landmark specified'}
                                </p>
                              </div>
                              {job.delivery_address && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(job.delivery_address || '', `addr-${job.id}`)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                  title="Copy address"
                                >
                                  {copiedId === `addr-${job.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Phone Number */}
                          {effectivePhone && (
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="font-mono font-medium">{effectivePhone}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(effectivePhone, `phone-${job.id}`)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                  title="Copy phone"
                                >
                                  {copiedId === `phone-${job.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <a
                                  href={`tel:${effectivePhone}`}
                                  className="px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[11px] font-semibold transition-colors"
                                >
                                  Call
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Order Item Details */}
                        <div className="mt-3 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="flex justify-between text-slate-700">
                            <span className="font-semibold text-slate-900">
                              {job.product_types?.name || 'Custom Item'}
                            </span>
                            <span className="font-bold text-slate-900">
                              Qty: {job.quantity}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>
                              {job.width} × {job.height} {job.dimension_unit}
                            </span>
                            <span className="font-mono font-medium text-slate-700">
                              {formatCurrency(job.line_total)}
                            </span>
                          </div>
                          {job.notes && (
                            <p className="text-[11px] text-amber-800 bg-amber-50/80 p-1.5 rounded mt-1 border border-amber-100 line-clamp-2">
                              Note: {job.notes}
                            </p>
                          )}
                        </div>

                        {/* Rider Information (If Dispatched or Delivered) */}
                        {job.delivery_rider_name && (
                          <div className="mt-3 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1">
                            <div className="flex items-center justify-between text-indigo-950 font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                Rider: {job.delivery_rider_name}
                              </span>
                              {job.delivery_rider_phone && (
                                <a
                                  href={`tel:${job.delivery_rider_phone}`}
                                  className="font-mono text-indigo-700 hover:underline"
                                >
                                  {job.delivery_rider_phone}
                                </a>
                              )}
                            </div>
                            {job.delivery_dispatched_at && (
                              <p className="text-[11px] text-indigo-600">
                                Dispatched: {formatDateTime(job.delivery_dispatched_at)}
                              </p>
                            )}
                            {job.delivery_delivered_at && (
                              <p className="text-[11px] text-emerald-700 font-semibold">
                                Delivered: {formatDateTime(job.delivery_delivered_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100">
                        {isReady && (
                          <Button
                            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold shadow-sm flex items-center justify-center gap-2 h-11"
                            onClick={() => handleOpenDispatch(job)}
                          >
                            <Send className="w-4 h-4" />
                            Dispatch with Rider
                          </Button>
                        )}

                        {isDispatched && (
                          <div className="space-y-2">
                            <Button
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm flex items-center justify-center gap-2 h-11"
                              onClick={() => handleOpenDelivered(job)}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Mark as Delivered
                            </Button>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenDispatch(job)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline p-1"
                              >
                                Edit Rider Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevertToPending(job.id, job.job_number)}
                                className="text-xs text-slate-400 hover:text-red-600 font-medium hover:underline p-1 flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Reset
                              </button>
                            </div>
                          </div>
                        )}

                        {isDelivered && (
                          <div className="text-center py-1">
                            <span className="text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
                              <Check className="w-4 h-4" /> Order Fulfilled &amp; Delivered
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* MODAL 1: Dispatch with Rider */}
      <Dialog open={!!dispatchModalJob} onOpenChange={(open) => !open && setDispatchModalJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <Truck className="w-5 h-5 text-indigo-600" />
              Dispatch Job {dispatchModalJob?.job_number}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Assign a courier or rider to transport this order to {dispatchModalJob?.customer_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Delivery address summary */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                Destination:
              </p>
              <p className="text-amber-800 mt-0.5 font-medium">
                {dispatchModalJob?.delivery_address || 'No landmark specified'}
              </p>
              {(dispatchModalJob?.delivery_phone || dispatchModalJob?.customer_phone) && (
                <p className="text-amber-700 font-mono mt-1">
                  Recipient Phone: {dispatchModalJob?.delivery_phone || dispatchModalJob?.customer_phone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rider / Courier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Samuel K. (Swift Express) or Bolt"
                value={riderName}
                onChange={e => setRiderName(e.target.value)}
                className="input-standard bg-slate-50 text-sm font-medium"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rider Contact Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="024 123 4567"
                value={riderPhone}
                onChange={e => setRiderPhone(e.target.value)}
                className="input-standard bg-slate-50 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Dispatch Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Handed over 2 banner rolls + invoice receipt"
                value={dispatchNotes}
                onChange={e => setDispatchNotes(e.target.value)}
                className="input-standard bg-slate-50 text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDispatchModalJob(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={handleConfirmDispatch}
              disabled={isPending || !riderName.trim() || !riderPhone.trim()}
            >
              {isPending ? 'Dispatching...' : 'Confirm Dispatch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Mark Delivered Confirmation */}
      <Dialog open={!!deliveredModalJob} onOpenChange={(open) => !open && setDeliveredModalJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Confirm Delivery - Job {deliveredModalJob?.job_number}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Confirm that the customer has received their package. This will close the job as fulfilled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
              <p className="font-semibold text-emerald-950">
                Customer: {deliveredModalJob?.customer_name}
              </p>
              {deliveredModalJob?.delivery_rider_name && (
                <p className="text-emerald-800">
                  Delivered via Rider: {deliveredModalJob.delivery_rider_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Delivery Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Received and verified by the customer"
                value={deliveredNotes}
                onChange={e => setDeliveredNotes(e.target.value)}
                className="input-standard bg-slate-50 text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDeliveredModalJob(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={handleConfirmDelivered}
              disabled={isPending}
            >
              {isPending ? 'Confirming...' : 'Yes, Confirm Delivered'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
