const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const lines = env.split('\n');
let url = '', key = '';
lines.forEach(l => {
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = l.split('=')[1].trim();
  if (l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = l.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function cleanDuplicates() {
  console.log('Starting duplicate invoice cleanup...');
  
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*, jobs(id, job_number, group_id, status), payments(*)');

  if (invError || !invoices) {
    console.error('Failed to fetch invoices:', invError);
    return;
  }

  const groupInvoices = invoices.filter(i => i.group_id);
  const jobInvoices = invoices.filter(i => i.job_id);

  const groupMap = new Map();
  for (const ji of jobInvoices) {
    if (ji.jobs && ji.jobs.group_id) {
      const gId = ji.jobs.group_id;
      const gi = groupInvoices.find(g => g.group_id === gId);
      if (gi) {
        if (!groupMap.has(gId)) groupMap.set(gId, { gi, jobInvoices: [] });
        groupMap.get(gId).jobInvoices.push(ji);
      }
    }
  }

  console.log(`Found ${groupMap.size} groups with redundant job invoices.`);

  let mergedCount = 0;
  let paymentsMoved = 0;
  let deletedInvoices = 0;

  for (const [gid, { gi, jobInvoices: jis }] of groupMap.entries()) {
    const jiIds = jis.map(j => j.id);

    // 1. Move all payments on these job invoices to the group invoice
    const { data: moved, error: moveError } = await supabase
      .from('payments')
      .update({ invoice_id: gi.id })
      .in('invoice_id', jiIds)
      .select('id, amount');

    if (moveError) {
      console.error(`Error moving payments for group ${gid}:`, moveError);
      continue;
    }

    if (moved && moved.length > 0) {
      paymentsMoved += moved.length;
    }

    // 2. Fetch all payments now attached to this group invoice
    const { data: allGiPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', gi.id);

    const totalPaid = (allGiPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const invoiceTotal = Number(gi.total);
    const newStatus = totalPaid >= invoiceTotal ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

    // 3. Check if this group only has 1 job; if so, link job_id to gi
    const { data: groupJobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('group_id', gid);

    const updatePayload = { status: newStatus };
    if (groupJobs && groupJobs.length === 1) {
      updatePayload.job_id = groupJobs[0].id;
    }

    await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('id', gi.id);

    // 4. Delete the redundant job invoices
    const { error: delError } = await supabase
      .from('invoices')
      .delete()
      .in('id', jiIds);

    if (delError) {
      console.error(`Error deleting job invoices for group ${gid}:`, delError);
    } else {
      deletedInvoices += jiIds.length;
    }

    mergedCount++;
    console.log(`Merged group ${gid}: kept ${gi.invoice_number} (status: ${newStatus}), re-linked ${moved ? moved.length : 0} payments, deleted ${jiIds.length} redundant invoices`);
  }

  console.log('\n--- CLEANUP COMPLETE ---');
  console.log(`Groups merged: ${mergedCount}`);
  console.log(`Payments safely re-linked to group invoices: ${paymentsMoved}`);
  console.log(`Redundant duplicate invoices deleted: ${deletedInvoices}`);
}

cleanDuplicates();
