'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Users, Settings } from 'lucide-react'

const adminTabs = [
  { name: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Products & Pricing', href: '/dashboard/admin/products', icon: Package },
  { name: 'Users', href: '/dashboard/admin/users', icon: Users },
  { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 mt-1">Manage tenant settings, users, and product catalog.</p>
      </div>

      <div className="mb-6 flex space-x-1 bg-slate-50 p-1 rounded-lg border border-indigo-100 inline-flex">
        {adminTabs.map(tab => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive 
                  ? 'bg-indigo-600 text-slate-900 shadow' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
