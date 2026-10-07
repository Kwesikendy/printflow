'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRealtime } from '@/contexts/RealtimeContext'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { transitionJobStatusAction } from '@/app/actions/jobs'
import { Printer, Play, CheckCircle2, Layers, ExternalLink, FileText } from 'lucide-react'
import type { Job } from '@/types/database'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, PRINT_ROOM_LABELS, formatDateTime } from '@/lib/utils'

interface QueueGroup {
  key: string
  groupId: string | null
  customerName: string
  customerPhone?: string | null
  printRoom?: string | null
  jobs: Job[]
  hasInProduction: boolean
  allInProduction: boolean
  oldestCreatedAt: string
  latestUpdatedAt: string
}

export function PrintQueueList({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const { subscribeToJobs } = useRealtime()

  useEffect(() => {
    const unsubscribe = subscribeToJobs((payload) => {
      const newJob = payload.new
      
      if (payload.eventType === 'INSERT') {
        if (['paid_released', 'in_production'].includes(newJob.status)) {
          setJobs(prev => [...prev, newJob])
        }
      } else if (payload.eventType === 'UPDATE') {
        if (['paid_released', 'in_production'].includes(newJob.status)) {
          setJobs(prev => {
            const exists = prev.some(j => j.id === newJob.id)
            if (exists) {
              return prev.map(j => j.id === newJob.id ? { ...j, ...newJob } : j)
            }
            return [...prev, newJob]
          })
          if (newJob.status === 'paid_released' && payload.old.status === 'awaiting_payment') {
            toast.success(`New job ${newJob.job_number} released to queue!`)
          }
        } else {
          // It transitioned OUT of the queue (e.g. to completed)
          setJobs(prev => prev.filter(j => j.id !== newJob.id))
        }
      }
    })
    
    return unsubscribe
  }, [subscribeToJobs])

  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)
  const [loadingGroupKey, setLoadingGroupKey] = useState<string | null>(null)

  const handleStart = async (jobId: string, jobNumber: string) => {
    // Optimistically update UI
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'in_production' } : j))
    setLoadingJobId(jobId)
    
    const res = await transitionJobStatusAction(jobId, 'in_production')
    setLoadingJobId(null)
    
    if (res.error) {
      // Revert optimistic update on failure
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'paid_released' } : j))
      
      if (res.error.includes('in_production -> in_production')) {
        toast.info(`Job ${jobNumber} is already in production.`)
      } else {
        toast.error(`Could not start job: ${res.error}`)
      }
    } else {
      toast.success(`Started job ${jobNumber}`)
    }
  }

  const handleComplete = async (jobId: string, jobNumber: string) => {
    // Store original just in case we need to revert
    const originalJob = jobs.find(j => j.id === jobId)
    // Optimistically remove from queue
    setJobs(prev => prev.filter(j => j.id !== jobId))
    setLoadingJobId(jobId)
    
    const res = await transitionJobStatusAction(jobId, 'completed')
    setLoadingJobId(null)
    
    if (res.error) {
      // Revert optimistic update
      if (originalJob) {
        setJobs(prev => [...prev, originalJob])
      }
      
      if (res.error.includes('completed -> completed')) {
        toast.info(`Job ${jobNumber} is already completed.`)
      } else {
        toast.error(`Could not complete job: ${res.error}`)
      }
    } else {
      toast.success(`Completed job ${jobNumber}`)
    }
  }

  const handleStartGroup = async (group: QueueGroup) => {
    const toStart = group.jobs.filter(j => j.status === 'paid_released')
    if (toStart.length === 0) return

    setLoadingGroupKey(group.key)
    setJobs(prev => prev.map(j => toStart.some(ts => ts.id === j.id) ? { ...j, status: 'in_production' } : j))

    const results = await Promise.all(
      toStart.map(j => transitionJobStatusAction(j.id, 'in_production'))
    )
    setLoadingGroupKey(null)

    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      toast.error(`Failed to start some jobs: ${failed[0].error}`)
    } else {
      toast.success(`Started all ${toStart.length} jobs for ${group.customerName}`)
    }
  }

  const handleCompleteGroup = async (group: QueueGroup) => {
    const toComplete = group.jobs.filter(j => j.status === 'in_production')
    if (toComplete.length === 0) return

    setLoadingGroupKey(group.key)
    setJobs(prev => prev.filter(j => !toComplete.some(tc => tc.id === j.id)))

    const results = await Promise.all(
      toComplete.map(j => transitionJobStatusAction(j.id, 'completed'))
    )
    setLoadingGroupKey(null)

    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      toast.error(`Failed to complete some jobs: ${failed[0].error}`)
    } else {
      toast.success(`Completed all ${toComplete.length} jobs for ${group.customerName}`)
    }
  }

  // Group jobs by group_id (for multi-job orders) or by job id for single jobs
  const queueGroups = useMemo(() => {
    const groupsMap = new Map<string, QueueGroup>()

    for (const job of jobs) {
      const key = job.group_id ? `group_${job.group_id}` : `job_${job.id}`

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          groupId: job.group_id || null,
          customerName: job.customer_name,
          customerPhone: job.customer_phone,
          printRoom: job.print_room,
          jobs: [],
          hasInProduction: false,
          allInProduction: true,
          oldestCreatedAt: job.created_at,
          latestUpdatedAt: job.updated_at,
        })
      }

      const grp = groupsMap.get(key)!
      grp.jobs.push(job)

      if (job.status === 'in_production') {
        grp.hasInProduction = true
      } else {
        grp.allInProduction = false
      }

      if (new Date(job.created_at).getTime() < new Date(grp.oldestCreatedAt).getTime()) {
        grp.oldestCreatedAt = job.created_at
      }
      if (new Date(job.updated_at).getTime() > new Date(grp.latestUpdatedAt).getTime()) {
        grp.latestUpdatedAt = job.updated_at
      }
    }

    // Sort:
    // 1. Groups with in_production jobs first
    // 2. Then by oldest created_at (FIFO)
    return Array.from(groupsMap.values()).sort((a, b) => {
      if (a.hasInProduction && !b.hasInProduction) return -1
      if (!a.hasInProduction && b.hasInProduction) return 1
      return new Date(a.oldestCreatedAt).getTime() - new Date(b.oldestCreatedAt).getTime()
    })
  }, [jobs])

  if (queueGroups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Printer />}
          title="Queue is empty"
          description="There are no jobs currently waiting for production."
        />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <AnimatePresence mode="popLayout">
        {queueGroups.map(group => {
          const isMulti = group.jobs.length > 1
          const printCardUrl = group.groupId
            ? `/print/job-card/group/${group.groupId}${group.printRoom ? `?room=${group.printRoom}` : ''}`
            : `/print/job-card/${group.jobs[0].id}`

          const readyToStartCount = group.jobs.filter(j => j.status === 'paid_released').length
          const inProdCount = group.jobs.filter(j => j.status === 'in_production').length

          return (
            <motion.div
              key={group.key}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full"
            >
              <Card className={cn(
                "overflow-hidden transition-colors border-l-4",
                group.hasInProduction ? 'border-l-indigo-500 bg-white' : 'border-l-slate-300 bg-white'
              )}>
                <CardContent className="p-6">

                  {/* ORDER / GROUP HEADER */}
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          {group.customerName}
                        </h3>

                        {isMulti && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/80 shadow-xs">
                            <Layers className="w-3.5 h-3.5" />
                            Multi-Job Order ({group.jobs.length} items)
                          </span>
                        )}

                        <StatusBadge status={group.hasInProduction ? 'in_production' : 'paid_released'} />

                        {group.printRoom && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200">
                            {PRINT_ROOM_LABELS[group.printRoom] || group.printRoom}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                        {group.customerPhone && (
                          <span>Phone: <strong className="text-slate-700 font-semibold">{group.customerPhone}</strong></span>
                        )}
                        <span>Received: {formatDateTime(group.oldestCreatedAt)}</span>
                      </div>
                    </div>

                    {/* TOP ACTION BUTTONS: PRINT JOB CARD & BATCH ACTIONS */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* SINGLE PRINT JOB CARD BUTTON FOR THE WHOLE ORDER */}
                      <a
                        href={printCardUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-800 border-2 border-slate-300 hover:border-slate-800 hover:bg-slate-50 shadow-sm transition-all"
                        title="Print single consolidated job ticket on 80mm roll"
                      >
                        <Printer className="w-4 h-4 text-slate-700" />
                        Print Job Card {isMulti ? '(All Items)' : ''}
                      </a>

                      {/* BATCH START ALL */}
                      {isMulti && readyToStartCount > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={loadingGroupKey === group.key}
                          onClick={() => handleStartGroup(group)}
                          className="text-xs"
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Start All ({readyToStartCount})
                        </Button>
                      )}

                      {/* BATCH COMPLETE ALL */}
                      {isMulti && inProdCount > 0 && (
                        <Button
                          variant="success"
                          size="sm"
                          loading={loadingGroupKey === group.key}
                          onClick={() => handleCompleteGroup(group)}
                          className="text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Complete All ({inProdCount})
                        </Button>
                      )}

                      {/* VIEW ORDER PAGE */}
                      {group.groupId && (
                        <Link
                          href={`/dashboard/jobs/group/${group.groupId}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1"
                        >
                          View Order <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* ITEMS LIST */}
                  <div className="mt-4 space-y-3">
                    {group.jobs.map((job, idx) => (
                      <div
                        key={job.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all flex flex-col md:flex-row gap-4 justify-between md:items-center",
                          job.status === 'in_production'
                            ? 'bg-indigo-50/40 border-indigo-100 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200/70 hover:bg-white'
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            {isMulti && (
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                            )}
                            <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {job.job_number}
                            </span>
                            <span className="font-bold text-sm text-slate-900">
                              {job.product_types?.name || 'Item'}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 mt-2">
                            <div>
                              <span className="text-slate-400 block font-medium">Dimensions</span>
                              <span className="font-semibold text-slate-900">{job.width} × {job.height} {job.dimension_unit || 'cm'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Quantity</span>
                              <span className="font-semibold text-slate-900">{job.quantity}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Total Area</span>
                              <span className="font-semibold text-slate-900">{job.area}</span>
                            </div>
                            {job.print_room && (
                              <div>
                                <span className="text-slate-400 block font-medium">Room</span>
                                <span className="font-semibold text-slate-900">{PRINT_ROOM_LABELS[job.print_room] || job.print_room}</span>
                              </div>
                            )}
                          </div>

                          {job.notes && (
                            <div className="mt-2 text-xs text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/60 italic">
                              <strong>Note:</strong> {job.notes}
                            </div>
                          )}
                        </div>

                        {/* ITEM ACTIONS */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <Link
                            href={`/dashboard/jobs/${job.id}`}
                            className="btn btn-outline border-slate-200 text-slate-700 hover:bg-slate-100 text-xs px-3 py-1.5"
                          >
                            Details
                          </Link>

                          {job.status === 'paid_released' && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="text-xs"
                              loading={loadingJobId === job.id}
                              onClick={() => handleStart(job.id, job.job_number)}
                            >
                              <Play className="w-3.5 h-3.5 mr-1" /> Start
                            </Button>
                          )}

                          {job.status === 'in_production' && (
                            <Button
                              variant="success"
                              size="sm"
                              className="text-xs"
                              loading={loadingJobId === job.id}
                              onClick={() => handleComplete(job.id, job.job_number)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
