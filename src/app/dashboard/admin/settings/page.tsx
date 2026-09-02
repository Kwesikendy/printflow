import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { AREA_UNIT_LABELS } from '@/lib/utils'
import { Settings2 } from 'lucide-react'
import { TenantSettingsForm } from '@/components/admin/TenantSettingsForm'

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
          <TenantSettingsForm tenant={tenant} />
        </CardContent>
      </Card>
    </div>
  )
}
