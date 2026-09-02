import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [
    { count: jobsCount },
    { count: usersCount },
    { count: productsCount }
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('product_types').select('*', { count: 'exact', head: true }).eq('is_active', true)
  ])

  // Get job counts by status for operational overview
  const { data: statusData } = await supabase
    .from('jobs')
    .select('status')
  
  const statusCounts = (statusData || []).reduce((acc: Record<string, number>, job: any) => {
    acc[job.status] = (acc[job.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Jobs All Time</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{jobsCount || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active Users</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{usersCount || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active Products</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{productsCount || 0}</p>
        </div>
      </div>

      <Card>
        <CardHeader title="Operational Overview (Jobs by Status)" />
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{status.replace('_', ' ')}</p>
                <p className="text-2xl font-bold text-slate-900">{String(count)}</p>
              </div>
            ))}
            {Object.keys(statusCounts).length === 0 && (
              <div className="col-span-4 text-center py-8 text-slate-500">No jobs found in the system.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
