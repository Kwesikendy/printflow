const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://zrnnrnnzywqnvdmnpbws.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpybm5ybm56eXdxbnZkbW5wYndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI4NDM1MywiZXhwIjoyMTAzODYwMzUzfQ.foPonjFDuAA0A0Ou3AJaJCpJbfSjt87pdp2eKankN3Q'
)

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1)
  console.log('Error:', error)
  console.log('Data:', data)
}
check()
