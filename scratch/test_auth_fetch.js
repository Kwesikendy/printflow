const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@demo.com',
    password: 'password123'
  });

  if (error) {
    console.error('Login error:', error.message);
    return;
  }

  console.log('Login successful! User ID:', data.user.id);
  const token = data.session.access_token;
  console.log('Session token acquired.');

  // Verify server actions directly
  const { searchTransactionCustomers, getCustomerFinancialStatement } = require('../src/app/actions/finance');
  console.log('Finance actions imported successfully.');
}

run();
