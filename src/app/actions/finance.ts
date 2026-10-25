'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type PaymentMethod } from '@/types/database'
import { releaseJobGroupAction } from './jobs'

export interface CustomerTransactionSummary {
  name: string
  phone: string | null
  source: string
  totalJobs: number
  totalInvoiced: number
  totalPaid: number
  balance: number
  lastTransactionDate: string | null
}

export interface StatementLedgerItem {
  id: string
  date: string
  type: 'invoice' | 'payment'
  reference: string
  description: string
  debit: number
  credit: number
  runningBalance: number
  paymentMethod?: string
  recordedBy?: string
  status?: string
}

export interface CustomerStatementData {
  customerName: string
  customerPhone: string | null
  source: string
  summary: {
    totalBilled: number
    totalPaid: number
    balance: number
    jobsCount: number
    invoicesCount: number
    paymentsCount: number
    firstTransactionDate: string | null
    lastTransactionDate: string | null
  }
  ledger: StatementLedgerItem[]
  invoices: any[]
  payments: any[]
  jobs: any[]
}

/**
 * Helper to get authenticated user and tenant profile
 */
async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profile not found')
  return { user, tenantId: (profile as any).tenant_id, role: (profile as any).role }
}

/**
 * Searches for customers who have recorded transactions (jobs, invoices, payments).
 */
export async function searchTransactionCustomers(query: string): Promise<CustomerTransactionSummary[]> {
  const { tenantId } = await getAuthContext()
  const serviceSupabase = createServiceClient()
  const q = query?.trim() || ''

  // Fetch jobs for this tenant matching query (or recent if query is empty)
  let jobsQuery = serviceSupabase
    .from('jobs')
    .select('id, group_id, customer_name, customer_phone, source, line_total, status, created_at')
    .eq('tenant_id', tenantId)

  if (q.length > 0) {
    jobsQuery = jobsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
  }

  const { data: jobs, error: jobsErr } = await jobsQuery
    .order('created_at', { ascending: false })
    .limit(q.length > 0 ? 50 : 25)

  if (jobsErr) {
    console.error('Error searching jobs for customers:', jobsErr)
    return []
  }

  // Also query job_groups to ensure group orders are captured
  let groupsQuery = serviceSupabase
    .from('job_groups')
    .select('id, customer_name, customer_phone, source, created_at')
    .eq('tenant_id', tenantId)

  if (q.length > 0) {
    groupsQuery = groupsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
  }

  const { data: groups } = await groupsQuery
    .order('created_at', { ascending: false })
    .limit(q.length > 0 ? 30 : 15)

  const jobsList = (jobs as any[]) || []
  const groupsList = (groups as any[]) || []

  // Map of unique customer names
  const customerMap = new Map<string, {
    name: string
    phone: string | null
    source: string
    jobIds: string[]
    groupIds: string[]
    lastDate: string | null
  }>()

  const registerCustomer = (rawName: string, phone: string | null, source: string, jobId?: string, groupId?: string, date?: string) => {
    if (!rawName) return
    const trimmed = rawName.trim()
    const key = trimmed.toLowerCase()

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: trimmed,
        phone: phone || null,
        source: source || 'walk_in',
        jobIds: [],
        groupIds: [],
        lastDate: date || null
      })
    }

    const entry = customerMap.get(key)!
    if (jobId && !entry.jobIds.includes(jobId)) entry.jobIds.push(jobId)
    if (groupId && !entry.groupIds.includes(groupId)) entry.groupIds.push(groupId)
    if (!entry.phone && phone) entry.phone = phone
    if (date && (!entry.lastDate || new Date(date) > new Date(entry.lastDate))) {
      entry.lastDate = date
    }
  }

  jobsList.forEach((j: any) => {
    registerCustomer(j.customer_name, j.customer_phone, j.source, j.id, j.group_id || undefined, j.created_at)
  });

  groupsList.forEach((g: any) => {
    registerCustomer(g.customer_name, g.customer_phone, g.source, undefined, g.id, g.created_at)
  })

  const customersList = Array.from(customerMap.values())
  if (customersList.length === 0) return []

  // Collect all relevant job and group IDs
  const allJobIds = Array.from(new Set(customersList.flatMap(c => c.jobIds)))
  const allGroupIds = Array.from(new Set(customersList.flatMap(c => c.groupIds)))

  // Fetch invoices for these jobs/groups
  let invoices: any[] = []
  if (allJobIds.length > 0 || allGroupIds.length > 0) {
    let invQuery = serviceSupabase
      .from('invoices')
      .select('id, job_id, group_id, total, status')
      .eq('tenant_id', tenantId)

    if (allJobIds.length > 0 && allGroupIds.length > 0) {
      invQuery = invQuery.or(`job_id.in.(${allJobIds.join(',')}),group_id.in.(${allGroupIds.join(',')})`)
    } else if (allJobIds.length > 0) {
      invQuery = invQuery.in('job_id', allJobIds)
    } else {
      invQuery = invQuery.in('group_id', allGroupIds)
    }

    const { data: invData } = await invQuery
    invoices = invData || []
  }

  const invoiceIds = invoices.map(i => i.id)

  // Fetch payments for these invoices
  let payments: any[] = []
  if (invoiceIds.length > 0) {
    const { data: payData } = await serviceSupabase
      .from('payments')
      .select('id, invoice_id, amount')
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds)

    payments = payData || []
  }

  // Payment totals per invoice
  const paidPerInvoice = new Map<string, number>()
  payments.forEach(p => {
    paidPerInvoice.set(p.invoice_id, (paidPerInvoice.get(p.invoice_id) || 0) + Number(p.amount))
  })

  // Build summary for each customer
  const results: CustomerTransactionSummary[] = customersList.map(c => {
    const customerInvoices = invoices.filter(inv => 
      (inv.job_id && c.jobIds.includes(inv.job_id)) ||
      (inv.group_id && c.groupIds.includes(inv.group_id))
    )

    const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)
    const totalPaid = customerInvoices.reduce((sum, inv) => sum + (paidPerInvoice.get(inv.id) || 0), 0)
    const balance = Math.max(0, Math.round((totalInvoiced - totalPaid) * 100) / 100)

    return {
      name: c.name,
      phone: c.phone,
      source: c.source,
      totalJobs: c.jobIds.length,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance,
      lastTransactionDate: c.lastDate
    }
  })

  // Sort by most recent transaction date descending
  return results.sort((a, b) => {
    if (!a.lastTransactionDate) return 1
    if (!b.lastTransactionDate) return -1
    return new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
  }).slice(0, 15)
}

/**
 * Returns top recent customers with transaction history for fast 1-click selection chips.
 */
export async function getRecentTransactionCustomers(): Promise<CustomerTransactionSummary[]> {
  return searchTransactionCustomers('')
}

/**
 * Fetches the comprehensive financial statement for a customer.
 */
export async function getCustomerFinancialStatement(
  customerName: string,
  options?: {
    customerPhone?: string | null
    fromDate?: string
    toDate?: string
  }
): Promise<CustomerStatementData | null> {
  const { tenantId } = await getAuthContext()
  const serviceSupabase = createServiceClient()
  const trimmedName = customerName?.trim()

  if (!trimmedName) return null

  // 1. Fetch matching jobs
  const { data: jobs, error: jobsErr } = await serviceSupabase
    .from('jobs')
    .select(`
      *,
      product_types ( name ),
      profiles ( full_name )
    `)
    .eq('tenant_id', tenantId)
    .ilike('customer_name', `%${trimmedName}%`)
    .order('created_at', { ascending: false })

  if (jobsErr) {
    console.error('Error fetching jobs for customer statement:', jobsErr)
    return null
  }

  // 2. Fetch matching job groups
  const { data: groups } = await serviceSupabase
    .from('job_groups')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('customer_name', `%${trimmedName}%`)

  const rawJobs = (jobs as any[]) || []
  const rawGroups = (groups as any[]) || []

  const jobIds = rawJobs.map((j: any) => j.id)
  const groupIds = Array.from(new Set([
    ...rawJobs.map((j: any) => j.group_id).filter(Boolean),
    ...rawGroups.map((g: any) => g.id)
  ]))

  // 3. Fetch Invoices
  let invoices: any[] = []
  if (jobIds.length > 0 || groupIds.length > 0) {
    let q = serviceSupabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)

    if (jobIds.length > 0 && groupIds.length > 0) {
      q = q.or(`job_id.in.(${jobIds.join(',')}),group_id.in.(${groupIds.join(',')})`)
    } else if (jobIds.length > 0) {
      q = q.in('job_id', jobIds)
    } else {
      q = q.in('group_id', groupIds)
    }

    const { data: invData, error: invErr } = await q.order('issued_at', { ascending: false })
    if (invErr) console.error('Invoices error:', invErr)
    invoices = invData || []
  }

  const invoiceIds = invoices.map(i => i.id)

  // 4. Fetch Payments
  let payments: any[] = []
  if (invoiceIds.length > 0) {
    const { data: payData, error: payErr } = await serviceSupabase
      .from('payments')
      .select(`
        *,
        profiles ( full_name )
      `)
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds)
      .order('recorded_at', { ascending: false })

    if (payErr) console.error('Payments error:', payErr)
    payments = payData || []
  }

  // Calculate invoice paid totals
  const invoicePaidMap = new Map<string, number>()
  payments.forEach(p => {
    invoicePaidMap.set(p.invoice_id, (invoicePaidMap.get(p.invoice_id) || 0) + Number(p.amount))
  })

  // Enrich invoices with amount paid, remaining balance, and accurate status
  const enrichedInvoices = invoices.map(inv => {
    const paid = Math.round((invoicePaidMap.get(inv.id) || 0) * 100) / 100
    const total = Number(inv.total)
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100)
    const computedStatus = balance <= 0.009 ? 'paid' : paid > 0.009 ? 'partial' : 'unpaid'
    return {
      ...inv,
      status: computedStatus,
      total,
      amount_paid: paid,
      balance_due: balance
    }
  })

  // 5. Build Unified Chronological Ledger
  const rawLedger: StatementLedgerItem[] = []

  enrichedInvoices.forEach(inv => {
    rawLedger.push({
      id: `inv-${inv.id}`,
      date: inv.issued_at,
      type: 'invoice',
      reference: inv.invoice_number,
      description: `Invoice issued (${inv.status})`,
      debit: Number(inv.total),
      credit: 0,
      runningBalance: 0,
      status: inv.status
    })
  })

  payments.forEach(p => {
    const matchedInv = enrichedInvoices.find(i => i.id === p.invoice_id)
    rawLedger.push({
      id: `pay-${p.id}`,
      date: p.recorded_at,
      type: 'payment',
      reference: p.reference || matchedInv?.invoice_number || 'Payment',
      description: `Payment received via ${(p.method || 'cash').toUpperCase()}${p.notes ? ` - ${p.notes}` : ''}`,
      debit: 0,
      credit: Number(p.amount),
      runningBalance: 0,
      paymentMethod: p.method,
      recordedBy: p.profiles?.full_name || 'Accounts Staff'
    })
  })

  // Sort ascending chronologically to compute running balance correctly
  rawLedger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let runningBalance = 0
  rawLedger.forEach(item => {
    runningBalance += item.debit - item.credit
    item.runningBalance = Math.round(runningBalance * 100) / 100
  })

  // Optional date filtering
  let filteredLedger = rawLedger
  let filteredInvoices = enrichedInvoices
  let filteredPayments = payments
  let filteredJobs = rawJobs

  if (options?.fromDate) {
    const fromTime = new Date(options.fromDate).getTime()
    filteredLedger = filteredLedger.filter(l => new Date(l.date).getTime() >= fromTime)
    filteredInvoices = filteredInvoices.filter(i => new Date(i.issued_at).getTime() >= fromTime)
    filteredPayments = filteredPayments.filter(p => new Date(p.recorded_at).getTime() >= fromTime)
    filteredJobs = filteredJobs.filter((j: any) => new Date(j.created_at).getTime() >= fromTime)
  }

  if (options?.toDate) {
    const toTime = new Date(options.toDate).getTime()
    filteredLedger = filteredLedger.filter(l => new Date(l.date).getTime() <= toTime)
    filteredInvoices = filteredInvoices.filter(i => new Date(i.issued_at).getTime() <= toTime)
    filteredPayments = filteredPayments.filter(p => new Date(p.recorded_at).getTime() <= toTime)
    filteredJobs = filteredJobs.filter((j: any) => new Date(j.created_at).getTime() <= toTime)
  }

  // Reverse ledger for display (most recent on top)
  const displayLedger = [...filteredLedger].reverse()

  const totalBilled = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)
  const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = Math.round((totalBilled - totalPaid) * 100) / 100

  const primaryJob = rawJobs[0]
  const primaryGroup = rawGroups[0]

  return {
    customerName: primaryJob?.customer_name || primaryGroup?.customer_name || trimmedName,
    customerPhone: options?.customerPhone || primaryJob?.customer_phone || primaryGroup?.customer_phone || null,
    source: primaryJob?.source || primaryGroup?.source || 'walk_in',
    summary: {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance,
      jobsCount: filteredJobs.length,
      invoicesCount: filteredInvoices.length,
      paymentsCount: filteredPayments.length,
      firstTransactionDate: rawLedger[0]?.date || null,
      lastTransactionDate: rawLedger[rawLedger.length - 1]?.date || null
    },
    ledger: displayLedger,
    invoices: filteredInvoices,
    payments: filteredPayments,
    jobs: filteredJobs
  }
}

/**
 * Bulk settles all outstanding unpaid/partial invoices for a customer at a go (FIFO).
 */
export async function settleCustomerBalanceAction({
  customerName,
  customerPhone,
  amount,
  method,
  reference,
  notes,
  releaseToPrintRoom = true
}: {
  customerName: string
  customerPhone?: string | null
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
  releaseToPrintRoom?: boolean
}): Promise<{
  success?: boolean
  error?: string
  invoicesSettledCount?: number
  totalSettled?: number
  remainingBalance?: number
}> {
  try {
    const { user, tenantId, role } = await getAuthContext()

  if (!['front_desk', 'admin', 'accountant'].includes(role)) {
    return { error: 'Insufficient permissions. Only accounts and front desk staff can settle balances.' }
  }

  const trimmedName = customerName?.trim()
  if (!trimmedName) {
    return { error: 'Customer name is required' }
  }

  if (isNaN(amount) || amount <= 0) {
    return { error: 'Payment amount must be greater than zero' }
  }

  const serviceSupabase = createServiceClient()
  const supabase = await createClient()

  // 1. Fetch all matching jobs for customer in this tenant
  const { data: jobs, error: jobsErr } = await serviceSupabase
    .from('jobs')
    .select('id, group_id, status')
    .eq('tenant_id', tenantId)
    .ilike('customer_name', `%${trimmedName}%`)

  if (jobsErr) {
    console.error('Error fetching jobs for customer balance settlement:', jobsErr)
    return { error: 'Database error fetching customer orders.' }
  }

  // 2. Fetch all matching job groups
  const { data: groups } = await serviceSupabase
    .from('job_groups')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('customer_name', `%${trimmedName}%`)

  const rawJobs = jobs || []
  const rawGroups = groups || []

  const jobIds = rawJobs.map((j: any) => j.id)
  const groupIds = Array.from(new Set([
    ...rawJobs.map((j: any) => j.group_id).filter(Boolean),
    ...rawGroups.map((g: any) => g.id)
  ]))

  if (jobIds.length === 0 && groupIds.length === 0) {
    return { error: 'No orders or invoices found for this customer.' }
  }

  // 3. Fetch all invoices for this customer (do NOT filter by status != 'paid' in SQL,
  // because an invoice's status column can be out of sync with its actual total - sum(payments))
  let invQuery = serviceSupabase
    .from('invoices')
    .select('id, invoice_number, total, status, is_flagged, issued_at, job_id, group_id')
    .eq('tenant_id', tenantId)

  if (jobIds.length > 0 && groupIds.length > 0) {
    invQuery = invQuery.or(`job_id.in.(${jobIds.join(',')}),group_id.in.(${groupIds.join(',')})`)
  } else if (jobIds.length > 0) {
    invQuery = invQuery.in('job_id', jobIds)
  } else {
    invQuery = invQuery.in('group_id', groupIds)
  }

  const { data: allCustomerInvoices, error: invErr } = await invQuery.order('issued_at', { ascending: true })

  if (invErr) {
    console.error('Error fetching customer invoices:', invErr)
    return { error: 'Failed to fetch customer invoices.' }
  }

  // Filter out flagged invoices and invoices whose jobs are all cancelled
  const cancelledJobIds = new Set(rawJobs.filter((j: any) => j.status === 'cancelled').map((j: any) => j.id))
  const candidateInvoices: any[] = ((allCustomerInvoices as any[]) || []).filter((inv: any) => {
    if (inv.is_flagged) return false
    if (inv.job_id && cancelledJobIds.has(inv.job_id)) return false
    if (inv.group_id) {
      const groupJobs = rawJobs.filter((j: any) => j.group_id === inv.group_id)
      if (groupJobs.length > 0 && groupJobs.every((j: any) => j.status === 'cancelled')) return false
    }
    return true
  })

  const invoiceIds = candidateInvoices.map((i: any) => i.id)
  if (invoiceIds.length === 0) {
    return { error: 'This customer has zero outstanding unpaid invoices.' }
  }

  // 4. Fetch all payments for these invoices to calculate exact balance_due per invoice
  const { data: payData } = await serviceSupabase
    .from('payments')
    .select('invoice_id, amount')
    .eq('tenant_id', tenantId)
    .in('invoice_id', invoiceIds)

  const paidPerInvoice = new Map<string, number>()
  ;(payData || []).forEach((p: any) => {
    paidPerInvoice.set(p.invoice_id, (paidPerInvoice.get(p.invoice_id) || 0) + Number(p.amount))
  })

  // Auto-heal any invoice whose status is 'unpaid'/'partial' even though balance_due <= 0
  for (const inv of candidateInvoices) {
    const paid = paidPerInvoice.get(inv.id) || 0
    const total = Number(inv.total)
    const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100)
    if (balanceDue <= 0.009 && inv.status !== 'paid') {
      await (serviceSupabase as any).from('invoices').update({ status: 'paid' }).eq('id', inv.id)
    }
  }

  // Calculate remaining balance per invoice and filter to those with balance > 0
  const actionableInvoices = candidateInvoices
    .map((inv: any) => {
      const paid = paidPerInvoice.get(inv.id) || 0
      const total = Number(inv.total)
      const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100)
      return {
        ...inv,
        total,
        amount_paid: paid,
        balance_due: balanceDue
      }
    })
    .filter((inv: any) => inv.balance_due > 0.009)
    // Sort oldest first (FIFO)
    .sort((a: any, b: any) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime())

  const totalOutstanding = actionableInvoices.reduce((sum: number, inv: any) => sum + inv.balance_due, 0)
  const roundedTotalOutstanding = Math.round(totalOutstanding * 100) / 100

  if (actionableInvoices.length === 0 || roundedTotalOutstanding <= 0.009) {
    return { error: 'No outstanding balance remaining to settle.' }
  }

  if (amount > roundedTotalOutstanding + 0.05) {
    return { error: `Amount cannot exceed total outstanding balance of ₵${roundedTotalOutstanding.toFixed(2)}.` }
  }

  // 5. Allocate payment across invoices FIFO
  let remainingToAllocate = Math.min(amount, roundedTotalOutstanding)
  let settledCount = 0
  let totalAllocated = 0

  for (const inv of actionableInvoices) {
    if (remainingToAllocate <= 0.009) break

    const paymentForThisInvoice = Math.min(remainingToAllocate, inv.balance_due)
    const roundedPayment = Math.round(paymentForThisInvoice * 100) / 100

    if (roundedPayment <= 0.009) continue

    const paymentNotes = notes
      ? `${notes} (Bulk settlement)`
      : `Customer ledger clearance for ${trimmedName}`

    // If this invoice had status = 'paid' in the DB despite having a balance_due > 0,
    // heal its status first so the RPC record_payment does not reject it.
    if (inv.status === 'paid') {
      await (serviceSupabase as any)
        .from('invoices')
        .update({ status: inv.amount_paid > 0.009 ? 'partial' : 'unpaid' })
        .eq('id', inv.id)
    }

    // Attempt RPC first
    const { error: rpcError } = await supabase.rpc('record_payment', {
      p_invoice_id: inv.id,
      p_amount: roundedPayment,
      p_method: method,
      p_reference: reference || null,
      p_notes: paymentNotes
    } as any)

    if (rpcError) {
      console.warn(`RPC record_payment failed for invoice ${inv.invoice_number}, using service fallback:`, rpcError.message)

      // Resilient service fallback:
      // 1. Insert payment
      const { error: insertPayErr } = await (serviceSupabase as any)
        .from('payments')
        .insert({
          tenant_id: tenantId,
          invoice_id: inv.id,
          job_id: inv.job_id,
          amount: roundedPayment,
          method: method,
          reference: reference || null,
          notes: paymentNotes,
          recorded_by: user.id,
          recorded_at: new Date().toISOString()
        })

      if (insertPayErr) {
        console.error('Service fallback payment insert error:', insertPayErr)
        return { error: `Failed to record payment for invoice ${inv.invoice_number}: ${insertPayErr.message}` }
      }

      // 2. Update invoice status
      const newPaidTotal = inv.amount_paid + roundedPayment
      const isPaid = newPaidTotal >= (inv.total - 0.009)
      await (serviceSupabase as any)
        .from('invoices')
        .update({ status: isPaid ? 'paid' : 'partial' })
        .eq('id', inv.id)

      // 3. Update job statuses if fully paid
      if (isPaid) {
        if (inv.job_id) {
          const { data: jobData } = await (serviceSupabase as any)
            .from('jobs')
            .select('status')
            .eq('id', inv.job_id)
            .single()

          if (jobData?.status === 'awaiting_payment') {
            await (serviceSupabase as any)
              .from('jobs')
              .update({ status: 'paid_released', updated_at: new Date().toISOString() })
              .eq('id', inv.job_id)

            await (serviceSupabase as any).from('job_status_events').insert({
              tenant_id: tenantId,
              job_id: inv.job_id,
              from_status: 'awaiting_payment',
              to_status: 'paid_released',
              actor_id: user.id,
              notes: `Customer balance cleared: ${method} ${reference ? 'ref: ' + reference : ''}`
            })
          }
        }

        if (inv.group_id) {
          const { data: groupJobs } = await (serviceSupabase as any)
            .from('jobs')
            .select('id')
            .eq('group_id', inv.group_id)
            .eq('tenant_id', tenantId)
            .eq('status', 'awaiting_payment')

          if (groupJobs && groupJobs.length > 0) {
            await (serviceSupabase as any)
              .from('jobs')
              .update({ status: 'paid_released', updated_at: new Date().toISOString() })
              .eq('group_id', inv.group_id)
              .eq('tenant_id', tenantId)
              .eq('status', 'awaiting_payment')

            const events = groupJobs.map((gj: any) => ({
              tenant_id: tenantId,
              job_id: gj.id,
              from_status: 'awaiting_payment',
              to_status: 'paid_released',
              actor_id: user.id,
              notes: `Customer group balance cleared: ${method} ${reference ? 'ref: ' + reference : ''}`
            }))
            await (serviceSupabase as any).from('job_status_events').insert(events)
          }
        }
      }
    }

    // Release to production queue if requested
    if (releaseToPrintRoom) {
      try {
        if (inv.group_id) {
          await releaseJobGroupAction(inv.group_id, 'Bulk settlement: released to print room')
        } else if (inv.job_id) {
          await supabase.rpc('transition_job_status', {
            p_job_id: inv.job_id,
            p_to_status: 'paid_released',
            p_notes: 'Bulk settlement: released to print room'
          } as any)
        }
      } catch (relErr) {
        console.warn('Warning: Auto-releasing job to print room:', relErr)
      }
    }

    remainingToAllocate = Math.round((remainingToAllocate - roundedPayment) * 100) / 100
    totalAllocated = Math.round((totalAllocated + roundedPayment) * 100) / 100
    settledCount++
  }

  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard/queue')
  revalidatePath('/print/finance-report')
  revalidatePath('/print/customer-statement')

    return {
      success: true,
      invoicesSettledCount: settledCount,
      totalSettled: totalAllocated,
      remainingBalance: Math.max(0, Math.round((roundedTotalOutstanding - totalAllocated) * 100) / 100)
    }
  } catch (err: any) {
    console.error('Fatal error in settleCustomerBalanceAction:', err)
    return { error: err.message || 'Unexpected server error settling balance' }
  }
}

export interface CustomerArrearsSummary {
  customerName: string
  customerPhone: string | null
  totalArrears: number
  otherInvoicesCount: number
  otherInvoicesBalance: number
  totalUnpaidInvoicesCount: number
  unpaidInvoices: Array<{
    id: string
    invoice_number: string
    issued_at: string
    total: number
    amount_paid: number
    balance_due: number
    status: string
    job_id?: string | null
    group_id?: string | null
  }>
}

/**
 * Retrieves the outstanding debt/arrears for a customer across all their jobs/invoices.
 * Used on the Job Payment screen to alert Front Desk of prior unpaid orders.
 */
export async function getCustomerArrearsAction(
  customerName: string,
  currentInvoiceId?: string
): Promise<CustomerArrearsSummary | null> {
  const trimmed = customerName?.trim()
  if (!trimmed) return null

  try {
    const { tenantId } = await getAuthContext()
    const serviceSupabase = createServiceClient()

    // 1. Fetch matching jobs
    const { data: jobs, error: jobsErr } = await serviceSupabase
      .from('jobs')
      .select('id, group_id, customer_phone, status')
      .eq('tenant_id', tenantId)
      .ilike('customer_name', `%${trimmed}%`)

    if (jobsErr) {
      console.error('Error fetching jobs for customer arrears:', jobsErr)
      return null
    }

    // 2. Fetch matching job groups
    const { data: groups } = await serviceSupabase
      .from('job_groups')
      .select('id, customer_phone')
      .eq('tenant_id', tenantId)
      .ilike('customer_name', `%${trimmed}%`)

    const rawJobs = (jobs as any[]) || []
    const rawGroups = (groups as any[]) || []

    const jobIds = rawJobs.map((j: any) => j.id)
    const groupIds = Array.from(new Set([
      ...rawJobs.map((j: any) => j.group_id).filter(Boolean),
      ...rawGroups.map((g: any) => g.id)
    ]))

    if (jobIds.length === 0 && groupIds.length === 0) {
      return {
        customerName: trimmed,
        customerPhone: null,
        totalArrears: 0,
        otherInvoicesCount: 0,
        otherInvoicesBalance: 0,
        totalUnpaidInvoicesCount: 0,
        unpaidInvoices: []
      }
    }

    // 3. Fetch all invoices for this customer and compute balance_due from actual payments
    let invQuery = serviceSupabase
      .from('invoices')
      .select('id, invoice_number, total, status, is_flagged, issued_at, job_id, group_id')
      .eq('tenant_id', tenantId)

    if (jobIds.length > 0 && groupIds.length > 0) {
      invQuery = invQuery.or(`job_id.in.(${jobIds.join(',')}),group_id.in.(${groupIds.join(',')})`)
    } else if (jobIds.length > 0) {
      invQuery = invQuery.in('job_id', jobIds)
    } else {
      invQuery = invQuery.in('group_id', groupIds)
    }

    const { data: invData, error: invErr } = await invQuery.order('issued_at', { ascending: true })
    if (invErr) {
      console.error('Error fetching unpaid invoices for customer arrears:', invErr)
      return null
    }

    const cancelledJobIds = new Set(rawJobs.filter((j: any) => j.status === 'cancelled').map((j: any) => j.id))
    const invoices = (invData || []).filter((inv: any) => {
      if (inv.is_flagged) return false
      if (inv.job_id && cancelledJobIds.has(inv.job_id)) return false
      if (inv.group_id) {
        const groupJobs = rawJobs.filter((j: any) => j.group_id === inv.group_id)
        if (groupJobs.length > 0 && groupJobs.every((j: any) => j.status === 'cancelled')) return false
      }
      return true
    })

    if (invoices.length === 0) {
      return {
        customerName: trimmed,
        customerPhone: rawJobs[0]?.customer_phone || rawGroups[0]?.customer_phone || null,
        totalArrears: 0,
        otherInvoicesCount: 0,
        otherInvoicesBalance: 0,
        totalUnpaidInvoicesCount: 0,
        unpaidInvoices: []
      }
    }

    const invoiceIds = invoices.map((i: any) => i.id)

    // 4. Fetch payments
    const { data: payData } = await serviceSupabase
      .from('payments')
      .select('invoice_id, amount')
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds)

    const paidMap = new Map<string, number>()
    ;(payData || []).forEach((p: any) => {
      paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) || 0) + Number(p.amount))
    })

    // 5. Calculate balance_due per invoice
    const actionable = invoices
      .map((inv: any) => {
        const paid = paidMap.get(inv.id) || 0
        const total = Number(inv.total)
        const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100)
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          issued_at: inv.issued_at,
          total,
          amount_paid: paid,
          balance_due: balanceDue,
          status: balanceDue <= 0.009 ? 'paid' : (paid > 0.009 ? 'partial' : 'unpaid'),
          job_id: inv.job_id,
          group_id: inv.group_id
        }
      })
      .filter((inv: any) => inv.balance_due > 0.009)
      .sort((a: any, b: any) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime())

    const totalArrears = Math.round(actionable.reduce((sum: number, i: any) => sum + i.balance_due, 0) * 100) / 100

    // Filter other invoices excluding currentInvoiceId
    const otherInvoices = currentInvoiceId 
      ? actionable.filter((i: any) => i.id !== currentInvoiceId)
      : actionable

    const otherInvoicesBalance = Math.round(otherInvoices.reduce((sum: number, i: any) => sum + i.balance_due, 0) * 100) / 100

    return {
      customerName: trimmed,
      customerPhone: rawJobs[0]?.customer_phone || rawGroups[0]?.customer_phone || null,
      totalArrears,
      otherInvoicesCount: otherInvoices.length,
      otherInvoicesBalance,
      totalUnpaidInvoicesCount: actionable.length,
      unpaidInvoices: actionable
    }
  } catch (err) {
    console.error('Error in getCustomerArrearsAction:', err)
    return null
  }
}


