'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  // Enrich invoices with amount paid and remaining balance
  const enrichedInvoices = invoices.map(inv => {
    const paid = Math.round((invoicePaidMap.get(inv.id) || 0) * 100) / 100
    const total = Number(inv.total)
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100)
    return {
      ...inv,
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
