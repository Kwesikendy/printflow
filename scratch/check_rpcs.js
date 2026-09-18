const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRPCs() {
  const { data, error } = await supabase.from('pg_proc').select('proname').limit(5);
  console.log('pg_proc error:', error?.message);

  // Let's test standard functions
  const rpcs = ['create_job_group', 'record_payment', 'transition_job_status', 'exec', 'execute', 'run_sql', 'sql'];
  for (const r of rpcs) {
    const res = await supabase.rpc(r, {});
    console.log(`RPC ${r}:`, res.error?.message);
  }
}

checkRPCs();
