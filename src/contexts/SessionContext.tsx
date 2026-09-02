'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserSession, Profile, Tenant } from '@/types/database'

interface SessionContextType {
  session: UserSession | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadSession = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSession(null)
        return
      }

      // Load profile + tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setSession(null)
        return
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', (profile as Profile).tenant_id)
        .single()

      if (!tenant) {
        setSession(null)
        return
      }

      setSession({
        user: { id: user.id, email: user.email! },
        profile: profile as Profile,
        tenant: tenant as Tenant,
      })
    } catch (error) {
      console.error('Session load error:', error)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN') {
          await loadSession()
        } else if (event === 'SIGNED_OUT') {
          setSession(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadSession, supabase.auth])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    window.location.href = '/login'
  }, [supabase.auth])

  return (
    <SessionContext.Provider value={{ session, loading, signOut, refreshSession: loadSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
