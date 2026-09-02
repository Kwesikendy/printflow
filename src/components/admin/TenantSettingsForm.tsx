'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { updateTenantSettings } from '@/app/actions/admin'
import { toast } from 'sonner'
import { Settings2, Save } from 'lucide-react'

export function TenantSettingsForm({ tenant }: { tenant: any }) {
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateTenantSettings(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Settings updated successfully')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Tenant Name</label>
        <input 
          type="text" 
          name="name"
          defaultValue={tenant?.name || ''} 
          required
          className="input-standard bg-white border-indigo-200" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Currency</label>
          <input 
            type="text" 
            name="currency"
            defaultValue={tenant?.currency || 'GHS'} 
            required
            className="input-standard bg-white border-indigo-200" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Measurement Unit</label>
          <select name="area_unit" defaultValue={tenant?.area_unit || 'cm2'} className="input-standard bg-white border-indigo-200 h-[42px]">
            <option value="cm2">Square Centimeters (cm²)</option>
            <option value="m2">Square Meters (m²)</option>
            <option value="in2">Square Inches (in²)</option>
          </select>
        </div>
      </div>

      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-3">
        <Settings2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          These settings are applied globally across all jobs and pricing rules.
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isPending}>
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </div>
    </form>
  )
}
