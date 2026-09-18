const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data: payments } = await supabase.from('payments').select('*, invoices(*), jobs(*)').limit(5)
  console.log('Payments sample:', JSON.stringify(payments, null, 2))
}
check()
