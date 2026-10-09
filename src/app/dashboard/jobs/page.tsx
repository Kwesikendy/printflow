import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { JobsListClient } from '@/components/jobs/JobsListClient'

import { getWorkdayBounds } from '@/lib/workday'

export default async function JobsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const searchParams = await props.searchParams
  const query = searchParams.q || ''
  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = 50
  
  const supabase = await createClient()

  let supaQuery = supabase
    .from('jobs')
    .select(`*, product_types(name)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (query) {
    supaQuery = supaQuery.or(`job_number.ilike.%${query}%,customer_name.ilike.%${query}%`)
  }

  const { data: jobs, count, error } = await supaQuery
  const totalPages = Math.ceil((count || 0) / pageSize)

  const { start: workdayStart } = getWorkdayBounds()
  const { data: seqData } = await supabase.from('job_sequences').select('last_reset_time').single()
  const dbResetTime = (seqData as any)?.last_reset_time ? new Date((seqData as any).last_reset_time) : null

  // Use the later of DB reset time or current 5 PM shift start
  const effectiveReset = (dbResetTime && dbResetTime.getTime() > workdayStart.getTime()) 
    ? dbResetTime 
    : workdayStart

  const lastResetTime = effectiveReset.toISOString()

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

      <JobsListClient 
        initialJobs={jobs || []} 
        initialQuery={query} 
        lastResetTime={lastResetTime} 
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  )
}
