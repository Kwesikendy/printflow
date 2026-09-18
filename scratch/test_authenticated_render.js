const { createClient } = require('@supabase/supabase-js');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAuth() {
  console.log('1. Signing in as admin...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@demo.com',
    password: 'password123'
  });

  if (error || !data.session) {
    console.error('Sign in error:', error);
    process.exit(1);
  }

  const token = data.session.access_token;
  const refreshToken = data.session.refresh_token;
  console.log('✅ Sign in successful.');

  // Build Supabase cookie header
  // Next.js Supabase auth helper uses cookie with project ref
  const projectRef = 'zrnnrnnzywqnvdmnpbws';
  const cookieStr = `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify({
    access_token: token,
    refresh_token: refreshToken,
    token_type: 'bearer',
    user: data.user
  }))}; Path=/; HttpOnly; SameSite=Lax;`;

  function getWithCookie(path) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: 'GET',
        headers: {
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ path, statusCode: res.statusCode, length: body.length, preview: body.substring(0, 300) }));
      });
      req.on('error', e => resolve({ path, error: e.message }));
      req.end();
    });
  }

  console.log('\n2. Testing /dashboard/admin/products...');
  const r1 = await getWithCookie('/dashboard/admin/products');
  console.log('Products page status:', r1.statusCode, `(body length: ${r1.length})`);
  if (r1.statusCode !== 200 && r1.statusCode !== 307) {
    console.log('Error preview:', r1.preview);
  } else {
    console.log('✅ Products page rendered successfully!');
  }

  console.log('\n3. Testing /dashboard/jobs/new...');
  const r2 = await getWithCookie('/dashboard/jobs/new');
  console.log('New Job page status:', r2.statusCode, `(body length: ${r2.length})`);
  if (r2.statusCode !== 200 && r2.statusCode !== 307) {
    console.log('Error preview:', r2.preview);
  } else {
    console.log('✅ New job page rendered successfully!');
  }
}

testAuth();
