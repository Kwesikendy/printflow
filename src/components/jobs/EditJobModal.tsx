'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { X, Edit, Ruler, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateJobAction } from '@/app/actions/jobs'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface EditJobModalProps {
  job: any
  role: string
}

export function EditJobModal({ job, role }: EditJobModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Form state
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
        notes: notes.trim()
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

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Edit className="w-5 h-5 text-indigo-500" />
                    Edit Job Details
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">Modify dimensions, quantity, or notes.</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-5">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Width</label>
                      <input
                        type="number" step="any" min="0.1" required
                        value={width} onChange={e => setWidth(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Height</label>
                      <input
                        type="number" step="any" min="0.1" required
                        value={height} onChange={e => setHeight(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity</label>
                      <input
                        type="number" min="1" required
                        value={quantity} onChange={e => setQuantity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Unit Cost {canEditPrice ? '' : '(Locked)'}
                      </label>
                      <input
                        type="number" step="any" min="0.01" required
                        value={unitCost} onChange={e => setUnitCost(e.target.value)}
                        disabled={!canEditPrice}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={notes} onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                      placeholder="Add any special instructions..."
                    />
                  </div>

                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-600">New Area:</span>
                      <span className="text-sm font-bold text-slate-900">{previewArea.toFixed(2)} {job.dimension_unit}²</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">New Total:</span>
                      <span className="text-lg font-black text-indigo-700">{formatCurrency(previewTotal)}</span>
                    </div>
                  </div>

                </div>

                <div className="mt-6 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1" loading={isPending}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
