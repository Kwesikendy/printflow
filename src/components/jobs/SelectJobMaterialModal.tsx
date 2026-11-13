'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Boxes, CheckCircle2, Ruler, AlertTriangle, Ban, Search, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type MaterialLike,
  calculateJobConsumption,
  recommendMaterialForJob,
  parseRollDimensions,
} from '@/lib/material-matching'
import type { Job } from '@/types/database'

export interface JobMaterialSelection {
  jobId: string
  jobNumber: string
  materialId: string | 'none'
}

interface SelectJobMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'start' | 'complete'
  jobs: Job[]
  materials: MaterialLike[]
  isSubmitting?: boolean
  onConfirm: (selections: JobMaterialSelection[]) => Promise<void> | void
}

/**
 * Print room picks the exact material for each job. Nothing is pre-selected:
 * the system never guesses, so the inventory always matches what was really used.
 */
export function SelectJobMaterialModal({
  open,
  onOpenChange,
  mode,
  jobs,
  materials,
  isSubmitting = false,
  onConfirm,
}: SelectJobMaterialModalProps) {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [search, setSearch] = useState<Record<string, string>>({})

  // Reset every time the popup opens so a previous choice is never carried over
  useEffect(() => {
    if (open) {
      setSelected({})
      setSearch({})
    }
  }, [open, jobs])

  const enrichedMaterials = useMemo(
    () => materials.map(m => ({ ...m, parsed: parseRollDimensions(m) })),
    [materials]
  )

  const allChosen = jobs.length > 0 && jobs.every(j => Boolean(selected[j.id]))
  const isStart = mode === 'start'

  const handleConfirm = async () => {
    if (!allChosen) return
    await onConfirm(
      jobs.map(j => ({
        jobId: j.id,
        jobNumber: j.job_number,
        materialId: selected[j.id] as string | 'none',
      }))
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5 font-heading">
            <Boxes className="w-5 h-5 text-slate-700 shrink-0" />
            <div>
              <span>
                {jobs.length > 1
                  ? `Select Material for ${jobs.length} Jobs`
                  : 'Select Material to Print On'}
              </span>
              <p className="text-xs font-normal text-slate-500 mt-0.5">
                Choose the exact material you are using. Its stock is reduced by the job&apos;s size
                {isStart ? ' as soon as you start printing.' : ' when you confirm.'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-3">
          {jobs.map((job, idx) => {
            const productName = (job as any)?.product_types?.name || 'Print Job'
            const consumption = calculateJobConsumption(
              job.width,
              job.height,
              job.quantity,
              job.dimension_unit,
              productName
            )
            const rec = recommendMaterialForJob(job as any, materials)
            const suggestedIds = new Set(rec.familyCandidates.map(c => c.id))
            const q = (search[job.id] || '').trim().toLowerCase()

            const options = enrichedMaterials
              .filter(m => !q || m.name.toLowerCase().includes(q))
              .sort((a, b) => {
                const aS = suggestedIds.has(a.id) ? 0 : 1
                const bS = suggestedIds.has(b.id) ? 0 : 1
                if (aS !== bS) return aS - bS
                return a.name.localeCompare(b.name)
              })

            const selectedId = selected[job.id]
            const selectedMat = enrichedMaterials.find(m => m.id === selectedId) || null
            const rollArea = selectedMat?.parsed.effectiveAreaPerRollM2 || 0
            const rollsNeeded = rollArea > 0 ? consumption.totalAreaM2 / rollArea : 0
            const currentRolls = selectedMat ? Number(selectedMat.qty_rolls) || 0 : 0
            const notEnough = Boolean(selectedMat) && rollsNeeded > currentRolls + 0.0001
            const tooNarrow =
              Boolean(selectedMat) && selectedMat!.parsed.effectiveWidthM + 0.035 < consumption.shortSideM

            return (
              <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                {/* Job header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    {jobs.length > 1 && (
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                      {job.job_number}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{productName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold">
                      <Ruler className="w-3 h-3 text-slate-500" />
                      {consumption.widthFt}ft × {consumption.heightFt}ft
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-bold">
                      Qty {consumption.quantity} • {consumption.totalAreaM2.toFixed(2)} m²
                    </span>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search[job.id] || ''}
                    onChange={e => setSearch(prev => ({ ...prev, [job.id]: e.target.value }))}
                    placeholder="Search materials by name..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                {/* Material list */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {options.length === 0 && (
                    <p className="text-xs text-slate-500 py-3 text-center">No materials match your search.</p>
                  )}
                  {options.map(m => {
                    const isSelected = selectedId === m.id
                    const stock = Number(m.qty_rolls) || 0
                    const isSuggested = suggestedIds.has(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelected(prev => ({ ...prev, [job.id]: m.id }))}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2',
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : stock > 0
                            ? 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                            : 'bg-slate-100/70 text-slate-500 border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{m.name}</div>
                          <div
                            className={cn(
                              'text-[11px] font-mono tabular-nums mt-0.5',
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            )}
                          >
                            {m.parsed.widthSummary} • {stock.toFixed(2)} rolls (
                            {(stock * m.parsed.effectiveAreaPerRollM2).toFixed(0)} m²)
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSuggested && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              )}
                            >
                              Similar
                            </span>
                          )}
                          {stock <= 0 && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                isSelected
                                  ? 'bg-amber-400/30 text-white'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              )}
                            >
                              Out of stock
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Explicit no-material choice */}
                <button
                  type="button"
                  onClick={() => setSelected(prev => ({ ...prev, [job.id]: 'none' }))}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all',
                    selectedId === 'none'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-dashed border-slate-300 hover:border-slate-400'
                  )}
                >
                  <Ban className="w-3.5 h-3.5 shrink-0" />
                  This job uses no stocked material (paper / outsourced / design only)
                </button>

                {/* Live summary */}
                {!selectedId && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Pick the material for this job to continue.</span>
                  </div>
                )}
                {selectedMat && (
                  <div
                    className={cn(
                      'rounded-lg border p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs',
                      notEnough ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200/90'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {notEnough || tooNarrow ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-slate-800">
                          Deducting {consumption.totalAreaM2.toFixed(2)} m² ({rollsNeeded.toFixed(3)} rolls)
                        </span>
                        <span className="text-slate-500 ml-1">
                          from <strong>{selectedMat.name}</strong>
                        </span>
                        {tooNarrow && (
                          <p className="text-amber-700 mt-0.5">This roll is narrower than the job&apos;s short side.</p>
                        )}
                        {notEnough && (
                          <p className="text-rose-700 mt-0.5">
                            System stock is lower than needed - stock will be set to 0 and flagged for a recount.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-[11px] font-semibold text-slate-600 shrink-0">
                      Stock after:{' '}
                      <strong className="text-indigo-700">
                        {Math.max(0, currentRolls - rollsNeeded).toFixed(2)} rolls
                      </strong>
                    </div>
                  </div>
                )}
                {selectedId === 'none' && (
                  <div className="rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex items-center gap-2 text-xs text-slate-600">
                    <Ban className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>No stock will be deducted for this job.</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 border-t border-slate-200 pt-3">
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
            type="button"
            variant={isStart ? 'primary' : 'success'}
            loading={isSubmitting}
            disabled={!allChosen}
            onClick={handleConfirm}
            className="text-xs font-bold px-4"
          >
            {isStart ? <Printer className="w-4 h-4 mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            {isStart
              ? jobs.length > 1
                ? `Confirm & Start Printing (${jobs.length})`
                : 'Confirm & Start Printing'
              : jobs.length > 1
              ? `Confirm & Complete (${jobs.length})`
              : 'Confirm & Mark Completed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
