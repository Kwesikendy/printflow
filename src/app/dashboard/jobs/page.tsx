import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Plus, Search, FileText } from 'lucide-react'

export default async function JobsPage(props: {
  searchParams: Promise<{ q?: string }>
}) {
  const searchParams = await props.searchParams
  const query = searchParams.q || ''
  
  const supabase = await createClient()

  let supaQuery = supabase
    .from('jobs')
    .select(`
      *,
      product_types(name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (query) {
    supaQuery = supaQuery.or(`job_number.ilike.%${query}%,customer_name.ilike.%${query}%`)
  } else {
    // If no search, maybe just show recent jobs (last 7 days or today, but for MVP let's show latest 50)
  }

  const { data: jobs, error } = await supaQuery

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
          <p className="text-slate-500 mt-1">Manage all print jobs and quotes.</p>
        </div>
        <Link href="/dashboard/jobs/new">
          <Button variant="primary">
            <Plus className="w-4 h-4" />
            New Job
          </Button>
        </Link>
      </div>

      <Card>
        <div className="p-4 border-b border-indigo-100 flex items-center gap-2 bg-slate-50 rounded-t-xl">
          <Search className="w-5 h-5 text-slate-500" />
          <form className="flex-1" method="GET" action="/dashboard/jobs">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by job number or customer name..."
              className="bg-transparent border-none text-slate-900 focus:outline-none w-full text-sm"
            />
          </form>
        </div>
        
        <CardContent className="p-0 overflow-x-auto">
          {!jobs || jobs.length === 0 ? (
            <EmptyState 
              icon={<FileText />}
              title="No jobs found"
              description={query ? "No jobs matched your search." : "Get started by creating a new job."}
              action={
                !query && (
                  <Link href="/dashboard/jobs/new">
                    <Button variant="outline">Create Job</Button>
                  </Link>
                )
              }
            />
          ) : (
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Job No.</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td className="font-medium text-slate-900">{job.job_number}</td>
                    <td>{job.customer_name}</td>
                    <td>{job.product_types?.name}</td>
                    <td>{formatCurrency(job.line_total)}</td>
                    <td><StatusBadge status={job.status} /></td>
                    <td>{formatDateTime(job.created_at)}</td>
                    <td className="text-right">
                      <Link href={`/dashboard/jobs/${job.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
