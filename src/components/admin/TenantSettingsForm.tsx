'use client'

import { useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { updateTenantSettings } from '@/app/actions/admin'
import { toast } from 'sonner'
import { Settings2, Save, Upload, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

export function TenantSettingsForm({ tenant }: { tenant: any }) {
  const [isPending, startTransition] = useTransition()
  const [logoPreview, setLogoPreview] = useState<string | null>(tenant?.logo_url || null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be under 5MB')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (logoFile) formData.set('logo', logoFile)
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
        <label className="block text-sm font-medium text-slate-500 mb-1">Company Name</label>
        <input
          type="text"
          name="name"
          defaultValue={tenant?.name || ''}
          required
          className="input-standard bg-white border-indigo-200"
        />
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-3">Company Logo</label>
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt="Company Logo"
                width={96}
                height={96}
                className="object-contain w-full h-full p-1"
                unoptimized
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-indigo-300 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {logoPreview ? 'Change Logo' : 'Upload Logo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <p className="text-xs text-slate-400 mt-2">
              PNG, JPG, SVG (max 5MB). This logo will appear on the loading screen and login page.
            </p>
            {logoFile && (
              <p className="text-xs text-indigo-600 mt-1 font-medium">? {logoFile.name} selected</p>
            )}
          </div>
        </div>
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
          These settings are applied globally. The logo appears on the loading screen and login page.
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
