import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getDefaultDashboardPath } from '@/lib/utils'
import type { Role } from '@/types/database'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session) {
      const user = session.user
      
      // Check if user has a profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single() as { data: { role: string } | null, error: any }
        
      if (profile) {
        return NextResponse.redirect(`${origin}${getDefaultDashboardPath(profile.role as Role)}`)
      } else {
        // User authenticated via Google but has no profile in the system.
        // We do not allow open registration. The admin must invite them first.
        try {
          const supabaseAdmin = createServiceClient()
          // Clean up the automatically created auth user since they aren't allowed
          await supabaseAdmin.auth.admin.deleteUser(user.id)
        } catch (e) {
          console.error("Failed to cleanup unauthorized user:", e)
        }
        
        return NextResponse.redirect(`${origin}/login?error=You are not registered. Please ask an administrator to invite you.`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}
