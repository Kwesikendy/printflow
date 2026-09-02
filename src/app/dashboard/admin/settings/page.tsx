import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { AREA_UNIT_LABELS } from '@/lib/utils'
import { Settings2 } from 'lucide-react'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('*')
    .single()
  
  const tenant = tenantData as any

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader 
          title="Tenant Configuration" 
          description="Global settings for your print shop." 
        />
        <CardContent>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Tenant Name</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={tenant?.name || ''} 
                  disabled
                  className="input-standard bg-slate-50 text-slate-600" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Currency</label>
                <input 
                  type="text" 
                  value={tenant?.currency || 'GHS'} 
                  disabled
                  className="input-standard bg-slate-50 text-slate-600" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Measurement Unit</label>
                <div className="input-standard bg-slate-50 text-slate-600 flex items-center h-[38px]">
                  {tenant?.area_unit ? AREA_UNIT_LABELS[tenant.area_unit as keyof typeof AREA_UNIT_LABELS] : 'cm²'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-3">
              <Settings2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                These settings are applied globally across all jobs and pricing rules. 
                For the MVP demo, configuration changes must be done directly in the database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
