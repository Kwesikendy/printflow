const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:PRINTFLOW11@@db.zrnnrnnzywqnvdmnpbws.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '003_functions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing SQL...');
    await client.query(sql);
    console.log('Successfully applied 003_functions.sql');
  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await client.end();
  }
}

run();
