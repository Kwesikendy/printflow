import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { type Database } from '@/types/database'
import { createMockSupabaseClient, isSupabaseConfigured } from './mock'

export async function createClient(): Promise<ReturnType<typeof createServerClient<Database>>> {
  if (!isSupabaseConfigured()) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createServerClient<Database>>
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie setting will be handled by middleware
          }
        },
      },
    }
  )
}

// Service role client — bypasses RLS entirely.
// Uses the plain supabase-js client (NOT the SSR cookie client) so the service
// role JWT is sent directly without any user-session interference.
export function createServiceClient(): ReturnType<typeof createSupabaseJsClient<Database>> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createSupabaseJsClient<Database>>
  }

  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
