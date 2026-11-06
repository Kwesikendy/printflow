'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateDateJobNumbers, generateDateInvoiceNumber } from '@/app/actions/jobs'
import type { JobSource } from '@/types/database'

export interface CustomerSuggestion {
  customer_name: string
  customer_phone: string | null
  source: string
}

export interface CustomerWithBalance {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: 'walk_in' | 'marketing'
  totalJobs: number
  totalInvoiced: number
  totalPaid: number
  balance: number
  lastTransactionDate: string | null
  created_at: string
  hasArrears: boolean
}

export interface AddClientInput {
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  source?: 'walk_in' | 'marketing'
  companyName?: string | null
  address?: string | null
  notes?: string | null
  // Historical debt fields
  hasHistoricalDebt?: boolean
  debtAmount?: number
  debtReason?: string | null
  debtDate?: string | null
  legacyReference?: string | null
  initialPayment?: number
  initialPaymentMethod?: 'cash' | 'momo' | 'other'
  initialPaymentReference?: string | null
}

export interface CustomerDirectoryResult {
  customers: CustomerWithBalance[]
  summary: {
    totalClients: number
    clientsOwing: number
    totalArrears: number
    clientsSettled: number
  }
}

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, is_active')
    .eq('id', user.id)
    .single() as any

  if (!profile || profile.is_active === false || !profile.tenant_id) {
    throw new Error('Active profile not found')
  }

  return { user, tenantId: profile.tenant_id, role: profile.role }
}

/**
 * Searches customers for autocomplete in order intake and search bars.
 */
export async function searchCustomers(query: string = ''): Promise<CustomerSuggestion[]> {
  const q = query?.trim() || ''

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, is_active')
      .eq('id', user.id)
      .single() as any

    if (!profile || profile.is_active === false || !profile.tenant_id) {
      return []
    }

    const tenantId = profile.tenant_id
    const serviceSupabase = createServiceClient() as any

    let custQuery = serviceSupabase
      .from('customers')
      .select('name, phone, created_at')
      .eq('tenant_id', tenantId)

    let grpQuery = serviceSupabase
      .from('job_groups')
      .select('customer_name, customer_phone, source, created_at')
      .eq('tenant_id', tenantId)

    let jobsQuery = serviceSupabase
      .from('jobs')
      .select('customer_name, customer_phone, source, created_at')
      .eq('tenant_id', tenantId)

    if (q) {
      custQuery = custQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      grpQuery = grpQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
      jobsQuery = jobsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
    }

    const [customersRes, jobGroupsRes, jobsRes] = await Promise.all([
      custQuery.order('created_at', { ascending: false }).limit(25),
      grpQuery.order('created_at', { ascending: false }).limit(25),
      jobsQuery.order('created_at', { ascending: false }).limit(25)
    ])

    const results = new Map<string, CustomerSuggestion>()

    const addResult = (name: string, phone: string | null, source: string) => {
      const trimmed = (name || '').trim()
      if (!trimmed || trimmed === 'TEST_DELETE_ME') return
      const key = trimmed.toLowerCase()
      if (!results.has(key)) {
        results.set(key, {
          customer_name: trimmed,
          customer_phone: phone ? phone.trim() : null,
          source: source || 'walk_in'
        })
      } else if (phone && !results.get(key)!.customer_phone) {
        results.get(key)!.customer_phone = phone.trim()
      }
    }

    if (customersRes.data) {
      customersRes.data.forEach((r: any) => addResult(r.name, r.phone, 'walk_in'))
    }
    if (jobGroupsRes.data) {
      jobGroupsRes.data.forEach((r: any) => addResult(r.customer_name, r.customer_phone, r.source))
    }
    if (jobsRes.data) {
      jobsRes.data.forEach((r: any) => addResult(r.customer_name, r.customer_phone, r.source))
    }

    return Array.from(results.values()).slice(0, 15)
  } catch (err) {
    console.error('searchCustomers action error:', err)
    return []
  }
}

/**
 * Adds a new client or records historical debt for an existing/new client.
 * Accessible to Admin and Accountant (and Front Desk).
 */
export async function createClientOrLegacyDebtAction(input: AddClientInput): Promise<{
  success?: boolean
  error?: string
  customerName?: string
  invoiceNumber?: string
  debtAmount?: number
  balance?: number
}> {
  try {
    const { user, tenantId, role } = await getAuthContext()

    if (!['admin', 'accountant', 'front_desk'].includes(role)) {
      return { error: 'Insufficient permissions to add clients or historical debt' }
    }

    const customerName = input.customerName?.trim()
    if (!customerName) {
      return { error: 'Customer or business name is required' }
    }

    const customerPhone = input.customerPhone?.trim() || null
    const customerEmail = input.customerEmail?.trim() || null
    const source = (input.source === 'marketing' ? 'marketing' : 'walk_in') as JobSource

    const serviceSupabase = createServiceClient() as any

    // 1. Check or Upsert in customers table
    const { data: existingCust } = await serviceSupabase
      .from('customers')
      .select('id, name, phone, email')
      .eq('tenant_id', tenantId)
      .ilike('name', customerName)
      .maybeSingle()

    let customerId: string
    if (existingCust) {
      customerId = existingCust.id
      // Update phone or email if provided and missing
      const updatePayload: any = {}
      if (customerPhone && !existingCust.phone) updatePayload.phone = customerPhone
      if (customerEmail && !existingCust.email) updatePayload.email = customerEmail

      if (Object.keys(updatePayload).length > 0) {
        await serviceSupabase
          .from('customers')
          .update(updatePayload)
          .eq('id', customerId)
      }
    } else {
      const { data: newCust, error: custErr } = await serviceSupabase
        .from('customers')
        .upsert({
          tenant_id: tenantId,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
        }, { onConflict: 'tenant_id, name' })
        .select('id')
        .single()

      if (custErr) {
        console.warn('Upsert customer warning:', custErr)
      }
      customerId = newCust?.id || 'cust-' + Date.now()
    }

    // 2. If historical debt was provided, record debt order and invoice
    const hasDebt = Boolean(input.hasHistoricalDebt)
    const rawDebtAmount = Number(input.debtAmount || 0)

    if (hasDebt && rawDebtAmount > 0) {
      const roundedDebtAmount = Math.round(rawDebtAmount * 100) / 100

      // Find or create 'Debt' product type
      let { data: debtProduct } = await serviceSupabase
        .from('product_types')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('name', 'Debt')
        .maybeSingle()

      if (!debtProduct) {
        const { data: createdProd, error: prodErr } = await serviceSupabase
          .from('product_types')
          .insert({
            tenant_id: tenantId,
            name: 'Debt',
            is_active: true
          })
          .select('id')
          .single()

        if (prodErr || !createdProd) {
          // Fallback to any active product
          const { data: fallbackProd } = await serviceSupabase
            .from('product_types')
            .select('id')
            .eq('tenant_id', tenantId)
            .limit(1)
            .single()
          debtProduct = fallbackProd
        } else {
          debtProduct = createdProd
        }
      }

      if (!debtProduct?.id) {
        return { error: 'Failed to resolve debt product category' }
      }

      // Debt date
      const debtDateIso = input.debtDate && !isNaN(new Date(input.debtDate).getTime())
        ? new Date(input.debtDate).toISOString()
        : new Date().toISOString()

      // Create job_groups record
      const { data: groupData, error: grpErr } = await serviceSupabase
        .from('job_groups')
        .insert({
          tenant_id: tenantId,
          customer_name: customerName,
          customer_phone: customerPhone,
          source: source,
          created_by: user.id,
          created_at: debtDateIso
        })
        .select('id')
        .single()

      if (grpErr || !groupData) {
        console.error('Error creating job_group for historical debt:', grpErr)
        return { error: 'Failed to record historical order group' }
      }

      const groupId = groupData.id

      // Generate collision-free job number and invoice number
      const jobNumbers = await generateDateJobNumbers(serviceSupabase, tenantId, 1)
      const jobNumber = jobNumbers[0] || `PF-HIST-${Date.now().toString().slice(-6)}`
      const invoiceNumber = await generateDateInvoiceNumber(serviceSupabase, tenantId)

      // Notes construction
      const notesParts = [
        input.debtReason?.trim() || 'Historical opening debt from manual records prior to PrintFlow onboarding',
        input.legacyReference?.trim() ? `Legacy Receipt/Book #: ${input.legacyReference.trim()}` : null,
        input.notes?.trim() ? `Note: ${input.notes.trim()}` : null
      ].filter(Boolean)

      const notesText = notesParts.join(' | ')

      // Create completed/picked_up job
      // (picked_up ensures it doesn't clutter active production queues)
      const { data: jobData, error: jobErr } = await serviceSupabase
        .from('jobs')
        .insert({
          tenant_id: tenantId,
          group_id: groupId,
          job_number: jobNumber,
          source: source,
          customer_name: customerName,
          customer_phone: customerPhone,
          product_type_id: debtProduct.id,
          width: 1,
          height: 1,
          area: 1,
          quantity: 1,
          unit_cost_applied: roundedDebtAmount,
          line_total: roundedDebtAmount,
          notes: notesText,
          status: 'picked_up',
          created_by: user.id,
          created_at: debtDateIso,
          updated_at: debtDateIso,
          dimension_unit: 'cm',
          delivery_method: 'pickup'
        })
        .select('id')
        .single()

      if (jobErr || !jobData) {
        console.error('Error creating job for historical debt:', jobErr)
        return { error: 'Failed to record historical job item' }
      }

      const jobId = jobData.id

      // Handle initial payment if specified
      const initialPayment = Math.max(0, Number(input.initialPayment || 0))
      const roundedPayment = Math.round(initialPayment * 100) / 100
      const initialStatus = roundedPayment >= roundedDebtAmount
        ? 'paid'
        : roundedPayment > 0
          ? 'partial'
          : 'unpaid'

      // Insert invoice
      const { data: invData, error: invErr } = await serviceSupabase
        .from('invoices')
        .insert({
          tenant_id: tenantId,
          job_id: jobId,
          group_id: groupId,
          invoice_number: invoiceNumber,
          total: roundedDebtAmount,
          subtotal: roundedDebtAmount,
          status: initialStatus,
          issued_at: debtDateIso
        })
        .select('id, invoice_number')
        .single()

      if (invErr || !invData) {
        console.error('Error creating invoice for historical debt:', invErr)
        return { error: 'Failed to record invoice for historical debt' }
      }

      const invoiceId = invData.id

      // Record payment if initial payment > 0
      if (roundedPayment > 0) {
        const { error: payErr } = await serviceSupabase
          .from('payments')
          .insert({
            tenant_id: tenantId,
            invoice_id: invoiceId,
            job_id: jobId,
            amount: Math.min(roundedPayment, roundedDebtAmount),
            method: input.initialPaymentMethod || 'cash',
            reference: input.initialPaymentReference?.trim() || 'Historical deposit / partial payment',
            notes: `Initial payment recorded during historical migration for ${customerName}`,
            recorded_by: user.id,
            recorded_at: debtDateIso
          })

        if (payErr) {
          console.error('Error recording historical initial payment:', payErr)
        }
      }

      // Log status event for audit trail
      await serviceSupabase.from('job_status_events').insert({
        tenant_id: tenantId,
        job_id: jobId,
        from_status: 'draft',
        to_status: 'picked_up',
        actor_id: user.id,
        notes: `Historical debt record created by ${role}: ${notesText}`
      })

      revalidatePath('/dashboard/admin')
      revalidatePath('/dashboard/admin/clients')
      revalidatePath('/dashboard/finance')
      revalidatePath('/dashboard/jobs')
      revalidatePath('/print/customer-statement')

      const remainingBalance = Math.max(0, Math.round((roundedDebtAmount - roundedPayment) * 100) / 100)

      return {
        success: true,
        customerName,
        invoiceNumber,
        debtAmount: roundedDebtAmount,
        balance: remainingBalance
      }
    }

    revalidatePath('/dashboard/admin')
    revalidatePath('/dashboard/admin/clients')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/jobs')

    return {
      success: true,
      customerName,
      debtAmount: 0,
      balance: 0
    }
  } catch (err: any) {
    console.error('createClientOrLegacyDebtAction error:', err)
    return { error: err.message || 'An unexpected error occurred while adding the client' }
  }
}

/**
 * Fetches the entire clients directory with aggregated balances, invoices, and debt metrics.
 * Powers the Clients & Arrears page for Admin & Accountant.
 */
export async function getCustomersDirectoryAction(options?: {
  query?: string
  filter?: 'all' | 'owing' | 'settled'
}): Promise<CustomerDirectoryResult> {
  const { tenantId } = await getAuthContext()
  const serviceSupabase = createServiceClient() as any
  const q = options?.query?.trim().toLowerCase() || ''
  const filter = options?.filter || 'all'

  // Run all 5 queries in parallel for high performance
  const [
    custRes,
    jobsRes,
    groupsRes,
    invoicesRes,
    paymentsRes
  ] = await Promise.all([
    serviceSupabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('jobs')
      .select('id, group_id, customer_name, customer_phone, source, status, line_total, created_at')
      .eq('tenant_id', tenantId),
    serviceSupabase
      .from('job_groups')
      .select('id, customer_name, customer_phone, source, created_at')
      .eq('tenant_id', tenantId),
    serviceSupabase
      .from('invoices')
      .select('id, job_id, group_id, invoice_number, total, status, is_flagged, issued_at')
      .eq('tenant_id', tenantId),
    serviceSupabase
      .from('payments')
      .select('id, invoice_id, amount')
      .eq('tenant_id', tenantId)
  ])

  const registeredCustomers = custRes.data || []
  const allJobs = jobsRes.data || []
  const allGroups = groupsRes.data || []
  const allInvoices = invoicesRes.data || []
  const allPayments = paymentsRes.data || []

  // Map payments per invoice
  const paymentsByInvoice = new Map<string, number>()
  ;(allPayments || []).forEach((p: any) => {
    paymentsByInvoice.set(p.invoice_id, (paymentsByInvoice.get(p.invoice_id) || 0) + Number(p.amount))
  })

  // Map invoices by job_id and group_id
  const invoicesByJobId = new Map<string, any[]>()
  const invoicesByGroupId = new Map<string, any[]>()
  ;(allInvoices || []).forEach((inv: any) => {
    if (inv.job_id) {
      if (!invoicesByJobId.has(inv.job_id)) invoicesByJobId.set(inv.job_id, [])
      invoicesByJobId.get(inv.job_id)!.push(inv)
    }
    if (inv.group_id) {
      if (!invoicesByGroupId.has(inv.group_id)) invoicesByGroupId.set(inv.group_id, [])
      invoicesByGroupId.get(inv.group_id)!.push(inv)
    }
  })

  // Aggregate master customer directory
  const customerMap = new Map<string, {
    id: string
    name: string
    phone: string | null
    email: string | null
    source: 'walk_in' | 'marketing'
    jobIds: Set<string>
    groupIds: Set<string>
    lastDate: string | null
    created_at: string
  }>()

  // First seed from customers table
  ;(registeredCustomers || []).forEach((c: any) => {
    const trimmed = (c.name || '').trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    customerMap.set(key, {
      id: c.id,
      name: trimmed,
      phone: c.phone || null,
      email: c.email || null,
      source: 'walk_in',
      jobIds: new Set(),
      groupIds: new Set(),
      lastDate: c.created_at || null,
      created_at: c.created_at || new Date().toISOString()
    })
  })

  // Incorporate jobs
  ;(allJobs || []).forEach((j: any) => {
    const trimmed = (j.customer_name || '').trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        id: 'job-cust-' + j.id,
        name: trimmed,
        phone: j.customer_phone || null,
        email: null,
        source: (j.source as any) || 'walk_in',
        jobIds: new Set(),
        groupIds: new Set(),
        lastDate: j.created_at || null,
        created_at: j.created_at || new Date().toISOString()
      })
    }

    const entry = customerMap.get(key)!
    if (j.id) entry.jobIds.add(j.id)
    if (j.group_id) entry.groupIds.add(j.group_id)
    if (!entry.phone && j.customer_phone) entry.phone = j.customer_phone
    if (j.source === 'marketing') entry.source = 'marketing'
    if (j.created_at && (!entry.lastDate || new Date(j.created_at) > new Date(entry.lastDate))) {
      entry.lastDate = j.created_at
    }
  })

  // Incorporate groups
  ;(allGroups || []).forEach((g: any) => {
    const trimmed = (g.customer_name || '').trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        id: 'grp-cust-' + g.id,
        name: trimmed,
        phone: g.customer_phone || null,
        email: null,
        source: (g.source as any) || 'walk_in',
        jobIds: new Set(),
        groupIds: new Set(),
        lastDate: g.created_at || null,
        created_at: g.created_at || new Date().toISOString()
      })
    }

    const entry = customerMap.get(key)!
    if (g.id) entry.groupIds.add(g.id)
    if (!entry.phone && g.customer_phone) entry.phone = g.customer_phone
    if (g.source === 'marketing') entry.source = 'marketing'
    if (g.created_at && (!entry.lastDate || new Date(g.created_at) > new Date(entry.lastDate))) {
      entry.lastDate = g.created_at
    }
  })

  // Calculate balances for each customer
  const compiledList: CustomerWithBalance[] = []
  let totalArrearsSum = 0
  let owingCount = 0
  let settledCount = 0

  customerMap.forEach(entry => {
    // Find unique invoices associated with this customer
    const invoiceIdsSeen = new Set<string>()
    let totalInvoiced = 0
    let totalPaid = 0

    entry.jobIds.forEach(jId => {
      const invs = invoicesByJobId.get(jId) || []
      invs.forEach(inv => {
        if (!invoiceIdsSeen.has(inv.id)) {
          invoiceIdsSeen.add(inv.id)
          totalInvoiced += Number(inv.total || 0)
          totalPaid += paymentsByInvoice.get(inv.id) || 0
        }
      })
    })

    entry.groupIds.forEach(gId => {
      const invs = invoicesByGroupId.get(gId) || []
      invs.forEach(inv => {
        if (!invoiceIdsSeen.has(inv.id)) {
          invoiceIdsSeen.add(inv.id)
          totalInvoiced += Number(inv.total || 0)
          totalPaid += paymentsByInvoice.get(inv.id) || 0
        }
      })
    })

    const balance = Math.max(0, Math.round((totalInvoiced - totalPaid) * 100) / 100)
    const hasArrears = balance > 0.05

    if (hasArrears) {
      totalArrearsSum += balance
      owingCount++
    } else {
      settledCount++
    }

    compiledList.push({
      id: entry.id,
      name: entry.name,
      phone: entry.phone,
      email: entry.email,
      source: entry.source,
      totalJobs: entry.jobIds.size,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance,
      lastTransactionDate: entry.lastDate,
      created_at: entry.created_at,
      hasArrears
    })
  })

  // Filter and search
  let filtered = compiledList

  if (q) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    )
  }

  if (filter === 'owing') {
    filtered = filtered.filter(c => c.hasArrears)
  } else if (filter === 'settled') {
    filtered = filtered.filter(c => !c.hasArrears)
  }

  // Sort: owing clients with highest balance first, then by recent transaction
  filtered.sort((a, b) => {
    if (a.balance !== b.balance) {
      return b.balance - a.balance
    }
    const aDate = a.lastTransactionDate ? new Date(a.lastTransactionDate).getTime() : 0
    const bDate = b.lastTransactionDate ? new Date(b.lastTransactionDate).getTime() : 0
    return bDate - aDate
  })

  return {
    customers: filtered,
    summary: {
      totalClients: compiledList.length,
      clientsOwing: owingCount,
      totalArrears: Math.round(totalArrearsSum * 100) / 100,
      clientsSettled: settledCount
    }
  }
}
