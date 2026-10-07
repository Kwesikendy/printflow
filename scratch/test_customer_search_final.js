const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function search(q) {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let custQuery = s.from('customers').select('name, phone, created_at').eq('tenant_id', tenantId);
  let grpQuery = s.from('job_groups').select('customer_name, customer_phone, source, created_at').eq('tenant_id', tenantId);
  let jobsQuery = s.from('jobs').select('customer_name, customer_phone, source, created_at').eq('tenant_id', tenantId);

  if (q) {
    custQuery = custQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    grpQuery = grpQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
    jobsQuery = jobsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
  }

  const [customersRes, jobGroupsRes, jobsRes] = await Promise.all([
    custQuery.order('created_at', { ascending: false }).limit(15),
    grpQuery.order('created_at', { ascending: false }).limit(15),
    jobsQuery.order('created_at', { ascending: false }).limit(15)
  ]);

  const results = new Map();
  const addResult = (name, phone, source) => {
    const trimmed = (name || '').trim();
    if (!trimmed || trimmed === 'TEST_DELETE_ME') return;
    const key = trimmed.toLowerCase();
    if (!results.has(key)) {
      results.set(key, { customer_name: trimmed, customer_phone: phone ? phone.trim() : null, source: source || 'walk_in' });
    } else if (phone && !results.get(key).customer_phone) {
      results.get(key).customer_phone = phone.trim();
    }
  };

  if (customersRes.data) customersRes.data.forEach(r => addResult(r.name, r.phone, 'walk_in'));
  if (jobGroupsRes.data) jobGroupsRes.data.forEach(r => addResult(r.customer_name, r.customer_phone, r.source));
  if (jobsRes.data) jobsRes.data.forEach(r => addResult(r.customer_name, r.customer_phone, r.source));

  return Array.from(results.values()).slice(0, 10);
}

async function run() {
  console.log('Search "O":', await search('O'));
  console.log('Search "024":', await search('024'));
  console.log('Search "Ben":', await search('Ben'));
}

run();
