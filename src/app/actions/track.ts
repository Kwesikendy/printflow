'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markInvoiceJobsCompleted(invoiceId: string) {
  const supabase = await createClient()

  // Find all jobs for this invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('group_id, jobs(id)')
    .eq('id', invoiceId)
    .single()

  if (!invoice) throw new Error('Invoice not found')

  if (invoice.group_id) {
    // Update all jobs in the group to picked_up
    await supabase.from('jobs').update({ status: 'picked_up' }).eq('group_id', invoice.group_id)
  } else if (invoice.jobs) {
    // Update single job
    await supabase.from('jobs').update({ status: 'picked_up' }).eq('id', invoice.jobs.id)
  }

  // Also update invoice status
  await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)
  
  revalidatePath(`/track/invoice/${invoiceId}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/invoices')
  return { success: true }
}
