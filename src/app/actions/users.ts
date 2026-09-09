'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Role } from '@/types/database'

export interface CreateUserResult {
  success?: boolean
  error?: string
}

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const email = formData.get('email') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as Role

  if (!email || !fullName || !role) {
    return { error: 'All fields are required.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null, error: any }

  if (!callerProfile || callerProfile.role !== 'admin') {
    return { error: 'Only admins can add users.' }
  }

  const supabaseAdmin = createServiceClient()

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?type=invite`,
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  if (!inviteData.user) {
    return { error: 'Failed to create user account.' }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: inviteData.user.id,
      tenant_id: (callerProfile as any).tenant_id,
      role: role as any,
      full_name: fullName,
      email,
      is_active: true,
    } as any)

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id)
    return { error: `Failed to create profile: ${profileError.message}` }
  }

  revalidatePath('/dashboard/admin/users')
  return { success: true }
}

export async function deleteUser(userId: string): Promise<CreateUserResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Prevent self-deletion
  if (user.id === userId) return { error: 'You cannot delete your own account.' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null, error: any }

  if (!callerProfile || callerProfile.role !== 'admin') {
    return { error: 'Only admins can delete users.' }
  }

  const supabaseAdmin = createServiceClient()

  // Delete auth user (this cascades to profiles via DB trigger or FK)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) return { error: deleteError.message }

  // Also delete profile explicitly (in case no cascade)
  await supabaseAdmin.from('profiles').delete().eq('id', userId)

  revalidatePath('/dashboard/admin/users')
  return { success: true }
}
