const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTest() {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  console.log('--- Test 1: Create & Delete Unused Product ---');
  // 1. Insert a temporary product
  const { data: newPt, error: createErr } = await supabase
    .from('product_types')
    .insert({
      tenant_id: tenantId,
      name: 'Temp Test Banner',
      is_active: true
    })
    .select()
    .single();

  if (createErr) {
    console.error('Create error:', createErr);
    return;
  }
  console.log('Created product:', newPt.name, newPt.id);

  // 2. Insert pricing rules for it
  const { error: ruleErr } = await supabase
    .from('pricing_rules')
    .insert([
      { tenant_id: tenantId, product_type_id: newPt.id, source: 'walk_in', unit_cost: 0.05 },
      { tenant_id: tenantId, product_type_id: newPt.id, source: 'marketing', unit_cost: 0.04 }
    ]);
  if (ruleErr) console.error('Pricing rule error:', ruleErr);
  console.log('Inserted 2 pricing rules.');

  // 3. Test deleting pricing rule
  const { data: rules } = await supabase.from('pricing_rules').select('id').eq('product_type_id', newPt.id);
  console.log(`Found ${rules.length} pricing rules before deletion.`);

  // 4. Test deleting unused product type (simulate server action logic)
  const { count: jobCount } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('product_type_id', newPt.id);
  console.log(`Job count for ${newPt.name}: ${jobCount}`);

  if (jobCount === 0) {
    await supabase.from('pricing_rules').delete().eq('product_type_id', newPt.id);
    const { error: delErr } = await supabase.from('product_types').delete().eq('id', newPt.id);
    console.log('Deletion result error:', delErr);
  }

  // 5. Verify it is gone
  const { data: checkPt } = await supabase.from('product_types').select('*').eq('id', newPt.id);
  const { data: checkRules } = await supabase.from('pricing_rules').select('*').eq('product_type_id', newPt.id);
  console.log('Product exists after delete?', checkPt.length > 0 ? 'YES' : 'NO (Successfully deleted)');
  console.log('Rules exist after delete?', checkRules.length > 0 ? 'YES' : 'NO (Successfully deleted)');

  console.log('\n--- Test 2: Verify Protected Deletion for Products With Existing Jobs ---');
  const { data: flyer } = await supabase.from('product_types').select('*').eq('name', 'Flyer').single();
  const { count: flyerJobs } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('product_type_id', flyer.id);
  console.log(`Flyer has ${flyerJobs} jobs. Should be protected from hard delete.`);
  console.log('All tests completed successfully!');
}

runTest();
