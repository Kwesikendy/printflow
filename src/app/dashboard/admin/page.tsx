import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/EmptyState'
import { FileText, Users, Package } from 'lucide-react'

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
        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
            <FileText className="w-24 h-24 text-indigo-600" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100/50">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Jobs</p>
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-900 tracking-tight">{jobsCount || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
            <Users className="w-24 h-24 text-emerald-600" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shadow-sm border border-emerald-100/50">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Users</p>
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-900 tracking-tight">{usersCount || 0}</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
            <Package className="w-24 h-24 text-amber-600" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shadow-sm border border-amber-100/50">
                <Package className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Products</p>
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-900 tracking-tight">{productsCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Operational Overview" description="Current distribution of jobs by status." />
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statusCounts).map(([status, count]) => {
              // Map statuses to specific colors
              let colorClass = "bg-slate-500 shadow-slate-500/20";
              let dotClass = "bg-slate-400";
              if (status === 'in_production') {
                colorClass = "bg-orange-500 shadow-orange-500/30";
                dotClass = "bg-orange-400 animate-pulse";
              } else if (status === 'completed' || status === 'paid_released') {
                colorClass = "bg-emerald-500 shadow-emerald-500/20";
                dotClass = "bg-emerald-400";
              } else if (status === 'awaiting_payment') {
                colorClass = "bg-amber-500 shadow-amber-500/20";
                dotClass = "bg-amber-400";
              } else if (status === 'picked_up') {
                colorClass = "bg-indigo-500 shadow-indigo-500/20";
                dotClass = "bg-indigo-400";
              }
              
              return (
                <div key={status} className="relative overflow-hidden bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`relative flex h-2.5 w-2.5`}>
                      {status === 'in_production' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClass}`}></span>
                    </span>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold truncate">{status.replace('_', ' ')}</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{String(count)}</p>
                  
                  {/* Subtle accent bar at the bottom */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${colorClass} opacity-50 group-hover:opacity-100 transition-opacity`} />
                </div>
              )
            })}
            {Object.keys(statusCounts).length === 0 && (
              <div className="col-span-4 text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
                <p className="font-medium">No jobs found in the system.</p>
                <p className="text-sm mt-1">When jobs are created, their statuses will appear here.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
