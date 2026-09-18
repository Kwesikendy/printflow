const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.zrnnrnnzywqnvdmnpbws',
    password: 'PRINTFLOW11@', // directly as string, not URL parsed!
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('>>> CONNECTED TO SUPABASE POOLER!');
    const res = await client.query('SELECT current_database(), now()');
    console.log('Result:', res.rows);
    await client.end();
    return true;
  } catch (err) {
    console.error('Error connecting to pooler:', err.message);
    return false;
  }
}

test();
