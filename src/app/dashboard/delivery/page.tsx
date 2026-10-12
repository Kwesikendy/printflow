import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DeliveryBoardClient } from '@/components/delivery/DeliveryBoardClient'
import { getDeliveryJobsAction } from '@/app/actions/delivery'
import { PageLoader } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Delivery Dispatch - PrintFlow',
  description: 'Manage courier orders and rider dispatches',
}

export default async function DeliveryDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()
  const profile = profileData as { role: string; email: string } | null

  const isMavis = profile?.email === 'm.adoko@printdpigh.com'
  if (profile?.role !== 'admin' && profile?.role !== 'front_desk' && !isMavis) {
    redirect('/dashboard')
  }

  const res = await getDeliveryJobsAction()
  const jobs = res.data || []

  return (
    <div className="w-full">
      <DeliveryBoardClient initialJobs={jobs} userEmail={profile?.email} />
    </div>
  )
}
