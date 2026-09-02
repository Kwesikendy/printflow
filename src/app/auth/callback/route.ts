import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getDefaultDashboardPath } from '@/lib/utils'

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
        .single()
        
      if (profile && 'role' in profile) {
        // Existing user, redirect to their dashboard
        return NextResponse.redirect(`${origin}${getDefaultDashboardPath(profile.role as string)}`)
      } else {
        // New user from OAuth. Assign them to the default tenant.
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
          
        if (tenant && 'id' in tenant) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              tenant_id: (tenant as { id: string }).id,
              role: 'front_desk',
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
              email: user.email,
              is_active: true
            })
            
          if (!profileError) {
            return NextResponse.redirect(`${origin}${getDefaultDashboardPath('front_desk')}`)
          } else {
            console.error("Profile creation error:", profileError)
          }
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}
