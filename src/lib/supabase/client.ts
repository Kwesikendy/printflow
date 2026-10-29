import { createBrowserClient } from '@supabase/ssr'
import { type Database } from '@/types/database'
import { createMockSupabaseClient, isSupabaseConfigured } from './mock'

export function createClient(): ReturnType<typeof createBrowserClient<Database>> {
  if (!isSupabaseConfigured()) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createBrowserClient<Database>>
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
