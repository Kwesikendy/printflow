'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createJob } from '@/app/actions/jobs'
import { formatCurrency, calculateArea, calculateLineTotal, cn } from '@/lib/utils'
import type { ProductType, PricingRule, StandardSize, JobSource } from '@/types/database'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Ruler, FileText, CheckCircle2 } from 'lucide-react'

interface NewJobFormProps {
  productTypes: ProductType[]
  pricingRules: PricingRule[]
  standardSizes: StandardSize[]
}

// Animate numbers smoothly
function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.95, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1, color: '#059669' }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      className="text-4xl font-extrabold text-emerald-600 tracking-tight block mt-1"
    >
      {formatCurrency(value)}
    </motion.span>
  )
}

export function NewJobForm({ productTypes, pricingRules, standardSizes }: NewJobFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const [source, setSource] = useState<JobSource>('walk_in')
  const [productTypeId, setProductTypeId] = useState<string>(productTypes[0]?.id || '')
  
  const [useStandardSize, setUseStandardSize] = useState(true)
  const [standardSizeId, setStandardSizeId] = useState<string>('')
  
  const [width, setWidth] = useState<string>('')
  const [height, setHeight] = useState<string>('')
  
  const [quantity, setQuantity] = useState<string>('1')
  const [manualUnitCost, setManualUnitCost] = useState<string>('')

  const activePricingRule = useMemo(() => {
    return pricingRules.find(r => r.product_type_id === productTypeId && r.source === source)
  }, [pricingRules, productTypeId, source])

  // Smart default: Update manual unit cost when product or source changes
  useEffect(() => {
    if (activePricingRule) {
      setManualUnitCost(activePricingRule.unit_cost.toString())
    } else {
      setManualUnitCost('')
    }
  }, [activePricingRule])

  const unitCost = parseFloat(manualUnitCost) || 0

  const finalWidth = useMemo(() => {
    if (useStandardSize && standardSizeId) {
      return standardSizes.find(s => s.id === standardSizeId)?.width || 0
    }
    return parseFloat(width) || 0
  }, [useStandardSize, standardSizeId, width, standardSizes])

  const finalHeight = useMemo(() => {
    if (useStandardSize && standardSizeId) {
      return standardSizes.find(s => s.id === standardSizeId)?.height || 0
    }
    return parseFloat(height) || 0
  }, [useStandardSize, standardSizeId, height, standardSizes])

  const parsedQty = parseInt(quantity, 10) || 1
  const area = calculateArea(finalWidth, finalHeight)
  const total = calculateLineTotal(area, unitCost, parsedQty)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (finalWidth <= 0 || finalHeight <= 0) {
      toast.error('Dimensions must be greater than 0.')
      return
    }
    if (unitCost <= 0) {
      toast.error('Unit Cost must be greater than 0.')
      return
    }

    const formData = new FormData(e.currentTarget)
    if (useStandardSize) {
      formData.set('width', finalWidth.toString())
      formData.set('height', finalHeight.toString())
    }
    
    startTransition(async () => {
      const res = await createJob(formData)
      if (res.error) {
        toast.error(res.error)
      } else if (res.success && res.data) {
        toast.success(`Job ${res.data.job_number} created!`)
        router.push(`/dashboard/jobs/${res.data.job_id}`)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* LEFT COLUMN - FORM */}
      <div className="lg:col-span-2 space-y-8">
        <form id="new-job-form" onSubmit={handleSubmit} className="space-y-8">
          
          <Card>
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Customer Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Name</label>
                  <input type="text" name="customerName" required className="input-standard bg-slate-50 border-slate-200" placeholder="Enter name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number (Optional)</label>
                  <input type="text" name="customerPhone" className="input-standard bg-slate-50 border-slate-200" placeholder="024 123 4567" />
                </div>
                <div className="md:col-span-2 mt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Job Source</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSource('walk_in')}
                      className={cn(
                        "relative flex flex-col items-center p-4 rounded-xl border-2 text-sm font-medium transition-all shadow-sm",
                        source === 'walk_in' ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                      )}
                    >
                      Walk-In (Retail)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSource('marketing')}
                      className={cn(
                        "relative flex flex-col items-center p-4 rounded-xl border-2 text-sm font-medium transition-all shadow-sm",
                        source === 'marketing' ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                      )}
                    >
                      Marketing (Bulk)
                    </button>
                  </div>
                  <input type="hidden" name="source" value={source} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shadow-sm">
                  <Ruler className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Job Specifications</h3>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Product Type</label>
                  <select 
                    name="productTypeId" 
                    className="input-standard bg-slate-50 border-slate-200 font-medium h-12"
                    value={productTypeId}
                    onChange={(e) => setProductTypeId(e.target.value)}
                  >
                    {productTypes.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Upload Artwork</label>
                  <input 
                    type="file" 
                    name="artwork" 
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2.5 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100
                      border border-slate-200 rounded-md bg-slate-50 cursor-pointer"
                  />
                  <p className="mt-1 text-xs text-slate-500">Max file size: 10MB (PDF, PNG, JPG)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Dimensions</label>
                  {/* Segmented Control */}
                  <div className="flex p-1 bg-slate-100 rounded-lg mb-4 w-full md:w-max border border-slate-200/60 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setUseStandardSize(true)}
                      className={cn(
                        "flex-1 md:w-32 py-2 px-4 text-sm font-medium rounded-md transition-all",
                        useStandardSize ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      Standard Size
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseStandardSize(false)}
                      className={cn(
                        "flex-1 md:w-32 py-2 px-4 text-sm font-medium rounded-md transition-all",
                        !useStandardSize ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      Custom Size
                    </button>
                  </div>

                  {useStandardSize ? (
                    <motion.div 
                      key="standard"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2"
                    >
                      <select 
                        className="input-standard bg-slate-50 h-12"
                        value={standardSizeId}
                        onChange={(e) => setStandardSizeId(e.target.value)}
                      >
                        <option value="">Select standard size...</option>
                        {standardSizes.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.width} × {s.height})</option>
                        ))}
                      </select>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="custom"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-4 mt-2"
                    >
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Width</label>
                        <input 
                          type="number" 
                          name="width" 
                          step="0.01" 
                          min="0.1"
                          className="input-standard bg-slate-50 h-12" 
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          required={!useStandardSize}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Height</label>
                        <input 
                          type="number" 
                          name="height" 
                          step="0.01" 
                          min="0.1"
                          className="input-standard bg-slate-50 h-12" 
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          required={!useStandardSize}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
                    <input 
                      type="number" 
                      name="quantity" 
                      min="1" 
                      className="input-standard bg-slate-50 h-12" 
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between items-center">
                      Unit Cost (₵)
                      <span className="text-xs text-indigo-500 font-normal">Editable</span>
                    </label>
                    <input 
                      type="number" 
                      name="unitCost" 
                      step="0.0001"
                      min="0.0001" 
                      className="input-standard bg-white border-indigo-200 focus:ring-indigo-500 h-12 shadow-sm font-medium text-indigo-900" 
                      value={manualUnitCost}
                      onChange={(e) => setManualUnitCost(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Optional Notes</label>
                  <textarea name="notes" rows={3} className="input-standard bg-slate-50 resize-none" placeholder="Add any specific requirements..."></textarea>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      {/* RIGHT COLUMN - STICKY SUMMARY */}
      <div className="lg:col-span-1 relative h-full">
        <div className="sticky top-24">
          <Card className="border-indigo-100 shadow-xl shadow-indigo-900/5 ring-1 ring-slate-900/5 bg-white/95 backdrop-blur-xl">
            <CardContent className="p-8">
              <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Quote
              </h3>
              
              <div className="pt-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60 shadow-inner mb-6 relative overflow-hidden">
                <motion.div 
                  key={total}
                  initial={{ opacity: 0.5, scale: 0.98, backgroundColor: "rgba(16, 185, 129, 0.1)" }}
                  animate={{ opacity: 1, scale: 1, backgroundColor: "rgba(16, 185, 129, 0)" }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 z-0 pointer-events-none"
                />
                <div className="relative z-10">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Estimated Total</div>
                  <AnimatedNumber value={total} />
                </div>
              </div>

              <details className="group [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center gap-2 text-sm font-medium text-slate-500 cursor-pointer hover:text-slate-900 transition-colors select-none mb-4">
                  <span className="transition group-open:rotate-90">▶</span>
                  Cost Breakdown
                </summary>
                
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="space-y-4 pt-2 pb-4 border-l-2 border-slate-100 pl-4 ml-1 overflow-hidden"
                >
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Unit Cost</span>
                    <span className="text-sm text-slate-900 font-semibold">{unitCost > 0 ? `₵${unitCost.toFixed(4)}` : 'N/A'}</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Dimensions</span>
                    <span className="text-sm text-slate-900 font-semibold">{finalWidth} × {finalHeight}</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Total Area</span>
                    <span className="text-sm text-slate-900 font-semibold">{area > 0 ? area.toFixed(2) : '0'}</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Quantity</span>
                    <span className="text-sm text-slate-900 font-semibold">{parsedQty}</span>
                  </div>
                </motion.div>
              </details>

              <div className="mt-8">
                <Button 
                  type="submit" 
                  form="new-job-form" 
                  loading={isPending} 
                  disabled={unitCost <= 0 || finalWidth <= 0 || finalHeight <= 0}
                  className="w-full h-14 text-base font-semibold shadow-indigo-600/20 shadow-lg hover:shadow-indigo-600/30 transition-all rounded-xl"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Create Job & Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
