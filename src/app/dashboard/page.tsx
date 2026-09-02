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

  if (!session || session.profile.role !== 'admin') {
     return <PageLoader />
  }

  // Admin gets a real dashboard
  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">System overview for {session.tenant.name}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card">
          <p className="text-sm font-medium text-slate-500">Total Jobs</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">Loading...</p>
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-slate-500">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">Loading...</p>
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-slate-500">Active Users</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">Loading...</p>
        </div>
      </div>
    </div>
  )
}
