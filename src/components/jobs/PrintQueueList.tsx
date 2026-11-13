'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRealtime } from '@/contexts/RealtimeContext'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { transitionJobStatusAction, startJobsWithMaterialAction } from '@/app/actions/jobs'
import { Printer, Play, CheckCircle2, Layers, ExternalLink } from 'lucide-react'
import type { Job } from '@/types/database'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, PRINT_ROOM_LABELS, formatDateTime, isPocketOrFinishingProduct } from '@/lib/utils'
import {
  type MaterialLike,
  calculateJobConsumption,
  parseRollDimensions,
} from '@/lib/material-matching'
import {
  SelectJobMaterialModal,
  type JobMaterialSelection,
} from '@/components/jobs/SelectJobMaterialModal'

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

export function PrintQueueList({
  initialJobs,
  initialMaterials = [],
  initialDeductedJobIds = [],
}: {
  initialJobs: Job[]
  initialMaterials?: MaterialLike[]
  initialDeductedJobIds?: string[]
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [materials, setMaterials] = useState<MaterialLike[]>(initialMaterials)
  const { subscribeToJobs } = useRealtime()

  // Material selection popup state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'start' | 'complete'>('start')
  const [jobsPendingSelection, setJobsPendingSelection] = useState<Job[]>([])
  // Jobs in the same action that need no material pick (extra services / already deducted)
  const [pendingDirectIds, setPendingDirectIds] = useState<string[]>([])
  const [isSubmittingModal, setIsSubmittingModal] = useState(false)
  const [deductedJobIds, setDeductedJobIds] = useState<Set<string>>(new Set(initialDeductedJobIds))

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

  const isExtra = (job?: Job) => isPocketOrFinishingProduct(job?.product_types?.name)

  const openSelection = (mode: 'start' | 'complete', needPick: Job[], direct: Job[] = []) => {
    setModalMode(mode)
    setJobsPendingSelection(needPick)
    setPendingDirectIds(direct.map(j => j.id))
    setModalOpen(true)
  }

  // Start button: always asks the print room which material they are printing on
  const handleStart = async (jobId: string, jobNumber: string) => {
    const target = jobs.find(j => j.id === jobId)
    if (!target) return

    // Pocket / finishing services use no stocked material - start them straight away
    if (isExtra(target) || materials.length === 0) {
      setLoadingJobId(jobId)
      const res = await transitionJobStatusAction(jobId, 'in_production')
      setLoadingJobId(null)
      if (res.error && !res.error.includes('in_production -> in_production')) {
        toast.error(`Could not start job: ${res.error}`)
      } else {
        setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'in_production' } : j)))
        toast.success(`Started job ${jobNumber}`)
      }
      return
    }

    openSelection('start', [target])
  }

  // Start All: pick a material for each printable job; extra services start alongside
  const handleStartGroup = async (group: QueueGroup) => {
    const toStart = group.jobs.filter(j => j.status === 'paid_released')
    if (toStart.length === 0) return

    const printable = toStart.filter(j => !isExtra(j))
    const extras = toStart.filter(j => isExtra(j))

    if (printable.length === 0 || materials.length === 0) {
      setLoadingGroupKey(group.key)
      const results = await Promise.all(toStart.map(j => transitionJobStatusAction(j.id, 'in_production')))
      setLoadingGroupKey(null)
      const failed = results.filter(r => r.error && !r.error.includes('in_production -> in_production'))
      if (failed.length > 0) {
        toast.error(`Failed to start some jobs: ${failed[0].error}`)
      } else {
        setJobs(prev => prev.map(j => (toStart.some(ts => ts.id === j.id) ? { ...j, status: 'in_production' } : j)))
        toast.success(`Started all ${toStart.length} jobs for ${group.customerName}`)
      }
      return
    }

    openSelection('start', printable, extras)
  }

  // Complete: only asks for a material if none was recorded when the job was started
  const handleComplete = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return
    if (isExtra(job) || deductedJobIds.has(job.id) || materials.length === 0) {
      void completeDirectly([job])
      return
    }
    openSelection('complete', [job])
  }

  const handleCompleteGroup = (group: QueueGroup) => {
    const toComplete = group.jobs.filter(j => j.status === 'in_production')
    if (toComplete.length === 0) return
    const needPick = toComplete.filter(j => !isExtra(j) && !deductedJobIds.has(j.id) && materials.length > 0)
    const direct = toComplete.filter(j => !needPick.some(n => n.id === j.id))
    if (needPick.length === 0) {
      void completeDirectly(direct)
      return
    }
    openSelection('complete', needPick, direct)
  }

  const completeDirectly = async (toComplete: Job[]) => {
    const ids = new Set(toComplete.map(j => j.id))
    const originalJobs = [...jobs]
    setJobs(prev => prev.filter(j => !ids.has(j.id)))
    const results = await Promise.all(toComplete.map(j => transitionJobStatusAction(j.id, 'completed')))
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      setJobs(originalJobs)
      toast.error(`Failed to complete job(s): ${failed[0].error}`)
    } else {
      toast.success(toComplete.length === 1 ? `Completed job ${toComplete[0].job_number}` : `Completed ${toComplete.length} jobs`)
    }
  }

  // Reflect the deduction locally so the next selection shows the new stock balance
  const applyLocalDeductions = (selections: JobMaterialSelection[]) => {
    setMaterials(prevMats => {
      const next = [...prevMats]
      for (const sel of selections) {
        if (sel.materialId === 'none') continue
        const job = jobs.find(j => j.id === sel.jobId)
        const idx = next.findIndex(m => m.id === sel.materialId)
        if (!job || idx === -1) continue
        const consumption = calculateJobConsumption(
          job.width,
          job.height,
          job.quantity,
          job.dimension_unit,
          job.product_types?.name
        )
        const rollArea = parseRollDimensions(next[idx]).effectiveAreaPerRollM2
        const rolls = rollArea > 0 ? consumption.totalAreaM2 / rollArea : 0
        next[idx] = { ...next[idx], qty_rolls: Math.max(0, Number(next[idx].qty_rolls || 0) - rolls) }
      }
      return next
    })
    setDeductedJobIds(prev => {
      const next = new Set(prev)
      selections.forEach(s => s.materialId !== 'none' && next.add(s.jobId))
      return next
    })
  }

  const handleConfirmSelection = async (selections: JobMaterialSelection[]) => {
    if (selections.length === 0) return
    setIsSubmittingModal(true)

    if (modalMode === 'start') {
      const { results } = await startJobsWithMaterialAction(
        selections.map(s => ({ jobId: s.jobId, materialId: s.materialId }))
      )
      const extraResults = await Promise.all(
        pendingDirectIds.map(id => transitionJobStatusAction(id, 'in_production'))
      )
      setIsSubmittingModal(false)

      const failed = results.find(r => r.error)
      const extraFailed = extraResults.find(r => r.error && !r.error.includes('in_production -> in_production'))
      const startedIds = new Set([
        ...results.filter(r => !r.error).map(r => r.jobId),
        ...pendingDirectIds,
      ])

      setJobs(prev => prev.map(j => (startedIds.has(j.id) ? { ...j, status: 'in_production' } : j)))
      applyLocalDeductions(selections.filter(s => results.find(r => r.jobId === s.jobId && !r.error)))

      if (failed || extraFailed) {
        toast.error(`Could not start some jobs: ${failed?.error || extraFailed?.error}`)
      } else {
        setModalOpen(false)
        const warning = results.find(r => r.warning)?.warning
        if (warning) toast.warning(warning)
        toast.success(
          selections.length === 1
            ? `Started ${selections[0].jobNumber} & deducted material`
            : `Started ${selections.length} jobs & deducted material`
        )
      }
      return
    }

    // Complete (fallback for jobs started before material selection existed)
    const completingIds = new Set([...selections.map(s => s.jobId), ...pendingDirectIds])
    const originalJobs = [...jobs]
    setJobs(prev => prev.filter(j => !completingIds.has(j.id)))

    const results = await Promise.all([
      ...selections.map(sel =>
        transitionJobStatusAction(sel.jobId, 'completed', undefined, undefined, undefined, sel.materialId)
      ),
      ...pendingDirectIds.map(id => transitionJobStatusAction(id, 'completed')),
    ])

    setIsSubmittingModal(false)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      setJobs(originalJobs)
      toast.error(`Failed to complete job(s): ${failed[0].error}`)
    } else {
      applyLocalDeductions(selections)
      setModalOpen(false)
      toast.success(
        completingIds.size === 1
          ? `Completed job ${selections[0].jobNumber} & updated inventory`
          : `Completed ${completingIds.size} jobs & updated inventory`
      )
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
            <div
              key={group.key}
              className="w-full"
            >
              <Card className="overflow-hidden bg-white border border-slate-200/90 shadow-xs">
                <CardContent className="p-5 sm:p-6">

                  {/* ORDER / GROUP HEADER */}
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight font-heading">
                          {group.customerName}
                        </h3>

                        {isMulti && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
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
                        className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                        title="Print single consolidated job ticket on 80mm roll"
                      >
                        <Printer className="w-4 h-4 text-slate-600" />
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
                          className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900 font-semibold px-2 py-1"
                        >
                          View Order <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* ITEMS LIST (FLATTENED DIVIDER ROWS - NO CARDS INSIDE CARDS) */}
                  <div className="divide-y divide-slate-100">
                    {group.jobs.map((job, idx) => {
                      const consumption = calculateJobConsumption(
                        job.width,
                        job.height,
                        job.quantity,
                        job.dimension_unit,
                        job.product_types?.name
                      )

                      return (
                        <div
                          key={job.id}
                          className={cn(
                            "py-3.5 px-2 flex flex-col md:flex-row gap-4 justify-between md:items-center transition-colors rounded-lg",
                            job.status === 'in_production'
                              ? 'bg-amber-50/30'
                              : 'hover:bg-slate-50/50'
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              {isMulti && (
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200">
                                  {idx + 1}
                                </span>
                              )}
                              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {job.job_number}
                              </span>
                              <span className="font-bold text-sm text-slate-900">
                                {job.product_types?.name || 'Item'}
                              </span>
                              {isPocketOrFinishingProduct(job.product_types?.name) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Extra Service (Invoiced)
                                </span>
                              )}
                              <StatusBadge status={job.status} />

                              {job.status === 'in_production' && deductedJobIds.has(job.id) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                                  Material recorded
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 mt-2">
                              <div>
                                <span className="text-slate-400 block font-medium">Dimensions</span>
                                <span className="font-semibold text-slate-900 font-mono tabular-nums">
                                  {job.width} × {job.height} {job.dimension_unit || 'cm'}{' '}
                                  <span className="text-slate-400 font-normal">
                                    ({consumption.widthFt}ft × {consumption.heightFt}ft)
                                  </span>
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-medium">Quantity</span>
                                <span className="font-semibold text-slate-900 font-mono tabular-nums">{job.quantity}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-medium">Media Area (m²)</span>
                                <span className="font-semibold text-slate-900 font-mono tabular-nums">
                                  {consumption.totalAreaM2.toFixed(2)} m²
                                </span>
                              </div>
                              {job.print_room && (
                                <div>
                                  <span className="text-slate-400 block font-medium">Room</span>
                                  <span className="font-semibold text-slate-900">{PRINT_ROOM_LABELS[job.print_room] || job.print_room}</span>
                                </div>
                              )}
                            </div>

                            {job.notes && (
                              <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 italic">
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
                                onClick={() => handleComplete(job.id)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                </CardContent>
              </Card>
            </div>
          )
        })}
      </AnimatePresence>

      <SelectJobMaterialModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        jobs={jobsPendingSelection}
        materials={materials}
        isSubmitting={isSubmittingModal}
        onConfirm={handleConfirmSelection}
      />
    </div>
  )
}

