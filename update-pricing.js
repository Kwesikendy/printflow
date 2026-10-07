const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const tenantId = '00000000-0000-0000-0000-000000000001';
const SQ_CM_PER_FT = 929.0304;

// All products and target prices from the client's official price sheet
const productsData = [
  { name: 'Flexi - Glossy', aliases: ['FLEXI', 'Flexi'], marketerFt: 2.1, clientFt: 2.6 },
  { name: 'Flexi with Lamination', aliases: ['FLEIX/LAM', 'Flexi/Lam'], marketerFt: 3.6, clientFt: 4.5 },
  { name: 'SAV - Glossy', aliases: ['SAV'], marketerFt: 2.1, clientFt: 2.6 },
  { name: 'SAV with Lamination', aliases: ['SAV/LAM'], marketerFt: 3.6, clientFt: 4.5 },
  { name: 'SAV - Matte', aliases: ['SAV MATTE'], marketerFt: 2.5, clientFt: 3.0 },
  { name: 'Flexi - Black Back', aliases: ['BLACK BACK'], marketerFt: 2.5, clientFt: 3.0 },
  { name: 'Flexi - Black Back Special', aliases: ['BLACK BACK SPECIAL', 'Black Back Special'], marketerFt: 2.3, clientFt: 3.0 },
  { name: 'SAV - Transparent', aliases: ['T-SAV', 'Transparent SAV'], marketerFt: 3.0, clientFt: 4.0 },
  { name: 'SAV - Reflective', aliases: ['R-SAV', 'Reflective SAV'], marketerFt: 5.0, clientFt: 6.0 },
  { name: 'Reflective SAV with Lamination', aliases: ['RSAV/LAM', 'R-SAV/LAM'], marketerFt: 6.6, clientFt: 8.0 },
  { name: 'Flexi - Reflective', aliases: ['R-FLEXI', 'Reflective Flexi'], marketerFt: 5.5, clientFt: 6.5 },
  { name: 'Blue Back Paper', aliases: ['BLUE BACK PAPER'], marketerFt: 2.1, clientFt: 2.6 },
  { name: 'Print and Cut SAV', aliases: ['PRINT N CUT', 'PRINT & CUT'], marketerFt: 4.0, clientFt: 5.0 },
  { name: 'One Way Vision', aliases: ['ONEWAY VISION'], marketerFt: 4.0, clientFt: 5.0 },
  { name: 'PVC', aliases: ['PVC'], marketerFt: 4.0, clientFt: 5.0 },
  { name: 'Flag', aliases: ['FLAG'], marketerFt: 4.0, clientFt: 5.0 },
  { name: 'Flag Finishing', aliases: ['FLAG FINISHING', 'Finishing'], marketerFt: 0.47, clientFt: 0.60 },
  { name: 'Cloth', aliases: ['CLOTH'], marketerFt: 2.2, clientFt: 2.7 },
  { name: 'Lamination', aliases: ['LAM'], marketerFt: 1.6, clientFt: 2.0 },
  { name: 'Print and Cut T-SAV', aliases: ['T-SAV+PNC', 'Transparent SAV Print & Cut'], marketerFt: 4.6, clientFt: 5.6 },
  { name: 'Cutting Only', aliases: ['CUTTING ONLY'], marketerFt: 1.6, clientFt: 2.0 },
  {
    name: 'DTF (A4)',
    aliases: ['DTF (A4)'],
    marketerFt: 4.0,
    clientFt: 5.0,
    customScheme: {
      default_unit: 'ft',
      walk_in: { ft: 5.0, in: +(5.0 / 144).toFixed(4), cm: +(5.0 / (21 * 29.7)).toFixed(6), m: +(5.0 * 10.7639).toFixed(2) },
      marketing: { ft: 4.0, in: +(4.0 / 144).toFixed(4), cm: +(4.0 / (21 * 29.7)).toFixed(6), m: +(4.0 * 10.7639).toFixed(2) }
    }
  },
  {
    name: 'DTF (A3)',
    aliases: ['DTF (A3)'],
    marketerFt: 8.0,
    clientFt: 10.0,
    customScheme: {
      default_unit: 'ft',
      walk_in: { ft: 10.0, in: +(10.0 / 144).toFixed(4), cm: +(10.0 / (29.7 * 42)).toFixed(6), m: +(10.0 * 10.7639).toFixed(2) },
      marketing: { ft: 8.0, in: +(8.0 / 144).toFixed(4), cm: +(8.0 / (29.7 * 42)).toFixed(6), m: +(8.0 * 10.7639).toFixed(2) }
    }
  },
  {
    name: 'PVC (Pull-Ups)',
    aliases: ['PVC (PULL-UPS)', 'PVC PULL-UPS'],
    marketerFt: 70.0,
    clientFt: 90.0,
    customScheme: {
      default_unit: 'ft',
      walk_in: { ft: 90.0, in: +(90.0 / 144).toFixed(4), cm: +(90.0 / (85 * 200)).toFixed(6), m: +(90.0 * 10.7639).toFixed(2) },
      marketing: { ft: 70.0, in: +(70.0 / 144).toFixed(4), cm: +(70.0 / (85 * 200)).toFixed(6), m: +(70.0 * 10.7639).toFixed(2) }
    }
  },
  {
    name: 'Flexi (Pull-Ups)',
    aliases: ['FLEXI (PULL - UPS)', 'FLEXI (PULL-UPS)'],
    marketerFt: 40.0,
    clientFt: 60.0,
    customScheme: {
      default_unit: 'ft',
      walk_in: { ft: 60.0, in: +(60.0 / 144).toFixed(4), cm: +(60.0 / (85 * 200)).toFixed(6), m: +(60.0 * 10.7639).toFixed(2) },
      marketing: { ft: 40.0, in: +(40.0 / 144).toFixed(4), cm: +(40.0 / (85 * 200)).toFixed(6), m: +(40.0 * 10.7639).toFixed(2) }
    }
  },
  { name: 'Plain Black Back', aliases: ['PLAIN BLACK BACK'], marketerFt: 2.0, clientFt: 2.5 },
  { name: 'Flexi Plain', aliases: ['PLAIN FLEXI/SAV', 'Plain Flexi'], marketerFt: 1.6, clientFt: 2.1 },
  { name: 'SAV Plain', aliases: ['Plain SAV'], marketerFt: 1.6, clientFt: 2.1 },
  { name: 'Pocketing', aliases: ['POCKETING'], marketerFt: 0.11, clientFt: 0.22 }
];

async function sync() {
  console.log('Connecting to Supabase...');
  const { data: existingProducts, error: pErr } = await supabase
    .from('product_types')
    .select('*')
    .eq('tenant_id', tenantId);

  if (pErr) throw pErr;

  const { data: storageData } = await supabase.storage
    .from('artworks')
    .download(`${tenantId}/settings/unit_pricing.json`);
  let config = {};
  if (storageData) {
    try { config = JSON.parse(await storageData.text()); } catch (e) {}
  }

  // Ensure Pull-Up standard size
  const { data: stdSizes } = await supabase.from('standard_sizes').select('*').eq('tenant_id', tenantId);
  const pullUpSize = stdSizes?.find(s => s.name.toLowerCase().includes('pull-up') || s.name.toLowerCase().includes('pull up'));
  if (!pullUpSize) {
    console.log('Adding "Pull-Up (85×200cm)" standard size...');
    await supabase.from('standard_sizes').insert({
      tenant_id: tenantId,
      name: 'Pull-Up (85×200cm)',
      width: 85,
      height: 200
    });
  }

  for (const item of productsData) {
    let prod = existingProducts.find(p => 
      p.name.toLowerCase() === item.name.toLowerCase() ||
      item.aliases.some(a => a.toLowerCase() === p.name.toLowerCase())
    );

    if (!prod && item.name === 'Flag Finishing') {
      prod = existingProducts.find(p => p.name.toLowerCase() === 'finishing');
      if (prod) {
        await supabase.from('product_types').update({ name: 'Flag Finishing' }).eq('id', prod.id);
        prod.name = 'Flag Finishing';
      }
    }

    if (!prod) {
      console.log(`➕ Inserting new product: "${item.name}"`);
      const { data: newProd, error: insertErr } = await supabase
        .from('product_types')
        .insert({ tenant_id: tenantId, name: item.name, is_active: true })
        .select()
        .single();
      if (insertErr) {
        console.error(`Failed to insert "${item.name}":`, insertErr);
        continue;
      }
      prod = newProd;
    } else if (!prod.is_active) {
      await supabase.from('product_types').update({ is_active: true }).eq('id', prod.id);
    }

    let scheme = item.customScheme;
    if (!scheme) {
      scheme = {
        default_unit: 'ft',
        walk_in: {
          ft: item.clientFt,
          in: +(item.clientFt / 144).toFixed(4),
          cm: +(item.clientFt / SQ_CM_PER_FT).toFixed(6),
          m: +((item.clientFt / SQ_CM_PER_FT) * 10000).toFixed(2),
        },
        marketing: {
          ft: item.marketerFt,
          in: +(item.marketerFt / 144).toFixed(4),
          cm: +(item.marketerFt / SQ_CM_PER_FT).toFixed(6),
          m: +((item.marketerFt / SQ_CM_PER_FT) * 10000).toFixed(2),
        }
      };
    }

    config[prod.id] = scheme;

    await supabase.from('pricing_rules').upsert({
      tenant_id: tenantId,
      product_type_id: prod.id,
      source: 'walk_in',
      unit_cost: scheme.walk_in.cm,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id,product_type_id,source' });

    await supabase.from('pricing_rules').upsert({
      tenant_id: tenantId,
      product_type_id: prod.id,
      source: 'marketing',
      unit_cost: scheme.marketing.cm,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id,product_type_id,source' });

    console.log(`Updated pricing for: ${prod.name} -> WalkIn: ₵${item.clientFt}/ft², Marketing: ₵${item.marketerFt}/ft²`);
  }

  await supabase.storage
    .from('artworks')
    .upload(`${tenantId}/settings/unit_pricing.json`, Buffer.from(JSON.stringify(config, null, 2)), {
      upsert: true,
      contentType: 'application/json'
    });

  console.log('✅ Unit pricing updated and uploaded successfully.');
}

sync().catch(console.error);
