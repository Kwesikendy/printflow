const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getCustomerStatement(customerName) {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const trimmedName = customerName.trim()

  // 1. Fetch all matching jobs
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select(`
      *,
      product_types ( name ),
      profiles ( full_name )
    `)
    .eq('tenant_id', tenantId)
    .ilike('customer_name', `%${trimmedName}%`)
    .order('created_at', { ascending: false })

  if (jobsErr) console.error('Jobs error:', jobsErr)

  // 2. Fetch all matching job groups
  const { data: groups } = await supabase
    .from('job_groups')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('customer_name', `%${trimmedName}%`)

  const jobIds = (jobs || []).map(j => j.id)
  const groupIds = Array.from(new Set([
    ...(jobs || []).map(j => j.group_id).filter(Boolean),
    ...(groups || []).map(g => g.id)
  ]))

  // 3. Fetch Invoices
  let invoices = []
  if (jobIds.length > 0 || groupIds.length > 0) {
    let q = supabase.from('invoices').select('*').eq('tenant_id', tenantId)
    if (jobIds.length > 0 && groupIds.length > 0) {
      q = q.or(`job_id.in.(${jobIds.join(',')}),group_id.in.(${groupIds.join(',')})`)
    } else if (jobIds.length > 0) {
      q = q.in('job_id', jobIds)
    } else {
      q = q.in('group_id', groupIds)
    }
    const { data: invData, error: invErr } = await q.order('issued_at', { ascending: false })
    if (invErr) console.error('Inv error:', invErr)
    invoices = invData || []
  }

  const invoiceIds = invoices.map(i => i.id)

  // 4. Fetch Payments
  let payments = []
  if (invoiceIds.length > 0) {
    const { data: payData, error: payErr } = await supabase
      .from('payments')
      .select('*, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds)
      .order('recorded_at', { ascending: false })
    if (payErr) console.error('Pay error:', payErr)
    payments = payData || []
  }

  // 5. Build Unified Chronological Ledger
  const ledger = []
  
  invoices.forEach(inv => {
    ledger.push({
      id: `inv-${inv.id}`,
      date: inv.issued_at,
      type: 'invoice',
      reference: inv.invoice_number,
      description: `Invoice issued (${inv.status})`,
      debit: Number(inv.total),
      credit: 0,
      invoiceId: inv.id,
      jobId: inv.job_id,
      groupId: inv.group_id
    })
  })

  payments.forEach(p => {
    const matchedInv = invoices.find(i => i.id === p.invoice_id)
    ledger.push({
      id: `pay-${p.id}`,
      date: p.recorded_at,
      type: 'payment',
      reference: p.reference || matchedInv?.invoice_number || 'Payment',
      description: `Payment received (${p.method.toUpperCase()})${p.notes ? ` - ${p.notes}` : ''}`,
      debit: 0,
      credit: Number(p.amount),
      paymentId: p.id,
      recordedBy: p.profiles?.full_name || 'Staff'
    })
  })

  // Sort ascending for running balance calculation
  ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let runningBalance = 0
  ledger.forEach(item => {
    runningBalance += item.debit - item.credit
    item.runningBalance = Math.round(runningBalance * 100) / 100
  })

  // Total summary
  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.total), 0)
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = Math.round((totalBilled - totalPaid) * 100) / 100

  return {
    customerName: jobs?.[0]?.customer_name || trimmedName,
    customerPhone: jobs?.[0]?.customer_phone || groups?.[0]?.customer_phone || null,
    source: jobs?.[0]?.source || 'walk_in',
    summary: {
      totalBilled,
      totalPaid,
      balance,
      jobsCount: (jobs || []).length,
      invoicesCount: invoices.length,
      paymentsCount: payments.length,
      firstTransactionDate: ledger[0]?.date || null,
      lastTransactionDate: ledger[ledger.length - 1]?.date || null
    },
    ledger,
    invoices,
    payments,
    jobs
  }
}

async function run() {
  const result = await getCustomerStatement('Justice')
  console.log('Justice statement summary:', result.summary)
  console.log('Justice ledger:', result.ledger)
}
run()
