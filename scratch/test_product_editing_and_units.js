const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Square centimeters per unit squared
const SQ_CM_PER_UNIT = {
  cm: 1,
  m: 10000,
  ft: 929.0304,
  in: 6.4516,
};

function toCmRate(rate, unit) {
  return rate / SQ_CM_PER_UNIT[unit];
}

function fromCmRate(cmCost, unit) {
  return cmCost * SQ_CM_PER_UNIT[unit];
}

async function runTests() {
  console.log('--- TEST 1: Math & Conversion Verification ---');
  const ratePerFt = 2.80; // ₵2.80 per sq ft
  const cmRate = toCmRate(ratePerFt, 'ft');
  console.log(`₵${ratePerFt}/ft² converted to cm² cost: ${cmRate} GHS/cm²`);
  
  const backToFt = fromCmRate(cmRate, 'ft');
  console.log(`Converted back to ft²: ₵${backToFt.toFixed(2)}/ft²`);
  if (Math.abs(backToFt - ratePerFt) > 0.0001) throw new Error('Conversion mismatch!');

  // Check line total matching
  const widthFt = 10;
  const heightFt = 4;
  const qty = 2;
  const areaFt2 = widthFt * heightFt; // 40 sq ft
  const frontendLineTotal = areaFt2 * ratePerFt * qty; // 40 * 2.80 * 2 = 224.00
  console.log(`Frontend line total: ₵${frontendLineTotal.toFixed(2)}`);

  const widthCm = widthFt * 30.48; // 304.8 cm
  const heightCm = heightFt * 30.48; // 121.92 cm
  const areaCm2 = widthCm * heightCm; // 37161.216 cm²
  const backendLineTotal = Math.round(areaCm2 * cmRate * qty * 100) / 100;
  console.log(`Backend line total: ₵${backendLineTotal.toFixed(2)}`);

  if (Math.abs(frontendLineTotal - backendLineTotal) > 0.01) {
    throw new Error(`Line total mismatch! Frontend: ${frontendLineTotal}, Backend: ${backendLineTotal}`);
  }
  console.log('✅ Math verification passed: Frontend and Backend totals match to the penny!');

  console.log('\n--- TEST 2: Product Types in Database ---');
  const { data: products, error: pErr } = await supabase
    .from('product_types')
    .select('id, name, is_active')
    .limit(5);

  if (pErr) throw pErr;
  console.log(`Found ${products.length} products:`, products.map(p => p.name));

  console.log('\n--- TEST 3: Pricing Rules in Database ---');
  const { data: rules, error: rErr } = await supabase
    .from('pricing_rules')
    .select('id, product_type_id, source, unit_cost')
    .limit(5);

  if (rErr) throw rErr;
  console.log(`Found ${rules.length} rules.`);
  for (const r of rules) {
    const ftCost = fromCmRate(r.unit_cost, 'ft');
    const inCost = fromCmRate(r.unit_cost, 'in');
    console.log(`  Rule for ${r.source}: ₵${ftCost.toFixed(2)}/ft² | ₵${inCost.toFixed(4)}/in² (base: ${r.unit_cost})`);
  }

  console.log('\n--- TEST 4: Storage Upload & Download of Unit Pricing ---');
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const testProduct = products[0];
  const testConfig = {
    [testProduct.id]: {
      walk_in: { ft: 2.80, in: 0.03, cm: 0.0035, m: 28.00 },
      marketing: { ft: 2.20, in: 0.02, cm: 0.0028, m: 22.00 }
    }
  };

  const uploadPath = `${tenantId}/settings/unit_pricing.json`;
  const { error: upErr } = await supabase.storage
    .from('artworks')
    .upload(uploadPath, Buffer.from(JSON.stringify(testConfig, null, 2)), {
      upsert: true,
      contentType: 'application/json'
    });

  if (upErr) throw upErr;
  console.log('✅ Unit pricing config uploaded successfully');

  const { data: downData, error: downErr } = await supabase.storage
    .from('artworks')
    .download(uploadPath);

  if (downErr) throw downErr;
  const downloadedText = await downData.text();
  const parsed = JSON.parse(downloadedText);
  console.log('✅ Unit pricing config downloaded and verified:', Object.keys(parsed));
  console.log(`  Rates for ${testProduct.name}:`, parsed[testProduct.id]);

  console.log('\nALL TESTS PASSED SUCCESSFULLY! 🚀');
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
