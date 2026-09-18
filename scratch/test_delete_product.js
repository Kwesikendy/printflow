const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: products } = await supabase.from('product_types').select('id, name').limit(5);
  console.log('Sample products:', products);

  for (const p of products) {
    const { count: jobCount } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('product_type_id', p.id);
    const { count: ruleCount } = await supabase.from('pricing_rules').select('*', { count: 'exact', head: true }).eq('product_type_id', p.id);
    console.log(`Product "${p.name}" (${p.id}): ${jobCount} jobs, ${ruleCount} pricing rules`);
  }
}

test();
