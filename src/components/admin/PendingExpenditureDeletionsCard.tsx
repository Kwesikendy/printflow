'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  approveExpenditureDeletionAction,
  clearExpenditureDeletionRequestAction,
} from '@/app/actions/expenditures'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, XCircle, Receipt } from 'lucide-react'
import Link from 'next/link'

export function PendingExpenditureDeletionsCard({
  initialPending,
}: {
  initialPending: any[]
}) {
  const [items, setItems] = useState(initialPending)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const router = useRouter()

  if (items.length === 0) return null

  const handleApprove = async (item: any) => {
    setProcessingId(item.id)
    try {
      const res = await approveExpenditureDeletionAction(item.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        toast.success(`Approved & deleted expenditure: ${item.description}`)
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve deletion')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (item: any) => {
    setProcessingId(item.id)
    try {
      const res = await clearExpenditureDeletionRequestAction(item.id, true)
      if (res.error) {
        toast.error(res.error)
      } else {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        toast.success(`Rejected deletion request for: ${item.description}`)
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject deletion')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <Card className="border-amber-200 bg-white shadow-xs">
      <CardHeader
        title={`Pending Expenditure Deletion Requests (${items.length})`}
        description="Requested by accounting due to mistakes or duplicate entries"
        action={
          <Link
            href="/dashboard/finance/expenditures"
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1"
          >
            <Receipt className="w-3.5 h-3.5" /> View All Expenditures
          </Link>
        }
      />
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const isBusy = processingId === item.id
            return (
              <div
                key={item.id}
                className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50/30"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-sm">
                      {item.description}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {item.category}
                    </span>
                    <span className="font-mono font-extrabold text-rose-700 text-sm">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      Spent: <strong>{formatDateTime(item.spent_at)}</strong>
                    </span>
                    {item.vendor && (
                      <span>
                        Vendor: <strong>{item.vendor}</strong>
                      </span>
                    )}
                    {item.reference && (
                      <span>
                        Ref: <strong>{item.reference}</strong>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-amber-900 bg-amber-100/70 border border-amber-200/80 rounded-lg px-2.5 py-1.5 inline-block mt-1">
                    <strong>Reason:</strong> &ldquo;{item.deletion_reason || 'No reason provided'}&rdquo;
                    {item.deletion_requested_by_name && (
                      <span className="text-amber-700">
                        {' '}
                        · Requested by {item.deletion_requested_by_name}
                        {item.deletion_requested_at
                          ? ` on ${formatDateTime(item.deletion_requested_at)}`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => handleReject(item)}
                    className="text-xs border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleApprove(item)}
                    className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {isBusy ? 'Processing...' : 'Approve & Delete'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
