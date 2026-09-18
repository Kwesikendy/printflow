const { Client } = require('pg');

const regions = ['eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'us-east-1', 'us-east-2', 'us-west-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'sa-east-1'];

async function testRegions() {
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.zrnnrnnzywqnvdmnpbws:PRINTFLOW11@@${host}:6543/postgres`;
    const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      console.log(`>>> SUCCESS in region ${r}!`);
      const res = await client.query('SELECT 1 as connected');
      console.log('Query result:', res.rows);
      await client.end();
      return r;
    } catch (err) {
      // console.log(`Failed ${r}:`, err.message);
    }
  }
  console.log('Could not connect to any pooler region.');
}

testRegions();
