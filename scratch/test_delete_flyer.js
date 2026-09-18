const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDeleteFlyer() {
  const { data: pt } = await supabase.from('product_types').select('*').eq('name', 'Flyer').single();
  const { error } = await supabase.from('product_types').delete().eq('id', pt.id);
  console.log('Delete Flyer result error:', error);
}

testDeleteFlyer();
