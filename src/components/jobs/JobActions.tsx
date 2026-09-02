'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { transitionJobStatusAction } from '@/app/actions/jobs'
import { getAllowedTransitions, JOB_STATUS_LABELS } from '@/lib/utils'
import type { Job, JobStatus, Role } from '@/types/database'
import { toast } from 'sonner'

export function JobActions({ job, role }: { job: Job, role?: Role }) {
  const [isPending, startTransition] = useTransition()
  
  if (!role) return null

  const allowedTransitions = getAllowedTransitions(job.status, role)
  
  if (allowedTransitions.length === 0) return null

  const handleTransition = (toStatus: JobStatus) => {
    startTransition(async () => {
      const res = await transitionJobStatusAction(job.id, toStatus)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Job marked as ${JOB_STATUS_LABELS[toStatus]}`)
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
                if (window.confirm('Are you sure you want to cancel this job?')) {
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
            Mark as {JOB_STATUS_LABELS[status]}
          </Button>
        )
      })}
    </div>
  )
}
