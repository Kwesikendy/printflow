const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const walkInPrices = {
  'Flexi': 0.0028058333333333334,
  'Black Back Flexi': 0.0032375000000000004,
  'SAV': 0.002374166666666667,
  'SAV Matte': 0.0032375,
  'Blue Back Paper': 0.0026979166666666666,
  'One Way Vision': 0.005395833333333333,
  'PVC': 0.005395833333333333,
  'Reflective SAV': 0.006475,
  'Transparent SAV': 0.004316666666666666,
  'Reflective FLEXI': 0.006475,
  'SAV LAMINATION': 0.004316666666666667,
  'PRINT & CUT': 0.006475,
  'FLAGS': 0.006475
};

const marketingPrices = {
  'Flexi': 0.0022662500000000005,
  'Black Back Flexi': 0.002697916666666667,
  'SAV': 0.00226625,
  'SAV Matte': 0.00226625,
  'Blue Back Paper': 0.00226625,
  'One Way Vision': 0.004316666666666667,
  'PVC': 0.004316666666666667,
  'Reflective SAV': 0.005395833333333333,
  'Transparent SAV': 0.0032375000000000004,
  'SAV LAMINATION': 0.003885,
  'PRINT & CUT': 0.004316666666666667,
  'FLAGS': 0.004316666666666667,
  'Reflective FLEXI': 0.006475
};

async function run() {
  try {
    console.log('Connected to Supabase via REST API.');
    
    // Use the default tenant ID from the seed script
    const tenantId = '00000000-0000-0000-0000-000000000001';
    
    const allProducts = Object.keys(walkInPrices);
    
    for (const productName of allProducts) {
      console.log(`Processing product: ${productName}`);
      
      // 1. Upsert product type
      let { data: existingPt, error: ptError } = await supabase
        .from('product_types')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', productName)
        .single();
        
      if (ptError && ptError.code !== 'PGRST116') {
         console.error('Error fetching product type:', ptError);
         continue;
      }
      
      let productId;
      
      if (!existingPt) {
        console.log(`- Inserting new product type: ${productName}`);
        const { data: newPt, error: insertError } = await supabase
          .from('product_types')
          .insert({ tenant_id: tenantId, name: productName, is_active: true })
          .select()
          .single();
          
        if (insertError) {
          console.error('Error inserting product type:', insertError);
          continue;
        }
        productId = newPt.id;
      } else {
        productId = existingPt.id;
      }

      // 2. Upsert Walk In Rule
      const walkInCost = walkInPrices[productName];
      console.log(`- Upserting Walk In pricing for ${productName}: ₵${walkInCost.toFixed(4)}`);
      const { error: rule1Error } = await supabase
        .from('pricing_rules')
        .upsert({ 
           tenant_id: tenantId, 
           product_type_id: productId, 
           source: 'walk_in', 
           unit_cost: walkInCost 
        }, { onConflict: 'tenant_id,product_type_id,source' });
        
      if (rule1Error) {
        console.error('Error upserting walk in pricing:', rule1Error);
      }
      
      // 3. Upsert Marketing Rule
      const marketingCost = marketingPrices[productName];
      console.log(`- Upserting Marketing pricing for ${productName}: ₵${marketingCost.toFixed(4)}`);
      const { error: rule2Error } = await supabase
        .from('pricing_rules')
        .upsert({ 
           tenant_id: tenantId, 
           product_type_id: productId, 
           source: 'marketing', 
           unit_cost: marketingCost 
        }, { onConflict: 'tenant_id,product_type_id,source' });
        
      if (rule2Error) {
        console.error('Error upserting marketing pricing:', rule2Error);
      }
    }

    console.log('Successfully updated product types and pricing rules.');

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
