import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FinanceReportPrint } from '@/components/finance/FinanceReportPrint'

export const metadata: Metadata = {
  title: 'Financial Report',
}

export default async function PrintFinanceReportPage() {
  const supabase = await createClient()

  // Get tenant profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8">Unauthorized</div>

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, tenants(name, logo_url)')
    .eq('id', user.id)
    .single()

  const anyProfile = profile as any
  if (!anyProfile || !anyProfile.tenants) return <div className="p-8">Tenant not found</div>

  const tenant = anyProfile.tenants

  // Fetch all payments and unpaid invoices
  const [{ data: payments }, { data: unpaidInvoices }] = await Promise.all([
    supabase
      .from('payments')
      .select(`
        *,
        profiles ( full_name )
      `)
      .order('recorded_at', { ascending: false }),
      
    supabase
      .from('invoices')
      .select(`
        *,
        jobs ( customer_name )
      `)
      .in('status', ['unpaid', 'partial'])
      .order('issued_at', { ascending: false })
  ])

  return (
    <FinanceReportPrint
      tenantName={tenant.name}
      logoUrl={tenant.logo_url}
      payments={payments || []}
      unpaidInvoices={unpaidInvoices || []}
    />
  )
}
