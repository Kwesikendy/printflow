import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/admin/InventoryManager'
import { getMaterialsAction } from '@/app/actions/inventory'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Material Inventory | PrintFlow',
}

export default async function InventoryPage() {
  const supabase = await createClient()

  // 1. Check Auth & Role
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, email, tenant_id')
    .eq('id', user.id)
    .single()
    
  const profile = profileData as any

  if (!profile) redirect('/login')

  const isAuthorized = profile.role === 'admin' || profile.email === 'd.opare@printdpigh.com'
  if (!isAuthorized) {
    redirect('/dashboard') // unauthorized users get booted to main dashboard
  }

  // 2. Fetch Materials
  const { data: materials } = await getMaterialsAction(profile.tenant_id)

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Material Inventory</h1>
          <p className="text-slate-500 mt-1">Manage print materials, roll sizes, and stock levels.</p>
        </div>
      </div>

      <InventoryManager initialMaterials={materials || []} />
    </div>
  )
}
