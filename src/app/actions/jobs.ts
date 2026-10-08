'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
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



function getDatePrefix(prefix: 'PF' | 'INV', date = new Date()): string {
  // Use UTC since Ghana is UTC+0 (Africa/Accra)
  const yy = String(date.getUTCFullYear()).slice(-2)
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${prefix}-${yy}${mm}${dd}-`
}

async function generateDateJobNumbers(
  serviceSupabase: any,
  tenantId: string,
  count: number
): Promise<string[]> {
  const prefix = getDatePrefix('PF')
  const { data: existing, error } = await serviceSupabase
    .from('jobs')
    .select('job_number')
    .eq('tenant_id', tenantId)
    .ilike('job_number', `${prefix}%`)

  if (error) {
    console.error('Error fetching existing job numbers:', error)
  }

  let maxNum = 0
  if (existing && existing.length > 0) {
    for (const row of existing) {
      const suffix = (row.job_number || '').replace(prefix, '')
      const n = parseInt(suffix, 10)
      if (!isNaN(n) && n > maxNum) {
        maxNum = n
      }
    }
  }

  const results: string[] = []
  for (let i = 0; i < count; i++) {
    maxNum++
    results.push(`${prefix}${String(maxNum).padStart(3, '0')}`)
  }
  return results
}

async function generateDateInvoiceNumber(
  serviceSupabase: any,
  tenantId: string
): Promise<string> {
  const prefix = getDatePrefix('INV')
  const { data: existing, error } = await serviceSupabase
    .from('invoices')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .ilike('invoice_number', `${prefix}%`)

  if (error) {
    console.error('Error fetching existing invoice numbers:', error)
  }

  let maxNum = 0
  if (existing && existing.length > 0) {
    for (const row of existing) {
      const suffix = (row.invoice_number || '').replace(prefix, '')
      const n = parseInt(suffix, 10)
      if (!isNaN(n) && n > maxNum) {
        maxNum = n
      }
    }
  }

  const nextNum = maxNum + 1
  return `${prefix}${String(nextNum).padStart(3, '0')}`
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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()
    const profile = profileData as Pick<Profile, 'tenant_id' | 'role'> | null
    if (!profile) return { error: 'Profile not found' }

    if (profile.role !== 'front_desk' && profile.role !== 'admin') {
      return { error: 'Only front desk or admin can create jobs' }
    }

    if (!items || items.length === 0) {
      return { error: 'At least one job item is required' }
    }

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

    // Build items payload with converted cm dimensions and normalized unit cost
    let itemsPayload: any[] = []
    try {
      itemsPayload = items.map((item) => {
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
          dimension_unit: item.dimensionUnit || 'cm',
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

    const serviceSupabase = createServiceClient() as any

    // 1. Insert Job Group
    const { data: groupData, error: groupError } = await serviceSupabase
      .from('job_groups')
      .insert({
        tenant_id: profile.tenant_id,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        source: source,
        created_by: user.id
      })
      .select('id')
      .single()

    if (groupError || !groupData) {
      console.error('Create job group error:', groupError)
      return { error: groupError?.message || 'Failed to create job group' }
    }

    const groupId = groupData.id

    // 2. Precalculate items & totals
    let grandTotal = 0
    const processedItems = itemsPayload.map(item => {
      const area = item.width * item.height
      const lineTotal = Math.round(area * item.unit_cost * item.quantity * 100) / 100
      grandTotal = Math.round((grandTotal + lineTotal) * 100) / 100
      return {
        ...item,
        area,
        lineTotal,
      }
    })

    // 3. Assign collision-free date-based job numbers with automatic retry
    let insertedJobs: any[] = []
    let jobInsertAttempts = 0
    let lastJobError: any = null

    while (jobInsertAttempts < 5) {
      jobInsertAttempts++
      const jobNumbers = await generateDateJobNumbers(serviceSupabase, profile.tenant_id, processedItems.length)

      const jobsToInsert = processedItems.map((item, idx) => ({
        tenant_id: profile.tenant_id,
        group_id: groupId,
        job_number: jobNumbers[idx],
        source: source,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        product_type_id: item.product_type_id,
        width: item.width,
        height: item.height,
        area: item.area,
        quantity: item.quantity,
        unit_cost_applied: item.unit_cost,
        line_total: item.lineTotal,
        notes: item.notes,
        artwork_url: item.artwork_url,
        dimension_unit: item.dimension_unit,
        print_room: item.print_room,
        status: 'awaiting_payment',
        created_by: user.id,
      }))

      const { data: inserted, error: insertError } = await serviceSupabase
        .from('jobs')
        .insert(jobsToInsert)
        .select('id, job_number, line_total')

      if (!insertError && inserted && inserted.length > 0) {
        insertedJobs = inserted
        break
      }

      lastJobError = insertError
      if (insertError?.code === '23505') {
        // Concurrency collision, retry with next increment
        await new Promise(r => setTimeout(r, 50 * jobInsertAttempts))
        continue
      }

      console.error('Job insert error:', insertError)
      return { error: insertError?.message || 'Failed to create jobs' }
    }

    if (insertedJobs.length === 0) {
      return { error: lastJobError?.message || 'Failed to assign unique job numbers' }
    }

    // 4. Insert Job Status Events
    const statusEvents = insertedJobs.map(j => ({
      tenant_id: profile.tenant_id,
      job_id: j.id,
      from_status: null,
      to_status: 'awaiting_payment',
      actor_id: user.id,
    }))
    await serviceSupabase.from('job_status_events').insert(statusEvents)

    // 5. Generate collision-free date-based invoice
    let invoiceRecord: any = null
    let invAttempts = 0
    let lastInvError: any = null

    while (invAttempts < 5) {
      invAttempts++
      const invoiceNumber = await generateDateInvoiceNumber(serviceSupabase, profile.tenant_id)

      const { data: invData, error: invError } = await serviceSupabase
        .from('invoices')
        .insert({
          tenant_id: profile.tenant_id,
          job_id: null,
          invoice_number: invoiceNumber,
          total: Math.round(grandTotal),
          status: 'unpaid',
          group_id: groupId,
        })
        .select('id, invoice_number')
        .single()

      if (!invError && invData) {
        invoiceRecord = invData
        break
      }

      lastInvError = invError
      if (invError?.code === '23505') {
        await new Promise(r => setTimeout(r, 50 * invAttempts))
        continue
      }

      console.error('Invoice insert error:', invError)
      return { error: invError?.message || 'Failed to create invoice' }
    }

    if (!invoiceRecord) {
      return { error: lastInvError?.message || 'Failed to generate unique invoice number' }
    }

    // 6. Upsert customer in address book
    const { error: customerError } = await serviceSupabase
      .from('customers')
      .upsert({
        tenant_id: profile.tenant_id,
        name: customerName,
        phone: customerPhone || null
      }, { onConflict: 'tenant_id, name' })

    if (customerError) {
      console.error('Error saving customer to database:', customerError)
    }

    revalidatePath('/dashboard/jobs')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/queue')

    return {
      success: true,
      data: {
        group_id: groupId,
        invoice_id: invoiceRecord.id,
        invoice_number: invoiceRecord.invoice_number,
        grand_total: grandTotal,
        jobs: insertedJobs.map(j => ({
          job_id: j.id,
          job_number: j.job_number,
          line_total: j.line_total,
        }))
      }
    }
  } catch (globalErr: any) {
    console.error('FATAL Server Action Error:', globalErr)
    return { error: 'Server Error: ' + globalErr.message }
  }
}

// Legacy single-job create (delegates to createJobGroupAction)
export async function createJob(formData: FormData): Promise<ActionResponse> {
  const customerName = formData.get('customerName') as string
  const customerPhone = formData.get('customerPhone') as string
  const productTypeId = formData.get('productTypeId') as string
  const source = formData.get('source') as JobSource
  const width = parseFloat(formData.get('width') as string)
  const height = parseFloat(formData.get('height') as string)
  const quantity = parseInt(formData.get('quantity') as string, 10)
  const unitCost = parseFloat(formData.get('unitCost') as string)
  const notes = formData.get('notes') as string
  const artworkUrl = formData.get('artworkUrl') as string | null

  if (!customerName || !productTypeId || !source || isNaN(width) || isNaN(height) || isNaN(quantity)) {
    return { error: 'Missing required fields or invalid numbers' }
  }

  return await createJobGroupAction(customerName, customerPhone || null, source, [{
    productTypeId,
    width,
    height,
    dimensionUnit: 'cm',
    quantity,
    unitCost,
    notes,
    artworkUrl,
    printRoom: null
  }])
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
  try {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient() as any

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id, line_total, status')
      .eq('id', jobId)
      .single()

    const job = jobData as { id: string; tenant_id: string; line_total: number; status: string } | null
    if (jobError || !job) return { error: 'Job not found' }

    let invoiceRecord: any = null
    let attempts = 0
    while (attempts < 5) {
      attempts++
      const invNumber = await generateDateInvoiceNumber(serviceSupabase, job.tenant_id)
      const { data: invData, error: insertError } = await serviceSupabase
        .from('invoices')
        .insert({
          tenant_id: job.tenant_id,
          job_id: jobId,
          invoice_number: invNumber,
          total: Math.round(job.line_total),
          status: 'unpaid',
        })
        .select('id, invoice_number')
        .single()

      if (!insertError && invData) {
        invoiceRecord = invData
        break
      }

      if (insertError?.code === '23505') {
        if (insertError.message?.includes('job_id')) {
          revalidatePath(`/dashboard/jobs/${jobId}`)
          return { success: true }
        }
        await new Promise(r => setTimeout(r, 50 * attempts))
        continue
      }

      return { error: insertError.message }
    }

    revalidatePath(`/dashboard/jobs/${jobId}`)
    return { success: true, data: invoiceRecord }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateJobAction(jobId: string, updates: { width: number, height: number, quantity: number, unitCost: number, notes: string, customerName?: string, customerPhone?: string, printRoom?: string }): Promise<ActionResponse> {
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

  const updatePayload: any = {
    width: updates.width,
    height: updates.height,
    area: area,
    quantity: updates.quantity,
    unit_cost_applied: finalUnitCost,
    line_total: lineTotal,
    notes: updates.notes || null
  }
  
  if (updates.customerName !== undefined) updatePayload.customer_name = updates.customerName
  if (updates.customerPhone !== undefined) updatePayload.customer_phone = updates.customerPhone
  if (updates.printRoom !== undefined) updatePayload.print_room = updates.printRoom || null

  const { error } = await (supabase.from('jobs') as any).update(updatePayload).eq('id', jobId)

  if (error) return { error: error.message }

  // Update invoice total and group if necessary
  if (job.group_id) {
    const { data: allJobsData } = await supabase.from('jobs').select('line_total').eq('group_id', job.group_id)
    const allJobs = allJobsData as any[] | null
    const newTotal = allJobs?.reduce((sum: number, j: any) => sum + Number(j.line_total), 0) || 0
    await (supabase.from('invoices') as any).update({ total: newTotal }).eq('group_id', job.group_id)

    // Update group customer details if changed
    if (updates.customerName !== undefined || updates.customerPhone !== undefined) {
      const groupUpdate: any = {}
      if (updates.customerName !== undefined) groupUpdate.customer_name = updates.customerName
      if (updates.customerPhone !== undefined) groupUpdate.customer_phone = updates.customerPhone
      await (supabase.from('job_groups') as any).update(groupUpdate).eq('id', job.group_id)
    }
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
  const { data: profileData } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single()
  const profile = profileData as { role: string, tenant_id: string } | null
  
  if (profile?.role !== 'admin' && profile?.role !== 'front_desk') {
    return { error: 'Insufficient permissions to delete jobs' }
  }

  const serviceSupabase = createServiceClient()

  // 1. Fetch the job details
  const { data: jobData, error: jobFetchError } = await serviceSupabase
    .from('jobs')
    .select('id, group_id, tenant_id, line_total')
    .eq('id', jobId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (jobFetchError || !jobData) {
    return { error: 'Job not found or already deleted' }
  }

  const job = jobData as { id: string; group_id: string | null; tenant_id: string; line_total: number }

  if (job.group_id) {
    // Multi-job group
    const { data: groupJobs } = await serviceSupabase
      .from('jobs')
      .select('id, line_total')
      .eq('group_id', job.group_id)
      .eq('tenant_id', profile.tenant_id)

    const allGroupJobs = (groupJobs || []) as { id: string; line_total: number }[]
    const remainingJobs = allGroupJobs.filter((j) => j.id !== jobId)

    if (remainingJobs.length === 0) {
      // Last job in the group - delete the whole group, its invoice and payments
      const { data: invData } = await serviceSupabase
        .from('invoices')
        .select('id')
        .eq('group_id', job.group_id)
        .eq('tenant_id', profile.tenant_id)
      
      const invoiceIds = (invData || []).map((inv: any) => inv.id)
      if (invoiceIds.length > 0) {
        await serviceSupabase.from('payments').delete().in('invoice_id', invoiceIds)
        await serviceSupabase.from('invoices').delete().in('id', invoiceIds)
      }

      await serviceSupabase.from('job_status_events').delete().eq('job_id', jobId)
      const { error: delErr } = await serviceSupabase.from('jobs').delete().eq('id', jobId).eq('tenant_id', profile.tenant_id)
      if (delErr) return { error: delErr.message }

      await serviceSupabase.from('job_groups').delete().eq('id', job.group_id).eq('tenant_id', profile.tenant_id)
    } else {
      // Other jobs still remain in group
      await serviceSupabase.from('job_status_events').delete().eq('job_id', jobId)
      // Unlink any payments referencing this job specifically
      await (serviceSupabase.from('payments') as any).update({ job_id: null }).eq('job_id', jobId)
      
      const { error: delErr } = await serviceSupabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('tenant_id', profile.tenant_id)

      if (delErr) {
        return { error: delErr.message }
      }

      // Recalculate group invoice total
      const newTotal = remainingJobs.reduce((sum: number, j: any) => sum + Number(j.line_total), 0)
      await (serviceSupabase.from('invoices') as any)
        .update({ total: Math.round(newTotal * 100) / 100 })
        .eq('group_id', job.group_id)
        .eq('tenant_id', profile.tenant_id)
    }
  } else {
    // Standalone job
    const { data: invData } = await serviceSupabase
      .from('invoices')
      .select('id')
      .eq('job_id', jobId)
      .eq('tenant_id', profile.tenant_id)

    const invoiceIds = (invData || []).map((inv: any) => inv.id)
    if (invoiceIds.length > 0) {
      await serviceSupabase.from('payments').delete().in('invoice_id', invoiceIds)
      await serviceSupabase.from('invoices').delete().in('id', invoiceIds)
    }
    await serviceSupabase.from('payments').delete().eq('job_id', jobId).eq('tenant_id', profile.tenant_id)
    await serviceSupabase.from('job_status_events').delete().eq('job_id', jobId)
    const { error: delErr } = await serviceSupabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('tenant_id', profile.tenant_id)

    if (delErr) {
      return { error: delErr.message }
    }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/pickup')
  revalidatePath('/dashboard/finance')
  if (job.group_id) {
    revalidatePath(`/dashboard/jobs/group/${job.group_id}`)
  }
  return { success: true }
}

export async function startNewDayAction(): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    const profile = profileData as Pick<Profile, 'tenant_id' | 'role'> | null
    if (!profile || (profile.role !== 'admin' && profile.role !== 'front_desk')) {
      return { error: 'Unauthorized' }
    }

    const serviceSupabase = createServiceClient() as any
    await serviceSupabase
      .from('job_sequences')
      .upsert({
        tenant_id: profile.tenant_id,
        last_reset_time: new Date().toISOString()
      }, { onConflict: 'tenant_id' })

    revalidatePath('/dashboard/jobs')
    revalidatePath('/dashboard/finance')
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function roundInvoiceTotalAction(invoiceId: string): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role
  if (!['front_desk', 'admin'].includes(role)) return { error: 'Insufficient permissions' }

  const { data: invoice } = await (supabase.from('invoices') as any).select('total, job_id, group_id').eq('id', invoiceId).single()
  if (!invoice) return { error: 'Invoice not found' }

  const rounded = Math.round(invoice.total)
  if (rounded === invoice.total) return { success: true }

  const { error } = await (supabase.from('invoices') as any).update({ total: rounded }).eq('id', invoiceId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/finance')
  if (invoice.job_id) revalidatePath(`/dashboard/jobs/${invoice.job_id}`)
  if (invoice.group_id) revalidatePath(`/dashboard/jobs/group/${invoice.group_id}`)
  
  return { success: true }
}

export async function editPaymentMethodAction(paymentId: string, method: string, reference?: string): Promise<ActionResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = profData as any
  if (!profile || !['admin', 'accountant', 'front_desk'].includes(profile.role)) {
    return { error: 'Insufficient permissions' }
  }

  const { data: payment, error: fetchErr } = await (supabase.from('payments') as any)
    .select('id, invoice_id, job_id')
    .eq('id', paymentId)
    .single()

  if (fetchErr || !payment) return { error: 'Payment not found' }

  const updateData: any = { method }
  if (reference !== undefined) {
    updateData.reference = reference || null
  }

  const { error } = await (supabase.from('payments') as any)
    .update(updateData)
    .eq('id', paymentId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/finance')
  if (payment.job_id) revalidatePath(`/dashboard/jobs/${payment.job_id}`)
  
  // To handle group paths properly:
  revalidatePath('/dashboard/jobs')
  
  return { success: true }
}