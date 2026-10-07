'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'

const MIN_DISPLAY_MS = 2500

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPrintRoute = pathname?.startsWith('/print')
  const { loading, session } = useSession()
  const [minTimeDone, setMinTimeDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const showLoader = !isPrintRoute && (loading || !minTimeDone)

  return (
    <>
      {!isPrintRoute && (
        <AppLoadingScreen
          visible={showLoader}
          tenantName={session?.tenant?.name}
          logoUrl={session?.tenant?.logo_url}
        />
      )}
      {(!showLoader || isPrintRoute) && children}
    </>
  )
}
