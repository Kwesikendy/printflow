'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { recordPaymentAction, roundInvoiceTotalAction, editPaymentMethodAction } from '@/app/actions/jobs'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Invoice, Payment } from '@/types/database'
import { cn, formatCurrency } from '@/lib/utils'
import { Banknote, Smartphone, MoreHorizontal, CheckCircle2, Clock, Edit3, X, Edit } from 'lucide-react'

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

function EditPaymentModal({ payment }: { payment: Payment }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  const [method, setMethod] = useState<string>(payment.method || 'cash')
  const [reference, setReference] = useState(payment.reference || payment.notes || '')

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await editPaymentMethodAction(payment.id, method, reference)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Payment updated')
        setIsOpen(false)
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Edit Payment">
        <Edit className="w-3.5 h-3.5" />
      </button>
      
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">Edit Payment Method</h3>
                  <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700 p-1"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Method</label>
                    <div className="flex gap-2">
                      {METHODS.map(m => (
                        <button
                          key={m.value} type="button" onClick={() => setMethod(m.value)}
                          className={cn('flex-1 py-2 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1', method === m.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600')}
                        >
                          <m.icon className="w-4 h-4" />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(method === 'momo' || method === 'other') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reference / Notes</label>
                      <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}
                  <Button type="submit" loading={isPending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg py-2">
                    Save Changes
                  </Button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>, document.body
      )}
    </>
  )
}

export function PaymentForm({ invoice, jobId, payments = [] }: PaymentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isRounding, startRounding] = useTransition()
  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')
  const [otherDetails, setOtherDetails] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [releaseToPrintRoom, setReleaseToPrintRoom] = useState(true)

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
    if (releaseToPrintRoom) {
      formData.set('releaseToPrintRoom', 'true')
    }
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
        if (isFullyPaid) {
          toast.success('Full payment confirmed! Jobs released to print room.')
        } else if (releaseToPrintRoom) {
          toast.success(`Partial payment of ${formatCurrency(amount)} recorded & forwarded to print room!`)
        } else {
          toast.success(`Partial payment of ${formatCurrency(amount)} recorded`)
        }
        setAmountStr('')
        setReference('')
        setOtherDetails('')
      }
    })
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Partial Payment History */}
      {payments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">Payment History</p>
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
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-amber-700">+{formatCurrency(p.amount)}</span>
                    <EditPaymentModal payment={p} />
                  </div>
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

          {/* Release to Print Room toggle for partial payments */}
          {displayAmount < remaining && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 transition-all">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={releaseToPrintRoom}
                  onChange={e => setReleaseToPrintRoom(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Forward job(s) to print room now
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Allows the print room to start production immediately even with a partial balance remaining.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Full vs Partial buttons */}
          <div className="flex gap-2">
            {amountStr === '' || displayAmount >= remaining ? (
              <div className="flex gap-2 w-full">
                <Button type="submit" variant="success" className="flex-1 h-12 text-base font-bold" loading={isPending}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm Full Payment ({formatCurrency(remaining)})
                </Button>
                {remaining % 1 !== 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 px-4 border-slate-300 hover:bg-slate-50 font-bold whitespace-nowrap"
                    loading={isRounding}
                    onClick={() => {
                      startRounding(async () => {
                        const res = await roundInvoiceTotalAction(invoice.id)
                        if (res.error) toast.error(res.error)
                        else toast.success('Total rounded to ' + formatCurrency(Math.round(invoice.total)))
                      })
                    }}
                    title="Round total to whole number"
                  >
                    Round ({formatCurrency(Math.round(remaining))})
                  </Button>
                )}
              </div>
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
