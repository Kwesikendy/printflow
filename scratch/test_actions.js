const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Mock testing the query and aggregation logic with live database
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testSearch(q) {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  let jobsQuery = supabase
    .from('jobs')
    .select('id, group_id, customer_name, customer_phone, source, line_total, status, created_at')
    .eq('tenant_id', tenantId)

  if (q.length > 0) {
    jobsQuery = jobsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
  }

  const { data: jobs } = await jobsQuery.order('created_at', { ascending: false }).limit(25)
  console.log(`Search for "${q}" returned ${jobs?.length} jobs`)
  const names = Array.from(new Set(jobs?.map(j => j.customer_name?.trim())))
  console.log('Customer names found:', names)
}

testSearch('collins').then(() => testSearch(''))
