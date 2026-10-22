'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Search, 
  Users, 
  FileText, 
  Phone, 
  ExternalLink, 
  Filter, 
  AlertCircle,
  Clock
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export interface OutstandingDebtor {
  name: string
  phone: string | null
  totalOutstanding: number
  unpaidInvoicesCount: number
  invoiceNumbers: string[]
  latestIssuedAt: string
}

interface OutstandingBalanceBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  contributors: OutstandingDebtor[]
  totalOutstanding: number
  filterLabel: string
  onSelectCustomer: (customerName: string, customerPhone?: string | null) => void
  onFilterCustomer?: (customerName: string) => void
}

export function OutstandingBalanceBreakdownModal({
  isOpen,
  onClose,
  contributors,
  totalOutstanding,
  filterLabel,
  onSelectCustomer,
  onFilterCustomer,
}: OutstandingBalanceBreakdownModalProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'balance' | 'invoices' | 'name'>('balance')

  const filteredAndSorted = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = contributors.filter(c => {
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    })

    list.sort((a, b) => {
      if (sortBy === 'balance') return b.totalOutstanding - a.totalOutstanding
      if (sortBy === 'invoices') return b.unpaidInvoicesCount - a.unpaidInvoicesCount
      return a.name.localeCompare(b.name)
    })

    return list
  }, [contributors, search, sortBy])

  const topDebtor = contributors.length > 0 ? contributors[0] : null

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 z-10"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-white to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Receivables Breakdown
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  Outstanding Balance Contributors
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Clients with pending balances for <span className="font-semibold text-slate-700">{filterLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stat Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/70 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Total Outstanding</p>
                <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{formatCurrency(totalOutstanding)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{contributors.length} total debtors</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Unpaid Invoices</p>
                <p className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">
                  {contributors.reduce((acc, c) => acc + c.unpaidInvoicesCount, 0)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Across all clients</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Largest Debtor</p>
                <p className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
                  {topDebtor ? topDebtor.name : 'None'}
                </p>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                  {topDebtor ? `${formatCurrency(topDebtor.totalOutstanding)} (${totalOutstanding > 0 ? ((topDebtor.totalOutstanding / totalOutstanding) * 100).toFixed(0) : 0}%)` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="px-5 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search debtor name or phone..."
                className="w-full pl-9 pr-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white placeholder-slate-400 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
              <span className="text-slate-500 font-medium whitespace-nowrap">Sort by:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSortBy('balance')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    sortBy === 'balance' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Balance
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('invoices')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    sortBy === 'invoices' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Invoices
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('name')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    sortBy === 'name' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Name
                </button>
              </div>
            </div>
          </div>

          {/* Debtors List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-4">
            {filteredAndSorted.map((debtor, index) => {
              const percentage = totalOutstanding > 0 
                ? (debtor.totalOutstanding / totalOutstanding) * 100 
                : 0

              return (
                <div
                  key={`${debtor.name}-${index}`}
                  className="p-3 sm:p-4 rounded-xl hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Rank indicator */}
                    <div className="w-7 h-7 shrink-0 rounded-lg bg-amber-50 text-amber-700 font-black text-xs flex items-center justify-center border border-amber-200/50">
                      #{index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-sm truncate">{debtor.name}</p>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {debtor.unpaidInvoicesCount} {debtor.unpaidInvoicesCount === 1 ? 'invoice' : 'invoices'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        {debtor.phone && (
                          <span className="flex items-center gap-1 text-slate-600 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {debtor.phone}
                          </span>
                        )}
                        {debtor.latestIssuedAt && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            Latest: {formatDate(debtor.latestIssuedAt)}
                          </span>
                        )}
                      </div>

                      {/* Contribution Progress Bar */}
                      <div className="mt-2 flex items-center gap-2 max-w-sm">
                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Balance & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <p className="text-base sm:text-lg font-black text-amber-600 tracking-tight">
                        {formatCurrency(debtor.totalOutstanding)}
                      </p>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Balance due</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onFilterCustomer && (
                        <button
                          type="button"
                          onClick={() => {
                            onFilterCustomer(debtor.name)
                            onClose()
                          }}
                          title="Filter table below by this client"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Filter className="w-3 h-3 text-slate-500" />
                          <span className="hidden sm:inline">Filter</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectCustomer(debtor.name, debtor.phone)
                        }}
                        title="View Full Customer Statement & Ledger"
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-xs"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Statement</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredAndSorted.length === 0 && (
              <div className="py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No debtors match your search</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing the search query.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredAndSorted.length} of {contributors.length} clients with unpaid balances</span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
