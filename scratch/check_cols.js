const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('product_types').select('*').limit(1);
  console.log('product_types columns:', Object.keys(data[0]));
  const { data: ptRules } = await supabase.from('pricing_rules').select('*').limit(1);
  console.log('pricing_rules columns:', Object.keys(ptRules[0]));
}

check();
