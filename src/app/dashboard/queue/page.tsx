import { createClient } from '@/lib/supabase/server'
import { PrintQueueList } from '@/components/jobs/PrintQueueList'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function PrintQueuePage() {
  const supabase = await createClient()

  // Fetch 'paid_released' and 'in_production' jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      product_types(name)
    `)
    .in('status', ['paid_released', 'in_production'])
    // Order in_production first, then by updated_at ascending (oldest first)
    .order('status', { ascending: false }) // 'paid_released' > 'in_production' alphabetically, so descending puts in_production first
    .order('updated_at', { ascending: true })

  if (!jobs) {
    return <PageLoader />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">Print Queue</h1>
        <p className="text-slate-500 mt-1">Live queue of jobs ready for production.</p>
      </div>

      <PrintQueueList initialJobs={jobs} />
    </div>
  )
}
