'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { X, Edit, User, FileText, Ruler, CreditCard, Box } from 'lucide-react'
import { toast } from 'sonner'
import { updateJobAction } from '@/app/actions/jobs'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, PRINT_ROOM_LABELS } from '@/lib/utils'

interface EditJobModalProps {
  job: any
  role: string
}

export function EditJobModal({ job, role }: EditJobModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Form state
  const [customerName, setCustomerName] = useState(job.customer_name || '')
  const [customerPhone, setCustomerPhone] = useState(job.customer_phone || '')
  const [printRoom, setPrintRoom] = useState(job.print_room || '')
  const [width, setWidth] = useState(job.width.toString())
  const [height, setHeight] = useState(job.height.toString())
  const [quantity, setQuantity] = useState(job.quantity.toString())
  const [unitCost, setUnitCost] = useState(job.unit_cost_applied.toString())
  const [notes, setNotes] = useState(job.notes || '')
  
  const canEditPrice = role === 'admin'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const w = parseFloat(width)
    const h = parseFloat(height)
    const q = parseInt(quantity)
    const cost = parseFloat(unitCost)

    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0 || isNaN(q) || q <= 0 || isNaN(cost) || cost <= 0) {
      toast.error('Please enter valid positive numbers for dimensions, quantity, and unit cost.')
      return
    }

    startTransition(async () => {
      const res = await updateJobAction(job.id, {
        width: w,
        height: h,
        quantity: q,
        unitCost: cost,
        notes: notes.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        printRoom: printRoom || undefined,
      })

      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Job updated successfully!')
        setIsOpen(false)
      }
    })
  }

  // Calculate new totals for preview
  const previewArea = (parseFloat(width) || 0) * (parseFloat(height) || 0)
  const previewTotal = previewArea * (parseFloat(unitCost) || 0) * (parseInt(quantity) || 0)

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)} className="flex items-center gap-2">
        <Edit className="w-4 h-4" /> Edit Job
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
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                    <Edit className="w-5 h-5 text-indigo-600" />
                    Edit Job #{job.job_number}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5 font-medium">Update details for the selected job.</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 custom-scrollbar">
                <form id="edit-job-form" onSubmit={handleSubmit} className="space-y-8">
                  
                  {/* Customer Section */}
                  <section>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-500" /> Customer Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Name</label>
                        <input
                          type="text" required
                          value={customerName} onChange={e => setCustomerName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 transition-shadow"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 transition-shadow"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Dimensions Section */}
                  <section>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-indigo-500" /> Dimensions & Details
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Width</label>
                        <div className="relative">
                          <input
                            type="number" step="any" min="0.1" required
                            value={width} onChange={e => setWidth(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 transition-shadow"
                          />
                          <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-400">{job.dimension_unit}</span>
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Height</label>
                        <div className="relative">
                          <input
                            type="number" step="any" min="0.1" required
                            value={height} onChange={e => setHeight(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 transition-shadow"
                          />
                          <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-400">{job.dimension_unit}</span>
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity</label>
                        <input
                          type="number" min="1" required
                          value={quantity} onChange={e => setQuantity(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 transition-shadow"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Print Room</label>
                        <select
                          value={printRoom} onChange={e => setPrintRoom(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 transition-shadow"
                        >
                          <option value="">Unassigned</option>
                          {Object.entries(PRINT_ROOM_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Pricing Section */}
                  <section>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-500" /> Pricing Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Unit Cost {canEditPrice ? '' : <span className="text-amber-600 font-medium ml-1">(Admin Only)</span>}
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-sm font-medium text-slate-500">GH₵</span>
                          <input
                            type="number" step="any" min="0.01" required
                            value={unitCost} onChange={e => setUnitCost(e.target.value)}
                            disabled={!canEditPrice}
                            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-900 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed transition-shadow"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Notes Section */}
                  <section>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" /> Additional Notes
                    </h4>
                    <textarea
                      value={notes} onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-medium text-slate-900 transition-shadow"
                      placeholder="Add any special instructions or requirements..."
                    />
                  </section>

                </form>
              </div>

              {/* Footer with totals and actions */}
              <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-0 z-10">
                <div className="p-3.5 bg-white border border-indigo-100 rounded-xl shadow-sm flex items-center gap-6">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Area</p>
                    <p className="text-sm font-black text-slate-800">{previewArea.toFixed(2)} {job.dimension_unit}²</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">New Total</p>
                    <p className="text-lg font-black text-indigo-600 leading-none">{formatCurrency(previewTotal)}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1 sm:flex-none px-6 rounded-xl font-bold" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="edit-job-form" variant="primary" className="flex-1 sm:flex-none px-8 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700" loading={isPending}>
                    Save Changes
                  </Button>
                </div>
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

