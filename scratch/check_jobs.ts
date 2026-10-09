import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkJobs() {
  const { data: firstJob, error: error1 } = await supabase
    .from('jobs')
    .select('job_number, customer_name, created_at')
    .order('created_at', { ascending: true })
    .limit(1)

  const { data: lastJob, error: error2 } = await supabase
    .from('jobs')
    .select('job_number, customer_name, created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  const { count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })

  console.log('Total Jobs:', count)
  console.log('First Job (Oldest):', firstJob?.[0])
  console.log('Last Job (Newest):', lastJob?.[0])
}

checkJobs()
