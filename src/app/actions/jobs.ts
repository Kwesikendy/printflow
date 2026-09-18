'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type JobStatus, type PaymentMethod, type JobSource, type Profile, type DimensionUnit } from '@/types/database'
import { toCmRate } from '@/lib/pricing'

export type ActionResponse = {
  error?: string
  success?: boolean
  data?: any
}

export interface JobItem {
  productTypeId: string
  width: number
  height: number
  dimensionUnit: DimensionUnit
  quantity: number
  unitCost: number
  notes?: string
  artworkFile?: File | null
}

// Convert any dimension unit to cm before storing
function toCm(value: number, unit: DimensionUnit): number {
  switch (unit) {
    case 'cm': return value
    case 'm':  return value * 100
    case 'ft': return value * 30.48
    case 'in': return value * 2.54
  }
}

async function uploadArtwork(
  supabase: any,
  tenantId: string,
  artworkFile: File
): Promise<string | null> {
  if (!artworkFile || artworkFile.size === 0) return null
  if (artworkFile.size > 100 * 1024 * 1024) throw new Error('Artwork file exceeds 100MB limit')

  const fileExt = artworkFile.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${tenantId}/${fileName}`

  const { error: uploadError } = await supabase.storage.from('artworks').upload(filePath, artworkFile)
  if (uploadError) throw new Error('Failed to upload artwork: ' + uploadError.message)

  const { data: publicUrlData } = supabase.storage.from('artworks').getPublicUrl(filePath)
  return publicUrlData.publicUrl
}

export async function createJobGroupAction(
  customerName: string,
  customerPhone: string | null,
  source: JobSource,
  items: JobItem[]
): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
  const profile = profileData as Pick<Profile, 'tenant_id'> | null
  if (!profile) return { error: 'Profile not found' }

  // Upload all artworks in parallel
  let artworkUrls: (string | null)[] = []
  try {
    artworkUrls = await Promise.all(
      items.map(item =>
        item.artworkFile && item.artworkFile.size > 0
          ? uploadArtwork(supabase, profile.tenant_id, item.artworkFile)
          : Promise.resolve(null)
      )
    )
  } catch (err: any) {
    return { error: err.message }
  }

  // Build items payload with converted cm dimensions and normalized cm² unit cost
  const itemsPayload = items.map((item, i) => ({
    product_type_id: item.productTypeId,
    width: toCm(item.width, item.dimensionUnit),
    height: toCm(item.height, item.dimensionUnit),
    dimension_unit: item.dimensionUnit,
    quantity: item.quantity,
    unit_cost: toCmRate(item.unitCost, item.dimensionUnit),
    notes: item.notes || null,
    artwork_url: artworkUrls[i] || null,
  }))

  const { data, error } = await supabase.rpc('create_job_group', {
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_source: source,
    p_items: itemsPayload,
  } as any)

  if (error) {
    console.error('Create job group error:', error)
    return { error: error.message }
  }

  // UPSERT the customer into the dedicated customers table
  if (profile) {
    const { error: customerError } = await supabase
      .from('customers')
      .upsert({
        tenant_id: profile.tenant_id,
        name: customerName,
        phone: customerPhone || null
      } as any, { onConflict: 'tenant_id, name' })
      
    if (customerError) {
      console.error('Error saving customer to database:', customerError)
      // We don't fail the whole request just because saving to address book failed
    }
  }

  revalidatePath('/dashboard/jobs')
  return { success: true, data }
}

// Legacy single-job create (kept for compatibility)
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
  const artworkFile = formData.get('artwork') as File | null

  if (!customerName || !productTypeId || !source || isNaN(width) || isNaN(height) || isNaN(quantity) || isNaN(unitCost)) {
    return { error: 'Missing required fields or invalid numbers' }
  }
  
  let artworkUrl: string | null = null

  if (artworkFile && artworkFile.size > 0) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      const profile = profileData as Pick<Profile, 'tenant_id'> | null
      if (profile) {
        try {
          artworkUrl = await uploadArtwork(supabase, profile.tenant_id, artworkFile)
        } catch (err: any) {
          return { error: err.message }
        }
      }
    }
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
    p_notes: notes || null,
    p_artwork_url: artworkUrl
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

export async function transitionJobStatusAction(
  jobId: string, 
  toStatus: JobStatus, 
  notes?: string,
  pickupName?: string,
  pickupPhone?: string
) {
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

  // If status is picked_up and we have pickup details, update the job record
  if (toStatus === 'picked_up' && (pickupName || pickupPhone)) {
    const { error: updateError } = await (supabase.from('jobs') as any)
      .update({
        pickup_name: pickupName || null,
        pickup_phone: pickupPhone || null
      })
      .eq('id', jobId)
      
    if (updateError) {
      console.error('Update pickup details error:', updateError)
    }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/pickup')
  return { success: true }
}

export async function createInvoiceForJobAction(jobId: string): Promise<ActionResponse> {
  const supabase = await createClient()

  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .select('id, tenant_id, line_total, status')
    .eq('id', jobId)
    .single()

  const job = jobData as { id: string; tenant_id: string; line_total: number; status: string } | null

  if (jobError || !job) return { error: 'Job not found' }
  if (job.status !== 'awaiting_payment') return { error: 'Job is not awaiting payment' }

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
    if (insertError.code === '23505') {
      revalidatePath(`/dashboard/jobs/${jobId}`)
      return { success: true }
    }
    return { error: insertError.message }
  }

  revalidatePath(`/dashboard/jobs/${jobId}`)
  return { success: true }
}
