const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:PRINTFLOW11@@db.zrnnrnnzywqnvdmnpbws.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '014_five_pm_workday_reset.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing 014_five_pm_workday_reset.sql...');
    await client.query(sql);
    console.log('Successfully applied 014_five_pm_workday_reset.sql');
  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await client.end();
  }
}

run();
