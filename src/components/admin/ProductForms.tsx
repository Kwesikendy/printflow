'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { createProductType, toggleProductType, createPricingRule } from '@/app/actions/admin'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
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
    <form onSubmit={handleSubmit} className="flex items-center gap-3 mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <input type="text" name="name" placeholder="e.g. Rollup Banner" required className="input-standard flex-1 h-9 text-sm" />
      <Button type="submit" size="sm" loading={isPending}>Save</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
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
