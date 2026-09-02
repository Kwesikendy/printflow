'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { recordPaymentAction } from '@/app/actions/jobs'
import { toast } from 'sonner'
import type { Invoice } from '@/types/database'
import { cn } from '@/lib/utils'
import { Banknote, Smartphone, MoreHorizontal } from 'lucide-react'

const METHODS = [
  { value: 'cash',  label: 'Cash',          icon: Banknote },
  { value: 'momo',  label: 'Mobile Money',  icon: Smartphone },
  { value: 'other', label: 'Other',         icon: MoreHorizontal },
]

export function PaymentForm({ invoice, jobId }: { invoice: Invoice, jobId: string }) {
  const [isPending, startTransition] = useTransition()
  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set('invoiceId', invoice.id)
    formData.set('amount', invoice.total.toString())
    formData.set('method', method)
    if (reference) formData.set('reference', reference)

    startTransition(async () => {
      const res = await recordPaymentAction(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Payment marked as received')
      }
    })
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 mt-4">
      <h4 className="text-sm font-bold text-slate-900 mb-1">Record Payment</h4>
      <p className="text-xs text-slate-500 mb-5">Amount due: <span className="font-semibold text-emerald-700 text-sm">₵{invoice.total.toFixed(2)}</span></p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Method pill buttons */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Payment Method</label>
          <div className="flex gap-2">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all",
                  method === value
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Reference — only prominent for MoMo */}
        {method === 'momo' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">MoMo Transaction ID</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. 1234567890"
              className="input-standard w-full"
            />
          </div>
        )}
        {method === 'other' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Note</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Optional"
              className="input-standard w-full"
            />
          </div>
        )}

        <Button type="submit" variant="success" className="w-full h-12 text-base font-bold" loading={isPending}>
          ✓ Confirm Payment of ₵{invoice.total.toFixed(2)}
        </Button>
      </form>
    </div>
  )
}
