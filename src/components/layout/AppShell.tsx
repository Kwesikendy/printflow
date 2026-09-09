'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'

const MIN_DISPLAY_MS = 2500

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, session } = useSession()
  const [minTimeDone, setMinTimeDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const showLoader = loading || !minTimeDone

  return (
    <>
      <AppLoadingScreen
        visible={showLoader}
        tenantName={session?.tenant?.name}
        logoUrl={session?.tenant?.logo_url}
      />
      {!showLoader && children}
    </>
  )
}
