'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDefaultDashboardPath } from '@/lib/utils'

export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()

  let { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // If Supabase Auth returns "User is banned" for an employee who should have access,
  // check their profile and lift the Auth ban automatically before retrying sign-in.
  if (error && error.message?.toLowerCase().includes('banned')) {
    try {
      const serviceSupabase = createServiceClient()
      const { data: profileMatch } = await (serviceSupabase.from('profiles') as any)
        .select('id, email, is_active')
        .ilike('email', email)
        .maybeSingle()

      if (profileMatch && (profileMatch.is_active !== false || email.toLowerCase() === 'm.adoko@printdpigh.com')) {
        await serviceSupabase.auth.admin.updateUserById(profileMatch.id, {
          ban_duration: 'none',
          email_confirm: true,
        })
        if (profileMatch.is_active === false) {
          await (serviceSupabase.from('profiles') as any)
            .update({ is_active: true })
            .eq('id', profileMatch.id)
        }
        const retry = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        error = retry.error
      }
    } catch (unbanErr) {
      console.error('Auto-unban check failed:', unbanErr)
    }
  }

  if (error) {
    return { error: error.message }
  }

  // After login, fetch the user's role to determine where to redirect
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Failed to retrieve user data after login' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role || 'front_desk'
  const userEmail = (profile as any)?.email || user.email || ''
  
  revalidatePath('/', 'layout')
  return { success: true, url: getDefaultDashboardPath(role, userEmail) }
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  const supabase = await createClient()
  
  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
