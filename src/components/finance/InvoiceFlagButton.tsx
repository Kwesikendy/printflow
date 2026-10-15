'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { setInvoiceFlagAction } from '@/app/actions/invoices'

export function InvoiceFlagButton({ invoice }: { invoice: any }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(invoice.flag_reason || '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isFlagged = Boolean(invoice.is_flagged)

  const save = (flagged: boolean) => {
    if (flagged && !reason.trim()) {
      toast.error('Add a short reason so the invoice can be corrected later.')
      return
    }
    startTransition(async () => {
      const result = await setInvoiceFlagAction(invoice.id, flagged, reason)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(flagged ? 'Invoice flagged and removed from default reports.' : 'Invoice restored to reports.')
      setOpen(false)
      invoice.is_flagged = flagged
      invoice.flag_reason = flagged ? reason.trim() : null
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(value => !value)}
        className={isFlagged ? 'text-rose-700 hover:bg-rose-50 text-xs font-semibold px-2 py-1' : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold px-2 py-1'}
        title={isFlagged ? 'Review or restore flagged invoice' : 'Flag invoice as incorrect'}
      >
        <Flag className="w-3.5 h-3.5 mr-1" /> {isFlagged ? 'Flagged' : 'Flag'}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-900">{isFlagged ? 'Invoice review' : 'Flag invoice'}</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Close invoice flag form">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {isFlagged ? (
            <>
              <p className="text-[11px] text-rose-700 bg-rose-50 rounded-lg p-2 mb-3">{invoice.flag_reason || 'Marked for review.'}</p>
              <Button type="button" size="sm" onClick={() => save(false)} disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null} Restore to reports
              </Button>
            </>
          ) : (
            <>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor={`flag-reason-${invoice.id}`}>Reason</label>
              <textarea
                id={`flag-reason-${invoice.id}`}
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Wrong customer or duplicated invoice"
                className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-800 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
              <Button type="button" size="sm" onClick={() => save(true)} disabled={isPending} className="mt-2 w-full bg-rose-600 hover:bg-rose-700 text-white text-xs">
                {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Flag className="w-3.5 h-3.5 mr-1" />} Flag & hide from reports
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
