'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { getDefaultDashboardPath } from '@/lib/utils'
import { PageLoader } from '@/components/ui/EmptyState'

export default function DashboardIndex() {
  const { session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) {
      const defaultPath = getDefaultDashboardPath(session.profile.role)
      // Only redirect if default path is different from current to prevent loops
      if (defaultPath !== '/dashboard') {
         router.replace(defaultPath)
      }
    }
  }, [session, router])

  return <PageLoader />
}
