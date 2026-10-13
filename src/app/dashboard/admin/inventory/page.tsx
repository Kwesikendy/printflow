import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/admin/InventoryManager'
import { 
  getMaterialsAction, 
  getInventoryLogsAction,
  getProductTypesForMaterialsAction 
} from '@/app/actions/inventory'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Print Media & Material Inventory | PrintFlow',
  description: 'Manage printing media rolls, stock levels, valuations, and usage logs',
}

export default async function InventoryPage() {
  const supabase = await createClient()

  // 1. Strict Auth & Role check: ONLY admin and accountant
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const serviceSupabase = createServiceClient()
  const { data: profileData } = await (serviceSupabase as any)
    .from('profiles')
    .select('role, email, tenant_id, full_name')
    .eq('id', user.id)
    .single()
    
  const profile = profileData as any
  if (!profile) redirect('/login')

  const isAuthorized = profile.role === 'admin' || profile.role === 'accountant'
  if (!isAuthorized) {
    redirect('/dashboard')
  }

  // 2. Fetch Materials, Logs, and Product Types in parallel
  const [materialsRes, logsRes, productTypesRes] = await Promise.all([
    getMaterialsAction(profile.tenant_id),
    getInventoryLogsAction(profile.tenant_id, 100),
    getProductTypesForMaterialsAction(profile.tenant_id)
  ])

  return (
    <div className="w-full space-y-6">
      <InventoryManager 
        initialMaterials={materialsRes.data || []} 
        initialLogs={logsRes.data || []}
        productTypes={productTypesRes.data || []}
        userRole={profile.role}
        tenantId={profile.tenant_id}
      />
    </div>
  )
}
