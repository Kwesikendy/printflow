'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { RealtimeProvider } from '@/contexts/RealtimeContext'
import { Menu } from 'lucide-react'
import { useSession } from '@/contexts/SessionContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { session } = useSession()

  if (!session) {
    return null
  }

  return (
    <RealtimeProvider>
      <div className="min-h-screen">
        <Sidebar mobileOpen={mobileOpen} setMobileOpenAction={setMobileOpen} />
        
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {/* Mobile header */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/40 bg-white/60 backdrop-blur-xl px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-slate-600 hover:text-slate-900 transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex-1 text-sm font-semibold leading-6 text-slate-800">
              {session.tenant.name}
            </div>
          </div>

          <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </RealtimeProvider>
  )
}
