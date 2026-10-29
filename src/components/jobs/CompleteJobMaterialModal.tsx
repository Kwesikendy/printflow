'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import {
  Boxes,
  CheckCircle2,
  Sparkles,
  Ruler,
  AlertTriangle,
  Layers,
  Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type MaterialLike,
  recommendMaterialForJob,
  parseRollDimensions,
} from '@/lib/material-matching'
import type { Job } from '@/types/database'

export interface JobCompletionSelection {
  jobId: string
  jobNumber: string
  materialId: string | 'none'
  saveAsDefaultLink: boolean
}

interface CompleteJobMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobsToComplete: Job[]
  materials: MaterialLike[]
  isSubmitting?: boolean
  onConfirm: (selections: JobCompletionSelection[]) => Promise<void> | void
}

export function CompleteJobMaterialModal({
  open,
  onOpenChange,
  jobsToComplete,
  materials,
  isSubmitting = false,
  onConfirm,
}: CompleteJobMaterialModalProps) {
  // Compute smart recommendations for each job being completed
  const jobRecommendations = useMemo(() => {
    return jobsToComplete.map(job => ({
      job,
      rec: recommendMaterialForJob(job as any, materials),
    }))
  }, [jobsToComplete, materials])

  // Map of jobId -> selected materialId ('none' means no material deduction)
  const [selectedMaterialByJob, setSelectedMaterialByJob] = useState<Record<string, string>>({})
  const [saveDefaultByJob, setSaveDefaultByJob] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (open) {
      const initialSelections: Record<string, string> = {}
      const initialSaveDefault: Record<string, boolean> = {}
      for (const { job, rec } of jobRecommendations) {
        initialSelections[job.id] = rec.recommendedMaterial?.id || 'none'
        // Default to saving link if product wasn't linked yet and we found a match
        const existingLink = (job as any)?.product_types?.material_id
        initialSaveDefault[job.id] = !existingLink && Boolean(rec.recommendedMaterial?.id)
      }
      setSelectedMaterialByJob(initialSelections)
      setSaveDefaultByJob(initialSaveDefault)
    }
  }, [open, jobRecommendations])

  const allMaterialsEnriched = useMemo(() => {
    return materials.map(m => ({
      ...m,
      parsed: parseRollDimensions(m),
    }))
  }, [materials])

  const handleConfirm = async () => {
    const selections: JobCompletionSelection[] = jobsToComplete.map(job => ({
      jobId: job.id,
      jobNumber: job.job_number,
      materialId: selectedMaterialByJob[job.id] || 'none',
      saveAsDefaultLink: Boolean(saveDefaultByJob[job.id]),
    }))
    await onConfirm(selections)
  }

  const totalDeductionM2 = useMemo(() => {
    return jobRecommendations.reduce((sum, { job, rec }) => {
      const sel = selectedMaterialByJob[job.id]
      if (!sel || sel === 'none') return sum
      return sum + rec.consumption.totalAreaM2
    }, 0)
  }, [jobRecommendations, selectedMaterialByJob])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <span>
                {jobsToComplete.length > 1
                  ? `Confirm Material Rolls & Complete All (${jobsToComplete.length} Jobs)`
                  : `Confirm Material Roll & Complete Job`}
              </span>
              <p className="text-xs font-normal text-slate-500 mt-0.5">
                PrintFlow auto-selected the smallest fitting roll width in stock. Confirm or switch rolls below.
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-3">
          {jobRecommendations.map(({ job, rec }, idx) => {
            const selectedId = selectedMaterialByJob[job.id] || 'none'
            const selectedMat = allMaterialsEnriched.find(m => m.id === selectedId) || null
            const { consumption, familyCandidates } = rec
            const productName = (job as any)?.product_types?.name || 'Print Job'

            const rollArea = selectedMat ? selectedMat.parsed.effectiveAreaPerRollM2 : 0
            const rollsDeducted = rollArea > 0 ? consumption.totalAreaM2 / rollArea : 0
            const currentRolls = selectedMat ? Number(selectedMat.qty_rolls) || 0 : 0
            const currentAreaM2 = currentRolls * rollArea
            const remainingRolls = Math.max(0, currentRolls - rollsDeducted)
            const remainingAreaM2 = Math.max(0, currentAreaM2 - consumption.totalAreaM2)

            const isRollTooNarrow =
              selectedMat &&
              selectedMat.parsed.effectiveWidthM + 0.035 < consumption.shortSideM

            return (
              <div
                key={job.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
              >
                {/* Job Header & Dimensions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    {jobsToComplete.length > 1 && (
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                      {job.job_number}
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {productName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold">
                      <Ruler className="w-3 h-3 text-indigo-500" />
                      {consumption.widthFt}ft × {consumption.heightFt}ft ({consumption.widthM}m × {consumption.heightM}m)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                      Qty: {consumption.quantity} • {consumption.totalAreaM2.toFixed(2)} m²
                    </span>
                  </div>
                </div>

                {/* Smart Auto-Selection Explanation */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-indigo-700 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    {rec.reason}
                  </span>
                </div>

                {/* Quick Roll Width Chips (if multiple rolls exist in the same family, e.g. 3FT, 4FT, 5FT, 10FT) */}
                {familyCandidates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Quick Select {rec.familyLabel} Roll Width:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {familyCandidates.map(cand => {
                        const isSelected = selectedId === cand.id
                        const fits = cand.parsed.effectiveWidthM + 0.035 >= consumption.shortSideM
                        const candArea = cand.parsed.effectiveAreaPerRollM2 * (Number(cand.qty_rolls) || 0)
                        const hasStock = (Number(cand.qty_rolls) || 0) > 0

                        return (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() =>
                              setSelectedMaterialByJob(prev => ({
                                ...prev,
                                [job.id]: cand.id,
                              }))
                            }
                            className={cn(
                              'text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2',
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : hasStock
                                ? 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                                : 'bg-slate-100/70 text-slate-400 border-slate-200'
                            )}
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs truncate">
                                {cand.name}
                              </div>
                              <div
                                className={cn(
                                  'text-[11px] font-mono tabular-nums mt-0.5 flex items-center gap-1.5',
                                  isSelected ? 'text-indigo-100' : 'text-slate-500'
                                )}
                              >
                                <span className="font-bold">{cand.parsed.widthSummary}</span>
                                <span>•</span>
                                <span>
                                  {Number(cand.qty_rolls).toFixed(2)} rolls ({candArea.toFixed(0)} m²)
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {fits ? (
                                <span
                                  className={cn(
                                    'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  )}
                                >
                                  Fits
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                    isSelected
                                      ? 'bg-amber-400/30 text-white'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  )}
                                >
                                  Narrow
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Full Dropdown Selector for Any Warehouse Material or No Deduction */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Selected Warehouse Roll to Deduct From:
                  </label>
                  <select
                    value={selectedId}
                    onChange={e =>
                      setSelectedMaterialByJob(prev => ({
                        ...prev,
                        [job.id]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="none">
                      — No Raw Material Roll Deduction (Paper / Outsource / Design) —
                    </option>
                    {familyCandidates.length > 0 && (
                      <optgroup label={`Recommended ${rec.familyLabel} Rolls`}>
                        {familyCandidates.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} — Width: {m.parsed.widthSummary} • Stock: {Number(m.qty_rolls).toFixed(2)} rolls (
                            {(Number(m.qty_rolls) * m.parsed.effectiveAreaPerRollM2).toFixed(1)} m²)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All Warehouse Materials">
                      {allMaterialsEnriched.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} — Width: {m.parsed.widthSummary} • Stock: {Number(m.qty_rolls).toFixed(2)} rolls (
                          {(Number(m.qty_rolls) * m.parsed.effectiveAreaPerRollM2).toFixed(1)} m²)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Live Stock Deduction Summary */}
                {selectedMat ? (
                  <div className="rounded-lg bg-white border border-slate-200/90 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {isRollTooNarrow ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-slate-800">
                          Deducting {consumption.totalAreaM2.toFixed(2)} m² ({rollsDeducted.toFixed(3)} rolls)
                        </span>
                        <span className="text-slate-500 ml-1">
                          from <strong>{selectedMat.name}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="font-mono tabular-nums text-[11px] font-semibold text-slate-600 shrink-0">
                      Stock after: <strong className="text-indigo-700">{remainingRolls.toFixed(2)} rolls</strong> ({remainingAreaM2.toFixed(1)} m²)
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex items-center gap-2 text-xs text-slate-600">
                    <Ban className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>No raw material will be deducted from warehouse inventory for this item.</span>
                  </div>
                )}

                {/* Remember choice checkbox */}
                {selectedMat && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={Boolean(saveDefaultByJob[job.id])}
                      onChange={e =>
                        setSaveDefaultByJob(prev => ({
                          ...prev,
                          [job.id]: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Remember <strong>{selectedMat.name}</strong> as the default family link for <strong>{productName}</strong>
                    </span>
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            Total Media Deduction:{' '}
            <strong className="text-indigo-700 font-bold">{totalDeductionM2.toFixed(2)} m²</strong>
          </div>

          <div className="flex items-center gap-2 justify-end">
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
              variant="success"
              loading={isSubmitting}
              onClick={handleConfirm}
              className="text-xs font-bold px-4"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {jobsToComplete.length > 1
                ? `Confirm & Complete All (${jobsToComplete.length})`
                : 'Confirm & Mark Completed'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
