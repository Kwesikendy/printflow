const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectInvoices() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      issued_at,
      total,
      status,
      group_id,
      job_id,
      job_groups(customer_name),
      jobs(customer_name),
      payments(amount)
    `)
    .order('issued_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    return;
  }

  console.log('Total invoices found in DB:', invoices.length);

  let totalOutstanding = 0;
  let unpaidCount = 0;

  const list = invoices.map(inv => {
    const customer = inv.job_groups?.customer_name || inv.jobs?.customer_name || 'Unknown';
    const paid = (inv.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Math.round((Number(inv.total) - paid) * 100) / 100;
    if (balance > 0.01) {
      unpaidCount++;
      totalOutstanding += balance;
    }
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer,
      date: inv.issued_at.slice(0, 19).replace('T', ' '),
      total: Number(inv.total),
      paid,
      balance,
      status: inv.status
    };
  });

  console.log(`Unpaid Invoices Count: ${unpaidCount}`);
  console.log(`Total Outstanding: GHS ${totalOutstanding.toFixed(2)}`);
  console.log('--- ALL INVOICES ---');
  console.table(list);
}

inspectInvoices();
