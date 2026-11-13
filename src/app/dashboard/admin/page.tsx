import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/EmptyState'
import { FileText, Users, Package, Clock, Contact2, Flag } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

import { redirect } from 'next/navigation'

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single() as { data: { role: string; is_active?: boolean } | null; error: any }

  if (!profile || profile.is_active === false || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  const [
    { count: jobsCount },
    { count: usersCount },
    { count: productsCount },
    { count: customersCount },
    { count: awaitingCount },
    { count: inProdCount },
    { count: readyPickupCount },
    { count: completedCount },
    recentJobsRes,
    invoiceEditsRes
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('product_types').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['awaiting_payment', 'pending_review']),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['in_production', 'ready_to_print', 'printing', 'preflight', 'paid_released']),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['ready_for_pickup', 'picked_up']),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('jobs').select('*, product_types(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('invoice_edits').select('*, invoices(invoice_number), profiles(full_name)').order('created_at', { ascending: false }).limit(5)
  ])

  const statusCounts: Record<string, number> = {
    awaiting_payment: awaitingCount || 0,
    in_production: inProdCount || 0,
    ready_for_pickup: readyPickupCount || 0,
    completed: completedCount || 0,
  }

  const recentJobs = recentJobsRes.data || []
  const invoiceEdits = invoiceEditsRes.error ? [] : (invoiceEditsRes.data || [])

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Operational summary and staff oversight.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/admin/clients">
            <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200 text-indigo-700 font-bold">
              <Contact2 className="w-4 h-4 mr-2" />
              Clients & Arrears
            </Button>
          </Link>
          <Link href="/print/flagged-invoices" target="_blank">
            <Button variant="outline" className="bg-white hover:bg-rose-50 border-rose-200 text-rose-700 font-bold">
              <Flag className="w-4 h-4 mr-2" />
              Flagged Report
            </Button>
          </Link>
          <Link href="/dashboard/staff-activity">
            <Button variant="primary" className="shadow-sm">
              <Users className="w-4 h-4 mr-2" />
              Staff Work Rate & Activity
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
            <Contact2 className="w-24 h-24 text-purple-600" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shadow-sm border border-purple-100/50">
                <Contact2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Clients</p>
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-900 tracking-tight">{customersCount || 0}</p>
            <Link href="/dashboard/admin/clients" className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
              View Directory &rarr;
            </Link>
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
                <div key={status} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex rounded-full h-2 w-2 ${dotClass}`}></span>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold truncate">{status.replace('_', ' ')}</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900 tracking-tight font-heading">{String(count)}</p>
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

      <Card>
        <CardHeader title="Recent Jobs" description="Latest jobs created in the system." />
        <CardContent className="p-0">
          <div className="table-container">
            <table className="table-standard w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="pl-6">Job No.</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Created At</th>
                  <th>Completed At</th>
                  <th className="pr-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {(recentJobs || []).map((job: any) => {
                  const isCompleted = job.status === 'completed' || job.status === 'picked_up';
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="pl-6 font-bold text-slate-900">
                        <Link href={`/dashboard/jobs/${job.id}`} className="hover:text-indigo-600 transition-colors">
                          {job.job_number}
                        </Link>
                      </td>
                      <td className="text-slate-700 font-medium">{job.customer_name}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200/60 shadow-sm">
                          {job.product_types?.name}
                        </span>
                      </td>
                      <td className="text-slate-500 text-sm">{formatDateTime(job.created_at)}</td>
                      <td className="text-slate-500 text-sm">
                        {isCompleted ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDateTime(job.updated_at)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pending</span>
                        )}
                      </td>
                      <td className="pr-6">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  )
                })}
                {(!recentJobs || recentJobs.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">No recent jobs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notifications / Invoice Edits */}
      <Card>
        <CardHeader title="Recent Invoice Adjustments" description="Notifications for manually edited invoices." />
        <CardContent className="p-0">
          <div className="table-container">
            <table className="table-standard w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="pl-6">Date</th>
                  <th>Invoice No.</th>
                  <th>Edited By</th>
                  <th>Previous Total</th>
                  <th>New Total</th>
                  <th className="pr-6">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {invoiceEdits.map((edit: any) => (
                  <tr key={edit.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="pl-6 text-slate-500 text-sm">{formatDateTime(edit.created_at)}</td>
                    <td className="font-bold text-slate-900">{edit.invoices?.invoice_number || 'Unknown'}</td>
                    <td className="text-slate-700 font-medium">{edit.profiles?.full_name || 'Staff'}</td>
                    <td className="text-slate-500 line-through text-sm">{formatCurrency(edit.old_total)}</td>
                    <td className="text-indigo-600 font-bold">{formatCurrency(edit.new_total)}</td>
                    <td className="pr-6 text-slate-600 text-sm italic">"{edit.reason}"</td>
                  </tr>
                ))}
                {invoiceEdits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">No recent invoice adjustments.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
