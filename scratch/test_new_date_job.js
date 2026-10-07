const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getDatePrefix(prefix, date = new Date()) {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${prefix}-${yy}${mm}${dd}-`;
}

async function generateDateJobNumbers(serviceSupabase, tenantId, count) {
  const prefix = getDatePrefix('PF');
  const { data: existing, error } = await serviceSupabase
    .from('jobs')
    .select('job_number')
    .eq('tenant_id', tenantId)
    .ilike('job_number', `${prefix}%`);

  if (error) throw error;

  let maxNum = 0;
  if (existing && existing.length > 0) {
    for (const row of existing) {
      const suffix = (row.job_number || '').replace(prefix, '');
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    maxNum++;
    results.push(`${prefix}${String(maxNum).padStart(3, '0')}`);
  }
  return results;
}

async function generateDateInvoiceNumber(serviceSupabase, tenantId) {
  const prefix = getDatePrefix('INV');
  const { data: existing, error } = await serviceSupabase
    .from('invoices')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .ilike('invoice_number', `${prefix}%`);

  if (error) throw error;

  let maxNum = 0;
  if (existing && existing.length > 0) {
    for (const row of existing) {
      const suffix = (row.invoice_number || '').replace(prefix, '');
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

async function test() {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  console.log('Testing date job numbers...');
  const jobs1 = await generateDateJobNumbers(s, tenantId, 2);
  console.log('Job numbers batch 1 (count 2):', jobs1);

  const inv1 = await generateDateInvoiceNumber(s, tenantId);
  console.log('Invoice number 1:', inv1);
}

test().catch(console.error);
