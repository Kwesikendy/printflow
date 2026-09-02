'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export interface CreateUserResult {
  success?: boolean
  error?: string
}

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const email = formData.get('email') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as string

  if (!email || !fullName || !role) {
    return { error: 'All fields are required.' }
  }

  // We need the service role key to invite users via the admin API
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get calling user's tenant_id
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return { error: 'Only admins can add users.' }
  }

  // Invite the user by email. Supabase will send them an invite link to set their password.
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?type=invite`,
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  if (!inviteData.user) {
    return { error: 'Failed to create user account.' }
  }

  // Create the profile row for this new user
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: inviteData.user.id,
      tenant_id: callerProfile.tenant_id,
      role,
      full_name: fullName,
      email,
      is_active: true,
    })

  if (profileError) {
    // Rollback: delete the auth user if profile creation failed
    await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id)
    return { error: `Failed to create profile: ${profileError.message}` }
  }

  revalidatePath('/dashboard/admin/users')
  return { success: true }
}
