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
        try {
          // New user via OAuth — provision a profile on the default tenant
          const supabaseAdmin = createServiceClient()

          const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .single() as { data: { id: string } | null, error: any }
            
          if (tenant) {
            const { error: profileError } = await supabaseAdmin
              .from('profiles')
              .insert({
                id: user.id,
                tenant_id: tenant.id,
                role: 'front_desk' as Role,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
                email: user.email ?? '',
                is_active: true,
              } as any)
              
            if (!profileError) {
              return NextResponse.redirect(`${origin}${getDefaultDashboardPath('front_desk')}`)
            } else {
              console.error("Profile creation error:", profileError)
              return NextResponse.redirect(`${origin}/login?error=Could not create user profile`)
            }
          } else {
            console.error("No default tenant found")
            return NextResponse.redirect(`${origin}/login?error=System misconfigured: No tenant`)
          }
        } catch (err: any) {
          console.error("OAuth provisioning error (check SUPABASE_SERVICE_ROLE_KEY):", err)
          return NextResponse.redirect(`${origin}/login?error=Server configuration error (missing admin key)`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}
