import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'
import { PageLoader } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { Printer, Users, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/Button'

import { redirect } from 'next/navigation'

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single() as { data: { role: string; is_active?: boolean } | null; error: any }

  if (!viewerProfile || viewerProfile.is_active === false || !['admin', 'accountant'].includes(viewerProfile.role)) {
    redirect('/dashboard')
  }

  // Fetch all payments and unpaid invoices for the tenant.
  // In a real app with large data, we would do the aggregation in SQL or use date filters.
  
  const [{ data: payments }, { data: unpaidInvoices }, expendituresResult] = await Promise.all([
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
        jobs ( job_number, customer_name, customer_phone, status ),
        job_groups ( customer_name, customer_phone, jobs ( id, status ) ),
        payments ( amount )
      `)
      .order('issued_at', { ascending: false })
      .limit(2000),

    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('expenditures')
          .select('*, profiles(full_name)')
          .order('spent_at', { ascending: false })
          .limit(200)
        if (error) return { data: [] }
        return { data: data || [] }
      } catch {
        return { data: [] }
      }
    })()
  ])

  if (!payments || !unpaidInvoices) {
    return <PageLoader />
  }

  const expenditures = expendituresResult?.data || []

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
          <Link href="/dashboard/finance/expenditures">
            <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200">
              <Receipt className="w-4 h-4 mr-2" />
              Expenditure
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
        expenditures={expenditures}
      />
    </div>
  )
}
