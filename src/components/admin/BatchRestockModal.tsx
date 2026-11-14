'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { batchRestockAction, prepareInventoryForRestockAction } from '@/app/actions/inventory'
import { toast } from 'sonner'
import { PackagePlus, RefreshCw, AlertCircle, CheckCircle2, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface MaterialItem {
  id: string
  name: string
  unit: string
  qty_rolls: number
  unit_cost: number
  roll_width?: number
  roll_length?: number
  roll_height?: number
}

interface BatchRestockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: MaterialItem[]
  onSuccess: () => void
}

export function BatchRestockModal({
  open,
  onOpenChange,
  materials,
  onSuccess,
}: BatchRestockModalProps) {
  const [deliveryRef, setDeliveryRef] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [entries, setEntries] = useState<Record<string, { rolls: string; cost: string }>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Initialize or get entry for a material
  const getEntry = (m: MaterialItem) => {
    return entries[m.id] || { rolls: '', cost: String(m.unit_cost || '') }
  }

  const updateEntry = (id: string, field: 'rolls' | 'cost', value: string, defaultCost: number) => {
    setEntries((prev) => {
      const current = prev[id] || { rolls: '', cost: String(defaultCost || '') }
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  // Calculate totals
  const activeEntries = Object.entries(entries).filter(([_, val]) => {
    const qty = parseFloat(val.rolls)
    return !isNaN(qty) && qty > 0
  })

  const totalRolls = activeEntries.reduce((acc, [_, val]) => acc + parseFloat(val.rolls), 0)
  const totalValuation = activeEntries.reduce((acc, [id, val]) => {
    const qty = parseFloat(val.rolls)
    const cost = parseFloat(val.cost) || 0
    return acc + qty * cost
  }, 0)

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeEntries.length === 0) {
      toast.error('Please enter quantities for at least one material.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = activeEntries.map(([materialId, val]) => ({
        materialId,
        rollsToAdd: parseFloat(val.rolls),
        costPerRoll: parseFloat(val.cost) || undefined,
      }))

      const res = await batchRestockAction(payload, deliveryRef)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Successfully restocked ${res.updatedCount} materials (${totalRolls} total rolls)!`)
        setEntries({})
        setDeliveryRef('')
        onOpenChange(false)
        onSuccess()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit batch restock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleZeroOutAll = async () => {
    setIsResetting(true)
    try {
      const res = await prepareInventoryForRestockAction('Manual reset ahead of incoming shipment intake')
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Inventory prepared: ${res.resetCount} materials zeroed out for fresh shipment!`)
        setShowResetConfirm(false)
        onSuccess()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to prepare inventory')
    } finally {
      setIsResetting(false)
    }
  }

  const filteredMaterials = materials.filter((m) =>
    m.name.toLowerCase().includes(filterQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-sky-600" />
                Shipment Restock Intake
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                Enter rolls received from today&apos;s delivery note. All updates are logged with audit timestamps.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
              className="text-xs font-semibold border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 self-start sm:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Reset All Stock to 0
            </Button>
          </div>
        </DialogHeader>

        {showResetConfirm && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-xs text-amber-900 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Zero out all stock balances before restocking?</p>
                <p className="text-amber-800 mt-0.5">
                  This will set all 29 materials to 0 rolls so your incoming shipment counts are recorded cleanly with zero historical discrepancies. An audit log entry will be saved.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="text-xs h-7"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleZeroOutAll}
                loading={isResetting}
                className="text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Confirm Zero-Out All
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleBatchSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Delivery Note & Filter Header */}
          <div className="p-6 py-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <div>
              <Label className="text-xs font-bold text-slate-700 mb-1 block">
                Delivery Note / Invoice Reference
              </Label>
              <input
                type="text"
                value={deliveryRef}
                onChange={(e) => setDeliveryRef(e.target.value)}
                placeholder="e.g. Waybill #1048 - Supplier Delivery"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700 mb-1 block">
                Search Material Catalog
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter by name (e.g. 4FT, FLEXI, SAV)..."
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>
          </div>

          {/* Scrollable Materials Table */}
          <div className="flex-1 overflow-y-auto p-6 pt-2 divide-y divide-slate-100">
            <div className="grid grid-cols-12 gap-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <div className="col-span-5">Material</div>
              <div className="col-span-2 text-right">In Stock</div>
              <div className="col-span-2 text-center">New Quantity (+)</div>
              <div className="col-span-3 text-right">Unit Cost (GHS)</div>
            </div>

            {filteredMaterials.map((m) => {
              const entry = getEntry(m)
              const hasQty = parseFloat(entry.rolls) > 0
              const unitSingular = m.unit === 'sheet' ? 'sheet' : m.unit === 'piece' ? 'pc' : 'roll'

              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-12 gap-2 py-2.5 items-center transition-colors rounded-lg px-1 ${
                    hasQty ? 'bg-sky-50/40 font-semibold' : ''
                  }`}
                >
                  <div className="col-span-5 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{m.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {m.roll_width}m × {m.roll_height || m.roll_length || 50}m ({m.unit})
                    </p>
                  </div>

                  <div className="col-span-2 text-right">
                    <span className="font-mono text-xs tabular-nums text-slate-600">
                      {m.qty_rolls.toFixed(m.qty_rolls % 1 === 0 ? 0 : 2)} {unitSingular}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={entry.rolls}
                      onChange={(e) => updateEntry(m.id, 'rolls', e.target.value, m.unit_cost)}
                      placeholder="0"
                      className="w-full text-center px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="col-span-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs text-slate-400">₵</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.cost}
                        onChange={(e) => updateEntry(m.id, 'cost', e.target.value, m.unit_cost)}
                        placeholder={String(m.unit_cost)}
                        className="w-24 text-right px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer Summary & Submit */}
          <DialogFooter className="p-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900">{activeEntries.length}</span> materials selected ·{' '}
              <span className="font-bold text-slate-900">{totalRolls}</span> total units · Est. Value:{' '}
              <span className="font-bold text-sky-700">{formatCurrency(totalValuation)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || activeEntries.length === 0}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-5 shadow-xs"
              >
                {isSubmitting ? 'Posting Restock...' : `Post Restock (${activeEntries.length} Items)`}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
