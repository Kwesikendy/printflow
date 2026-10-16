'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { X, CheckCircle2, Banknote, Smartphone, MoreHorizontal, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { recordPaymentAction } from '@/app/actions/jobs'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import Link from 'next/link'

interface RecordPaymentModalProps {
  invoice: any
  balance: number
  customerName: string
  payUrl: string
}

const METHODS = [
  { value: 'cash',  label: 'Cash',         icon: Banknote },
  { value: 'momo',  label: 'Mobile Money', icon: Smartphone },
  { value: 'other', label: 'Other',        icon: MoreHorizontal },
]

export function RecordPaymentModal({
  invoice,
  balance,
  customerName,
  payUrl
}: RecordPaymentModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')
  const [amountStr, setAmountStr] = useState(balance.toFixed(2))
  const [releaseToPrintRoom, setReleaseToPrintRoom] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setAmountStr(balance.toFixed(2))
      setReference('')
      setMethod('cash')
      setReleaseToPrintRoom(true)
    }
  }, [isOpen, balance])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(amountStr)

    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    if (amount > balance) {
      toast.error(`Amount cannot exceed remaining balance of ${formatCurrency(balance)}`)
      return
    }

    const formData = new FormData()
    formData.set('invoiceId', invoice.id)
    formData.set('amount', amount.toString())
    formData.set('method', method)
    if (releaseToPrintRoom) {
      formData.set('releaseToPrintRoom', 'true')
    }
    if (reference.trim()) {
      formData.set('reference', reference.trim())
      formData.set('notes', reference.trim())
    }

    startTransition(async () => {
      const res = await recordPaymentAction(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        const isFull = amount >= balance
        toast.success(
          isFull
            ? `Payment of ${formatCurrency(amount)} cleared! Invoice marked as paid.`
            : `Partial payment of ${formatCurrency(amount)} recorded.`
        )
        setIsOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-xs font-bold px-2.5 py-1 border border-emerald-200 shadow-sm"
        title="Clear / Record Payment"
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
        Pay
      </Button>

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Clear Payment</h3>
                    <p className="text-xs text-slate-500 font-medium">{invoice.invoice_number} · {customerName}</p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  {/* Summary Card */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Invoice Total</p>
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(invoice.total)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-medium">Balance Due</p>
                      <p className="text-base font-black text-amber-600">{formatCurrency(balance)}</p>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {METHODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMethod(m.value)}
                          className={cn(
                            'py-2.5 px-2 text-xs font-bold rounded-xl border flex flex-col items-center gap-1.5 transition-all',
                            method === m.value
                              ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-600'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          )}
                        >
                          <m.icon className="w-4 h-4" />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount to Record */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Amount to Clear (₵)
                      </label>
                      {parseFloat(amountStr) !== balance && (
                        <button
                          type="button"
                          onClick={() => setAmountStr(balance.toFixed(2))}
                          className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        >
                          Pay Full Balance ({formatCurrency(balance)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={balance}
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Reference or Transaction ID */}
                  {(method === 'momo' || method === 'other') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {method === 'momo' ? 'Momo Reference / Transaction ID' : 'Reference / Notes'}
                      </label>
                      <input
                        type="text"
                        placeholder={method === 'momo' ? 'e.g. 289410985' : 'e.g. Check / Cheque No. or Bank transfer'}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {/* Release to Print Room */}
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={releaseToPrintRoom}
                      onChange={(e) => setReleaseToPrintRoom(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-indigo-900 block">Forward to Print Room</span>
                      <span className="text-indigo-600">Release jobs into production queue immediately</span>
                    </div>
                  </label>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <Link
                      href={payUrl}
                      onClick={() => setIsOpen(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Full Job
                    </Link>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        className="text-slate-600 hover:bg-slate-100 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        loading={isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md"
                      >
                        Confirm Payment
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
