'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { 
  editPaymentAction, 
  deletePaymentAction, 
  movePaymentToInvoiceAction 
} from '@/app/actions/jobs'
import { toast } from 'sonner'
import { 
  ShieldAlert, 
  Trash2, 
  ArrowRightLeft, 
  Edit3, 
  X, 
  DollarSign, 
  Smartphone, 
  Banknote, 
  MoreHorizontal 
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { Payment } from '@/types/database'

interface AdminPaymentCorrectionModalProps {
  payment: Payment
  currentInvoiceNumber?: string
  userRole?: string
  onSuccess?: () => void
  buttonText?: string
  variant?: 'badge' | 'danger-badge' | 'button'
}

const METHODS = [
  { value: 'cash',  label: 'Cash',         icon: Banknote },
  { value: 'momo',  label: 'Mobile Money', icon: Smartphone },
  { value: 'other', label: 'Other',        icon: MoreHorizontal },
]

export function AdminPaymentCorrectionModal({
  payment,
  currentInvoiceNumber,
  userRole,
  onSuccess,
  buttonText,
  variant = 'badge',
}: AdminPaymentCorrectionModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'move' | 'delete'>('edit')
  const [isPending, startTransition] = useTransition()

  // Form states
  const [amount, setAmount] = useState<string>(payment.amount?.toString() || '0')
  const [method, setMethod] = useState<string>(payment.method || 'cash')
  const [reference, setReference] = useState<string>(payment.reference || '')
  const [notes, setNotes] = useState<string>(payment.notes || '')
  const [targetInvoiceNumber, setTargetInvoiceNumber] = useState<string>('')
  const [deleteReason, setDeleteReason] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Only admins can see and use this modal
  if (userRole !== 'admin') {
    return null
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid payment amount greater than 0.')
      return
    }

    startTransition(async () => {
      const res = await editPaymentAction(payment.id, parsedAmount, method, reference, notes)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Payment updated and invoice balance recalculated!')
        setIsOpen(false)
        onSuccess?.()
      }
    })
  }

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetInvoiceNumber.trim()) {
      toast.error('Please enter the target invoice number (e.g. PF-261105-024).')
      return
    }

    startTransition(async () => {
      const res = await movePaymentToInvoiceAction(payment.id, targetInvoiceNumber.trim(), 'Moved by Admin')
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Payment moved to invoice ${targetInvoiceNumber.trim().toUpperCase()}!`)
        setIsOpen(false)
        onSuccess?.()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to completely reverse/delete this payment of ${formatCurrency(payment.amount)}? The invoice balance will immediately revert to owing.`)) {
      return
    }

    startTransition(async () => {
      const res = await deletePaymentAction(payment.id, deleteReason || 'Reversed by Admin')
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Payment/Credit successfully reversed! Client arrears have been restored.')
        setIsOpen(false)
        onSuccess?.()
      }
    })
  }

  const renderTriggerButton = () => {
    if (variant === 'danger-badge') {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md transition-colors shadow-2xs cursor-pointer"
          title="Reverse or correct this credit transaction"
        >
          <ShieldAlert className="w-3 h-3 text-rose-600" />
          {buttonText || 'Reverse / Fix'}
        </button>
      )
    }

    if (variant === 'button') {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
          title="Admin payment correction & reversal"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
          {buttonText || 'Admin Fix'}
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors shadow-2xs cursor-pointer"
        title="Admin Payment Correction & Reversal"
      >
        <ShieldAlert className="w-3 h-3 text-amber-600" />
        {buttonText || 'Admin Fix'}
      </button>
    )
  }

  return (
    <>
      {renderTriggerButton()}

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Correct Payment Entry</h3>
                      <p className="text-xs text-slate-500">
                        Current Amount: <span className="font-semibold text-slate-700">{formatCurrency(payment.amount)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all',
                      activeTab === 'edit'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Amount / Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('move')}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all',
                      activeTab === 'move'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Move to Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('delete')}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all',
                      activeTab === 'delete'
                        ? 'bg-white text-rose-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Entry
                  </button>
                </div>

                {/* Tab 1: Edit Amount & Method */}
                {activeTab === 'edit' && (
                  <form onSubmit={handleEdit} className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Correct Amount (GH₵)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method</label>
                      <div className="flex gap-2">
                        {METHODS.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setMethod(m.value)}
                            className={cn(
                              'flex-1 py-2 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1 transition-all',
                              method === m.value
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            )}
                          >
                            <m.icon className="w-3.5 h-3.5" />
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Note</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="e.g. MoMo Transaction ID, Cheque #, etc."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800"
                      />
                    </div>

                    <Button
                      type="submit"
                      loading={isPending}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-2.5 mt-2"
                    >
                      Save Payment Correction
                    </Button>
                  </form>
                )}

                {/* Tab 2: Move to Another Invoice */}
                {activeTab === 'move' && (
                  <form onSubmit={handleMove} className="p-5 space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                      Entered this money on the wrong invoice? Enter the correct invoice number below and the payment will be safely transferred. Both invoices will have their balances updated immediately.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Target Invoice Number
                      </label>
                      <input
                        type="text"
                        required
                        value={targetInvoiceNumber}
                        onChange={e => setTargetInvoiceNumber(e.target.value)}
                        placeholder="e.g. PF-261105-024"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 uppercase focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        autoFocus
                      />
                    </div>

                    <Button
                      type="submit"
                      loading={isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-2.5 mt-2"
                    >
                      Transfer Payment to Target Invoice
                    </Button>
                  </form>
                )}

                {/* Tab 3: Delete / Void */}
                {activeTab === 'delete' && (
                  <div className="p-5 space-y-4">
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-relaxed">
                      <p className="font-bold mb-1">Warning: Irreversible Action</p>
                      Deleting this payment of <span className="font-black">{formatCurrency(payment.amount)}</span> will immediately subtract it from the invoice. If the invoice was marked as &quot;Paid&quot;, it will revert to &quot;Partial&quot; or &quot;Unpaid&quot;.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reason for Deletion (Optional)
                      </label>
                      <input
                        type="text"
                        value={deleteReason}
                        onChange={e => setDeleteReason(e.target.value)}
                        placeholder="e.g. Mistaken entry by accountant"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="danger"
                      loading={isPending}
                      onClick={handleDelete}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl py-2.5"
                    >
                      Delete and Reverse Payment
                    </Button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
