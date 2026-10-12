const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('List users error:', error);
    return;
  }
  const mavis = users.users.find(u => u.email === 'm.adoko@printdpigh.com');
  console.log('Mavis user in Auth:', mavis ? { id: mavis.id, email: mavis.email } : 'Not found');
  
  // Set password to password123 to ensure user can log in
  if (mavis) {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(mavis.id, {
      password: 'password123',
      email_confirm: true
    });
    console.log('Password update result:', updateErr ? updateErr.message : 'Successfully set to password123');
  }

  // Also list all other users
  console.log('All available test accounts:');
  users.users.forEach(u => console.log(`- ${u.email}`));
}

check();
