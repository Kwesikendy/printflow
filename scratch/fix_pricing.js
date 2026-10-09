require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Update Supabase schema cache
  await supabase.rpc('reload_schema').catch(() => {});

  // Update products to fixed price
  const { data: products } = await supabase.from('product_types').select('id, name').in('name', ['PULLUP FLEXY 80 X 200CM', 'PVC 80 X 200CM']);
  
  if (products) {
    for (const p of products) {
      // 1. set is_fixed_price = true
      await supabase.from('product_types').update({ is_fixed_price: true }).eq('id', p.id);
      
      // 2. update pricing rules
      if (p.name.includes('FLEXY')) {
        await supabase.from('pricing_rules').update({ unit_cost: 40 }).eq('product_type_id', p.id).eq('source', 'marketing');
        await supabase.from('pricing_rules').update({ unit_cost: 50 }).eq('product_type_id', p.id).eq('source', 'walk_in');
      } else if (p.name.includes('PVC')) {
        await supabase.from('pricing_rules').update({ unit_cost: 70 }).eq('product_type_id', p.id).eq('source', 'marketing');
        await supabase.from('pricing_rules').update({ unit_cost: 90 }).eq('product_type_id', p.id).eq('source', 'walk_in');
      }
    }
  }
  console.log('Fixed prices and pricing rules updated!');
}
run();
