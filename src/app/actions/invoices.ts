'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function editInvoiceTotalAction(invoiceId: string, newTotal: number, reason: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  const profile = data as any

  if (!profile || !['admin', 'accountant'].includes(profile.role)) {
    return { error: 'Insufficient permissions' }
  }

  // Get current invoice
  const { data: invData, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  const invoice = invData as any

  if (invoiceError || !invoice) {
    return { error: 'Invoice not found' }
  }

  const oldTotal = invoice.total

  // Update invoice
  const { error: updateError } = await (supabase.from('invoices') as any)
    .update({ total: newTotal })
    .eq('id', invoiceId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Log edit
  const { error: logError } = await (supabase.from('invoice_edits') as any).insert({
    tenant_id: profile.tenant_id,
    invoice_id: invoiceId,
    user_id: user.id,
    old_total: oldTotal,
    new_total: newTotal,
    reason: reason
  })

  if (logError) {
    console.error('Error logging invoice edit:', logError)
  }

  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard/jobs')
  if (invoice.group_id) revalidatePath(`/dashboard/jobs/group/${invoice.group_id}`)
  if (invoice.job_id) revalidatePath(`/dashboard/jobs/${invoice.job_id}`)

  return { success: true }
}
