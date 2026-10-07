'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type JobStatus, type PaymentMethod, type JobSource, type Profile, type DimensionUnit, type PrintRoom } from '@/types/database'
import { toCmRate, resolveUnitRate } from '@/lib/pricing'
import { getTenantUnitPricing } from '@/lib/pricing-server'
import { getWorkdayBounds } from '@/lib/workday'

export async function ensureWorkdaySequenceReset(supabase: any, tenantId: string) {
  try {
    const { start } = getWorkdayBounds()
    const { data: seq } = await supabase
      .from('job_sequences')
      .select('last_reset_time')
      .eq('tenant_id', tenantId)
      .single()

    if (seq) {
      const lastReset = new Date(seq.last_reset_time)
      if (lastReset.getTime() < start.getTime()) {
        await supabase
          .from('job_sequences')
          .update({
            last_job: 0,
            last_inv: 0,
            last_reset_time: start.toISOString()
          })
          .eq('tenant_id', tenantId)
      }
    }
  } catch (err) {
    console.error('Error in ensureWorkdaySequenceReset:', err)
  }
}

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
  artworkUrl?: string | null
  printRoom?: PrintRoom | null
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



export async function createJobGroupAction(
  customerName: string,
  customerPhone: string | null,
  source: JobSource,
  items: JobItem[]
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
  const profile = profileData as Pick<Profile, 'tenant_id' | 'role'> | null
  if (!profile) return { error: 'Profile not found' }


  // If user is not an admin, strictly enforce configured catalog pricing
  let pricingRules: any[] = []
  let unitPricingConfig: any = null
  if (profile.role !== 'admin') {
    const [{ data: rulesData }, configData] = await Promise.all([
      supabase.from('pricing_rules').select('*').eq('tenant_id', profile.tenant_id),
      getTenantUnitPricing(profile.tenant_id)
    ])
    pricingRules = (rulesData as any[]) || []
    unitPricingConfig = configData
  }

  // Build items payload with converted cm dimensions and normalized cm² unit cost
  let itemsPayload: any[] = []
  try {
    itemsPayload = items.map((item, i) => {
      let effectiveUnitCost = item.unitCost

      if (profile.role !== 'admin') {
        const activeRule = pricingRules.find(r => r.product_type_id === item.productTypeId && r.source === source)
        const resolvedRate = resolveUnitRate(
          unitPricingConfig,
          item.productTypeId,
          source,
          item.dimensionUnit,
          activeRule?.unit_cost
        )
        if (!resolvedRate || resolvedRate <= 0) {
          throw new Error('One or more products have no configured price. Only administrators can specify custom prices.')
        }
        effectiveUnitCost = resolvedRate
      } else {
        if (!effectiveUnitCost || effectiveUnitCost <= 0) {
          throw new Error('Unit cost must be greater than 0 for all items.')
        }
      }

      return {
        product_type_id: item.productTypeId,
        width: item.width,
        height: item.height,
        dimension_unit: item.dimensionUnit,
        quantity: item.quantity,
        unit_cost: effectiveUnitCost,
        notes: item.notes || null,
        artwork_url: item.artworkUrl || null,
        print_room: item.printRoom || null,
      }
    })
  } catch (err: any) {
    return { error: err.message }
  }

  await ensureWorkdaySequenceReset(supabase, profile.tenant_id)

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
  } catch (globalErr: any) {
    console.error('FATAL Server Action Error:', globalErr)
    return { error: 'Server Error: ' + globalErr.message }
  }
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
  let unitCost = parseFloat(formData.get('unitCost') as string)
  const notes = formData.get('notes') as string
  const artworkUrl = formData.get('artworkUrl') as string | null

  if (!customerName || !productTypeId || !source || isNaN(width) || isNaN(height) || isNaN(quantity)) {
    return { error: 'Missing required fields or invalid numbers' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
  const profile = profileData as Pick<Profile, 'tenant_id' | 'role'> | null
  if (!profile) return { error: 'Profile not found' }

  // If user is not admin, enforce official pricing
  if (profile.role !== 'admin') {
    const [{ data: rulesData }, unitPricingConfig] = await Promise.all([
      supabase.from('pricing_rules').select('*').eq('tenant_id', profile.tenant_id).eq('product_type_id', productTypeId).eq('source', source),
      getTenantUnitPricing(profile.tenant_id)
    ])
    const activeRule = (rulesData as any)?.[0]
    const resolvedRate = resolveUnitRate(
      unitPricingConfig,
      productTypeId,
      source,
      'cm',
      activeRule?.unit_cost
    )
    if (!resolvedRate || resolvedRate <= 0) {
      return { error: 'Product has no configured price. Only administrators can specify custom prices.' }
    }
    unitCost = resolvedRate
  } else if (isNaN(unitCost) || unitCost <= 0) {
    return { error: 'Unit cost must be greater than 0' }
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
  const releaseToPrintRoom = formData.get('releaseToPrintRoom') === 'true'

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

  // If user requested forwarding to print room upon partial payment
  if (releaseToPrintRoom) {
    const { data: invData } = await supabase
      .from('invoices')
      .select('job_id, group_id')
      .eq('id', invoiceId)
      .single()

    const inv = invData as { job_id: string | null; group_id: string | null } | null
    if (inv?.group_id) {
      await releaseJobGroupAction(inv.group_id, 'Forwarded to print room after partial payment')
    } else if (inv?.job_id) {
      await supabase.rpc('transition_job_status', {
        p_job_id: inv.job_id,
        p_to_status: 'paid_released',
        p_notes: 'Forwarded to print room after partial payment'
      } as any)
    }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/[id]`, 'page')
  revalidatePath(`/dashboard/jobs/group/[id]`, 'page')
  revalidatePath('/dashboard/queue')
  return { success: true }
}

export async function releaseJobGroupAction(groupId: string, notes?: string): Promise<ActionResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role
  if (!['front_desk', 'admin'].includes(role)) {
    return { error: 'Insufficient permissions to release jobs' }
  }

  // Fetch all jobs in this group currently awaiting payment
  const { data: jobsData, error: jobsError } = await supabase
    .from('jobs')
    .select('id, job_number')
    .eq('group_id', groupId)
    .eq('status', 'awaiting_payment')

  if (jobsError) {
    return { error: jobsError.message }
  }

  const jobs = (jobsData || []) as { id: string; job_number: string }[]
  if (jobs.length === 0) {
    return { success: true }
  }

  const defaultNote = notes || 'Forwarded to print room with partial payment'
  for (const job of jobs) {
    const { error: transitionError } = await supabase.rpc('transition_job_status', {
      p_job_id: job.id,
      p_to_status: 'paid_released',
      p_notes: defaultNote,
    } as any)

    if (transitionError) {
      console.error(`Error transitioning job ${job.id}:`, transitionError)
    }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/group/${groupId}`)
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
  // Removed strict awaiting_payment check to allow generating invoices for manually forwarded jobs

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

export async function updateJobAction(jobId: string, updates: { width: number, height: number, quantity: number, unitCost: number, notes: string }): Promise<ActionResponse> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single()
  const profile = data as { role: string, tenant_id: string } | null
  
  if (profile?.role !== 'admin' && profile?.role !== 'front_desk') {
    return { error: 'Insufficient permissions' }
  }

  const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single()
  const job = jobData as any
  if (!job) return { error: 'Job not found' }
  
  const finalUnitCost = profile?.role === 'admin' ? updates.unitCost : job.unit_cost_applied
  const area = updates.width * updates.height
  const lineTotal = Math.round(area * finalUnitCost * updates.quantity * 100) / 100

  const { error } = await (supabase.from('jobs') as any).update({
    width: updates.width,
    height: updates.height,
    area: area,
    quantity: updates.quantity,
    unit_cost_applied: finalUnitCost,
    line_total: lineTotal,
    notes: updates.notes || null
  }).eq('id', jobId)

  if (error) return { error: error.message }

  // Update invoice total
  if (job.group_id) {
    const { data: allJobsData } = await supabase.from('jobs').select('line_total').eq('group_id', job.group_id)
    const allJobs = allJobsData as any[] | null
    const newTotal = allJobs?.reduce((sum: number, j: any) => sum + Number(j.line_total), 0) || 0
    await (supabase.from('invoices') as any).update({ total: newTotal }).eq('group_id', job.group_id)
  } else {
    await (supabase.from('invoices') as any).update({ total: lineTotal }).eq('job_id', jobId)
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/${jobId}`)
  if (job.group_id) revalidatePath(`/dashboard/jobs/group/${job.group_id}`)
  
  return { success: true }
}

export async function deleteJobAction(jobId: string): Promise<ActionResponse> {
  const supabase = await createClient()
  
  // Verify user role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single()
  const profile = data as { role: string, tenant_id: string } | null
  
  if (profile?.role !== 'admin' && profile?.role !== 'front_desk') {
    return { error: 'Insufficient permissions to delete jobs' }
  }

  // Delete dependencies first (status events, payments, invoices)
  await supabase.from('job_status_events').delete().eq('job_id', jobId).eq('tenant_id', profile.tenant_id)
  await supabase.from('payments').delete().eq('job_id', jobId).eq('tenant_id', profile.tenant_id)
  await supabase.from('invoices').delete().eq('job_id', jobId).eq('tenant_id', profile.tenant_id)
  
  // Finally delete the job
  const { error } = await supabase.from('jobs').delete().eq('id', jobId).eq('tenant_id', profile.tenant_id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/pickup')
  return { success: true }
}

export async function startNewDayAction(): Promise<ActionResponse> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('start_new_day')
  if (error) return { error: error.message }
  revalidatePath('/dashboard/jobs')
  return { success: true }
}