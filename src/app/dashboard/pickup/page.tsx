import { createClient } from '@/lib/supabase/server'
import { PickupQueueList } from '@/components/jobs/PickupQueueList'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function PickupQueuePage() {
  const supabase = await createClient()

  // Fetch all completed jobs waiting for customer pickup
  const { data: rawJobs } = await supabase
    .from('jobs')
    .select(`
      *,
      product_types(name),
      job_status_events(to_status, created_at)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (!rawJobs) {
    return <PageLoader />
  }

  // Sort by actual completed event timestamp so newly completed jobs are at top
  const jobs = [...(rawJobs as any[])].sort((a: any, b: any) => {
    const timeA = new Date(
      a.job_status_events?.find((e: any) => e.to_status === 'completed')?.created_at || a.created_at
    ).getTime()
    const timeB = new Date(
      b.job_status_events?.find((e: any) => e.to_status === 'completed')?.created_at || b.created_at
    ).getTime()
    return timeB - timeA
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">Pickup Queue</h1>
        <p className="text-slate-500 mt-1">Jobs that are completed and ready for customer pickup.</p>
      </div>

      <PickupQueueList initialJobs={jobs} />
    </div>
  )
}
