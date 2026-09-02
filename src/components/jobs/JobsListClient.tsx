'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Search, FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export function JobsListClient({ initialJobs, initialQuery }: { initialJobs: any[], initialQuery: string }) {
  const router = useRouter()
  const [isFocused, setIsFocused] = useState(false)

  // In a real app with realtime, we'd sync jobs here. Since page.tsx fetches them, we just render what we get.
  // The search form submission triggers a full page navigation.

  return (
    <div className="space-y-6">
      {/* Floating Modern Search Bar */}
      <div className="relative max-w-2xl">
        <motion.div 
          animate={{
            boxShadow: isFocused 
              ? '0 10px 25px -5px rgba(99, 102, 241, 0.15), 0 8px 10px -6px rgba(99, 102, 241, 0.1)' 
              : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
          }}
          className="relative bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl overflow-hidden transition-colors"
        >
          <div className="flex items-center px-4 py-3">
            <motion.div 
              animate={{ color: isFocused ? '#4f46e5' : '#94a3b8', scale: isFocused ? 1.05 : 1 }}
              className="mr-3"
            >
              <Search className="w-5 h-5" />
            </motion.div>
            <form method="GET" action="/dashboard/jobs" className="flex-1 flex">
              <input
                type="text"
                name="q"
                defaultValue={initialQuery}
                placeholder="Search by Job No. or Customer..."
                className="w-full bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none text-base"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              {/* Hidden submit so Enter key works */}
              <button type="submit" className="hidden">Search</button>
            </form>
          </div>
        </motion.div>
      </div>

      {/* Jobs List Container */}
      <div className="bg-white/60 backdrop-blur-2xl rounded-2xl shadow-premium-card border border-white/80 overflow-hidden relative">
        <div className="table-container">
          <table className="table-standard w-full">
            <thead className="bg-slate-50/50 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10">
              <tr>
                <th className="pl-6">Job No.</th>
                <th>Customer</th>
                <th>Product</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            
            <AnimatePresence>
              {initialJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0 border-none">
                    <EmptyState 
                      icon={<FileText />}
                      title="No jobs found"
                      description={initialQuery ? "No jobs matched your search criteria." : "Get started by creating your first print job."}
                      action={
                        !initialQuery && (
                          <Link href="/dashboard/jobs/new">
                            <Button variant="outline">Create Job</Button>
                          </Link>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                <tbody className="divide-y divide-slate-100/50">
                  {initialJobs.map((job, index) => (
                    <motion.tr 
                      key={job.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                      whileHover={{ 
                        backgroundColor: "rgba(248, 250, 252, 0.8)",
                        scale: 1.002,
                        transition: { duration: 0.15 }
                      }}
                      onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                      className="group cursor-pointer"
                    >
                      <td className="pl-6 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {job.job_number}
                      </td>
                      <td className="font-medium text-slate-700">{job.customer_name}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200/60 shadow-sm">
                          {job.product_types?.name}
                        </span>
                      </td>
                      <td className="text-right font-bold text-emerald-600">
                        {formatCurrency(job.line_total)}
                      </td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="text-slate-500 text-sm">
                        {formatDateTime(job.created_at)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              )}
            </AnimatePresence>
          </table>
        </div>
      </div>
    </div>
  )
}
