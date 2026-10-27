import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PrintQueueList } from '@/components/jobs/PrintQueueList'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function PrintQueuePage() {
  const supabase = await createClient()
  const serviceSupabase = createServiceClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <PageLoader />

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, print_room, tenant_id')
    .eq('id', user.id)
    .single() as { data: { role: string, print_room: string | null, tenant_id: string } | null, error: any }

  let jobsQuery = supabase
    .from('jobs')
    .select(`
      *,
      product_types(id, name, material_id)
    `)
    .in('status', ['paid_released', 'in_production'])

  // Filter jobs by print room if user is a printer assigned to a specific room
  // Unassigned jobs (print_room is null) are visible to all printers
  if (profile?.role === 'printer' && profile.print_room) {
    jobsQuery = jobsQuery.or(`print_room.eq.${profile.print_room},print_room.is.null`)
  }

  const [{ data: jobs }, { data: materials }] = await Promise.all([
    jobsQuery
      // Order in_production first, then by updated_at ascending (oldest first)
      .order('status', { ascending: false })
      .order('updated_at', { ascending: true }),
    profile?.tenant_id
      ? serviceSupabase
          .from('materials')
          .select('id, name, unit, roll_width, roll_length, qty_rolls')
          .eq('tenant_id', profile.tenant_id)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])

  if (!jobs) {
    return <PageLoader />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">Print Queue</h1>
        <p className="text-slate-500 mt-1">
          Live queue of jobs ready for production — completing a job automatically deducts the confirmed material roll from warehouse inventory.
        </p>
      </div>

      <PrintQueueList initialJobs={jobs} initialMaterials={materials || []} />
    </div>
  )
}

