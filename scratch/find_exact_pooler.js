const { Client } = require('pg');

const regions = [
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'us-east-1', 'us-east-2', 'us-west-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'sa-east-1', 'ca-central-1', 'ap-northeast-1', 'ap-northeast-2'
];

async function find() {
  for (const r of regions) {
    const client = new Client({
      host: `aws-0-${r}.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: 'postgres.zrnnrnnzywqnvdmnpbws',
      password: 'PRINTFLOW11@',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });

    try {
      await client.connect();
      console.log(`\n\n🎉 FOUND REGION: ${r}!\n\n`);
      const res = await client.query('SELECT 1 as success');
      console.log(res.rows);
      await client.end();
      return;
    } catch (err) {
      if (err.message.includes('tenant/user')) {
        // wrong region
        process.stdout.write('.');
      } else {
        console.log(`\nRegion ${r} error:`, err.message);
      }
    }
  }
  console.log('\nFinished testing.');
}

find();
