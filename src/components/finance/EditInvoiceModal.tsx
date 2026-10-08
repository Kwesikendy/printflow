'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { X, Edit, DollarSign, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { editInvoiceTotalAction } from '@/app/actions/invoices'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface EditInvoiceModalProps {
  invoice: any
}

export function EditInvoiceModal({ invoice }: EditInvoiceModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  const [newTotal, setNewTotal] = useState(invoice.total?.toString() || '')
  const [reason, setReason] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const total = parseFloat(newTotal)
    if (isNaN(total) || total < 0) {
      toast.error('Please enter a valid positive number for the new total.')
      return
    }
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for this edit.')
      return
    }

    startTransition(async () => {
      const res = await editInvoiceTotalAction(invoice.id, total, reason.trim())
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Invoice total updated successfully!')
        setIsOpen(false)
        setReason('')
      }
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)} className="hover:bg-slate-100 text-slate-500 hover:text-indigo-600 text-xs font-semibold px-2 py-1">
        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
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
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                      <Edit className="w-5 h-5 text-indigo-600" />
                      Edit Invoice {invoice.invoice_number}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5 font-medium">Override the total invoice amount.</p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-500 uppercase">Current Total</span>
                    <span className="text-lg font-black text-slate-900">{formatCurrency(invoice.total)}</span>
                  </div>

                  <form id="edit-invoice-form" onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-indigo-500" /> New Grand Total
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-2.5 text-sm font-medium text-slate-500">GH₵</span>
                        <input
                          type="number" step="any" min="0" required
                          value={newTotal} onChange={e => setNewTotal(e.target.value)}
                          className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-900 transition-shadow"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" /> Reason for Edit
                      </label>
                      <textarea
                        required
                        value={reason} onChange={e => setReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-medium text-slate-900 transition-shadow"
                        placeholder="e.g. Corrected miscalculation, manual discount applied..."
                      />
                    </div>
                  </form>
                </div>

                <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="edit-invoice-form" variant="primary" className="flex-1 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700" loading={isPending}>
                    Confirm Edit
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
