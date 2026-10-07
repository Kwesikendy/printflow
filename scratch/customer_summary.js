const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: invoices } = await supabase
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
    .neq('invoice_number', 'INV-TEST-999')
    .order('issued_at', { ascending: true });

  const byCust = {};
  for (const inv of invoices) {
    const cust = (inv.job_groups?.customer_name || inv.jobs?.customer_name || 'Unknown').trim();
    if (!byCust[cust]) byCust[cust] = { count: 0, total: 0, paid: 0, balance: 0, invoices: [] };
    const paid = (inv.payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const bal = Number(inv.total) - paid;
    byCust[cust].count++;
    byCust[cust].total += Number(inv.total);
    byCust[cust].paid += paid;
    byCust[cust].balance += bal;
    byCust[cust].invoices.push({
      num: inv.invoice_number,
      total: Number(inv.total).toFixed(2),
      paid: paid.toFixed(2),
      balance: bal.toFixed(2),
      time: inv.issued_at.slice(11, 16)
    });
  }

  console.log('=== BREAKDOWN BY CUSTOMER ===');
  const rows = Object.entries(byCust)
    .map(([cust, d]) => ({
      Customer: cust,
      Invoices: d.count,
      'Total Invoiced (GHS)': d.total.toFixed(2),
      'Paid (GHS)': d.paid.toFixed(2),
      'Outstanding (GHS)': d.balance.toFixed(2),
      'Invoice Numbers': d.invoices.map(i => `${i.num}(${i.balance})`).join(', ')
    }))
    .sort((a, b) => parseFloat(b['Outstanding (GHS)']) - parseFloat(a['Outstanding (GHS)']));

  console.table(rows);
}

run();
