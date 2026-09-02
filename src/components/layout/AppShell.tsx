'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'

// Minimum time the loading screen must be visible (ms)
const MIN_DISPLAY_MS = 2500

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading } = useSession()
  const [minTimeDone, setMinTimeDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Show loading screen until BOTH the session is ready AND the minimum time has elapsed
  const showLoader = loading || !minTimeDone

  return (
    <>
      <AppLoadingScreen visible={showLoader} />
      {!showLoader && children}
    </>
  )
}
