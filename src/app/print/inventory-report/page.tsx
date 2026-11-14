import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { InventoryReportPrint } from '@/components/admin/InventoryReportPrint'

export const metadata: Metadata = {
  title: 'Inventory Stock Additions & Movement Report - PrintFlow',
}

export default async function PrintInventoryReportPage(props: {
  searchParams: Promise<{ focus?: string; period?: string }>
}) {
  const searchParams = await props.searchParams
  const initialFocus = searchParams.focus || 'add_stock'
  const initialPeriod = searchParams.period || 'all'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8 text-sm text-slate-600">Unauthorized</div>

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(name, logo_url)')
    .eq('id', user.id)
    .single()

  const anyProfile = profile as any
  if (!anyProfile || !anyProfile.tenants) {
    return <div className="p-8 text-sm text-slate-600">Tenant not found</div>
  }
  if (!['admin', 'accountant'].includes(anyProfile.role)) {
    return (
      <div className="p-8 text-sm text-slate-600">
        Unauthorized. Only administrators and accountants can access inventory reports.
      </div>
    )
  }

  const serviceSupabase = createServiceClient() as any
  const tenant = anyProfile.tenants

  const [{ data: materials }, { data: logs }] = await Promise.all([
    serviceSupabase
      .from('materials')
      .select('*')
      .eq('tenant_id', anyProfile.tenant_id)
      .order('name'),
    serviceSupabase
      .from('inventory_logs')
      .select(`
        id,
        tenant_id,
        material_id,
        action,
        job_id,
        qty_change_rolls,
        qty_change_area,
        notes,
        created_at,
        materials(name, unit, roll_width, roll_length, unit_cost),
        jobs(job_number, customer_name)
      `)
      .eq('tenant_id', anyProfile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  return (
    <InventoryReportPrint
      tenantName={tenant.name}
      logoUrl={tenant.logo_url}
      materials={materials || []}
      logs={logs || []}
      initialFocus={initialFocus}
      initialPeriod={initialPeriod}
    />
  )
}
