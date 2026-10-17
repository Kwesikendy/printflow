const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDryRunCustomerSettlement(customerName, testAmount) {
  console.log(`\n=== Testing Settlement Dry-Run for: "${customerName}" with ₵${testAmount} ===`);

  // 1. Fetch matching jobs
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('id, group_id, status')
    .ilike('customer_name', `%${customerName}%`);

  const { data: groups, error: groupsErr } = await supabase
    .from('job_groups')
    .select('id')
    .ilike('customer_name', `%${customerName}%`);

  const jobIds = (jobs || []).map(j => j.id);
  const groupIds = Array.from(new Set([
    ...(jobs || []).map(j => j.group_id).filter(Boolean),
    ...(groups || []).map(g => g.id)
  ]));

  console.log(`Found ${jobIds.length} jobs, ${groupIds.length} groups`);

  // 2. Fetch unpaid/partial invoices
  let invQuery = supabase
    .from('invoices')
    .select('id, invoice_number, total, status, issued_at, job_id, group_id')
    .neq('status', 'paid');

  if (jobIds.length > 0 && groupIds.length > 0) {
    invQuery = invQuery.or(`job_id.in.(${jobIds.join(',')}),group_id.in.(${groupIds.join(',')})`);
  } else if (jobIds.length > 0) {
    invQuery = invQuery.in('job_id', jobIds);
  } else if (groupIds.length > 0) {
    invQuery = invQuery.in('group_id', groupIds);
  }

  const { data: unpaidInvoices } = await invQuery.order('issued_at', { ascending: true });
  console.log(`Unpaid / Partial Invoices found: ${unpaidInvoices?.length || 0}`);

  if (!unpaidInvoices || unpaidInvoices.length === 0) {
    console.log('No unpaid invoices for this customer.');
    return;
  }

  const invoiceIds = unpaidInvoices.map(i => i.id);

  // 3. Fetch payments
  const { data: payData } = await supabase
    .from('payments')
    .select('invoice_id, amount')
    .in('invoice_id', invoiceIds);

  const paidPerInvoice = new Map();
  (payData || []).forEach(p => {
    paidPerInvoice.set(p.invoice_id, (paidPerInvoice.get(p.invoice_id) || 0) + Number(p.amount));
  });

  const actionableInvoices = unpaidInvoices
    .map(inv => {
      const paid = paidPerInvoice.get(inv.id) || 0;
      const total = Number(inv.total);
      const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100);
      return {
        ...inv,
        total,
        amount_paid: paid,
        balance_due: balanceDue
      };
    })
    .filter(inv => inv.balance_due > 0.009)
    .sort((a, b) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime());

  const totalOutstanding = actionableInvoices.reduce((sum, inv) => sum + inv.balance_due, 0);
  console.log(`Actionable Invoices: ${actionableInvoices.length}`);
  console.log(`Total Outstanding Balance: ₵${totalOutstanding.toFixed(2)}`);

  // Simulate FIFO allocation
  let rem = testAmount;
  console.log('\n--- Simulated Allocation (FIFO): ---');
  for (const inv of actionableInvoices) {
    if (rem <= 0) {
      console.log(` - ${inv.invoice_number}: ₵0.00 allocated (Still owes ₵${inv.balance_due.toFixed(2)})`);
      continue;
    }
    const alloc = Math.min(rem, inv.balance_due);
    const rounded = Math.round(alloc * 100) / 100;
    const remainingOnInvoice = Math.max(0, Math.round((inv.balance_due - rounded) * 100) / 100);
    const status = remainingOnInvoice <= 0.009 ? 'FULL PAYMENT (PAID)' : `PARTIAL (₵${remainingOnInvoice.toFixed(2)} left)`;
    console.log(` - ${inv.invoice_number} (Due: ₵${inv.balance_due.toFixed(2)}): Allocating ₵${rounded.toFixed(2)} -> ${status}`);
    rem = Math.max(0, Math.round((rem - rounded) * 100) / 100);
  }
  console.log(`Remaining Unallocated from payment: ₵${rem.toFixed(2)}`);
  console.log(`New Customer Balance: ₵${Math.max(0, Math.round((totalOutstanding - testAmount) * 100) / 100).toFixed(2)}`);
}

testDryRunCustomerSettlement('OBED', 1000).then(() => {
  testDryRunCustomerSettlement('OBED', 2500);
});
