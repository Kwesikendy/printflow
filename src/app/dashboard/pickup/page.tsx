import { createClient } from '@/lib/supabase/server'
import { PickupQueueList } from '@/components/jobs/PickupQueueList'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function PickupQueuePage() {
  const supabase = await createClient()

  // Fetch completed jobs for shop pickup (excluding courier delivery)
  let jobs: any[] = []
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      product_types(name)
    `)
    .eq('status', 'completed')
    .or('delivery_method.is.null,delivery_method.eq.pickup')
    .order('updated_at', { ascending: false })

  if (error) {
    // Graceful fallback if delivery_method column does not exist yet
    const { data: fallbackData } = await supabase
      .from('jobs')
      .select(`
        *,
        product_types(name)
      `)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
    jobs = fallbackData || []
  } else {
    jobs = data || []
  }

  if (!jobs) {
    return <PageLoader />
  }

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
