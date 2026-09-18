'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Search, User, Phone, ArrowRight, CheckCircle, AlertCircle, Clock, Loader2, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { searchTransactionCustomers, getRecentTransactionCustomers, type CustomerTransactionSummary } from '@/app/actions/finance'

interface CustomerSearchSectionProps {
  onSelectCustomer: (customerName: string, customerPhone?: string | null) => void
  selectedCustomerName?: string | null
}

export function CustomerSearchSection({ onSelectCustomer, selectedCustomerName }: CustomerSearchSectionProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [results, setResults] = useState<CustomerTransactionSummary[]>([])
  const [recentCustomers, setRecentCustomers] = useState<CustomerTransactionSummary[]>([])
  const [isSearching, startSearchTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load recent customers on initial mount for quick-access chips
  useEffect(() => {
    getRecentTransactionCustomers().then((data) => {
      setRecentCustomers(data.slice(0, 6))
    }).catch(console.error)
  }, [])

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length >= 1) {
      const timer = setTimeout(() => {
        startSearchTransition(async () => {
          const res = await searchTransactionCustomers(trimmed)
          setResults(res)
        })
      }, 250)
      return () => clearTimeout(timer)
    } else {
      setResults([])
    }
  }, [query])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (customer: CustomerTransactionSummary) => {
    setQuery(customer.name)
    setIsFocused(false)
    onSelectCustomer(customer.name, customer.phone)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsFocused(false)
  }

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {/* Search Input Container */}
      <div className="bg-white/85 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Customer Financial Statements</h2>
              <p className="text-xs text-slate-500 font-medium">Search any client to generate comprehensive ledger statements & print reports</p>
            </div>
          </div>

          {selectedCustomerName && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Client:</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                {selectedCustomerName}
              </span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {isSearching ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            ) : (
              <Search className="w-5 h-5 text-slate-400" />
            )}
          </div>

          <input
            type="text"
            className="w-full pl-11 pr-10 py-3 bg-slate-50/70 border border-slate-200/90 rounded-xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
            placeholder="Search customer by name or phone (e.g. Collins, Jeffrey, 0244...)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsFocused(true)
            }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsFocused(false)
              if (e.key === 'Enter' && results.length > 0) {
                handleSelect(results[0])
              }
            }}
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Recent Customers Chips */}
        {recentCustomers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Recent Clients:
            </span>
            {recentCustomers.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => handleSelect(c)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  selectedCustomerName?.toLowerCase() === c.name.toLowerCase()
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-600 border-slate-200/80 shadow-2xs'
                }`}
              >
                <span>{c.name}</span>
                {c.balance > 0 ? (
                  <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                    selectedCustomerName?.toLowerCase() === c.name.toLowerCase() 
                      ? 'bg-white/20 text-white' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {formatCurrency(c.balance)}
                  </span>
                ) : (
                  <CheckCircle className={`w-3 h-3 ${
                    selectedCustomerName?.toLowerCase() === c.name.toLowerCase() ? 'text-white' : 'text-emerald-500'
                  }`} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          {isSearching && results.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Searching transaction history...
            </div>
          ) : results.length > 0 ? (
            <div>
              <div className="px-4 py-2 bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Matching Customers ({results.length})
              </div>
              {results.map((c) => {
                const hasBalance = c.balance > 0.05
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-600 flex items-center justify-center font-bold text-sm transition-colors shrink-0 mt-0.5">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 group-hover:text-indigo-900 text-sm">
                            {c.name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 uppercase">
                            ({c.totalJobs} {c.totalJobs === 1 ? 'order' : 'orders'})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {c.phone}
                            </span>
                          )}
                          {c.lastTransactionDate && (
                            <span>Last: {formatDate(c.lastTransactionDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-xs text-slate-500 font-medium">
                          Billed: <span className="font-bold text-slate-800">{formatCurrency(c.totalInvoiced)}</span>
                        </div>
                        {hasBalance ? (
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 mt-0.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Due: {formatCurrency(c.balance)}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 mt-0.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Settled
                          </div>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : query.trim().length >= 1 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No customers found</p>
              <p className="text-xs text-slate-400 mt-1">No past transactions found matching &ldquo;{query}&rdquo;</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
