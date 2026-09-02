import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { JobsListClient } from '@/components/jobs/JobsListClient'

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
  }

  const { data: jobs, error } = await supaQuery

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Jobs</h1>
          <p className="text-slate-500 mt-2 text-lg">Manage all print jobs and quotes.</p>
        </div>
        <Link href="/dashboard/jobs/new">
          <Button variant="primary" className="shadow-premium-hover">
            <Plus className="w-5 h-5 mr-1" />
            New Job
          </Button>
        </Link>
      </div>

      <JobsListClient initialJobs={jobs || []} initialQuery={query} />
    </div>
  )
}
