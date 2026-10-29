'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markInvoiceJobsCompleted(invoiceId: string, pickupName?: string, pickupPhone?: string) {
  const supabase = createServiceClient()

  // Find all jobs and payments for this invoice
  const { data: invoiceRaw } = await supabase
    .from('invoices')
    .select('total, status, group_id, jobs(id), payments(amount)')
    .eq('id', invoiceId)
    .single()

  const invoice = invoiceRaw as any

  if (!invoice) throw new Error('Invoice not found')

  const updatePayload: any = { status: 'picked_up' }
  if (pickupName) updatePayload.pickup_name = pickupName
  if (pickupPhone) updatePayload.pickup_phone = pickupPhone

  if (invoice.group_id) {
    // Update all jobs in the group to picked_up
    await (supabase.from('jobs') as any).update(updatePayload).eq('group_id', invoice.group_id)
  } else if (invoice.jobs) {
    // Update single job
    await (supabase.from('jobs') as any).update(updatePayload).eq('id', invoice.jobs.id)
  }

  // Only mark invoice status as 'paid' if payments actually cover the total
  const totalPaid = Math.round(((invoice.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0)) * 100) / 100
  const invoiceTotal = Math.round(Number(invoice.total) * 100) / 100
  const accurateStatus =
    totalPaid >= invoiceTotal - 0.009
      ? 'paid'
      : totalPaid > 0.009
      ? 'partial'
      : 'unpaid'

  if (invoice.status !== accurateStatus) {
    await (supabase.from('invoices') as any).update({ status: accurateStatus }).eq('id', invoiceId)
  }
  
  revalidatePath(`/track/invoice/${invoiceId}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/finance')
  return { success: true }
}
