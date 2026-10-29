'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type JobStatus, type PaymentMethod, type JobSource, type Profile, type DimensionUnit, type PrintRoom, type DeliveryMethod } from '@/types/database'
import { toCmRate, resolveUnitRate } from '@/lib/pricing'
import { getTenantUnitPricing } from '@/lib/pricing-server'
import { getWorkdayBounds } from '@/lib/workday'
import { isPocketOrFinishingProduct } from '@/lib/utils'

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

export interface JobDiscount {
  type: 'percentage' | 'fixed'
  value: number
  reason?: string | null
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

function applyInvoiceDiscount(subtotal: number, invoice: any) {
  const type = invoice?.discount_type
  const value = Number(invoice?.discount_value || 0)
  const amount = type === 'percentage'
    ? Math.min(subtotal, Math.max(0, subtotal * Math.min(100, value) / 100))
    : type === 'fixed'
      ? Math.min(subtotal, Math.max(0, value))
      : 0
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount_amount: Math.round(amount * 100) / 100,
    total: Math.round((subtotal - amount) * 100) / 100,
  }
}



function getDatePrefix(prefix: 'PF' | 'INV', now = new Date()): string {
  // Use the SHIFT start date (5PM boundary) not the calendar midnight date.
  // e.g. 3:00 AM Oct 16 → shift started Oct 15 at 17:00 → prefix uses Oct 15.
  const workday = getWorkdayBounds(now)
  const shiftStart = workday.start
  const yy = String(shiftStart.getUTCFullYear()).slice(-2)
  const mm = String(shiftStart.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shiftStart.getUTCDate()).padStart(2, '0')
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
  items: JobItem[],
  deliveryMethod: DeliveryMethod = 'pickup',
  deliveryAddress?: string | null,
  deliveryPhone?: string | null,
  discount?: JobDiscount
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
    
    // Fetch product types to check for fixed pricing
    const productIds = Array.from(new Set(items.map(it => it.productTypeId || (it as any).product_type_id)))
    const [{ data: rulesData }, configData, { data: productsData }] = await Promise.all([
      profile.role !== 'admin' ? supabase.from('pricing_rules').select('*').eq('tenant_id', profile.tenant_id) : Promise.resolve({ data: null }),
      profile.role !== 'admin' ? getTenantUnitPricing(profile.tenant_id) : Promise.resolve(null),
      supabase.from('product_types').select('id, is_fixed_price').in('id', productIds).eq('tenant_id', profile.tenant_id)
    ])
    
    if (profile.role !== 'admin') {
      pricingRules = (rulesData as any[]) || []
      unitPricingConfig = configData
    }
    const fixedPriceMap = new Map(productsData?.map((p: any) => [p.id, p.is_fixed_price]) || [])

    // Build items payload with converted cm dimensions and normalized unit cost
    let itemsPayload: any[] = []
    try {
      itemsPayload = items.map((item) => {
        let effectiveUnitCost = item.unitCost

        if (profile.role !== 'admin') {
          const activeRule = pricingRules.find(r => r.product_type_id === item.productTypeId && r.source === source)
          const isFixed = fixedPriceMap.get(item.productTypeId)
          let resolvedRate = 0
          
          if (isFixed) {
            resolvedRate = activeRule?.unit_cost || 0
          } else {
            resolvedRate = resolveUnitRate(
              unitPricingConfig,
              item.productTypeId,
              source,
              item.dimensionUnit,
              activeRule?.unit_cost
            )
          }
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
    const groupInsertPayload: any = {
      tenant_id: profile.tenant_id,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      source: source,
      created_by: user.id,
      delivery_method: deliveryMethod,
      delivery_address: deliveryMethod === 'delivery' ? (deliveryAddress || null) : null,
      delivery_phone: deliveryMethod === 'delivery' ? (deliveryPhone || null) : null,
    }

    let { data: groupData, error: groupError } = await serviceSupabase
      .from('job_groups')
      .insert(groupInsertPayload)
      .select('id')
      .single()

    // Graceful fallback if delivery columns do not exist yet on job_groups
    if (groupError && (groupError.message?.includes('delivery_') || groupError.code === '42703')) {
      console.warn('Fallback: delivery columns not yet present on job_groups, retrying without delivery fields')
      const fallbackGroup = await serviceSupabase
        .from('job_groups')
        .insert({
          tenant_id: profile.tenant_id,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          source: source,
          created_by: user.id,
        })
        .select('id')
        .single()
      groupData = fallbackGroup.data
      groupError = fallbackGroup.error
    }

    if (groupError || !groupData) {
      console.error('Create job group error:', groupError)
      return { error: groupError?.message || 'Failed to create job group' }
    }

    const groupId = groupData.id

    // 2. Precalculate items & totals
    let grandTotal = 0
    const processedItems = itemsPayload.map(item => {
      const isFixed = fixedPriceMap.get(item.product_type_id)
      const area = isFixed ? 1 : (item.width * item.height)
      const lineTotal = Math.round(area * item.unit_cost * item.quantity * 100) / 100
      grandTotal = Math.round((grandTotal + lineTotal) * 100) / 100
      return {
        ...item,
        area,
        lineTotal,
      }
    })

    const subtotal = Math.round(grandTotal * 100) / 100
    const discountType = discount?.type === 'percentage' || discount?.type === 'fixed'
      ? discount.type
      : 'none'
    const requestedDiscount = Number(discount?.value || 0)
    const discountAmount = discountType === 'percentage'
      ? Math.min(subtotal, Math.max(0, subtotal * Math.min(100, Math.max(0, requestedDiscount)) / 100))
      : Math.min(subtotal, Math.max(0, requestedDiscount))
    const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100

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
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'delivery' ? (deliveryAddress || null) : null,
        delivery_phone: deliveryMethod === 'delivery' ? (deliveryPhone || null) : null,
        delivery_status: deliveryMethod === 'delivery' ? 'pending' : null,
        created_by: user.id,
      }))

      let { data: inserted, error: insertError } = await serviceSupabase
        .from('jobs')
        .insert(jobsToInsert)
        .select('id, job_number, line_total')

      // Fallback if jobs table doesn't have delivery columns yet
      if (insertError && (insertError.message?.includes('delivery_') || insertError.code === '42703')) {
        console.warn('Fallback: delivery columns not yet present on jobs table, retrying without delivery fields')
        const fallbackJobsToInsert = jobsToInsert.map(({ delivery_method, delivery_address, delivery_phone, delivery_status, ...rest }: any) => rest)
        const fallbackRes = await serviceSupabase
          .from('jobs')
          .insert(fallbackJobsToInsert)
          .select('id, job_number, line_total')
        inserted = fallbackRes.data
        insertError = fallbackRes.error
      }

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

      let { data: invData, error: invError } = await serviceSupabase
        .from('invoices')
        .insert({
          tenant_id: profile.tenant_id,
          job_id: insertedJobs.length === 1 ? insertedJobs[0].id : null,
          invoice_number: invoiceNumber,
          subtotal,
          total: finalTotal,
          discount_type: discountType,
          discount_value: discountType === 'none' ? 0 : requestedDiscount,
          discount_amount: Math.round(discountAmount * 100) / 100,
          discount_reason: discount?.reason?.trim() || null,
          status: 'unpaid',
          group_id: groupId,
        })
        .select('id, invoice_number')
        .single()

      // If database has not run migration 017 yet, fallback to base invoice schema with finalTotal
      if (invError && (invError.message?.includes('subtotal') || invError.message?.includes('discount') || invError.code === 'PGRST204' || invError.message?.includes('schema cache'))) {
        const fallback = await serviceSupabase
          .from('invoices')
          .insert({
            tenant_id: profile.tenant_id,
            job_id: insertedJobs.length === 1 ? insertedJobs[0].id : null,
            invoice_number: invoiceNumber,
            total: finalTotal,
            status: 'unpaid',
            group_id: groupId,
          })
          .select('id, invoice_number')
          .single()
        invData = fallback.data
        invError = fallback.error
      }

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
        subtotal,
        discount_amount: Math.round(discountAmount * 100) / 100,
        final_total: finalTotal,
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
  revalidatePath('/dashboard/finance')
  revalidatePath('/print/finance-report')
  return { success: true }
}

export async function cancelJobGroupAction(groupId: string): Promise<ActionResponse> {
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
    return { error: 'Insufficient permissions to cancel orders' }
  }

  // Fetch all cancellable jobs in the group
  const { data: jobsData, error: jobsError } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('group_id', groupId)
    .in('status', ['draft', 'quoted', 'awaiting_payment'])

  if (jobsError) return { error: jobsError.message }

  const jobs = (jobsData || []) as { id: string; status: string }[]
  if (jobs.length === 0) {
    return { error: 'No jobs in this order can be cancelled (they may already be in production or completed).' }
  }

  for (const job of jobs) {
    const { error: transitionError } = await supabase.rpc('transition_job_status', {
      p_job_id: job.id,
      p_to_status: 'cancelled',
      p_notes: 'Order cancelled by staff',
    } as any)
    if (transitionError) {
      console.error(`Error cancelling job ${job.id}:`, transitionError)
    }
  }

  // If the invoice for this group has 0 payments, delete the invoice so it doesn't linger as phantom debt
  try {
    const serviceSupabase = createServiceClient() as any
    const { data: inv } = await serviceSupabase
      .from('invoices')
      .select('id, payments(id)')
      .eq('group_id', groupId)
      .single()

    if (inv && (!inv.payments || inv.payments.length === 0)) {
      await serviceSupabase.from('invoices').delete().eq('id', inv.id)
    }
  } catch (cleanErr) {
    console.error('Error cleaning up cancelled group invoice:', cleanErr)
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/group/${groupId}`)
  revalidatePath('/dashboard/finance')
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
  if (!['front_desk', 'admin', 'accountant'].includes(role)) {
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

  // Also auto-advance companion pocket/finishing jobs in the same group so non-printable extra services
  // stay in sync with the primary printed products and don't stall the order or confuse staff
  try {
    const { data: currentJob } = await supabase
      .from('jobs')
      .select('group_id, product_types(name)')
      .eq('id', jobId)
      .single()

    const isExtra = isPocketOrFinishingProduct((currentJob as any)?.product_types?.name)
    const groupId = (currentJob as any)?.group_id

    if (groupId && !isExtra && ['in_production', 'completed', 'picked_up'].includes(toStatus)) {
      const { data: siblings } = await supabase
        .from('jobs')
        .select('id, status, product_types(name)')
        .eq('group_id', groupId)

      if (siblings && (siblings as any[]).length > 0) {
        const siblingList = siblings as any[]
        const printableSiblings = siblingList.filter((s: any) => !isPocketOrFinishingProduct(s.product_types?.name) && s.id !== jobId)
        const allOtherPrintableDone = printableSiblings.every((s: any) =>
          toStatus === 'completed' ? ['completed', 'picked_up', 'cancelled'].includes(s.status) :
          toStatus === 'in_production' ? ['in_production', 'completed', 'picked_up'].includes(s.status) :
          toStatus === 'picked_up' ? ['picked_up', 'cancelled'].includes(s.status) : false
        )

        if (allOtherPrintableDone) {
          const extraSiblings = siblingList.filter((s: any) => isPocketOrFinishingProduct(s.product_types?.name))
          for (const extraJob of extraSiblings) {
            if (extraJob.status !== toStatus) {
              if (toStatus === 'completed' && extraJob.status === 'paid_released') {
                await supabase.rpc('transition_job_status', {
                  p_job_id: extraJob.id,
                  p_to_status: 'in_production',
                  p_notes: 'Auto-advanced with companion print job'
                } as any)
              }
              await supabase.rpc('transition_job_status', {
                p_job_id: extraJob.id,
                p_to_status: toStatus,
                p_notes: notes || 'Auto-advanced with companion print job'
              } as any)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Non-fatal: could not sync companion pocket/finishing job:', e)
  }

  // If status is completed, automatically deduct material from inventory
  if (toStatus === 'completed') {
    try {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, tenant_id, width, height, quantity, dimension_unit, product_types(material_id)')
        .eq('id', jobId)
        .single()
  
      const job = jobData as any
      const materialId = job?.product_types?.material_id
  
      if (materialId && job) {
        const { data: materialData } = await (supabase as any)
          .from('materials')
          .select('id, roll_width, roll_length, qty_rolls')
          .eq('id', materialId)
          .single()
  
        const material = materialData as any
        if (material) {
          const w_cm = toCm(job.width, job.dimension_unit)
          const h_cm = toCm(job.height, job.dimension_unit)
          const area_m2 = (w_cm / 100) * (h_cm / 100) * job.quantity
          
          const roll_height = material.roll_height || material.roll_length || 0
          const roll_area = material.roll_width * roll_height
          const rolls_deducted = roll_area > 0 ? (area_m2 / roll_area) : 0
  
          if (rolls_deducted > 0) {
            await (supabase as any).from('inventory_logs').insert({
              tenant_id: job.tenant_id,
              material_id: materialId,
              action: 'job_deduction',
              job_id: jobId,
              qty_change_rolls: -rolls_deducted,
              qty_change_area: -area_m2,
              notes: `Auto-deducted for completed job`
            })
    
            await (supabase as any).from('materials').update({
              qty_rolls: material.qty_rolls - rolls_deducted,
              updated_at: new Date().toISOString()
            }).eq('id', materialId)
          }
        }
      }
    } catch (err) {
      console.error('Failed to deduct inventory:', err)
    }
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

    // Auto-clean artwork storage when job is picked up or cancelled to keep Supabase storage lean
    if (toStatus === 'picked_up' || toStatus === 'cancelled') {
      try {
        const serviceSupabase = createServiceClient() as any
        const { data: jobArtwork } = await serviceSupabase
          .from('jobs')
          .select('artwork_url, tenant_id')
          .eq('id', jobId)
          .single()

        if (jobArtwork?.artwork_url && jobArtwork?.tenant_id) {
          const match = jobArtwork.artwork_url.match(new RegExp(`${jobArtwork.tenant_id}/([^?]+)`))
          if (match) {
            const filePath = `${jobArtwork.tenant_id}/${match[1]}`
            await serviceSupabase.storage.from('artworks').remove([filePath])
          }
          await serviceSupabase.from('jobs').update({ artwork_url: null }).eq('id', jobId)
        }
      } catch (cleanErr) {
        console.warn('Non-fatal: could not auto-clean artwork file:', cleanErr)
      }
    }

    // If status is cancelled, clean up phantom invoices or recalculate group invoice total
    if (toStatus === 'cancelled') {
    try {
      const serviceSupabase = createServiceClient() as any
      const { data: jobInfo } = await serviceSupabase
        .from('jobs')
        .select('id, group_id, tenant_id')
        .eq('id', jobId)
        .single()

      if (jobInfo?.group_id) {
        const { data: grpJobs } = await serviceSupabase
          .from('jobs')
          .select('id, line_total, status')
          .eq('group_id', jobInfo.group_id)

        const activeJobs = (grpJobs || []).filter((j: any) => j.status !== 'cancelled')
        const newTotal = activeJobs.reduce((sum: number, j: any) => sum + Number(j.line_total), 0)

        const { data: inv } = await serviceSupabase
          .from('invoices')
          .select('id, payments(id)')
          .eq('group_id', jobInfo.group_id)
          .single()

        const paymentsCount = (inv?.payments || []).length
        if (activeJobs.length === 0 && paymentsCount === 0 && inv?.id) {
          // Whole group cancelled with 0 payments: delete phantom invoice
          await serviceSupabase.from('invoices').delete().eq('id', inv.id)
        } else if (inv?.id) {
          await serviceSupabase.from('invoices').update({ total: Math.round(newTotal * 100) / 100 }).eq('id', inv.id)
        }
        revalidatePath(`/dashboard/jobs/group/${jobInfo.group_id}`)
      } else if (jobInfo?.id) {
        const { data: inv } = await serviceSupabase
          .from('invoices')
          .select('id, payments(id)')
          .eq('job_id', jobId)
          .single()

        const paymentsCount = (inv?.payments || []).length
        if (paymentsCount === 0 && inv?.id) {
          await serviceSupabase.from('invoices').delete().eq('id', inv.id)
        }
      }
    } catch (cancelErr) {
      console.error('Failed to handle invoice cancellation sync:', cancelErr)
    }
  }

  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/pickup')
  revalidatePath('/dashboard/finance')
  return { success: true }
}

export async function createInvoiceForJobAction(jobId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient() as any

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id, line_total, status, group_id')
      .eq('id', jobId)
      .single()

    const job = jobData as { id: string; tenant_id: string; line_total: number; status: string; group_id: string | null } | null
    if (jobError || !job) return { error: 'Job not found' }

    // Check if an invoice already exists for this job directly
    const { data: existingJobInv } = await serviceSupabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('job_id', jobId)
      .maybeSingle()

    if (existingJobInv) {
      revalidatePath(`/dashboard/jobs/${jobId}`)
      return { success: true, data: existingJobInv }
    }

    // Check if job belongs to a group that already has an invoice
    if (job.group_id) {
      const { data: existingGroupInv } = await serviceSupabase
        .from('invoices')
        .select('id, invoice_number, job_id')
        .eq('group_id', job.group_id)
        .maybeSingle()

      if (existingGroupInv) {
        if (!existingGroupInv.job_id) {
          await serviceSupabase.from('invoices').update({ job_id: jobId }).eq('id', existingGroupInv.id)
        }
        revalidatePath(`/dashboard/jobs/${jobId}`)
        return { success: true, data: existingGroupInv }
      }
    }

    let invoiceRecord: any = null
    let attempts = 0
    while (attempts < 5) {
      attempts++
      const invNumber = await generateDateInvoiceNumber(serviceSupabase, job.tenant_id)
      let { data: invData, error: insertError } = await serviceSupabase
        .from('invoices')
        .insert({
          tenant_id: job.tenant_id,
          job_id: jobId,
          invoice_number: invNumber,
          subtotal: Math.round(Number(job.line_total) * 100) / 100,
          total: Math.round(Number(job.line_total) * 100) / 100,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          status: 'unpaid',
          group_id: job.group_id || null,
        })
        .select('id, invoice_number')
        .single()

      if (insertError && (insertError.message?.includes('subtotal') || insertError.message?.includes('discount') || insertError.message?.includes('schema cache'))) {
        const fallback = await serviceSupabase
          .from('invoices')
          .insert({
            tenant_id: job.tenant_id,
            job_id: jobId,
            invoice_number: invNumber,
            total: Math.round(Number(job.line_total)),
            status: 'unpaid',
            group_id: job.group_id || null,
          })
          .select('id, invoice_number')
          .single()
        invData = fallback.data
        insertError = fallback.error
      }

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
  
  if (profile?.role !== 'admin') {
    return { error: 'Insufficient permissions. Only administrators can edit jobs.' }
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
  
  if (profile?.role !== 'admin') {
    return { error: 'Insufficient permissions. Only administrators can delete jobs.' }
  }

  const serviceSupabase = createServiceClient()

  // 1. Fetch the job details
  const { data: jobData, error: jobFetchError } = await serviceSupabase
    .from('jobs')
    .select('id, group_id, tenant_id, line_total, status')
    .eq('id', jobId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (jobFetchError || !jobData) {
    return { error: 'Job not found or already deleted' }
  }

  const job = jobData as { id: string; group_id: string | null; tenant_id: string; line_total: number; status: string }

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

export async function deleteJobGroupAction(groupId: string): Promise<ActionResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profileData } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single()
  const profile = profileData as { role: string, tenant_id: string } | null

  if (profile?.role !== 'admin') {
    return { error: 'Insufficient permissions. Only administrators can delete orders.' }
  }

  const serviceSupabase = createServiceClient()

  // 1. Fetch group jobs
  const { data: groupJobs, error: jobsErr } = await serviceSupabase
    .from('jobs')
    .select('id, status')
    .eq('group_id', groupId)
    .eq('tenant_id', profile.tenant_id)

  if (jobsErr) return { error: jobsErr.message }
  const jobs = (groupJobs || []) as { id: string; status: string }[]

  // 2. Delete payments and invoices
  const { data: invData } = await serviceSupabase
    .from('invoices')
    .select('id')
    .eq('group_id', groupId)
    .eq('tenant_id', profile.tenant_id)

  const invoiceIds = (invData || []).map((inv: any) => inv.id)
  if (invoiceIds.length > 0) {
    await serviceSupabase.from('payments').delete().in('invoice_id', invoiceIds)
    await serviceSupabase.from('invoices').delete().in('id', invoiceIds)
  }

  // 3. Delete job status events and jobs
  const jobIds = jobs.map(j => j.id)
  if (jobIds.length > 0) {
    await serviceSupabase.from('job_status_events').delete().in('job_id', jobIds)
    await serviceSupabase.from('jobs').delete().in('id', jobIds).eq('tenant_id', profile.tenant_id)
  }

  // 4. Delete job group
  await serviceSupabase.from('job_groups').delete().eq('id', groupId).eq('tenant_id', profile.tenant_id)

  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/queue')
  revalidatePath('/dashboard/pickup')
  revalidatePath('/dashboard/finance')
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
