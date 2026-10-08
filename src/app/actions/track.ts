'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markInvoiceJobsCompleted(invoiceId: string, pickupName?: string, pickupPhone?: string) {
  const supabase = await createClient()

  // Find all jobs for this invoice
  const { data: invoiceRaw } = await supabase
    .from('invoices')
    .select('group_id, jobs(id)')
    .eq('id', invoiceId)
    .single()

  const invoice = invoiceRaw as any

  if (!invoice) throw new Error('Invoice not found')

  const updatePayload: any = { status: 'picked_up' }
  if (pickupName) updatePayload.pickup_name = pickupName
  if (pickupPhone) updatePayload.pickup_phone = pickupPhone

  if (invoice.group_id) {
    // Update all jobs in the group to picked_up
    // @ts-ignore
    await supabase.from('jobs').update(updatePayload).eq('group_id', invoice.group_id)
  } else if (invoice.jobs) {
    // Update single job
    // @ts-ignore
    await supabase.from('jobs').update(updatePayload).eq('id', invoice.jobs.id)
  }

  // Also update invoice status
  // @ts-ignore
  await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)
  
  revalidatePath(`/track/invoice/${invoiceId}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/invoices')
  return { success: true }
}
