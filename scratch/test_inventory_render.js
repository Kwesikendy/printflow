const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'd.agbebo@printdpigh.com',
    password: 'password123'
  });

  if (error) {
    console.error('Login error:', error);
    return;
  }

  // Construct cookies formatted as Supabase SSR expects
  // Supabase ssr uses: sb-<project-ref>-auth-token
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionData = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user
  });
  
  const cookieHeader = `${cookieName}=${encodeURIComponent(sessionData)}`;

  const res = await fetch('http://localhost:3000/dashboard/admin/inventory', {
    headers: {
      Cookie: cookieHeader
    }
  });

  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Body length:', text.length);
  
  if (text.includes('Material Inventory')) {
    console.log('FOUND: "Material Inventory" in HTML!');
  } else {
    console.log('NOT FOUND: "Material Inventory" in HTML.');
    console.log('First 500 chars:', text.slice(0, 500));
  }
}

run();
