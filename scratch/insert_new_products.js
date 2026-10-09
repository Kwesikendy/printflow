require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addProducts() {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  // 1. Insert PULLUP FLEXY 80 X 200CM
  const { data: flexy, error: err1 } = await supabase.from('product_types').insert({
    tenant_id: tenantId,
    name: 'PULLUP FLEXY 80 X 200CM',
    is_active: true
  }).select('id').single();

  if (err1) {
    console.error('Error inserting flexy:', err1);
    return;
  }

  // Insert pricing rules for PULLUP FLEXY (Area = 80*200 = 16000)
  // Marketing = 40 / 16000 = 0.0025
  // Walk-in = 50 / 16000 = 0.003125
  await supabase.from('pricing_rules').insert([
    { tenant_id: tenantId, product_type_id: flexy.id, source: 'marketing', unit_cost: 0.0025 },
    { tenant_id: tenantId, product_type_id: flexy.id, source: 'walk_in', unit_cost: 0.003125 }
  ]);

  // 2. Insert PVC 80 X 200CM
  const { data: pvc, error: err2 } = await supabase.from('product_types').insert({
    tenant_id: tenantId,
    name: 'PVC 80 X 200CM',
    is_active: true
  }).select('id').single();

  if (err2) {
    console.error('Error inserting PVC:', err2);
    return;
  }

  // Insert pricing rules for PVC (Area = 80*200 = 16000)
  // Marketing = 70 / 16000 = 0.004375
  // Walk-in = 90 / 16000 = 0.005625
  await supabase.from('pricing_rules').insert([
    { tenant_id: tenantId, product_type_id: pvc.id, source: 'marketing', unit_cost: 0.004375 },
    { tenant_id: tenantId, product_type_id: pvc.id, source: 'walk_in', unit_cost: 0.005625 }
  ]);

  console.log('Successfully inserted PULLUP FLEXY and PVC products and pricing rules!');
}

addProducts();
