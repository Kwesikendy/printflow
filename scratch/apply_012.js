const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = '${process.env.DATABASE_URL || ""}';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '012_print_rooms.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing 012_print_rooms.sql...');
    await client.query(sql);
    console.log('Successfully applied 012_print_rooms.sql');
  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await client.end();
  }
}

run();
