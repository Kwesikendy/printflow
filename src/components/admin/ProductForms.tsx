'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { createProductType, toggleProductType, createPricingRule, updatePricingRule } from '@/app/actions/admin'
import { toast } from 'sonner'
import { Plus, Edit2, Check, X } from 'lucide-react'
import type { ProductType } from '@/types/database'

export function AddProductTypeForm() {
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createProductType(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Product type added')
        setIsAdding(false)
      }
    })
  }

  if (!isAdding) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="mt-2 text-indigo-600">
        <Plus className="w-4 h-4 mr-1" /> Add Product Type
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <input type="text" name="name" placeholder="e.g. Rollup Banner" required className="input-standard flex-1 h-9 text-sm" />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={isPending} className="flex-1 sm:flex-none">Save</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="flex-1 sm:flex-none">Cancel</Button>
      </div>
    </form>
  )
}

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
      className={`badge transition-opacity hover:opacity-80 disabled:opacity-50 ${product.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}
    >
      {product.is_active ? 'Active' : 'Inactive'}
    </button>
  )
}

export function AddPricingRuleForm({ productTypes }: { productTypes: ProductType[] }) {
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
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
      <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="mt-2 text-indigo-600">
        <Plus className="w-4 h-4 mr-1" /> Add Pricing Rule
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Product Type</label>
          <select name="productTypeId" required className="input-standard h-9 text-sm">
            {productTypes.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
          <select name="source" required className="input-standard h-9 text-sm">
            <option value="walk_in">Walk-in</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Unit Cost (₵)</label>
          <input type="number" name="unitCost" step="0.0001" min="0.0001" required className="input-standard h-9 text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={isPending}>Save Rule</Button>
      </div>
    </form>
  )
}

export function PricingRuleRow({ rule }: { rule: any }) {
  const [isEditing, setIsEditing] = useState(false)
  const [unitCost, setUnitCost] = useState(rule.unit_cost.toString())
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      const res = await updatePricingRule(rule.id, parseFloat(unitCost))
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pricing rule updated')
        setIsEditing(false)
      }
    })
  }

  const handleCancel = () => {
    setUnitCost(rule.unit_cost.toString())
    setIsEditing(false)
  }

  return (
    <tr>
      <td className="font-medium text-slate-900">{rule.product_types?.name}</td>
      <td className="capitalize">{rule.source.replace('_', '-')}</td>
      <td className="text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-slate-500 font-medium">₵</span>
            <input 
              type="number" 
              step="0.0001" 
              min="0.0001" 
              value={unitCost} 
              onChange={(e) => setUnitCost(e.target.value)} 
              className="input-standard h-8 w-24 text-right text-sm font-medium text-green-600"
              disabled={isPending}
            />
            <button onClick={handleSave} disabled={isPending} className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors" title="Save">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} disabled={isPending} className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 group">
            <span className="text-green-600 font-medium">₵{rule.unit_cost.toFixed(4)}</span>
            <button onClick={() => setIsEditing(true)} className="text-slate-300 hover:text-indigo-600 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Edit">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
