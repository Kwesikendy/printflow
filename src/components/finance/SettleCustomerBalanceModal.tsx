'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, CheckCircle2, Banknote, Smartphone, Landmark, MoreHorizontal, 
  AlertCircle, ArrowRight, Loader2, Sparkles, FileText, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { settleCustomerBalanceAction } from '@/app/actions/finance'
import { toast } from 'sonner'
import type { PaymentMethod } from '@/types/database'

interface SettleCustomerBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customerName: string
  customerPhone?: string | null
  totalOutstanding: number
  invoices: Array<{
    id: string
    invoice_number: string
    issued_at: string
    total: number
    amount_paid: number
    balance_due: number
    status: string
  }>
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod
  label: string
  sublabel: string
  icon: typeof Banknote
}> = [
  { value: 'cash',  label: 'Cash',         sublabel: 'Physical notes',  icon: Banknote },
  { value: 'momo',  label: 'Mobile Money', sublabel: 'MTN / Telecel / AT', icon: Smartphone },
  { value: 'other', label: 'Bank / Other', sublabel: 'Transfer / Cheque', icon: Landmark }
]

export function SettleCustomerBalanceModal({
  isOpen,
  onClose,
  onSuccess,
  customerName,
  customerPhone,
  totalOutstanding,
  invoices
}: SettleCustomerBalanceModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amountStr, setAmountStr] = useState(totalOutstanding.toFixed(2))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [releaseToPrintRoom, setReleaseToPrintRoom] = useState(true)
  const [showBreakdown, setShowBreakdown] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset or update state whenever modal opens or totalOutstanding updates
  useEffect(() => {
    if (isOpen) {
      setAmountStr(totalOutstanding.toFixed(2))
      setReference('')
      setNotes('')
      setMethod('cash')
      setReleaseToPrintRoom(true)
      setShowBreakdown(true)
    }
  }, [isOpen, totalOutstanding])

  // Filter only invoices that have a balance due
  const unpaidInvoices = useMemo(() => {
    return (invoices || [])
      .filter(i => (i.balance_due ?? 0) > 0.009)
      .sort((a, b) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime())
  }, [invoices])

  // Calculate live allocation preview
  const allocationPreview = useMemo(() => {
    const parsed = parseFloat(amountStr)
    let rem = isNaN(parsed) || parsed < 0 ? 0 : parsed

    let fullyPaidCount = 0
    let partialCount = 0

    const list = unpaidInvoices.map(inv => {
      const needed = inv.balance_due
      const toApply = Math.min(rem, needed)
      const rounded = Math.round(toApply * 100) / 100
      rem = Math.max(0, Math.round((rem - rounded) * 100) / 100)

      const isFullyCovered = rounded >= (needed - 0.009)
      const isPartiallyCovered = rounded > 0.009 && !isFullyCovered

      if (isFullyCovered) fullyPaidCount++
      else if (isPartiallyCovered) partialCount++

      return {
        ...inv,
        allocated: rounded,
        isFullyCovered,
        isPartiallyCovered,
        remainingAfter: Math.max(0, Math.round((needed - rounded) * 100) / 100)
      }
    })

    const parsedAmount = isNaN(parsed) ? 0 : parsed
    const newRemainingTotal = Math.max(0, Math.round((totalOutstanding - parsedAmount) * 100) / 100)

    return {
      list,
      fullyPaidCount,
      partialCount,
      newRemainingTotal,
      isFullSettlement: newRemainingTotal <= 0.01
    }
  }, [amountStr, unpaidInvoices, totalOutstanding])

  if (!isOpen) return null

  const parsedAmount = parseFloat(amountStr)
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= totalOutstanding + 0.05

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidAmount) {
      toast.error(`Please enter a valid amount up to ${formatCurrency(totalOutstanding)}`)
      return
    }

    startTransition(async () => {
      try {
        const res = await settleCustomerBalanceAction({
          customerName,
          customerPhone,
          amount: parsedAmount,
          method,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          releaseToPrintRoom
        })

        if (res.error) {
          toast.error(res.error)
          return
        }

        const isFull = allocationPreview.isFullSettlement
        toast.success(
          isFull
            ? `Full settlement of ${formatCurrency(parsedAmount)} recorded! All ${res.invoicesSettledCount || unpaidInvoices.length} invoices cleared.`
            : `Partial payment of ${formatCurrency(parsedAmount)} recorded across ${res.invoicesSettledCount} invoices.`
        )

        onSuccess()
        onClose()
      } catch (err: any) {
        console.error('Settlement error:', err)
        toast.error(err.message || 'Failed to record customer settlement')
      }
    })
  }

  return mounted ? createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] z-10 my-auto"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-linear-to-r from-emerald-50/60 via-white to-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Settle Customer Balance</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                    Bulk Clearance
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {customerName} {customerPhone ? `· ${customerPhone}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Summary Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-linear-to-br from-amber-50/80 via-white to-emerald-50/50 border border-amber-200/80 shadow-2xs">
              <div>
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                  Total Outstanding Balance
                </span>
                <span className="text-3xl font-black text-amber-600 tracking-tight block mt-0.5">
                  {formatCurrency(totalOutstanding)}
                </span>
                <span className="text-xs text-amber-800/80 font-medium">
                  Across {unpaidInvoices.length} unsettled invoice{unpaidInvoices.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="sm:text-right flex flex-col justify-between sm:items-end pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  After Payment Status
                </span>
                <div>
                  {allocationPreview.isFullSettlement ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% Account Settled (₵0.00 left)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Remains: {formatCurrency(allocationPreview.newRemainingTotal)}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 mt-1">
                  {allocationPreview.fullyPaidCount} fully closed · {allocationPreview.partialCount} partial
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'py-3 px-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer',
                      method === m.value
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-sm ring-1 ring-emerald-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <m.icon className={cn('w-4 h-4', method === m.value ? 'text-emerald-700' : 'text-slate-400')} />
                      {method === m.value && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <span className="font-bold text-xs">{m.label}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{m.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Payment Amount (₵)
                </label>
                {Math.abs(parsedAmount - totalOutstanding) > 0.01 && (
                  <button
                    type="button"
                    onClick={() => setAmountStr(totalOutstanding.toFixed(2))}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Pay Full Balance ({formatCurrency(totalOutstanding)})
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-base">
                  ₵
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={totalOutstanding}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Payments automatically settle the oldest unpaid invoices first (First-In, First-Out).
              </p>
            </div>

            {/* Reference & Transaction Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {method === 'momo'
                    ? 'Momo Reference / Transaction ID'
                    : method === 'other'
                    ? 'Bank Ref / Cheque No.'
                    : 'Receipt Ref / Memo (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    method === 'momo'
                      ? 'e.g. 289410985'
                      : method === 'other'
                      ? 'e.g. Bank slip or Cheque #004'
                      : 'e.g. Cash register ref'
                  }
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer cleared full outstanding balance"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Forward to Print Room Checkbox */}
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 cursor-pointer hover:bg-indigo-50/80 transition-colors">
              <input
                type="checkbox"
                checked={releaseToPrintRoom}
                onChange={(e) => setReleaseToPrintRoom(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <div className="text-xs">
                <span className="font-bold text-indigo-900 block">
                  Release Awaiting Orders to Print Room
                </span>
                <span className="text-indigo-600">
                  Automatically transitions jobs from awaiting payment to paid & ready in the production queue.
                </span>
              </div>
            </label>

            {/* Invoices Settlement Allocation Breakdown */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Invoice Settlement Allocation ({unpaidInvoices.length} invoices)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>{showBreakdown ? 'Hide preview' : 'View allocation'}</span>
                  {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {showBreakdown && (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {allocationPreview.list.map((inv) => (
                    <div key={inv.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{inv.invoice_number}</span>
                          <span className="text-slate-400 text-[11px]">{formatDate(inv.issued_at)}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Total: {formatCurrency(inv.total)} · Due: {formatCurrency(inv.balance_due)}
                        </div>
                      </div>

                      <div className="text-right">
                        {inv.isFullyCovered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Fully Paid (+{formatCurrency(inv.allocated)})
                          </span>
                        ) : inv.isPartiallyCovered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Partial: {formatCurrency(inv.allocated)} ({formatCurrency(inv.remainingAfter)} left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                            Unchanged (₵0.00)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isPending}
                disabled={!isValidAmount || isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer active:scale-[0.98] transition-all"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing Balance...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Confirm & Settle {formatCurrency(isValidAmount ? parsedAmount : 0)}
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  ) : null
}
