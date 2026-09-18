'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { recordPaymentAction } from '@/app/actions/jobs'
import { toast } from 'sonner'
import type { Invoice, Payment } from '@/types/database'
import { cn, formatCurrency } from '@/lib/utils'
import { Banknote, Smartphone, MoreHorizontal, CheckCircle2, Clock, Edit3 } from 'lucide-react'

const METHODS = [
  { value: 'cash',  label: 'Cash',         icon: Banknote },
  { value: 'momo',  label: 'Mobile Money', icon: Smartphone },
  { value: 'other', label: 'Other',        icon: MoreHorizontal },
]

interface PaymentFormProps {
  invoice: Invoice
  jobId: string
  payments?: Payment[]
}

export function PaymentForm({ invoice, jobId, payments = [] }: PaymentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')
  const [otherDetails, setOtherDetails] = useState('')
  const [amountStr, setAmountStr] = useState('')

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = invoice.total - totalPaid
  const isPartial = invoice.status === 'partial'
  const displayAmount = amountStr !== '' ? parseFloat(amountStr) : remaining

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = amountStr !== '' ? parseFloat(amountStr) : remaining

    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (amount > remaining) {
      toast.error(`Amount exceeds remaining balance of ${formatCurrency(remaining)}`)
      return
    }

    const formData = new FormData()
    formData.set('invoiceId', invoice.id)
    formData.set('amount', amount.toString())
    formData.set('method', method)
    if (method === 'momo' && reference.trim()) {
      formData.set('reference', reference.trim())
    } else if (method === 'other') {
      const details = otherDetails.trim() || reference.trim()
      if (details) {
        formData.set('reference', details)
        formData.set('notes', details)
      }
    }

    startTransition(async () => {
      const res = await recordPaymentAction(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        const isFullyPaid = amount >= remaining
        toast.success(isFullyPaid ? 'Full payment confirmed!' : `Partial payment of ${formatCurrency(amount)} recorded`)
        setAmountStr('')
        setReference('')
        setOtherDetails('')
      }
    })
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Partial Payment History */}
      {isPartial && payments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">Partial Payment Recorded</p>
          </div>
          <div className="space-y-1.5">
            {payments.map(p => {
              const displayMethod =
                p.method === 'momo'
                  ? 'Mobile Money'
                  : p.method === 'other'
                  ? p.reference || p.notes || 'Other'
                  : 'Cash'
              return (
                <div key={p.id} className="flex justify-between items-center text-sm text-amber-700">
                  <span className="capitalize font-medium">
                    {displayMethod}
                    {p.reference && p.method === 'momo' && (
                      <span className="text-xs text-amber-500 font-normal"> · ID: {p.reference}</span>
                    )}
                  </span>
                  <span className="font-semibold">+{formatCurrency(p.amount)}</span>
                </div>
              )
            })}
            <div className="border-t border-amber-200 pt-2 flex justify-between text-sm font-bold text-amber-800">
              <span>Remaining Balance</span>
              <span className="text-red-600">{formatCurrency(remaining)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
        <h4 className="text-sm font-bold text-slate-900 mb-1">
          {isPartial ? 'Record Further Payment' : 'Record Payment'}
        </h4>
        <p className="text-xs text-slate-500 mb-5">
          {isPartial
            ? <>Outstanding: <span className="font-semibold text-red-600 text-sm">{formatCurrency(remaining)}</span></>
            : <>Amount due: <span className="font-semibold text-emerald-700 text-sm">{formatCurrency(invoice.total)}</span></>
          }
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Amount to Collect (GHS)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              placeholder={remaining.toFixed(2)}
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-xs"
            />
            {amountStr !== '' && displayAmount < remaining && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                This will record a partial payment. Balance after: {formatCurrency(remaining - displayAmount)}
              </p>
            )}
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Payment Method</label>
            <div className="flex gap-2">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer',
                    method === value
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {method === 'momo' && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 transition-all">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                MoMo Transaction ID / Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. 0244123456 or TXN-984210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all shadow-xs"
                autoFocus
              />
            </div>
          )}

          {method === 'other' && (
            <div className="rounded-xl border-2 border-emerald-300 bg-white p-4 shadow-sm space-y-2.5 transition-all">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-emerald-600" />
                  Specify Payment Method & Details
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400 font-medium">Quick fill:</span>
                  {(['Bank Transfer', 'Cheque', 'POS / Card', 'Direct Deposit'] as const).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setOtherDetails(tag)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold transition-colors cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={2}
                value={otherDetails}
                onChange={e => setOtherDetails(e.target.value)}
                placeholder="Type the payment details here (e.g. Bank Transfer via Ecobank, Cheque #00492, POS Card Terminal, etc.)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all resize-none shadow-xs"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                Front desk can specify any custom payment method or transaction notes here.
              </p>
            </div>
          )}

          {/* Full vs Partial buttons */}
          <div className="flex gap-2">
            {amountStr === '' || displayAmount >= remaining ? (
              <Button type="submit" variant="success" className="w-full h-12 text-base font-bold" loading={isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Full Payment ({formatCurrency(remaining)})
              </Button>
            ) : (
              <>
                <Button type="submit" variant="outline" className="flex-1 h-12 font-bold border-amber-400 text-amber-700 hover:bg-amber-50" loading={isPending}>
                  Record Partial ({formatCurrency(displayAmount)})
                </Button>
                <Button
                  type="button"
                  variant="success"
                  className="flex-1 h-12 font-bold"
                  loading={isPending}
                  onClick={() => setAmountStr(remaining.toFixed(2))}
                >
                  Pay in Full
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
