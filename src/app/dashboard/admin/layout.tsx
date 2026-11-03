'use client'

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
    return 'HR workspace'
  }

  const getPageSubtitle = () => {
    if (isAdmin) return 'Manage people, payroll, tenant settings, users, clients & arrears, and product catalog.'
    if (pathname.startsWith('/dashboard/admin/clients')) return 'Track customer profiles, register historical clients, and manage debtor arrears.'
    return 'View employee information, leave, and payroll.'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">{getPageTitle()}</h1>
        <p className="text-slate-500 mt-1">{getPageSubtitle()}</p>
      </div>

      <div className="mb-8 flex overflow-x-auto w-full max-w-full md:inline-flex space-x-1 bg-slate-900/5 p-1 rounded-xl shadow-inner border border-slate-900/5 relative hide-scrollbar">
        {visibleTabs.map(tab => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-2 text-sm font-semibold rounded-lg transition-colors z-10 whitespace-nowrap shrink-0 ${
                isActive 
                  ? 'text-slate-900' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="admin-tab-indicator"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/60 -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : ''}`} />
              {tab.name}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
