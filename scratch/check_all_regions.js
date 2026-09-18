const { Client } = require('pg');

const regions = [
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'sa-east-1', 'ca-central-1', 'af-south-1'
];

async function checkOne(r) {
  const host = `aws-0-${r}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543,
    database: 'postgres',
    user: 'postgres.zrnnrnnzywqnvdmnpbws',
    password: 'PRINTFLOW11@',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 2500
  });

  try {
    await client.connect();
    console.log(`\n🎉 SUCCESS ON PORT 6543 IN REGION: ${r}!`);
    await client.end();
  } catch (err) {
    if (!err.message.includes('tenant/user') && !err.message.includes('timeout')) {
      console.log(`Region ${r}:`, err.message);
    }
  }
}

async function checkSession(r) {
  const host = `aws-0-${r}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres.zrnnrnnzywqnvdmnpbws',
    password: 'PRINTFLOW11@',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 2500
  });

  try {
    await client.connect();
    console.log(`\n🎉 SUCCESS ON PORT 5432 IN REGION: ${r}!`);
    await client.end();
  } catch (err) {
    if (!err.message.includes('tenant/user') && !err.message.includes('timeout')) {
      console.log(`Region ${r} (5432):`, err.message);
    }
  }
}

Promise.all(regions.map(r => checkOne(r).then(() => checkSession(r)))).then(() => {
  console.log('Done checking regions.');
});
