const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function breakdown() {
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
      job_groups(
        id,
        customer_name,
        customer_phone,
        created_by,
        jobs(
          id,
          job_number,
          product_types(name),
          width,
          height,
          dimension_unit,
          quantity,
          unit_cost_applied,
          line_total,
          status,
          created_by,
          created_at
        )
      ),
      jobs(
        id,
        job_number,
        product_types(name),
        customer_name,
        width,
        height,
        dimension_unit,
        quantity,
        unit_cost_applied,
        line_total,
        status,
        created_by,
        created_at
      ),
      payments(
        id,
        amount,
        method,
        recorded_at
      )
    `)
    .order('issued_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Get profile names
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role');
  const profileMap = {};
  (profiles || []).forEach(p => {
    profileMap[p.id] = `${p.full_name} (${p.role})`;
  });

  console.log(`=== DETAILED BREAKDOWN OF ALL ${invoices.length} INVOICES TODAY ===\n`);

  let grandTotal = 0;
  let grandPaid = 0;
  let grandOutstanding = 0;

  for (const inv of invoices) {
    const isGroup = !!inv.group_id;
    const customer = inv.job_groups?.customer_name || inv.jobs?.customer_name || 'Unknown';
    const jobsList = isGroup ? (inv.job_groups?.jobs || []) : (inv.jobs ? [inv.jobs] : []);
    const paid = (inv.payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const balance = Number(inv.total) - paid;
    const creatorId = isGroup ? inv.job_groups?.created_by : inv.jobs?.created_by;
    const creator = profileMap[creatorId] || creatorId || 'Unknown';

    grandTotal += Number(inv.total);
    grandPaid += paid;
    if (balance > 0.01) grandOutstanding += balance;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Invoice: ${inv.invoice_number} | Customer: ${customer} | Issued: ${inv.issued_at.slice(11, 19)}`);
    console.log(`Total: GHS ${Number(inv.total).toFixed(2)} | Paid: GHS ${paid.toFixed(2)} | Balance: GHS ${balance.toFixed(2)} | Status: ${inv.status}`);
    console.log(`Staff Creator: ${creator}`);
    console.log(`Items/Jobs (${jobsList.length}):`);
    for (const j of jobsList) {
      console.log(`  • [${j.job_number}] ${j.product_types?.name} - ${j.width}x${j.height} ${j.dimension_unit} | Qty: ${j.quantity} @ GHS ${j.unit_cost_applied} = GHS ${j.line_total} (Status: ${j.status})`);
    }
  }

  console.log(`================================================================================`);
  console.log(`GRAND SUMMARY:`);
  console.log(`Total Invoices: ${invoices.length}`);
  console.log(`Total Invoiced Amount: GHS ${grandTotal.toFixed(2)}`);
  console.log(`Total Paid (Revenue): GHS ${grandPaid.toFixed(2)}`);
  console.log(`Total Outstanding: GHS ${grandOutstanding.toFixed(2)}`);
}

breakdown();
