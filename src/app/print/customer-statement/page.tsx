import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCustomerFinancialStatement } from '@/app/actions/finance'
import { CustomerStatementPrint } from '@/components/finance/CustomerStatementPrint'
import { startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

export const metadata: Metadata = {
  title: 'Customer Financial Statement',
}

interface PageProps {
  searchParams: Promise<{
    customer?: string
    phone?: string
    period?: string
  }>
}

export default async function PrintCustomerStatementPage(props: PageProps) {
  const searchParams = await props.searchParams
  const customerName = searchParams.customer?.trim()
  const customerPhone = searchParams.phone?.trim()
  const period = searchParams.period?.trim() || 'all'

  if (!customerName) {
    return <div className="p-8 text-center text-slate-500">Please provide a customer name to print their statement.</div>
  }

  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8 text-center text-red-600">Unauthorized</div>

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, tenants(name, logo_url)')
    .eq('id', user.id)
    .single()

  const anyProfile = profile as any
  if (!anyProfile || !anyProfile.tenants) {
    return <div className="p-8 text-center text-red-600">Tenant not found</div>
  }

  const tenant = anyProfile.tenants

  // Date filters if period was specified
  let fromDate: string | undefined
  let toDate: string | undefined
  let periodLabel = 'All Time'

  const now = new Date()
  if (period === 'this_month') {
    fromDate = startOfMonth(now).toISOString()
    toDate = endOfMonth(now).toISOString()
    periodLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (period === 'last_month') {
    const lastMonthDate = subMonths(now, 1)
    fromDate = startOfMonth(lastMonthDate).toISOString()
    toDate = endOfMonth(lastMonthDate).toISOString()
    periodLabel = lastMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (period === 'this_year') {
    fromDate = startOfYear(now).toISOString()
    periodLabel = `Year ${now.getFullYear()}`
  }

  const statement = await getCustomerFinancialStatement(customerName, {
    customerPhone,
    fromDate,
    toDate
  })

  if (!statement) {
    return (
      <div className="p-8 text-center text-slate-500">
        No financial records or transactions found for &ldquo;{customerName}&rdquo;.
      </div>
    )
  }

  return (
    <CustomerStatementPrint
      tenantName={tenant.name}
      logoUrl={tenant.logo_url}
      statement={statement}
      periodLabel={periodLabel}
    />
  )
}
