const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: 'db.zrnnrnnzywqnvdmnpbws.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'PRINTFLOW11@',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('CONNECTED TO POSTGRES VIA IPV6!');
    const res = await client.query('SELECT current_database(), now()');
    console.log('Result:', res.rows);
    await client.end();
  } catch (err) {
    console.error('Error connecting:', err);
  }
}

test();
