'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BriefcaseBusiness, LayoutDashboard, Package, Users, Settings, CloudUpload, Contact2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSession } from '@/contexts/SessionContext'

const adminTabs = [
  { name: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Clients & Arrears', href: '/dashboard/admin/clients', icon: Contact2 },
  { name: 'Products & Pricing', href: '/dashboard/admin/products', icon: Package },
  { name: 'Users', href: '/dashboard/admin/users', icon: Users },
  { name: 'HR', href: '/dashboard/admin/hr', icon: BriefcaseBusiness },
  { name: 'Backups', href: '/dashboard/admin/backups', icon: CloudUpload },
  { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { session } = useSession()
  const [optimisticTab, setOptimisticTab] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticTab(null)
  }, [pathname])

  if (pathname.startsWith('/dashboard/admin/inventory')) {
    const isInventoryAllowed = session && (
      session.profile.role === 'admin' ||
      session.profile.role === 'accountant'
    )
    if (!isInventoryAllowed) return null
    return <>{children}</>
  }

  const isAdmin = session?.profile.role === 'admin'
  const isAccountantHr = session?.profile.role === 'accountant' && pathname.startsWith('/dashboard/admin/hr')
  const isAccountantClients = session?.profile.role === 'accountant' && pathname.startsWith('/dashboard/admin/clients')
  if (session && !isAdmin && !isAccountantHr && !isAccountantClients) {
    return null
  }

  const visibleTabs = isAdmin 
    ? adminTabs 
    : adminTabs.filter(tab => tab.href === '/dashboard/admin/hr' || tab.href === '/dashboard/admin/clients')

  const getPageTitle = () => {
    if (isAdmin) return 'Admin Panel'
    if (pathname.startsWith('/dashboard/admin/clients')) return 'Clients & Arrears'
    return 'HR Workspace'
  }

  const getPageSubtitle = () => {
    if (isAdmin) return 'Manage people, payroll, tenant settings, users, clients & arrears, and product catalog.'
    if (pathname.startsWith('/dashboard/admin/clients')) return 'Track customer profiles, register historical clients, and manage debtor arrears.'
    return 'View employee information, leave, and payroll.'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">{getPageTitle()}</h1>
        <p className="text-slate-500 text-sm mt-1">{getPageSubtitle()}</p>
      </div>

      {/* Tactile Soft-UI Debossed Segmented Tab Track */}
      <div className="mb-8 flex overflow-x-auto w-full max-w-full md:inline-flex p-1.5 rounded-2xl neu-track relative hide-scrollbar gap-1">
        {visibleTabs.map(tab => {
          const isActive = (optimisticTab || pathname) === tab.href
          return (
            <Link
              key={tab.name}
              href={tab.href}
              prefetch={true}
              onClick={() => setOptimisticTab(tab.href)}
              className={`relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-150 z-10 whitespace-nowrap shrink-0 ${
                isActive 
                  ? 'text-slate-900 bg-white shadow-xs border border-white/80 font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-sky-700' : 'text-slate-400'}`} />
              {tab.name}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
