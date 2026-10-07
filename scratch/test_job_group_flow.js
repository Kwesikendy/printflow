const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getDatePrefix(prefix, date = new Date()) {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${prefix}-${yy}${mm}${dd}-`;
}

async function testFullCreationFlow() {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  
  // 1. Get a valid user profile
  const { data: profile } = await s.from('profiles').select('id, tenant_id').eq('tenant_id', tenantId).limit(1).single();
  const userId = profile.id;

  // 2. Get a valid product type
  const { data: prod } = await s.from('product_types').select('id').eq('tenant_id', tenantId).limit(1).single();
  const prodId = prod.id;

  console.log('Testing with User:', userId, 'Product:', prodId);

  // Step 1: Create job group
  const { data: group, error: groupErr } = await s
    .from('job_groups')
    .insert({
      tenant_id: tenantId,
      customer_name: 'TEST AUTO NUMBERING',
      customer_phone: '0550000000',
      source: 'walk_in',
      created_by: userId
    })
    .select('id')
    .single();

  if (groupErr) throw groupErr;
  console.log('Group created:', group.id);

  // Step 2: Query prefix and assign job number
  const prefix = getDatePrefix('PF');
  const { data: existingJobs } = await s.from('jobs').select('job_number').eq('tenant_id', tenantId).ilike('job_number', `${prefix}%`);
  let maxNum = 0;
  if (existingJobs) {
    for (const r of existingJobs) {
      const suffix = (r.job_number || '').replace(prefix, '');
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  const jobNumber = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  console.log('Assigned Job Number:', jobNumber);

  // Step 3: Insert job
  const { data: insertedJobs, error: jobErr } = await s
    .from('jobs')
    .insert([{
      tenant_id: tenantId,
      group_id: group.id,
      job_number: jobNumber,
      source: 'walk_in',
      customer_name: 'TEST AUTO NUMBERING',
      customer_phone: '0550000000',
      product_type_id: prodId,
      width: 10,
      height: 10,
      area: 100,
      quantity: 1,
      unit_cost_applied: 1,
      line_total: 100,
      status: 'awaiting_payment',
      created_by: userId
    }])
    .select('id, job_number, line_total');

  if (jobErr) throw jobErr;
  console.log('Job inserted successfully:', insertedJobs);

  // Step 4: Invoice
  const invPrefix = getDatePrefix('INV');
  const { data: existingInvs } = await s.from('invoices').select('invoice_number').eq('tenant_id', tenantId).ilike('invoice_number', `${invPrefix}%`);
  let maxInv = 0;
  if (existingInvs) {
    for (const r of existingInvs) {
      const suffix = (r.invoice_number || '').replace(invPrefix, '');
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > maxInv) maxInv = n;
    }
  }
  const invNumber = `${invPrefix}${String(maxInv + 1).padStart(3, '0')}`;
  console.log('Assigned Invoice Number:', invNumber);

  const { data: invoice, error: invErr } = await s
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      job_id: null,
      invoice_number: invNumber,
      total: 100,
      status: 'unpaid',
      group_id: group.id
    })
    .select('id, invoice_number')
    .single();

  if (invErr) throw invErr;
  console.log('Invoice created successfully:', invoice);

  // Clean up the test records!
  await s.from('invoices').delete().eq('id', invoice.id);
  await s.from('jobs').delete().eq('id', insertedJobs[0].id);
  await s.from('job_groups').delete().eq('id', group.id);
  console.log('Cleanup completed successfully!');
}

testFullCreationFlow().catch(console.error);
