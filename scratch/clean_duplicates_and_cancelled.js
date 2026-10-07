const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanDuplicatesAndCancelled() {
  console.log('--- BACKING UP AND REMOVING DUPLICATES AND CANCELLED RECORDS ---');

  // 1. Identify specific invoice numbers to remove
  const targetInvoiceNumbers = [
    'INV-00054', // OBED cancelled duplicate (1,350.00)
    'INV-00003', // OBED duplicate (321.29)
    'INV-00051', // HETTY cancelled (537.60)
    'INV-00056', // HETTY duplicate of INV-00005 (537.60)
    'INV-00057', // IBN NART cancelled (9.60)
    'INV-00007', // KWAME duplicate of INV-00008 (60.42)
  ];

  // Specific jobs to delete:
  // - Cancelled jobs: PF-00056, PF-00053, PF-00059
  // - Abandoned duplicates: PF-00003, PF-00004 (from INV-00003), PF-00008 (from INV-00007)
  const targetJobNumbers = [
    'PF-00056',
    'PF-00053',
    'PF-00059',
    'PF-00003',
    'PF-00004',
    'PF-00008'
  ];

  // 2. Fetch full details for backup
  const { data: backupInvoices } = await supabase
    .from('invoices')
    .select('*, payments(*)')
    .in('invoice_number', targetInvoiceNumbers);

  const { data: backupJobs } = await supabase
    .from('jobs')
    .select('*, job_status_events(*)')
    .in('job_number', targetJobNumbers);

  const backupData = {
    timestamp: new Date().toISOString(),
    invoices: backupInvoices || [],
    jobs: backupJobs || []
  };

  const backupPath = path.join(__dirname, 'backup_deleted_duplicates_and_cancelled_2026_10_07.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Saved backup to: ${backupPath}`);
  console.log(`Invoices to delete: ${backupInvoices?.length || 0}`);
  console.log(`Jobs to delete: ${backupJobs?.length || 0}`);

  // 3. Delete invoices
  const invoiceIds = (backupInvoices || []).map(i => i.id);
  if (invoiceIds.length > 0) {
    const { error: invErr } = await supabase.from('invoices').delete().in('id', invoiceIds);
    if (invErr) console.error('Error deleting invoices:', invErr);
    else console.log(`Deleted ${invoiceIds.length} duplicate/cancelled invoices`);
  }

  // 4. Delete job status events and jobs
  const jobIds = (backupJobs || []).map(j => j.id);
  if (jobIds.length > 0) {
    await supabase.from('job_status_events').delete().in('job_id', jobIds);
    const { error: jobErr } = await supabase.from('jobs').delete().in('id', jobIds);
    if (jobErr) console.error('Error deleting jobs:', jobErr);
    else console.log(`Deleted ${jobIds.length} duplicate/cancelled jobs`);
  }

  // 5. Clean up any empty job_groups created by these jobs
  const groupIds = [...new Set((backupJobs || []).map(j => j.group_id).filter(Boolean))];
  for (const gid of groupIds) {
    const { data: remaining } = await supabase.from('jobs').select('id').eq('group_id', gid);
    if (!remaining || remaining.length === 0) {
      await supabase.from('job_groups').delete().eq('id', gid);
      console.log(`Cleaned up empty job_group: ${gid}`);
    }
  }

  // 6. Recalculate remaining ledger
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, status, payments(amount)');

  let totalRevenue = 0;
  let totalOutstanding = 0;
  let unpaidCount = 0;

  for (const inv of allInvoices || []) {
    const paid = (inv.payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const bal = Number(inv.total) - paid;
    totalRevenue += paid;
    if (bal > 0.01) {
      totalOutstanding += bal;
      unpaidCount++;
    }
  }

  console.log('\n=== LEDGER AFTER CLEANUP ===');
  console.log(`Remaining Invoices: ${allInvoices?.length || 0}`);
  console.log(`Unpaid Invoices Count: ${unpaidCount}`);
  console.log(`Total Revenue: GHS ${totalRevenue.toFixed(2)}`);
  console.log(`Total Outstanding: GHS ${totalOutstanding.toFixed(2)}`);
}

cleanDuplicatesAndCancelled();
