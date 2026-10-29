import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDefaultDashboardPath } from '@/lib/utils'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()

    const role = (profile as any)?.role || 'front_desk'
    const email = (profile as any)?.email || user.email || ''
    redirect(getDefaultDashboardPath(role, email))
  } else {
    redirect('/login')
  }
}
