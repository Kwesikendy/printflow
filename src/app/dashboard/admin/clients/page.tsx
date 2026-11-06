import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCustomersDirectoryAction } from '@/app/actions/customers'
import { ClientsDirectoryClient } from '@/components/customers/ClientsDirectoryClient'

export default async function AdminClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single() as { data: { role: string; is_active?: boolean } | null; error: any }

  if (!profile || profile.is_active === false || !['admin', 'accountant'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const directoryData = await getCustomersDirectoryAction()

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients & Arrears Directory</h1>
          <p className="text-slate-500 mt-1">
            Track customer profiles, register historical clients, and manage outstanding balances.
          </p>
        </div>
      </div>

      <ClientsDirectoryClient initialData={directoryData} userRole={profile.role} />
    </div>
  )
}
