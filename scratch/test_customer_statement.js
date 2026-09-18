const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testCustomer(name) {
  console.log('Testing customer query for:', name)

  // 1. Fetch jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      product_types ( name ),
      profiles ( full_name )
    `)
    .ilike('customer_name', `%${name}%`)
    .order('created_at', { ascending: false })

  console.log(`Found ${jobs?.length || 0} jobs`)

  const jobIds = (jobs || []).map(j => j.id)
  const groupIds = (jobs || []).map(j => j.group_id).filter(Boolean)

  // 2. Also check job groups with this customer name
  const { data: jobGroups } = await supabase
    .from('job_groups')
    .select('*')
    .ilike('customer_name', `%${name}%`)

  const allGroupIds = Array.from(new Set([...groupIds, ...(jobGroups || []).map(g => g.id)]))

  // 3. Fetch Invoices
  let invoiceQuery = supabase.from('invoices').select('*')
  if (jobIds.length > 0 && allGroupIds.length > 0) {
    invoiceQuery = invoiceQuery.or(`job_id.in.(${jobIds.join(',')}),group_id.in.(${allGroupIds.join(',')})`)
  } else if (jobIds.length > 0) {
    invoiceQuery = invoiceQuery.in('job_id', jobIds)
  } else if (allGroupIds.length > 0) {
    invoiceQuery = invoiceQuery.in('group_id', allGroupIds)
  }

  const { data: invoices } = jobIds.length || allGroupIds.length ? await invoiceQuery : { data: [] }
  console.log(`Found ${invoices?.length || 0} invoices`)

  const invoiceIds = (invoices || []).map(i => i.id)

  // 4. Fetch Payments
  let payments = []
  if (invoiceIds.length > 0) {
    const { data: p } = await supabase
      .from('payments')
      .select('*, profiles(full_name)')
      .in('invoice_id', invoiceIds)
      .order('recorded_at', { ascending: false })
    payments = p || []
  }
  console.log(`Found ${payments.length} payments`)

  const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + Number(inv.total), 0)
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = totalInvoiced - totalPaid

  console.log({
    totalInvoiced,
    totalPaid,
    balance
  })
}

testCustomer('Collins').then(() => testCustomer('otu George'))
