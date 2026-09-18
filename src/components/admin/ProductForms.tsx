'use client'

import { useState, useTransition, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import {
  createProductType,
  toggleProductType,
  createPricingRule,
  updatePricingRule,
  deleteProductType,
  deletePricingRule,
  updateProductType,
  saveProductUnitPricing,
  createProductWithPricing
} from '@/app/actions/admin'
import { toast } from 'sonner'
import {
  Plus, Edit2, Check, X, Trash2, Settings2, DollarSign,
  Sparkles, Search, Filter, RefreshCw, ChevronDown
} from 'lucide-react'
import type {
  ProductType,
  DimensionUnit,
  JobSource,
  ProductPricingScheme,
  UnitPricingConfig,
} from '@/types/database'
import {
  convertRate,
  fromCmRate,
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  type UnitRates
} from '@/lib/pricing'

const DIMENSION_UNITS: DimensionUnit[] = ['ft', 'in', 'cm', 'm']

// ============================================================
// EDIT PRODUCT MODAL (Full Product & Multi-Unit Pricing Control)
// ============================================================
export function EditProductModal({
  product,
  initialScheme,
  isOpen,
  onClose
}: {
  product: ProductType
  initialScheme?: ProductPricingScheme
  isOpen: boolean
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(product.name)
  const [isActive, setIsActive] = useState(product.is_active)

  // Walk-in unit rates
  const [walkInRates, setWalkInRates] = useState<Record<DimensionUnit, string>>({
    ft: initialScheme?.walk_in?.ft?.toString() || '',
    in: initialScheme?.walk_in?.in?.toString() || '',
    cm: initialScheme?.walk_in?.cm?.toString() || '',
    m: initialScheme?.walk_in?.m?.toString() || '',
  })

  // Marketing unit rates
  const [marketingRates, setMarketingRates] = useState<Record<DimensionUnit, string>>({
    ft: initialScheme?.marketing?.ft?.toString() || '',
    in: initialScheme?.marketing?.in?.toString() || '',
    cm: initialScheme?.marketing?.cm?.toString() || '',
    m: initialScheme?.marketing?.m?.toString() || '',
  })

  const [activeTab, setActiveTab] = useState<'walk_in' | 'marketing'>('walk_in')

  if (!isOpen) return null

  const autoConvertRates = (source: 'walk_in' | 'marketing', baseUnit: DimensionUnit) => {
    const ratesObj = source === 'walk_in' ? walkInRates : marketingRates
    const baseVal = parseFloat(ratesObj[baseUnit])
    if (isNaN(baseVal) || baseVal <= 0) {
      toast.error(`Please enter a valid rate for ${baseUnit} first`)
      return
    }

    const updated: Record<DimensionUnit, string> = { ...ratesObj }
    for (const u of DIMENSION_UNITS) {
      if (u !== baseUnit) {
        const conv = convertRate(baseVal, baseUnit, u)
        updated[u] = conv >= 1 ? conv.toFixed(2) : conv >= 0.01 ? conv.toFixed(4) : conv.toFixed(6)
      }
    }

    if (source === 'walk_in') setWalkInRates(updated)
    else setMarketingRates(updated)
    toast.success(`Calculated other units based on ${baseUnit}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Product name cannot be empty')
      return
    }

    const parseRates = (obj: Record<DimensionUnit, string>): UnitRates => {
      const res: UnitRates = {}
      for (const u of DIMENSION_UNITS) {
        const n = parseFloat(obj[u])
        if (!isNaN(n) && n > 0) res[u] = n
      }
      return res
    }

    const scheme: ProductPricingScheme = {
      walk_in: parseRates(walkInRates),
      marketing: parseRates(marketingRates),
    }

    startTransition(async () => {
      // 1. Update product name and active status
      if (name.trim() !== product.name || isActive !== product.is_active) {
        const renameRes = await updateProductType(product.id, name.trim(), isActive)
        if (renameRes.error) {
          toast.error(renameRes.error)
          return
        }
      }

      // 2. Save unit pricing scheme
      const schemeRes = await saveProductUnitPricing(product.id, scheme)
      if (schemeRes.error) {
        toast.error(schemeRes.error)
        return
      }

      toast.success('Product and pricing updated successfully!')
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Edit Product Details & Pricing</h3>
              <p className="text-xs text-slate-500">Edit name, active status, and custom unit pricing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Product Name & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Product Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="input-standard h-11 text-base font-medium"
                placeholder="e.g. Rollup Banner, SAV Vinyl"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-full h-11 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {isActive ? 'Active (Ready)' : 'Inactive (Hidden)'}
              </button>
            </div>
          </div>

          {/* Unit Pricing Section */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/60 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Unit Pricing Rates
                </h4>
                <p className="text-xs text-slate-500">
                  Specify different prices for different measurement units.
                </p>
              </div>

              {/* Tabs: Walk-in vs Marketing */}
              <div className="flex bg-slate-200/70 p-1 rounded-lg self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('walk_in')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'walk_in'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Walk-in Rates
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('marketing')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'marketing'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Marketing Rates
                </button>
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'walk_in' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Walk-in Customer Rates (Standard)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Quick fill from:</span>
                    <button
                      type="button"
                      onClick={() => autoConvertRates('walk_in', 'ft')}
                      className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold transition-colors cursor-pointer"
                      title="Auto-calculate other units from ft²"
                    >
                      ft²
                    </button>
                    <button
                      type="button"
                      onClick={() => autoConvertRates('walk_in', 'in')}
                      className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold transition-colors cursor-pointer"
                      title="Auto-calculate other units from in²"
                    >
                      in²
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DIMENSION_UNITS.map(u => (
                    <div key={u} className="bg-white p-3 rounded-lg border border-slate-200">
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Rate per {UNIT_SHORT_LABELS[u]}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₵</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={walkInRates[u]}
                          onChange={e => setWalkInRates({ ...walkInRates, [u]: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Marketing / Contract Rates (Discounted)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Quick fill from:</span>
                    <button
                      type="button"
                      onClick={() => autoConvertRates('marketing', 'ft')}
                      className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold transition-colors cursor-pointer"
                      title="Auto-calculate other units from ft²"
                    >
                      ft²
                    </button>
                    <button
                      type="button"
                      onClick={() => autoConvertRates('marketing', 'in')}
                      className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold transition-colors cursor-pointer"
                      title="Auto-calculate other units from in²"
                    >
                      in²
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DIMENSION_UNITS.map(u => (
                    <div key={u} className="bg-white p-3 rounded-lg border border-slate-200">
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Rate per {UNIT_SHORT_LABELS[u]}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₵</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={marketingRates[u]}
                          onChange={e => setMarketingRates({ ...marketingRates, [u]: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} className="px-6">
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// EDIT PRODUCT BUTTON (Row Action)
// ============================================================
export function EditProductTypeButton({
  product,
  scheme
}: {
  product: ProductType
  scheme?: ProductPricingScheme
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
        title={`Edit ${product.name} & Pricing Scheme`}
      >
        <Edit2 className="w-4 h-4" />
      </button>

      <EditProductModal
        product={product}
        initialScheme={scheme}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

// ============================================================
// EDIT PRICING RULE MODAL (Full Rule Editing)
// ============================================================
export function EditPricingRuleModal({
  rule,
  productTypes,
  unitScheme,
  isOpen,
  onClose
}: {
  rule: any
  productTypes: ProductType[]
  unitScheme?: ProductPricingScheme
  isOpen: boolean
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [selectedProductId, setSelectedProductId] = useState(rule.product_type_id)
  const [selectedSource, setSelectedSource] = useState<JobSource>(rule.source)
  const [selectedUnit, setSelectedUnit] = useState<DimensionUnit>('ft')

  const initialRate = unitScheme?.[rule.source as JobSource]?.[selectedUnit] ?? fromCmRate(rule.unit_cost, selectedUnit)
  const [rate, setRate] = useState(initialRate >= 1 ? initialRate.toFixed(2) : initialRate.toFixed(4))

  const handleUnitChange = (newUnit: DimensionUnit) => {
    setSelectedUnit(newUnit)
    const customRate = unitScheme?.[selectedSource]?.[newUnit]
    if (customRate !== undefined) {
      setRate(customRate.toString())
    } else {
      const derived = fromCmRate(rule.unit_cost, newUnit)
      setRate(derived >= 1 ? derived.toFixed(2) : derived.toFixed(4))
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(rate)
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid rate greater than 0')
      return
    }

    startTransition(async () => {
      const res = await updatePricingRule(
        rule.id,
        num,
        selectedUnit,
        selectedProductId,
        selectedSource
      )
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pricing rule updated successfully!')
        onClose()
      }
    })
  }

  if (!isOpen) return null

  const numRate = parseFloat(rate) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Edit Pricing Rule</h3>
              <p className="text-xs text-slate-500">Edit product, customer source, unit, and rate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              required
              className="input-standard h-10 text-sm font-medium"
            >
              {productTypes.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Source</label>
            <div className="grid grid-cols-2 gap-3">
              {(['walk_in', 'marketing'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSource(s)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    selectedSource === s
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s === 'walk_in' ? 'Walk-in (Retail)' : 'Marketing (Bulk)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Measurement Unit</label>
              <select
                value={selectedUnit}
                onChange={e => handleUnitChange(e.target.value as DimensionUnit)}
                className="input-standard h-10 text-sm font-semibold text-indigo-700"
              >
                <option value="ft">ft² (Square Feet)</option>
                <option value="in">in² (Square Inches)</option>
                <option value="cm">cm² (Square Centimeters)</option>
                <option value="m">m² (Square Meters)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rate (₵ per {UNIT_SHORT_LABELS[selectedUnit]})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₵</span>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  className="input-standard pl-7 h-10 text-sm font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Quick Preview Conversion Card */}
          {numRate > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Equivalent Rates Across Units:
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {DIMENSION_UNITS.map(u => {
                  const conv = convertRate(numRate, selectedUnit, u)
                  return (
                    <div
                      key={u}
                      className={`p-1.5 rounded-lg border ${
                        u === selectedUnit
                          ? 'bg-indigo-50 border-indigo-200 font-bold text-indigo-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 uppercase">{u}²</div>
                      <div className="text-xs">₵{conv >= 1 ? conv.toFixed(2) : conv.toFixed(4)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} className="px-5">
              Save Rule
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// ADD PRODUCT MODAL (Unified Product + Pricing Creator)
// ============================================================
export function AddProductTypeModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [customizeUnits, setCustomizeUnits] = useState(false)

  const [baseUnit, setBaseUnit] = useState<DimensionUnit>('ft')
  const [walkInBaseRate, setWalkInBaseRate] = useState('')
  const [marketingBaseRate, setMarketingBaseRate] = useState('')

  const [walkInRates, setWalkInRates] = useState<Record<DimensionUnit, string>>({
    ft: '', in: '', cm: '', m: ''
  })
  const [marketingRates, setMarketingRates] = useState<Record<DimensionUnit, string>>({
    ft: '', in: '', cm: '', m: ''
  })

  if (!isOpen) return null

  const handleBaseRateChange = (source: 'walk_in' | 'marketing', val: string) => {
    if (source === 'walk_in') {
      setWalkInBaseRate(val)
      const num = parseFloat(val)
      if (!isNaN(num) && num > 0) {
        const updated: Record<DimensionUnit, string> = { ...walkInRates, [baseUnit]: val }
        for (const u of DIMENSION_UNITS) {
          if (u !== baseUnit) {
            const conv = convertRate(num, baseUnit, u)
            updated[u] = conv >= 1 ? conv.toFixed(2) : conv >= 0.01 ? conv.toFixed(4) : conv.toFixed(6)
          }
        }
        setWalkInRates(updated)
      }
    } else {
      setMarketingBaseRate(val)
      const num = parseFloat(val)
      if (!isNaN(num) && num > 0) {
        const updated: Record<DimensionUnit, string> = { ...marketingRates, [baseUnit]: val }
        for (const u of DIMENSION_UNITS) {
          if (u !== baseUnit) {
            const conv = convertRate(num, baseUnit, u)
            updated[u] = conv >= 1 ? conv.toFixed(2) : conv >= 0.01 ? conv.toFixed(4) : conv.toFixed(6)
          }
        }
        setMarketingRates(updated)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Product name is required')
      return
    }

    const parseRates = (obj: Record<DimensionUnit, string>): UnitRates => {
      const res: UnitRates = {}
      for (const u of DIMENSION_UNITS) {
        const n = parseFloat(obj[u])
        if (!isNaN(n) && n > 0) res[u] = n
      }
      return res
    }

    const walkInObj = parseRates(walkInRates)
    const marketingObj = parseRates(marketingRates)

    const scheme: ProductPricingScheme = {
      walk_in: Object.keys(walkInObj).length > 0 ? walkInObj : undefined,
      marketing: Object.keys(marketingObj).length > 0 ? marketingObj : undefined,
    }

    startTransition(async () => {
      const res = await createProductWithPricing(name.trim(), scheme)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Product "${name}" created with pricing scheme!`)
        setName('')
        setWalkInBaseRate('')
        setMarketingBaseRate('')
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Add New Product</h3>
              <p className="text-xs text-slate-500">Create a product and configure its pricing scheme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input-standard h-11 text-base font-medium"
              placeholder="e.g. Rollup Banner, SAV Vinyl, PVC Card"
              autoFocus
            />
          </div>

          {/* Pricing Scheme Box */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Initial Pricing Scheme (Optional)
                </h4>
                <p className="text-xs text-slate-500">Set standard prices per measurement unit</p>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Base Unit:</span>
                <select
                  value={baseUnit}
                  onChange={e => setBaseUnit(e.target.value as DimensionUnit)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  <option value="ft">ft² (sq ft)</option>
                  <option value="in">in² (sq in)</option>
                  <option value="cm">cm² (sq cm)</option>
                  <option value="m">m² (sq m)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Walk-in Rate (₵ per {UNIT_SHORT_LABELS[baseUnit]})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₵</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 2.80"
                    value={walkInBaseRate}
                    onChange={e => handleBaseRateChange('walk_in', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marketing Rate (₵ per {UNIT_SHORT_LABELS[baseUnit]})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₵</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 2.20"
                    value={marketingBaseRate}
                    onChange={e => handleBaseRateChange('marketing', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Toggle unit customization */}
            <div className="pt-2 border-t border-indigo-100/60">
              <button
                type="button"
                onClick={() => setCustomizeUnits(!customizeUnits)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {customizeUnits ? 'Hide individual unit rates' : 'Customize individual rates per unit (ft, in, cm, m)'}
              </button>

              {customizeUnits && (
                <div className="mt-3 space-y-3 pt-2 border-t border-indigo-100/40">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-2">Walk-in Unit Rates:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {DIMENSION_UNITS.map(u => (
                        <div key={u}>
                          <label className="block text-[11px] text-slate-500 mb-0.5">{UNIT_SHORT_LABELS[u]}</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={walkInRates[u]}
                            onChange={e => setWalkInRates({ ...walkInRates, [u]: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-2">Marketing Unit Rates:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {DIMENSION_UNITS.map(u => (
                        <div key={u}>
                          <label className="block text-[11px] text-slate-500 mb-0.5">{UNIT_SHORT_LABELS[u]}</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={marketingRates[u]}
                            onChange={e => setMarketingRates({ ...marketingRates, [u]: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} className="px-6">
              Create Product
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// ADD PRODUCT BUTTON TRIGGER
// ============================================================
export function AddProductTypeForm() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-indigo-600 hover:bg-indigo-50 font-semibold cursor-pointer"
      >
        <Plus className="w-4 h-4 mr-1" /> Add Product
      </Button>

      <AddProductTypeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

// ============================================================
// TOGGLE PRODUCT ACTIVE BUTTON
// ============================================================
export function ToggleProductTypeButton({ product }: { product: ProductType }) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    startTransition(async () => {
      const res = await toggleProductType(product.id, !product.is_active)
      if (res.error) {
        toast.error(res.error)
      }
    })
  }

  return (
    <button 
      onClick={handleToggle}
      disabled={isPending}
      className={`badge transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer ${product.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}
    >
      {product.is_active ? 'Active' : 'Inactive'}
    </button>
  )
}

// ============================================================
// DELETE PRODUCT BUTTON
// ============================================================
export function DeleteProductTypeButton({ product }: { product: ProductType }) {
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteProductType(product.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(res.message || 'Product deleted')
        setConfirmOpen(false)
      }
    })
  }

  if (confirmOpen) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
        <span className="text-xs text-rose-800 font-semibold">Delete?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          {isPending ? '...' : 'Yes'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(false)}
          disabled={isPending}
          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmOpen(true)}
      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
      title={`Delete ${product.name}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

// ============================================================
// ADD PRICING RULE FORM
// ============================================================
export function AddPricingRuleForm({ productTypes }: { productTypes: ProductType[] }) {
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useState(false)
  const [unit, setUnit] = useState<DimensionUnit>('ft')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('unit', unit)
    startTransition(async () => {
      const res = await createPricingRule(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pricing rule added')
        setIsAdding(false)
      }
    })
  }

  if (!isAdding) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="mt-2 text-indigo-600 hover:bg-indigo-50 font-semibold cursor-pointer">
        <Plus className="w-4 h-4 mr-1" /> Add Pricing Rule
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Product</label>
          <select name="productTypeId" required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs">
            {productTypes.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer Source</label>
          <select name="source" required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs">
            <option value="walk_in">Walk-in</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Measurement Unit</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as DimensionUnit)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
          >
            <option value="ft">ft² (Square Feet)</option>
            <option value="in">in² (Square Inches)</option>
            <option value="cm">cm² (Square Centimeters)</option>
            <option value="m">m² (Square Meters)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Rate (₵ per {UNIT_SHORT_LABELS[unit]})</label>
          <input
            type="number"
            name="unitCost"
            step="any"
            min="0.0001"
            placeholder="e.g. 2.80"
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-xs"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={isPending}>Save Rule</Button>
      </div>
    </form>
  )
}

// ============================================================
// PRICING RULE ROW (with Edit Modal trigger & delete)
// ============================================================
export function PricingRuleRow({
  rule,
  productTypes,
  unitScheme
}: {
  rule: any
  productTypes: ProductType[]
  unitScheme?: ProductPricingScheme
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const source = rule.source as 'walk_in' | 'marketing'

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deletePricingRule(rule.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pricing rule deleted')
        setConfirmDelete(false)
      }
    })
  }

  // Display rates
  const ftRate = unitScheme?.[source]?.ft ?? fromCmRate(rule.unit_cost, 'ft')
  const inRate = unitScheme?.[source]?.in ?? fromCmRate(rule.unit_cost, 'in')
  const cmRate = unitScheme?.[source]?.cm ?? rule.unit_cost

  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      <td className="font-semibold text-slate-900">{rule.product_types?.name}</td>
      <td>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
          rule.source === 'walk_in' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
        }`}>
          {rule.source === 'walk_in' ? 'Walk-in' : 'Marketing'}
        </span>
      </td>
      <td className="text-right">
        {confirmDelete ? (
          <div className="flex items-center justify-end gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
            <span className="text-xs text-rose-800 font-semibold">Delete rule?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? '...' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 group">
            <div className="flex items-center gap-1.5 text-right">
              <span className="text-slate-900 font-bold text-sm">
                ₵{ftRate >= 1 ? ftRate.toFixed(2) : ftRate.toFixed(4)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">/ft²</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-700 font-semibold text-xs">
                ₵{inRate >= 1 ? inRate.toFixed(2) : inRate.toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-400">/in²</span>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title="Edit Rule (Product, Source, Unit, Rate)"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <EditPricingRuleModal
          rule={rule}
          productTypes={productTypes}
          unitScheme={unitScheme}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      </td>
    </tr>
  )
}

// ============================================================
// PRICING RULES SECTION (With Real-Time Search and Filters)
// ============================================================
export function PricingRulesSection({
  pricingRules,
  productTypes,
  unitPricingConfig,
}: {
  pricingRules: any[]
  productTypes: ProductType[]
  unitPricingConfig: UnitPricingConfig
}) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'walk_in' | 'marketing'>('all')
  const [productFilter, setProductFilter] = useState<string>('all')

  const filteredRules = useMemo(() => {
    return (pricingRules || []).filter((rule: any) => {
      // Source filter
      if (sourceFilter !== 'all' && rule.source !== sourceFilter) return false

      // Product filter
      if (productFilter !== 'all' && rule.product_type_id !== productFilter) return false

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const prodName = (rule.product_types?.name || '').toLowerCase()
        const src = (rule.source || '').toLowerCase().replace('_', ' ')
        const ftRate = (unitPricingConfig[rule.product_type_id]?.[rule.source as JobSource]?.ft ?? fromCmRate(rule.unit_cost, 'ft')).toFixed(2)
        const inRate = (unitPricingConfig[rule.product_type_id]?.[rule.source as JobSource]?.in ?? fromCmRate(rule.unit_cost, 'in')).toFixed(4)
        const rawCost = (rule.unit_cost || '').toString()

        const matches =
          prodName.includes(q) ||
          src.includes(q) ||
          ftRate.includes(q) ||
          inRate.includes(q) ||
          rawCost.includes(q)

        if (!matches) return false
      }

      return true
    })
  }, [pricingRules, sourceFilter, productFilter, search, unitPricingConfig])

  const walkInCount = useMemo(() => (pricingRules || []).filter((r: any) => r.source === 'walk_in').length, [pricingRules])
  const marketingCount = useMemo(() => (pricingRules || []).filter((r: any) => r.source === 'marketing').length, [pricingRules])

  const hasActiveFilters = search.trim().length > 0 || sourceFilter !== 'all' || productFilter !== 'all'

  const resetFilters = () => {
    setSearch('')
    setSourceFilter('all')
    setProductFilter('all')
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90 space-y-3">
        {/* Row 1: Full-width Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rules by product name, source, or price..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Filters toolbar & Counter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          {/* Filter Pills & Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Source Tabs */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold shadow-xs">
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  sourceFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                All ({pricingRules?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('walk_in')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  sourceFilter === 'walk_in'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Walk-in ({walkInCount})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('marketing')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  sourceFilter === 'marketing'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Marketing ({marketingCount})
              </button>
            </div>

            {/* Product Dropdown */}
            <div className="relative inline-block">
              <select
                value={productFilter}
                onChange={e => setProductFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer shadow-xs min-w-[160px] leading-normal"
              >
                <option value="all">All Products</option>
                {productTypes.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Results counter */}
          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{filteredRules.length}</span> of{' '}
            <span className="font-bold text-slate-800">{pricingRules?.length || 0}</span> rules
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="table-container">
        <table className="table-standard">
          <thead>
            <tr>
              <th>Product</th>
              <th>Customer Source</th>
              <th className="text-right">Unit Rate (ft² / in²)</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule: any) => (
              <PricingRuleRow
                key={rule.id}
                rule={rule}
                productTypes={productTypes}
                unitScheme={unitPricingConfig[rule.product_type_id]}
              />
            ))}
            {filteredRules.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-10 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="w-6 h-6 text-slate-300" />
                    <p className="font-medium text-slate-600">No matching pricing rules found</p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="text-xs text-indigo-600 hover:underline font-semibold cursor-pointer"
                      >
                        Clear search filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddPricingRuleForm productTypes={productTypes} />
    </div>
  )
}

// ============================================================
// PRODUCTS SECTION (With Search & Full Editing Controls)
// ============================================================
export function ProductsSection({
  productTypes,
  pricingRules,
  unitPricingConfig
}: {
  productTypes: ProductType[]
  pricingRules: any[]
  unitPricingConfig: UnitPricingConfig
}) {
  const [search, setSearch] = useState('')

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return productTypes || []
    const q = search.toLowerCase().trim()
    return (productTypes || []).filter(p => p.name.toLowerCase().includes(q))
  }, [productTypes, search])

  return (
    <div className="space-y-4">
      {/* Search bar & Add Product Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/90">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products by name..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <AddProductTypeForm />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table-standard">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Unit Pricing Overview</th>
              <th>Status</th>
              <th className="text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((pt: any) => {
              const scheme = unitPricingConfig[pt.id]
              const walkInFt = scheme?.walk_in?.ft
              const walkInIn = scheme?.walk_in?.in

              const defaultRule = (pricingRules as any[])?.find(
                (r: any) => r.product_type_id === pt.id && r.source === 'walk_in'
              )
              const displayFt = walkInFt ?? (defaultRule ? fromCmRate(Number(defaultRule.unit_cost), 'ft') : null)
              const displayIn = walkInIn ?? (defaultRule ? fromCmRate(Number(defaultRule.unit_cost), 'in') : null)

              return (
                <tr key={pt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="font-semibold text-slate-900">
                    {pt.name}
                  </td>
                  <td>
                    {displayFt !== null ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                          ft²: ₵{displayFt >= 1 ? displayFt.toFixed(2) : displayFt.toFixed(4)}
                        </span>
                        {displayIn !== null && (
                          <span className="bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">
                            in²: ₵{displayIn >= 1 ? displayIn.toFixed(2) : displayIn.toFixed(4)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No pricing configured</span>
                    )}
                  </td>
                  <td>
                    <ToggleProductTypeButton product={pt} />
                  </td>
                  <td className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <EditProductTypeButton product={pt} scheme={scheme} />
                      <DeleteProductTypeButton product={pt} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">
                  <p className="font-medium text-slate-600">No products match your search</p>
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="text-xs text-indigo-600 hover:underline font-semibold mt-1 cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
