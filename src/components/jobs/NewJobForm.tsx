'use client'

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { createJobGroupAction, type JobItem } from '@/app/actions/jobs'
import { searchCustomers, type CustomerSuggestion } from '@/app/actions/customers'
import { toast } from 'sonner'
import { cn, formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ruler, FileText, CheckCircle2, Plus, Trash2, Upload,
  ChevronDown, User, Search
} from 'lucide-react'
import type { ProductType, PricingRule, StandardSize, JobSource, DimensionUnit, UnitPricingConfig } from '@/types/database'
import { resolveUnitRate, UNIT_SHORT_LABELS } from '@/lib/pricing'

interface NewJobFormProps {
  productTypes: ProductType[]
  pricingRules: PricingRule[]
  standardSizes: StandardSize[]
  unitPricingConfig?: UnitPricingConfig
}

const DIMENSION_UNITS: { value: DimensionUnit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'm',  label: 'm'  },
  { value: 'ft', label: 'ft' },
  { value: 'in', label: 'in' },
]

function toCm(value: number, unit: DimensionUnit): number {
  switch (unit) {
    case 'cm': return value
    case 'm':  return value * 100
    case 'ft': return value * 30.48
    case 'in': return value * 2.54
  }
}

function calculateArea(w: number, h: number): number {
  return w * h
}

function calculateLineTotal(area: number, unitCost: number, qty: number): number {
  return area * unitCost * qty
}

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.95, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      className="text-4xl font-extrabold text-emerald-600 tracking-tight block mt-1"
    >
      {formatCurrency(value)}
    </motion.span>
  )
}

interface LineItemState {
  id: string
  productTypeId: string
  useStandardSize: boolean
  standardSizeId: string
  width: string
  height: string
  dimensionUnit: DimensionUnit
  quantity: string
  manualUnitCost: string
  notes: string
  artworkFile: File | null
  artworkName: string
}

function createLineItem(productTypes: ProductType[]): LineItemState {
  return {
    id: Math.random().toString(36).substring(2),
    productTypeId: productTypes[0]?.id || '',
    useStandardSize: true,
    standardSizeId: '',
    width: '',
    height: '',
    dimensionUnit: 'cm',
    quantity: '1',
    manualUnitCost: '',
    notes: '',
    artworkFile: null,
    artworkName: '',
  }
}

function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (s: CustomerSuggestion) => void
}) {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) { setSuggestions([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      const results = await searchCustomers(value)
      setSuggestions(results)
      setOpen(results.length > 0)
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          required
          className="input-standard bg-slate-50 border-slate-200 pl-9"
          placeholder="Type name to search or add new..."
          autoComplete="off"
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{ zIndex: 9999 }}
            className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 transition-colors border-b border-slate-100 last:border-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(s);
                    setOpen(false);
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.customer_name}</p>
                    {s.customer_phone && <p className="text-xs text-slate-500">{s.customer_phone}</p>}
                  </div>
                  <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                    {s.source.replace('_', ' ')}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function LineItemCard({
  item,
  index,
  total,
  productTypes,
  pricingRules,
  standardSizes,
  unitPricingConfig,
  source,
  onUpdate,
  onRemove,
}: {
  item: LineItemState
  index: number
  total: number
  productTypes: ProductType[]
  pricingRules: PricingRule[]
  standardSizes: StandardSize[]
  unitPricingConfig?: UnitPricingConfig
  source: JobSource
  onUpdate: (id: string, updates: Partial<LineItemState>) => void
  onRemove: (id: string) => void
}) {
  const u = (updates: Partial<LineItemState>) => onUpdate(item.id, updates)

  const effectiveUnit: DimensionUnit = item.useStandardSize ? 'cm' : item.dimensionUnit

  const activePricingRule = useMemo(() =>
    pricingRules.find(r => r.product_type_id === item.productTypeId && r.source === source),
    [pricingRules, item.productTypeId, source]
  )

  useEffect(() => {
    const rate = resolveUnitRate(
      unitPricingConfig,
      item.productTypeId,
      source,
      effectiveUnit,
      activePricingRule?.unit_cost
    )
    if (rate > 0) {
      const formatted = rate >= 1 ? rate.toFixed(2) : rate >= 0.01 ? rate.toFixed(4) : rate.toFixed(6)
      u({ manualUnitCost: formatted })
    } else {
      u({ manualUnitCost: '' })
    }
  }, [item.productTypeId, source, effectiveUnit, activePricingRule?.id, unitPricingConfig])

  const finalWidth = item.useStandardSize && item.standardSizeId
    ? (standardSizes.find(s => s.id === item.standardSizeId)?.width || 0)
    : (parseFloat(item.width) || 0)

  const finalHeight = item.useStandardSize && item.standardSizeId
    ? (standardSizes.find(s => s.id === item.standardSizeId)?.height || 0)
    : (parseFloat(item.height) || 0)

  const unitCost = parseFloat(item.manualUnitCost) || 0
  const parsedQty = parseInt(item.quantity, 10) || 1
  const area = calculateArea(finalWidth, finalHeight)
  const lineTotal = calculateLineTotal(area, unitCost, parsedQty)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file && file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Max 100MB allowed.')
      e.target.value = ''
      return
    }
    u({ artworkFile: file, artworkName: file?.name || '' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="relative"
    >
      <Card className="border-indigo-100">
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </div>
              <h4 className="font-semibold text-slate-800">Job Item {index + 1}</h4>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-emerald-600">{formatCurrency(lineTotal)}</span>
              {total > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Product Type</label>
            <select
              className="input-standard bg-slate-50 border-slate-200 font-medium h-12"
              value={item.productTypeId}
              onChange={e => u({ productTypeId: e.target.value })}
            >
              {productTypes.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Size */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-400" /> Dimensions
              </label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => u({ useStandardSize: true })}
                  className={cn('px-3 py-1.5 transition-colors', item.useStandardSize ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => u({ useStandardSize: false })}
                  className={cn('px-3 py-1.5 transition-colors', !item.useStandardSize ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
                >
                  Custom
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {item.useStandardSize ? (
                <motion.div key="std" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <select
                    className="input-standard bg-slate-50 h-12"
                    value={item.standardSizeId}
                    onChange={e => u({ standardSizeId: e.target.value })}
                  >
                    <option value="">Select standard size...</option>
                    {standardSizes.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.width} × {s.height} cm)</option>
                    ))}
                  </select>
                </motion.div>
              ) : (
                <motion.div key="custom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Width</label>
                    <input
                      type="number" step="0.01" min="0.01"
                      className="input-standard bg-slate-50 h-12"
                      value={item.width}
                      onChange={e => u({ width: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Height</label>
                    <input
                      type="number" step="0.01" min="0.01"
                      className="input-standard bg-slate-50 h-12"
                      value={item.height}
                      onChange={e => u({ height: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
                    <select
                      className="input-standard bg-white border-indigo-200 h-12 font-semibold text-indigo-700 w-20"
                      value={item.dimensionUnit}
                      onChange={e => u({ dimensionUnit: e.target.value as DimensionUnit })}
                    >
                      {DIMENSION_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Qty + Unit Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
              <input
                type="number" min="1"
                className="input-standard bg-slate-50 h-12"
                value={item.quantity}
                onChange={e => u({ quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
                <span>Unit Cost (₵ per {UNIT_SHORT_LABELS[effectiveUnit]})</span>
                <span className="text-xs text-indigo-500 font-normal">Editable</span>
              </label>
              <input
                type="number" step="0.0001" min="0.0001"
                className="input-standard bg-white border-indigo-200 focus:ring-indigo-500 h-12 shadow-sm font-medium text-indigo-900"
                value={item.manualUnitCost}
                onChange={e => u({ manualUnitCost: e.target.value })}
              />
            </div>
          </div>

          {/* Artwork Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Upload Artwork</label>
            <label className={cn(
              'flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors',
              item.artworkName ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            )}>
              <Upload className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-slate-600 truncate">
                  {item.artworkName || 'Click to upload (images, PDF — max 100MB)'}
                </p>
              </div>
              <input
                type="file"
                accept="image/*,.pdf,.ai,.psd,.eps"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
            <textarea
              rows={2}
              className="input-standard bg-slate-50 resize-none"
              placeholder="Special requirements..."
              value={item.notes}
              onChange={e => u({ notes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function NewJobForm({
  productTypes,
  pricingRules,
  standardSizes,
  unitPricingConfig
}: NewJobFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [source, setSource] = useState<JobSource>('walk_in')
  const [items, setItems] = useState<LineItemState[]>([createLineItem(productTypes)])

  const updateItem = useCallback((id: string, updates: Partial<LineItemState>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const addItem = () => setItems(prev => [...prev, createLineItem(productTypes)])

  const handleSelectCustomer = (s: CustomerSuggestion) => {
    setCustomerName(s.customer_name)
    setCustomerPhone(s.customer_phone || '')
    setSource(s.source as JobSource)
  }

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const finalWidth = item.useStandardSize && item.standardSizeId
        ? (standardSizes.find(s => s.id === item.standardSizeId)?.width || 0)
        : (parseFloat(item.width) || 0)
      const finalHeight = item.useStandardSize && item.standardSizeId
        ? (standardSizes.find(s => s.id === item.standardSizeId)?.height || 0)
        : (parseFloat(item.height) || 0)
      const area = calculateArea(finalWidth, finalHeight)
      const lineTotal = calculateLineTotal(area, parseFloat(item.manualUnitCost) || 0, parseInt(item.quantity) || 1)
      return sum + lineTotal
    }, 0)
  }, [items, standardSizes])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!customerName.trim()) { toast.error('Customer name is required'); return }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const w = it.useStandardSize && it.standardSizeId
        ? (standardSizes.find(s => s.id === it.standardSizeId)?.width || 0)
        : parseFloat(it.width) || 0
      const h = it.useStandardSize && it.standardSizeId
        ? (standardSizes.find(s => s.id === it.standardSizeId)?.height || 0)
        : parseFloat(it.height) || 0
      if (w <= 0 || h <= 0) { toast.error(`Job ${i + 1}: Dimensions must be greater than 0`); return }
      if ((parseFloat(it.manualUnitCost) || 0) <= 0) { toast.error(`Job ${i + 1}: Unit cost must be greater than 0`); return }
    }

    const jobItems: JobItem[] = items.map(it => ({
      productTypeId: it.productTypeId,
      width: it.useStandardSize && it.standardSizeId
        ? (standardSizes.find(s => s.id === it.standardSizeId)?.width || 0)
        : parseFloat(it.width) || 0,
      height: it.useStandardSize && it.standardSizeId
        ? (standardSizes.find(s => s.id === it.standardSizeId)?.height || 0)
        : parseFloat(it.height) || 0,
      dimensionUnit: it.useStandardSize ? 'cm' : it.dimensionUnit,
      quantity: parseInt(it.quantity) || 1,
      unitCost: parseFloat(it.manualUnitCost) || 0,
      notes: it.notes || undefined,
      artworkFile: it.artworkFile,
    }))

    startTransition(async () => {
      const res = await createJobGroupAction(customerName, customerPhone || null, source, jobItems)
      if (res.error) {
        toast.error(res.error)
      } else if (res.success && res.data) {
        const itemCount = res.data.jobs?.length || 1
        toast.success(`Order created! ${itemCount} job${itemCount > 1 ? 's' : ''} — Invoice ${res.data.invoice_number}`)
        router.push(`/dashboard/jobs/group/${res.data.group_id}`)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* LEFT COLUMN */}
      <div className="lg:col-span-2 space-y-6">
        <form id="new-job-form" onSubmit={handleSubmit} className="space-y-6">

          {/* Customer Details — elevated z-index so autocomplete floats above job items */}
          <div className="relative" style={{ zIndex: 1000 }}>
          <Card className="overflow-visible">
            <CardContent className="p-4 sm:p-8 overflow-visible">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Customer Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Name</label>
                  <CustomerAutocomplete
                    value={customerName}
                    onChange={setCustomerName}
                    onSelect={handleSelectCustomer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone (Optional)</label>
                  <input
                    type="text"
                    className="input-standard bg-slate-50 border-slate-200"
                    placeholder="024 123 4567"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Job Source</label>
                  <div className="grid grid-cols-2 gap-4">
                    {(['walk_in', 'marketing'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSource(s)}
                        className={cn(
                          'relative flex flex-col items-center p-4 rounded-xl border-2 text-sm font-medium transition-all shadow-sm',
                          source === s ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                        )}
                      >
                        {s === 'walk_in' ? 'Walk-In (Retail)' : 'Marketing (Bulk)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>{/* end elevated z-index wrapper */}

          {/* Job Line Items */}
          <AnimatePresence>
            {items.map((item, index) => (
              <LineItemCard
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                productTypes={productTypes}
                pricingRules={pricingRules}
                standardSizes={standardSizes}
                unitPricingConfig={unitPricingConfig}
                source={source}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </AnimatePresence>

          {/* Add Job Button */}
          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-semibold hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Another Job
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN — SUMMARY */}
      <div className="lg:col-span-1 relative">
        <div className="sticky top-24">
          <Card className="border-indigo-100 shadow-xl shadow-indigo-900/5 ring-1 ring-slate-900/5 bg-white/95 backdrop-blur-xl">
            <CardContent className="p-8">
              <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Order Summary
              </h3>

              <div className="space-y-2 mb-4">
                {items.map((item, index) => {
                  const pt = productTypes.find(p => p.id === item.productTypeId)
                  const w = item.useStandardSize && item.standardSizeId
                    ? (standardSizes.find(s => s.id === item.standardSizeId)?.width || 0)
                    : parseFloat(item.width) || 0
                  const h = item.useStandardSize && item.standardSizeId
                    ? (standardSizes.find(s => s.id === item.standardSizeId)?.height || 0)
                    : parseFloat(item.height) || 0
                  const area = calculateArea(w, h)
                  const lt = calculateLineTotal(area, parseFloat(item.manualUnitCost) || 0, parseInt(item.quantity) || 1)
                  return (
                    <div key={item.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 last:border-none">
                      <span className="text-slate-600 truncate max-w-[60%]">
                        {index + 1}. {pt?.name || 'Item'}
                      </span>
                      <span className="font-semibold text-slate-900">{formatCurrency(lt)}</span>
                    </div>
                  )
                })}
              </div>

              <div className="pt-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60 shadow-inner mb-6 relative overflow-hidden">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Grand Total ({items.length} item{items.length > 1 ? 's' : ''})
                </div>
                <AnimatedNumber value={grandTotal} />
              </div>

              <Button
                type="submit"
                form="new-job-form"
                loading={isPending}
                disabled={grandTotal <= 0}
                className="w-full h-14 text-base font-semibold shadow-indigo-600/20 shadow-lg hover:shadow-indigo-600/30 transition-all rounded-xl"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Create Order & Quote
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
