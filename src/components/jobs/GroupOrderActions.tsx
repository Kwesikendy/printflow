'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { releaseJobGroupAction, cancelJobGroupAction, deleteJobGroupAction } from '@/app/actions/jobs'
import { toast } from 'sonner'
import { Printer, XCircle, Trash2 } from 'lucide-react'

import type { Role } from '@/types/database'

interface GroupOrderActionsProps {
  groupId: string
  awaitingCount: number
  cancellableCount: number
  hasPayments: boolean
  allJobsCount: number
  role?: Role
}

export function GroupOrderActions({
  groupId,
  awaitingCount,
  cancellableCount,
  hasPayments,
  allJobsCount,
  role
}: GroupOrderActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [released, setReleased] = useState(false)

  const handleRelease = () => {
    startTransition(async () => {
      const res = await releaseJobGroupAction(groupId, 'Manually forwarded to print room')
      if (res.error) {
        toast.error(res.error)
      } else {
        setReleased(true)
        toast.success(`All ${awaitingCount} job${awaitingCount > 1 ? 's' : ''} forwarded to print room!`)
      }
    })
  }

  const handleCancelOrder = () => {
    if (!window.confirm('Are you sure you want to cancel this entire order? All jobs in this order will be cancelled.')) {
      return
    }

    startTransition(async () => {
      toast.loading('Cancelling order...', { id: 'cancel-order' })
      const res = await cancelJobGroupAction(groupId)
      if (res.error) {
        toast.error(res.error, { id: 'cancel-order' })
      } else {
        toast.success('Order cancelled successfully', { id: 'cancel-order' })
        router.refresh()
      }
    })
  }

  const handleDeleteOrder = () => {
    if (!window.confirm('Are you sure you want to permanently delete this order? This will remove all jobs and the invoice record.')) {
      return
    }

    startTransition(async () => {
      toast.loading('Deleting order...', { id: 'delete-order' })
      const res = await deleteJobGroupAction(groupId)
      if (res.error) {
        toast.error(res.error, { id: 'delete-order' })
      } else {
        toast.success('Order deleted successfully', { id: 'delete-order' })
        router.push('/dashboard/jobs')
      }
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {awaitingCount > 0 && !released && (
        <Button
          variant="primary"
          onClick={handleRelease}
          loading={isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Forward All to Print Room ({awaitingCount})
        </Button>
      )}

      {cancellableCount > 0 && (
        <Button
          variant="outline"
          onClick={handleCancelOrder}
          loading={isPending}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-sm font-semibold flex items-center gap-1.5"
          title="Cancel all jobs in this order"
        >
          <XCircle className="w-4 h-4" />
          Cancel Order
        </Button>
      )}

      {role === 'admin' && !hasPayments && cancellableCount === allJobsCount && allJobsCount > 0 && (
        <Button
          variant="ghost"
          onClick={handleDeleteOrder}
          loading={isPending}
          className="text-slate-400 hover:text-red-600 hover:bg-red-50 text-sm font-semibold flex items-center gap-1.5"
          title="Delete mistaken order completely (Admin only)"
        >
          <Trash2 className="w-4 h-4" />
          Delete Order
        </Button>
      )}
    </div>
  )
}
