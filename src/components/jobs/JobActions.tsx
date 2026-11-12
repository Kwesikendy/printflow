'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { transitionJobStatusAction, startJobsWithMaterialAction } from '@/app/actions/jobs'
import { getAllowedTransitions, JOB_STATUS_LABELS, isPocketOrFinishingProduct } from '@/lib/utils'
import type { Job, JobStatus, Role } from '@/types/database'
import type { MaterialLike } from '@/lib/material-matching'
import {
  SelectJobMaterialModal,
  type JobMaterialSelection,
} from '@/components/jobs/SelectJobMaterialModal'
import { toast } from 'sonner'

const BUTTON_LABELS: Partial<Record<JobStatus, string>> = {
  in_production: 'Mark as In Production',
  completed:     'Mark as Completed',
  picked_up:     'Mark as Picked Up',
  quoted:        'Send Quote',
  awaiting_payment: 'Mark as Awaiting Payment',
  paid_released: 'Forward to Print Room',
  cancelled:     'Cancel Job',
}

export function JobActions({
  job,
  role,
  hasPaymentOverride,
  materials = [],
  materialDeducted = false,
}: {
  job: Job
  role?: Role
  hasPaymentOverride?: boolean
  materials?: MaterialLike[]
  /** True when a material deduction was already recorded for this job */
  materialDeducted?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<JobStatus>(job.status)
  const [materialModalMode, setMaterialModalMode] = useState<'start' | 'complete' | null>(null)
  const [deducted, setDeducted] = useState(materialDeducted)

  // Pocket / finishing extras never use stocked material
  const needsMaterial =
    materials.length > 0 && !isPocketOrFinishingProduct((job as any)?.product_types?.name)

  if (!role) return null

  let allowedTransitions = getAllowedTransitions(optimisticStatus, role)

  // Determine if payment has been made
  let hasPayment = hasPaymentOverride
  if (hasPayment === undefined) {
    const invoiceRaw = (job as any).invoices
    const invoice = Array.isArray(invoiceRaw) ? invoiceRaw[0] : invoiceRaw
    const payments = invoice?.payments || []
    hasPayment = payments.length > 0 || invoice?.status === 'paid'
  }

  // Only allow 'paid_released' (Forward to Print Room) if a payment has been made
  if (!hasPayment) {
    allowedTransitions = allowedTransitions.filter(t => t !== 'paid_released')
  }

  if (allowedTransitions.length === 0) return null

  const handleTransition = (toStatus: JobStatus, materialIdOverride?: string | null) => {
    // Prevent double-clicking
    if (isPending) {
      toast.info('Please wait, the previous action is still in progress.')
      return
    }

    // If they click a transition that is no longer valid (e.g., already transitioned)
    if (!getAllowedTransitions(optimisticStatus, role).includes(toStatus)) {
      toast.error(`This job is already "${JOB_STATUS_LABELS[optimisticStatus]}". You cannot perform that action again.`)
      return
    }

    startTransition(async () => {
      // Optimistically update the UI immediately so the button changes right away
      setOptimisticStatus(toStatus)

      const res = await transitionJobStatusAction(
        job.id,
        toStatus,
        undefined,
        undefined,
        undefined,
        materialIdOverride
      )
      if (res.error) {
        // Revert the optimistic update if it failed
        setOptimisticStatus(job.status)

        // Handle the specific case where the job is already in the target state
        if (res.error.includes('Invalid transition:') && res.error.includes(`${toStatus} -> ${toStatus}`)) {
          toast.info(`This job is already marked as ${JOB_STATUS_LABELS[toStatus]}.`)
        } else {
          toast.error(`Could not update job status: ${res.error}`)
        }
      } else {
        setMaterialModalMode(null)
        toast.success(
          toStatus === 'paid_released'
            ? 'Job forwarded to print room!'
            : toStatus === 'completed'
            ? 'Job marked as Completed!'
            : `Job marked as "${JOB_STATUS_LABELS[toStatus]}"`
        )
      }
    })
  }

  const handleConfirmMaterial = (selections: JobMaterialSelection[]) => {
    const sel = selections[0]
    if (!sel) return

    if (materialModalMode === 'start') {
      if (isPending) return
      startTransition(async () => {
        setOptimisticStatus('in_production')
        const { results } = await startJobsWithMaterialAction([
          { jobId: job.id, materialId: sel.materialId },
        ])
        const r = results[0]
        if (r?.error) {
          setOptimisticStatus(job.status)
          toast.error(`Could not start job: ${r.error}`)
          return
        }
        if (sel.materialId !== 'none') setDeducted(true)
        setMaterialModalMode(null)
        if (r?.warning) toast.warning(r.warning)
        toast.success('Job started & material deducted from inventory!')
      })
      return
    }

    // Fallback for jobs started before material selection existed
    handleTransition('completed', sel.materialId)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {allowedTransitions.map((status) => {
          if (status === 'cancelled') {
            return (
              <Button
                key={status}
                variant="danger"
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this job? This cannot be undone.')) {
                    handleTransition(status)
                  }
                }}
                loading={isPending}
              >
                Cancel Job
              </Button>
            )
          }

          // Starting production: print room picks the material (popup)
          if (status === 'in_production' && needsMaterial) {
            return (
              <Button
                key={status}
                variant="primary"
                onClick={() => setMaterialModalMode('start')}
                loading={isPending}
              >
                {BUTTON_LABELS[status] ?? `Mark as ${JOB_STATUS_LABELS[status]}`}
              </Button>
            )
          }

          // Completing a job that never had a material recorded: ask now
          if (status === 'completed' && needsMaterial && !deducted) {
            return (
              <Button
                key={status}
                variant="primary"
                onClick={() => setMaterialModalMode('complete')}
                loading={isPending}
              >
                {BUTTON_LABELS[status] ?? `Mark as ${JOB_STATUS_LABELS[status]}`}
              </Button>
            )
          }

          return (
            <Button
              key={status}
              variant="primary"
              onClick={() => handleTransition(status)}
              loading={isPending}
            >
              {BUTTON_LABELS[status] ?? `Mark as ${JOB_STATUS_LABELS[status]}`}
            </Button>
          )
        })}
      </div>

      <SelectJobMaterialModal
        open={materialModalMode !== null}
        onOpenChange={open => {
          if (!open) setMaterialModalMode(null)
        }}
        mode={materialModalMode ?? 'start'}
        jobs={[job]}
        materials={materials}
        isSubmitting={isPending}
        onConfirm={handleConfirmMaterial}
      />
    </>
  )
}
