const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://zrnnrnnzywqnvdmnpbws.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpybm5ybm56eXdxbnZkbW5wYndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI4NDM1MywiZXhwIjoyMTAzODYwMzUzfQ.foPonjFDuAA0A0Ou3AJaJCpJbfSjt87pdp2eKankN3Q'
)

const usersToCreate = [
  { email: 'admin@demo.com', role: 'admin', name: 'Alice Admin' },
  { email: 'desk@demo.com', role: 'front_desk', name: 'Frank Frontdesk' },
  { email: 'printer@demo.com', role: 'printer', name: 'Peter Printer' },
  { email: 'accountant@demo.com', role: 'accountant', name: 'Anna Accountant' },
]

async function createUsers() {
  const tenantId = '00000000-0000-0000-0000-000000000001'

  for (const u of usersToCreate) {
    console.log(`Creating user ${u.email}...`)
    
    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'password123',
      email_confirm: true // auto confirm
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`User ${u.email} already exists in Auth. Updating profile...`)
        // We could fetch the user id if needed, but let's assume if it fails we skip for now.
        // For simplicity, we just log it.
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existing = existingUsers.users.find(eu => eu.email === u.email)
        if (existing) {
          await updateProfile(existing.id, tenantId, u.role, u.name, u.email)
        }
      } else {
        console.error('Failed to create auth user:', authError.message)
      }
      continue
    }

    const userId = authUser.user.id
    console.log(`Auth user created: ${userId}`)

    // 2. Insert/Update into public.profiles
    await updateProfile(userId, tenantId, u.role, u.name, u.email)
  }
}

async function updateProfile(userId, tenantId, role, name, email) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        tenant_id: tenantId,
        role: role,
        full_name: name,
        email: email,
        is_active: true
      })

    if (profileError) {
      console.error('Failed to insert profile:', profileError.message)
    } else {
      console.log(`Profile mapped for ${name} (${role})`)
    }
}

createUsers().then(() => console.log('Done!'))
