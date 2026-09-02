import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function FinancePage() {
  const supabase = await createClient()

  // Fetch all payments and unpaid invoices for the tenant.
  // In a real app with large data, we would do the aggregation in SQL or use date filters.
  
  const [{ data: payments }, { data: unpaidInvoices }] = await Promise.all([
    supabase
      .from('payments')
      .select(`
        *,
        jobs (
          source,
          product_types ( name )
        ),
        profiles ( full_name )
      `)
      .order('recorded_at', { ascending: false }),
      
    supabase
      .from('invoices')
      .select(`
        *,
        jobs ( job_number, customer_name )
      `)
      .eq('status', 'unpaid')
      .order('issued_at', { ascending: false })
  ])

  if (!payments || !unpaidInvoices) {
    return <PageLoader />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">Financial Dashboard</h1>
        <p className="text-slate-500 mt-1">Revenue overview, payments, and outstanding invoices.</p>
      </div>

      <FinanceDashboard 
        payments={payments as any[]} 
        unpaidInvoices={unpaidInvoices as any[]} 
      />
    </div>
  )
}
