const https = require('https');
require('dotenv').config({ path: '.env.local' });

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function querySql(path, body) {
  return new Promise(resolve => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'zrnnrnnzywqnvdmnpbws.supabase.co',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }, (res) => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ path, status: res.statusCode, body: out }));
    });
    req.on('error', (e) => resolve({ path, error: e.message }));
    req.write(data);
    req.end();
  });
}

async function test() {
  const paths = [
    '/pg/v1/query',
    '/database/v1/query',
    '/sql/v1',
    '/rest/v1/rpc/exec_sql',
    '/rest/v1/rpc/run_sql'
  ];

  for (const p of paths) {
    const res = await querySql(p, { query: 'SELECT 1;' });
    console.log(p, '->', res.status, res.body.substring(0, 100));
  }
}

test();
