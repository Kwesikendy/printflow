const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPricing() {
  const { data: rules } = await supabase.from('pricing_rules').select('*, product_types(name)').limit(15);
  console.log('Existing pricing rules sample:', rules);
}
checkPricing();
