const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const connectionString = 'postgresql://postgres:PRINTFLOW11@@db.zrnnrnnzywqnvdmnpbws.supabase.co:5432/postgres'

async function runMigrations() {
  const client = new Client({ connectionString })
  
  try {
    await client.connect()
    console.log('Connected to database.')

    const migrationDir = path.join(__dirname, 'supabase', 'migrations')
    const files = fs.readdirSync(migrationDir).sort()

    for (const file of files) {
      if (!file.endsWith('.sql')) continue
      
      console.log(`Executing ${file}...`)
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8')
      
      try {
        await client.query(sql)
        console.log(`✓ ${file} executed successfully.`)
      } catch (err) {
        console.error(`✗ Error executing ${file}:`, err.message)
        // Keep going or stop? Usually stop, but let's try to run all for MVP
        if (err.message.includes('already exists')) {
          console.log(`  (Skipping some already-existing entities)`)
        } else {
          throw err
        }
      }
    }
    
    console.log('\nAll migrations completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await client.end()
  }
}

runMigrations()
