import { createClient } from '@/lib/supabase/server'
import { PrintQueueList } from '@/components/jobs/PrintQueueList'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function PrintQueuePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <PageLoader />

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, print_room')
    .eq('id', user.id)
    .single() as { data: { role: string, print_room: string | null } | null, error: any }

  let jobsQuery = supabase
    .from('jobs')
    .select(`
      *,
      product_types(name)
    `)
    .in('status', ['paid_released', 'in_production'])

  // Filter jobs by print room if user is a printer assigned to a specific room
  // Unassigned jobs (print_room is null) are visible to all printers
  if (profile?.role === 'printer' && profile.print_room) {
    jobsQuery = jobsQuery.or(`print_room.eq.${profile.print_room},print_room.is.null`)
  }

  const { data: jobs } = await jobsQuery
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
