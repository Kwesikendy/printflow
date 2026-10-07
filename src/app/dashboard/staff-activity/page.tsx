import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getStaffDailyWorkAction } from '@/app/actions/staff-activity'
import { StaffActivityDashboard } from '@/components/analytics/StaffActivityDashboard'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function StaffActivityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role

  // Only Admin and Accountant can view staff activity and work rate
  if (!['admin', 'accountant'].includes(role)) {
    redirect('/dashboard')
  }

  const res = await getStaffDailyWorkAction()

  if (res.error || !res.data) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold text-slate-800">Unable to load staff activity</h2>
        <p className="text-slate-500 mt-2">{res.error || 'Unknown error'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Activity & Work Rate</h1>
        <p className="text-slate-500 mt-1 text-base">
          Monitor daily production, work rate, and jobs processed across Front Office and Print Rooms.
        </p>
      </div>

      <StaffActivityDashboard initialReport={res.data} />
    </div>
  )
}
