'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { X, Edit, DollarSign, FileText, Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { editInvoiceTotalAction, getInvoiceJobsAction, editInvoiceItemsAction } from '@/app/actions/invoices'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface EditInvoiceModalProps {
  invoice: any
}

export function EditInvoiceModal({ invoice }: EditInvoiceModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  
  const [items, setItems] = useState<any[]>([])
  const [newTotal, setNewTotal] = useState(invoice.total?.toString() || '')
  const [reason, setReason] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch jobs when opened
  useEffect(() => {
    if (isOpen) {
      setLoadingItems(true)
      getInvoiceJobsAction(invoice.id).then(res => {
        if (res.data) setItems(res.data)
        setLoadingItems(false)
      })
    }
  }, [isOpen, invoice.id])

  // Recalculate total when items change
  const calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_cost)), 0)

  const handleItemChange = (id: string, field: string, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    let customTotal: number | undefined = parseFloat(newTotal)
    if (isNaN(customTotal) || customTotal < 0) {
      customTotal = undefined
    }
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for this edit.')
      return
    }

    startTransition(async () => {
      const payloadItems = items.map(i => ({
        id: i.id,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
        width_cm: Number(i.width_cm),
        height_cm: Number(i.height_cm),
        notes: i.notes
      }))

      const res = await editInvoiceItemsAction(invoice.id, payloadItems, reason.trim(), customTotal)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Invoice & items updated successfully!')
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
                className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                      <Edit className="w-5 h-5 text-indigo-600" />
                      Edit Invoice {invoice.invoice_number}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5 font-medium">Modify individual items, quantities, and prices.</p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  <div className="mb-6 flex gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex-1">
                      <span className="text-xs font-bold text-slate-500 uppercase">Original Total</span>
                      <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(invoice.total)}</div>
                    </div>
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex-1">
                      <span className="text-xs font-bold text-indigo-500 uppercase">Calculated Subtotal</span>
                      <div className="text-xl font-black text-indigo-700 mt-1">{formatCurrency(calculatedSubtotal)}</div>
                    </div>
                  </div>

                  {loadingItems ? (
                    <div className="py-12 flex justify-center items-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                  ) : (
                    <form id="edit-invoice-form" onSubmit={handleSubmit} className="space-y-6">
                      
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                              <th className="py-3 px-4 font-semibold">Product / Item</th>
                              <th className="py-3 px-4 font-semibold w-24">Qty</th>
                              <th className="py-3 px-4 font-semibold w-32">Unit Price</th>
                              <th className="py-3 px-4 font-semibold text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map(item => (
                              <tr key={item.id} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">{item.product_types?.name || 'Item'}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">{item.width_cm} x {item.height_cm} cm</div>
                                </td>
                                <td className="py-3 px-4">
                                  <input 
                                    type="number" min="1" step="1" required
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-center focus:ring-1 focus:ring-indigo-500 text-sm font-semibold text-slate-900"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input 
                                    type="number" min="0" step="any" required
                                    value={item.unit_cost}
                                    onChange={(e) => handleItemChange(item.id, 'unit_cost', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm font-semibold text-slate-900"
                                  />
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-emerald-600">
                                  {formatCurrency(Number(item.quantity) * Number(item.unit_cost))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-indigo-500" /> Manual Grand Total Override
                          </label>
                          <p className="text-xs text-slate-500 mb-2">Leave empty to use calculated subtotal.</p>
                          <div className="relative">
                            <span className="absolute left-4 top-2.5 text-sm font-medium text-slate-500">GH₵</span>
                            <input
                              type="number" step="any" min="0"
                              value={newTotal} onChange={e => setNewTotal(e.target.value)}
                              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-900 transition-shadow"
                              placeholder={calculatedSubtotal.toString()}
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
                            placeholder="e.g. Corrected quantity, adjusted price for client..."
                          />
                        </div>
                      </div>
                    </form>
                  )}
                </div>

                <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="edit-invoice-form" variant="primary" className="flex-1 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700" loading={isPending || loadingItems}>
                    Save Changes & Update Invoice
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

