'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { ROLE_LABELS, canAccessRoute, cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { 
  Printer,
  LayoutDashboard, 
  FileText, 
  ListChecks, 
  PieChart, 
  Settings, 
  LogOut,
  X
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Jobs', href: '/dashboard/jobs', icon: FileText, roles: ['admin', 'front_desk'] },
  { name: 'Pickup Queue', href: '/dashboard/pickup', icon: ListChecks, roles: ['admin', 'front_desk'] },
  { name: 'Print Queue', href: '/dashboard/queue', icon: Printer, roles: ['admin', 'printer'] },
  { name: 'Finance', href: '/dashboard/finance', icon: PieChart, roles: ['admin', 'accountant'] },
]

export function Sidebar({ mobileOpen, setMobileOpenAction }: { mobileOpen: boolean, setMobileOpenAction: (open: boolean) => void }) {
  const pathname = usePathname()
  const { session, signOut } = useSession()
  
  if (!session) return null

  const role = session.profile.role
  const visibleItems = navItems.filter(item => item.roles.includes(role) && canAccessRoute(role, item.href))

  const handleLogout = async () => {
    await signOut()
  }

  const SidebarContent = (
    <div className="flex h-full flex-col" style={{ background: '#EFEFEF' }}>
      <div className="flex flex-col items-start px-5 py-5 border-b border-slate-100 gap-2">
        <Image
          src="/printflow-logo.jpg"
          alt="PrintFlow"
          width={160}
          height={50}
          priority
          className="object-contain select-none"
          style={{ maxHeight: '44px', width: 'auto' }}
        />
        <p className="text-xs font-semibold text-indigo-600 tracking-wide pl-0.5">{session.tenant.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/dashboard')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpenAction(false)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "text-indigo-700" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute inset-0 bg-indigo-50 border border-indigo-100 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-slate-400")} />
              {item.name}
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-slate-200">
        <div className="px-3 py-3 rounded-xl border mb-2" style={{ background: 'rgba(255,255,255,0.6)', borderColor: '#e0e0e8' }}>
          <p className="text-xs text-slate-500 mb-0.5">
            {new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 17 ? 'Good afternoon,' : 'Good evening,'}
          </p>
          <p className="text-sm font-bold text-slate-900">{session.profile.full_name.split(' ')[0]}</p>
          <p className="text-xs font-medium text-indigo-600 mt-1">{ROLE_LABELS[role]}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 z-50" style={{ background: '#EFEFEF' }}>
        {SidebarContent}
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="relative z-50 lg:hidden">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
            onClick={() => setMobileOpenAction(false)} 
          />
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200" style={{ background: '#EFEFEF' }}
          >
            <div className="absolute right-0 top-0 -mr-12 pt-4">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-slate-200"
                onClick={() => setMobileOpenAction(false)}
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            {SidebarContent}
          </motion.div>
        </div>
      )}
    </>
  )
}
