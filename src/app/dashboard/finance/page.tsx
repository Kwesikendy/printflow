import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'
import { PageLoader } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { Printer, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'

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
        jobs ( job_number, customer_name ),
        job_groups ( customer_name ),
        payments ( amount )
      `)
      .order('issued_at', { ascending: false })
      .limit(100)
  ])

  if (!payments || !unpaidInvoices) {
    return <PageLoader />
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Dashboard</h1>
          <p className="text-slate-500 mt-1">Revenue overview, payments, and outstanding invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/staff-activity">
            <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200">
              <Users className="w-4 h-4 mr-2" />
              Staff Activity
            </Button>
          </Link>
          <Link href="/print/finance-report" target="_blank">
            <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200">
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </Link>
        </div>
      </div>

      <FinanceDashboard 
        payments={payments as any[]} 
        unpaidInvoices={unpaidInvoices as any[]} 
      />
    </div>
  )
}
