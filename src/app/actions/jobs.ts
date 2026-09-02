'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type JobStatus, type PaymentMethod, type JobSource } from '@/types/database'

export type ActionResponse = {
  error?: string
  success?: boolean
  data?: any
}

export async function createJob(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient()

  const customerName = formData.get('customerName') as string
  const customerPhone = formData.get('customerPhone') as string
  const productTypeId = formData.get('productTypeId') as string
  const source = formData.get('source') as JobSource
  const width = parseFloat(formData.get('width') as string)
  const height = parseFloat(formData.get('height') as string)
  const quantity = parseInt(formData.get('quantity') as string, 10)
  const unitCost = parseFloat(formData.get('unitCost') as string)
  const notes = formData.get('notes') as string

  if (!customerName || !productTypeId || !source || isNaN(width) || isNaN(height) || isNaN(quantity) || isNaN(unitCost)) {
    return { error: 'Missing required fields or invalid numbers' }
  }

  const { data, error } = await supabase.rpc('create_job', {
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_product_type_id: productTypeId,
    p_source: source,
    p_width: width,
    p_height: height,
    p_quantity: quantity,
    p_unit_cost: unitCost,
    p_notes: notes || null
  } as any)

  if (error) {
    console.error('Create job error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/jobs')
  return { success: true, data }
}

export async function recordPaymentAction(formData: FormData) {
  const supabase = await createClient()
  
  const invoiceId = formData.get('invoiceId') as string
  const amount = parseFloat(formData.get('amount') as string)
  const method = formData.get('method') as PaymentMethod
  const reference = formData.get('reference') as string
  const notes = formData.get('notes') as string

  if (!invoiceId || isNaN(amount) || !method) {
    return { error: 'Invalid payment data' }
  }

  const { error } = await supabase.rpc('record_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_reference: reference || null,
    p_notes: notes || null
  } as any)

  if (error) {
    console.error('Record payment error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/[id]`, 'page')
  revalidatePath('/dashboard/queue')
  return { success: true }
}

export async function transitionJobStatusAction(jobId: string, toStatus: JobStatus, notes?: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.rpc('transition_job_status', {
    p_job_id: jobId,
    p_to_status: toStatus,
    p_notes: notes || null
  } as any)

  if (error) {
    console.error('Transition status error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/pickup')
  return { success: true }
}

// Creates a missing invoice for legacy jobs that were created without one
export async function createInvoiceForJobAction(jobId: string): Promise<ActionResponse> {
  const supabase = await createClient()

  // Fetch the job to get line_total
  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .select('id, tenant_id, line_total, status')
    .eq('id', jobId)
    .single()

  const job = jobData as { id: string; tenant_id: string; line_total: number; status: string } | null

  if (jobError || !job) return { error: 'Job not found' }
  if (job.status !== 'awaiting_payment') return { error: 'Job is not awaiting payment' }

  // Generate an invoice number
  const { data: invNum, error: numError } = await supabase.rpc('get_next_invoice_number', {
    p_tenant_id: job.tenant_id
  } as any)
  if (numError) return { error: numError.message }

  const { error: insertError } = await supabase.from('invoices').insert({
    tenant_id: job.tenant_id,
    job_id: jobId,
    invoice_number: invNum as string,
    total: job.line_total,
    status: 'unpaid',
  } as any)

  if (insertError) {
    // Unique constraint = invoice already exists (race condition or legacy data)
    // Just revalidate so the page reloads and shows the existing invoice
    if (insertError.code === '23505') {
      revalidatePath(`/dashboard/jobs/${jobId}`)
      return { success: true }
    }
    return { error: insertError.message }
  }

  revalidatePath(`/dashboard/jobs/${jobId}`)
  return { success: true }
}
