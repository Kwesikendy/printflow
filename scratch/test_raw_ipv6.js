const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: '2a05:d018:837:ae02:c9e8:759d:8aba:dd77',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'PRINTFLOW11@',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('CONNECTED TO POSTGRES DIRECTLY VIA IPV6 ADDRESS!');
    const res = await client.query('SELECT current_database(), now()');
    console.log('Result:', res.rows);
    await client.end();
  } catch (err) {
    console.error('Error connecting:', err);
  }
}

test();
