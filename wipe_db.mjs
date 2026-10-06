import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Need service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function wipeData() {
  console.log("Starting database wipe of all testing transactional data...")

  // Delete in order to respect foreign key constraints
  const tables = [
    'job_status_events',
    'payments',
    'invoices',
    'jobs',
    'job_groups',
    'profiles'
  ]

  for (const table of tables) {
    console.log(`Wiping table: ${table}...`)
    // Delete all records by checking id is not null
    const { error } = await supabase.from(table).delete().not('id', 'is', null)
    
    if (error) {
      console.error(`Error wiping ${table}:`, error.message)
    } else {
      console.log(`Successfully cleared ${table}.`)
    }
  }

  console.log("Fetching all user accounts...")
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error("Error fetching users:", userError.message)
  } else if (userData && userData.users) {
    for (const u of userData.users) {
      console.log(`Deleting user account: ${u.email}...`)
      const { error: delError } = await supabase.auth.admin.deleteUser(u.id)
      if (delError) {
        console.error(`Error deleting user ${u.email}:`, delError.message)
      } else {
        console.log(`Deleted user ${u.email}.`)
      }
    }
  }

  console.log("\n========================================")
  console.log("WIPE COMPLETE! The system is now a clean slate.")
  console.log("All test jobs, invoices, and payments have been removed.")
  console.log("NOTE: We deliberately KEPT your product_types (configurations) intact.")
  console.log("========================================\n")
}

wipeData()
