'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from './SessionContext'
import type { Job } from '@/types/database'

interface RealtimeContextType {
  subscribeToJobs: (callback: (payload: { eventType: string; new: Job; old: Job }) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextType>({
  subscribeToJobs: () => () => {},
})

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const supabase = createClient()
  const callbacksRef = useRef<Set<(payload: { eventType: string; new: Job; old: Job }) => void>>(new Set())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!session?.tenant?.id) return

    const tenantId = session.tenant.id

    // Subscribe to jobs table changes for this tenant
    const channel = supabase
      .channel(`jobs:tenant:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          callbacksRef.current.forEach(cb =>
            cb({
              eventType: payload.eventType,
              new: payload.new as Job,
              old: payload.old as Job,
            })
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [session?.tenant?.id, supabase])

  const subscribeToJobs = (callback: (payload: { eventType: string; new: Job; old: Job }) => void) => {
    callbacksRef.current.add(callback)
    return () => {
      callbacksRef.current.delete(callback)
    }
  }

  return (
    <RealtimeContext.Provider value={{ subscribeToJobs }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  return useContext(RealtimeContext)
}
