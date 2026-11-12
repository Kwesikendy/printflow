import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FlaggedInvoicesPrint } from '@/components/finance/FlaggedInvoicesPrint'
import { getShiftDateString } from '@/lib/workday'

export const metadata: Metadata = {
  title: 'Flagged & Disputed Invoices Report — PrintFlow',
}

export default async function PrintFlaggedInvoicesPage(props: {
  searchParams: Promise<{ mode?: string; day?: string }>
}) {
  const searchParams = await props.searchParams
  const modeParam = searchParams.mode || 'all'
  const dayParam = searchParams.day || getShiftDateString()
  const supabase = await createClient()

  // Get current user and ensure authorized (admin or accountant)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8">Unauthorized</div>

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(name, logo_url)')
    .eq('id', user.id)
    .single()

  const anyProfile = profile as any
  if (!anyProfile || !anyProfile.tenants) return <div className="p-8">Tenant not found</div>
  if (!['admin', 'accountant'].includes(anyProfile.role)) {
    return <div className="p-8">Unauthorized. Only administrators and accountants can access this report.</div>
  }

  const tenant = anyProfile.tenants

  // Fetch flagged invoices with jobs, job_groups, payments, and flagging staff member profile
  const { data: flaggedInvoices, error } = await supabase
    .from('invoices')
    .select(`
      *,
      jobs ( customer_name, customer_phone ),
      job_groups ( customer_name, customer_phone ),
      payments ( amount, recorded_at, method ),
      profiles:flagged_by ( full_name )
    `)
    .eq('tenant_id', anyProfile.tenant_id)
    .eq('is_flagged', true)
    .order('flagged_at', { ascending: false })

  if (error) {
    console.error('Error fetching flagged invoices for report:', error)
  }

  return (
    <FlaggedInvoicesPrint
      tenantName={tenant.name}
      logoUrl={tenant.logo_url}
      flaggedInvoices={flaggedInvoices || []}
      initialMode={modeParam}
      initialDay={dayParam}
    />
  )
}
