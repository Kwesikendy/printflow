const { Client } = require('pg');

const regions = [
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1', 'af-south-1'
];

async function run() {
  for (const r of regions) {
    const host = 'aws-0-' + r + '.pooler.supabase.com';
    const client = new Client({
      host: host,
      port: 6543,
      database: 'postgres',
      user: 'postgres.zrnnrnnzywqnvdmnpbws',
      password: 'PRINTFLOW11@',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3500
    });

    try {
      await client.connect();
      console.log('🎉 FOUND REGION:', r);
      const res = await client.query('SELECT current_database(), now()');
      console.log('Result:', res.rows);
      await client.end();
      return r;
    } catch (err) {
      if (!err.message.includes('tenant/user') && !err.message.includes('timeout') && !err.message.includes('ENOTFOUND')) {
        console.log(r, '->', err.message);
      }
    }
  }
  console.log('None of the regions matched.');
}

run();
