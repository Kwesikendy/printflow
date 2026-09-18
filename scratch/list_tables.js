const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTables() {
  const tables = [
    'tenants', 'profiles', 'product_types', 'pricing_rules', 'standard_sizes',
    'jobs', 'job_groups', 'invoices', 'payments', 'job_status_events', 'customers'
  ];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`Table '${t}': OK, columns:`, data[0] ? Object.keys(data[0]) : 'empty table');
    } else {
      console.log(`Table '${t}': Error:`, error.message);
    }
  }
}

listTables();
