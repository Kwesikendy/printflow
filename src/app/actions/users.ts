'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Role, PrintRoom } from '@/types/database'

export interface CreateUserResult {
  success?: boolean
  error?: string
}

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const email = formData.get('email') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as Role
  const printRoom = formData.get('print_room') as string | null
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const department = (formData.get('department') as string | null)?.trim() || null
  const jobTitle = (formData.get('job_title') as string | null)?.trim() || null
  const employmentType = (formData.get('employment_type') as string | null) || 'full_time'
  const employmentStartDate = (formData.get('employment_start_date') as string | null) || null

  if (!email || !fullName || !role) {
    return { error: 'All fields are required.' }
  }

  if (!['front_desk', 'printer', 'accountant', 'admin', 'cleaner', 'rider'].includes(role)) {
    return { error: 'Please select a valid role.' }
  }

  if (!['full_time', 'part_time', 'contract'].includes(employmentType)) {
    return { error: 'Please select a valid employment type.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null, error: any }

  if (!callerProfile || !['admin', 'accountant'].includes(callerProfile.role)) {
    return { error: 'Only admins and accountants can add users.' }
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
      print_room: role === 'printer' && printRoom ? printRoom : null,
      phone,
      department,
      job_title: jobTitle,
      employment_type: employmentType,
      employment_start_date: employmentStartDate || null,
    } as any)

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id)
    return { error: `Failed to create profile: ${profileError.message}` }
  }

  const { error: leaveError } = await (supabaseAdmin.from('employee_leave_balances') as any)
    .insert({
      tenant_id: (callerProfile as any).tenant_id,
      employee_id: inviteData.user.id,
      leave_year: new Date().getFullYear(),
      entitlement: 20,
      used_days: 0,
    })

  if (leaveError) {
    await supabaseAdmin.from('profiles').delete().eq('id', inviteData.user.id)
    await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id)
    return { error: `Failed to create leave balance: ${leaveError.message}` }
  }

  revalidatePath('/dashboard/admin/users')
  revalidatePath('/dashboard/admin/hr')
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
  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}

export async function updateUserPrintRoom(userId: string, printRoom: PrintRoom | null): Promise<CreateUserResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null, error: any }

  if (!callerProfile || callerProfile.role !== 'admin') {
    return { error: 'Only admins can update user settings.' }
  }

  const supabaseAdmin = createServiceClient()

  const { error } = await (supabaseAdmin.from('profiles') as any)
    .update({ print_room: printRoom })
    .eq('id', userId)

  if (error) {
    return { error: `Failed to update user: ${error.message}` }
  }

  revalidatePath('/dashboard/admin/users')
  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}

export async function updateEmployeeDepartment(userId: string, department: string | null): Promise<CreateUserResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null, error: any }

  if (!callerProfile || callerProfile.role !== 'admin') {
    return { error: 'Only admins can update employee assignments.' }
  }

  const supabaseAdmin = createServiceClient()
  const { error } = await (supabaseAdmin.from('profiles') as any)
    .update({ department: department?.trim() || null })
    .eq('id', userId)
    .eq('tenant_id', callerProfile.tenant_id)

  if (error) return { error: `Failed to update assignment: ${error.message}` }

  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}

export async function updateEmployeeLeave(userId: string, usedDays: number): Promise<CreateUserResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null, error: any }

  if (!callerProfile || callerProfile.role !== 'admin') {
    return { error: 'Only admins can update leave balances.' }
  }

  if (!Number.isInteger(usedDays) || usedDays < 0 || usedDays > 20) {
    return { error: 'Leave used must be a whole number from 0 to 20.' }
  }

  const supabaseAdmin = createServiceClient()
  const { data: employee } = await (supabaseAdmin.from('profiles') as any)
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', callerProfile.tenant_id)
    .maybeSingle()

  if (!employee) return { error: 'Employee not found in your tenant.' }

  const leaveYear = new Date().getFullYear()
  const { error } = await (supabaseAdmin.from('employee_leave_balances') as any)
    .upsert({
      tenant_id: callerProfile.tenant_id,
      employee_id: userId,
      leave_year: leaveYear,
      entitlement: 20,
      used_days: usedDays,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,leave_year' })

  if (error) return { error: `Failed to update leave balance: ${error.message}` }

  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}
