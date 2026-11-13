'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { ROLE_LABELS, canAccessRoute, cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'
import { 
  Printer,
  Package,
  LayoutDashboard, 
  FileText, 
  ListChecks, 
  PieChart, 
  Receipt,
  LogOut,
  Key,
  Users,
  BriefcaseBusiness,
  Contact2,
  X
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package, roles: ['admin', 'accountant'] },
  { name: 'Jobs', href: '/dashboard/jobs', icon: FileText, roles: ['admin', 'front_desk', 'accountant'] },
  { name: 'Clients & Arrears', href: '/dashboard/admin/clients', icon: Contact2, roles: ['admin', 'accountant'] },
  { name: 'Pickup Queue', href: '/dashboard/pickup', icon: ListChecks, roles: ['admin', 'front_desk'] },
  { name: 'Print Queue', href: '/dashboard/queue', icon: Printer, roles: ['admin', 'printer'] },
  { name: 'Finance', href: '/dashboard/finance', icon: PieChart, roles: ['admin', 'accountant'] },
  { name: 'Expenditure', href: '/dashboard/finance/expenditures', icon: Receipt, roles: ['admin', 'accountant'] },
  { name: 'Staff Activity', href: '/dashboard/staff-activity', icon: Users, roles: ['admin', 'accountant'] },
  { name: 'HR', href: '/dashboard/admin/hr', icon: BriefcaseBusiness, roles: ['admin', 'accountant'] },
]

export function Sidebar({ mobileOpen, setMobileOpenAction }: { mobileOpen: boolean, setMobileOpenAction: (open: boolean) => void }) {
  const pathname = usePathname()
  const { session, signOut } = useSession()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  
  if (!session) return null

  const role = session.profile.role
  const visibleItems = navItems.filter(item => {
    return item.roles.includes(role) && canAccessRoute(role, item.href, session.profile.email)
  })

  const handleLogout = async () => {
    await signOut()
  }

  const SidebarContent = (
    <div className="flex h-full flex-col bg-[#EEF2F6]">
      <div className="flex flex-col items-start px-5 py-5 border-b border-slate-200/80 gap-1.5">
        <Image
          src={session.tenant?.logo_url || process.env.NEXT_PUBLIC_APP_LOGO || "/Print_DPI_Logo.png"}
          alt={process.env.NEXT_PUBLIC_APP_NAME || "PrintDpi"}
          width={160}
          height={50}
          priority
          unoptimized={!!session.tenant?.logo_url}
          className="object-contain select-none rounded-lg"
          style={{ maxHeight: '44px', width: 'auto' }}
        />
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">{session.tenant.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/dashboard')
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              onClick={() => setMobileOpenAction(false)}
              className={cn(
                "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                isActive 
                  ? "text-slate-900 shadow-xs bg-white border border-slate-200/60" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <item.icon className={cn("w-4.5 h-4.5 shrink-0 transition-colors", isActive ? "text-slate-900" : "text-slate-400")} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </div>

      <div className="p-3.5 border-t border-slate-200/80">
        <div className="px-3.5 py-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs mb-2">
          <p className="text-[11px] text-slate-400 mb-0.5 font-medium" suppressHydrationWarning>
            {new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 17 ? 'Good afternoon,' : 'Good evening,'}
          </p>
          <p className="text-sm font-bold text-slate-900">{session.profile.full_name.split(' ')[0]}</p>
          <p className="text-xs font-semibold text-sky-700 mt-0.5">
            {ROLE_LABELS[role]}
          </p>
        </div>
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="flex items-center w-full gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-colors"
        >
          <Key className="w-4 h-4 text-slate-400" />
          Change Password
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center w-full gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          Sign Out
        </button>
      </div>
      
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-slate-200/90 z-50 bg-[#EEF2F6]">
        {SidebarContent}
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="relative z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-slate-950/50" 
            onClick={() => setMobileOpenAction(false)} 
          />
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-[#EEF2F6]"
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
