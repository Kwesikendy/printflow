require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ dimension_unit: 'cm' })
      .neq('dimension_unit', 'cm');
      
    if (error) throw error;
    console.log('Successfully updated existing jobs to cm.');
  } catch (err) {
    console.error('Error updating DB:', err);
  }
}
run();
