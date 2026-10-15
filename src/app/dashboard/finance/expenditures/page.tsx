import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getExpendituresAction } from '@/app/actions/expenditures'
import { ExpenditureManager } from '@/components/finance/ExpenditureManager'

export default async function ExpendituresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'accountant'].includes((profile as any).role)) redirect('/dashboard')

  const result = await getExpendituresAction()
  return <ExpenditureManager initialExpenditures={result.data || []} errorMessage={result.error} />
}
