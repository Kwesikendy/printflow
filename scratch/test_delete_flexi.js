const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDelete() {
  // Check if Flexi can be deleted
  const { data: pt } = await supabase.from('product_types').select('*').eq('name', 'Flexi').single();
  console.log('Flexi product:', pt);

  if (pt) {
    // 1. Delete pricing rules
    const { error: prErr } = await supabase.from('pricing_rules').delete().eq('product_type_id', pt.id);
    console.log('Delete pricing rules error:', prErr);

    // 2. Delete product type
    const { error: ptErr } = await supabase.from('product_types').delete().eq('id', pt.id);
    console.log('Delete product type error:', ptErr);
  }
}

testDelete();
