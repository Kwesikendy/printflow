const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data: jobs } = await supabase.from('jobs').select('customer_name, customer_phone, source, line_total, status').limit(10)
  console.log('Jobs:', jobs)
  const { data: customers } = await supabase.from('customers').select('*').limit(10)
  console.log('Customers table:', customers)
  const { data: invoices } = await supabase.from('invoices').select('*').limit(5)
  console.log('Invoices sample:', invoices)
}
check()
