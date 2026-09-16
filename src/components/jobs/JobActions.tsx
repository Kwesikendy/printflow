'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { Button } from '@/components/ui/Button'
import { transitionJobStatusAction } from '@/app/actions/jobs'
import { getAllowedTransitions, JOB_STATUS_LABELS } from '@/lib/utils'
import type { Job, JobStatus, Role } from '@/types/database'
import { toast } from 'sonner'

const BUTTON_LABELS: Partial<Record<JobStatus, string>> = {
  in_production: 'Mark as In Production',
  completed:     'Mark as Completed',
  picked_up:     'Mark as Picked Up',
  quoted:        'Send Quote',
  awaiting_payment: 'Mark as Awaiting Payment',
  paid_released: 'Mark as Paid & Released',
  cancelled:     'Cancel Job',
}

export function JobActions({ job, role }: { job: Job, role?: Role }) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<JobStatus>(job.status)

  if (!role) return null

  const allowedTransitions = getAllowedTransitions(optimisticStatus, role)

  if (allowedTransitions.length === 0) return null

  const handleTransition = (toStatus: JobStatus) => {
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

      const res = await transitionJobStatusAction(job.id, toStatus)
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
        toast.success(`Job marked as "${JOB_STATUS_LABELS[toStatus]}"`)
      }
    })
  }

  return (
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
  )
}
