'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Printer, User, Phone, CheckCircle, AlertCircle, FileText, 
  CreditCard, Calendar, ArrowDownRight, ArrowUpRight, TrendingUp,
  Receipt, Package, ExternalLink, Loader2, Sparkles, Filter
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, formatDate, PAYMENT_METHOD_LABELS, SOURCE_LABELS } from '@/lib/utils'
import { getCustomerFinancialStatement, type CustomerStatementData } from '@/app/actions/finance'
import Link from 'next/link'
import { startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

interface CustomerStatementModalProps {
  customerName: string | null
  customerPhone?: string | null
  isOpen: boolean
  onClose: () => void
}

export function CustomerStatementModal({
  customerName,
  customerPhone,
  isOpen,
  onClose
}: CustomerStatementModalProps) {
  const [statement, setStatement] = useState<CustomerStatementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'ledger' | 'invoices' | 'payments' | 'jobs'>('ledger')
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all')
  const [isPending, startTransition] = useTransition()

  // Load statement data whenever customerName or dateFilter changes
  useEffect(() => {
    if (!isOpen || !customerName) {
      setStatement(null)
      return
    }

    setLoading(true)
    let fromDate: string | undefined
    let toDate: string | undefined

    const now = new Date()
    if (dateFilter === 'this_month') {
      fromDate = startOfMonth(now).toISOString()
      toDate = endOfMonth(now).toISOString()
    } else if (dateFilter === 'last_month') {
      const lastMonthDate = subMonths(now, 1)
      fromDate = startOfMonth(lastMonthDate).toISOString()
      toDate = endOfMonth(lastMonthDate).toISOString()
    } else if (dateFilter === 'this_year') {
      fromDate = startOfYear(now).toISOString()
    }

    startTransition(async () => {
      try {
        const data = await getCustomerFinancialStatement(customerName, {
          customerPhone,
          fromDate,
          toDate
        })
        setStatement(data)
      } catch (err) {
        console.error('Error fetching statement:', err)
      } finally {
        setLoading(false)
      }
    })
  }, [isOpen, customerName, customerPhone, dateFilter])

  if (!isOpen || !customerName) return null

  const hasOutstanding = (statement?.summary?.balance ?? 0) > 0.05
  const printUrl = `/print/customer-statement?customer=${encodeURIComponent(customerName)}${
    customerPhone ? `&phone=${encodeURIComponent(customerPhone)}` : ''
  }${dateFilter !== 'all' ? `&period=${dateFilter}` : ''}`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] z-10"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-linear-to-r from-slate-50 via-white to-indigo-50/30">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-600/20 shrink-0">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                      {customerName}
                    </h1>
                    {hasOutstanding ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Outstanding: {formatCurrency(statement?.summary.balance ?? 0)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Account Settled
                      </span>
                    )}
                    {statement?.source && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 uppercase tracking-wider">
                        {SOURCE_LABELS[statement.source as keyof typeof SOURCE_LABELS] || statement.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1">
                    {customerPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {customerPhone}
                      </span>
                    )}
                    <span>Customer Financial Statement & Ledger</span>
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <Link href={printUrl} target="_blank">
                  <Button variant="primary" className="shadow-md shadow-indigo-600/10 cursor-pointer">
                    <Printer className="w-4 h-4 mr-2" />
                    Print Statement
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Date Preset Filter Bar */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200/60">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3" /> Filter Period:
                </span>
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'this_year', label: 'This Year' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDateFilter(p.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateFilter === p.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {statement?.summary?.lastTransactionDate && (
                <div className="hidden sm:block text-xs text-slate-400 font-medium">
                  Last activity: {formatDate(statement.summary.lastTransactionDate)}
                </div>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm font-semibold text-slate-600">Generating customer financial statement...</p>
              </div>
            ) : statement ? (
              <>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50/80 border border-slate-200/80 p-4 sm:p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invoiced</span>
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {formatCurrency(statement.summary.totalBilled)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{statement.summary.invoicesCount} invoices issued</p>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 sm:p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Payments Received</span>
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                        <Receipt className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-700 tracking-tight">
                      {formatCurrency(statement.summary.totalPaid)}
                    </div>
                    <p className="text-xs text-emerald-600/80 mt-1">{statement.summary.paymentsCount} payments logged</p>
                  </div>

                  <div className={`p-4 sm:p-5 rounded-2xl border ${
                    hasOutstanding 
                      ? 'bg-amber-50/60 border-amber-200/80' 
                      : 'bg-slate-50/80 border-slate-200/80'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        hasOutstanding ? 'text-amber-700' : 'text-slate-400'
                      }`}>
                        Net Balance Due
                      </span>
                      <div className={`p-1.5 rounded-lg ${
                        hasOutstanding ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className={`text-2xl font-black tracking-tight ${
                      hasOutstanding ? 'text-amber-700' : 'text-slate-900'
                    }`}>
                      {formatCurrency(statement.summary.balance)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {hasOutstanding ? 'Payment pending' : 'Zero outstanding balance'}
                    </p>
                  </div>

                  <div className="bg-slate-50/80 border border-slate-200/80 p-4 sm:p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Package className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {statement.summary.jobsCount}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Production jobs recorded</p>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-slate-200">
                  <nav className="flex space-x-6">
                    {[
                      { id: 'ledger', label: 'Statement of Account (Ledger)', icon: Receipt, count: statement.ledger.length },
                      { id: 'invoices', label: 'Invoices', icon: FileText, count: statement.invoices.length },
                      { id: 'payments', label: 'Payments Received', icon: CreditCard, count: statement.payments.length },
                      { id: 'jobs', label: 'Job Orders', icon: Package, count: statement.jobs.length }
                    ].map((tab) => {
                      const Icon = tab.icon
                      const isActive = activeTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                            isActive
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      )
                    })}
                  </nav>
                </div>

                {/* Tab 1: Statement Ledger */}
                {activeTab === 'ledger' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <p>Chronological breakdown of charges (Debits) and settlements (Credits) with running balance.</p>
                      <span className="font-semibold text-slate-700">Showing {statement.ledger.length} entries</span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="table-container">
                        <table className="table-standard w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/80">
                              <th className="pl-6">Date</th>
                              <th>Type</th>
                              <th>Reference</th>
                              <th>Description</th>
                              <th className="text-right">Debit (+)</th>
                              <th className="text-right">Credit (-)</th>
                              <th className="text-right pr-6">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {statement.ledger.map((row) => {
                              const isInvoice = row.type === 'invoice'
                              return (
                                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="pl-6 text-slate-600 font-medium whitespace-nowrap">
                                    {formatDateTime(row.date)}
                                  </td>
                                  <td>
                                    {isInvoice ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
                                        Invoice
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                                        Payment
                                      </span>
                                    )}
                                  </td>
                                  <td className="font-bold text-slate-900">{row.reference}</td>
                                  <td className="text-slate-600 text-xs">
                                    <div>{row.description}</div>
                                    {row.recordedBy && (
                                      <div className="text-[11px] text-slate-400">By: {row.recordedBy}</div>
                                    )}
                                  </td>
                                  <td className="text-right font-bold text-slate-800">
                                    {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                                  </td>
                                  <td className="text-right font-bold text-emerald-600">
                                    {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                                  </td>
                                  <td className="text-right pr-6 font-black whitespace-nowrap">
                                    <span className={row.runningBalance > 0 ? 'text-amber-600' : 'text-slate-700'}>
                                      {formatCurrency(row.runningBalance)}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                            {statement.ledger.length === 0 && (
                              <tr>
                                <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                                  No transaction entries for this selected period.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Invoices Breakdown */}
                {activeTab === 'invoices' && (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="table-container">
                        <table className="table-standard w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/80">
                              <th className="pl-6">Invoice No.</th>
                              <th>Date Issued</th>
                              <th>Status</th>
                              <th className="text-right">Total Amount</th>
                              <th className="text-right">Amount Paid</th>
                              <th className="text-right pr-6">Balance Due</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {statement.invoices.map((inv) => (
                              <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="pl-6 font-bold text-indigo-600">
                                  <Link href={`/print/invoice/${inv.id}`} target="_blank" className="hover:underline flex items-center gap-1.5">
                                    <span>{inv.invoice_number}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </Link>
                                </td>
                                <td className="text-slate-600 font-medium whitespace-nowrap">{formatDate(inv.issued_at)}</td>
                                <td>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                    inv.status === 'paid' 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : inv.status === 'partial'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="text-right font-bold text-slate-900">{formatCurrency(inv.total)}</td>
                                <td className="text-right font-bold text-emerald-600">{formatCurrency(inv.amount_paid)}</td>
                                <td className="text-right pr-6 font-black text-amber-600">
                                  {formatCurrency(inv.balance_due)}
                                </td>
                              </tr>
                            ))}
                            {statement.invoices.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                                  No invoices found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Payments Log */}
                {activeTab === 'payments' && (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="table-container">
                        <table className="table-standard w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/80">
                              <th className="pl-6">Date & Time</th>
                              <th>Method</th>
                              <th>Reference / Transaction ID</th>
                              <th>Notes</th>
                              <th>Cashier / Recorded By</th>
                              <th className="text-right pr-6">Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {statement.payments.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="pl-6 text-slate-600 font-medium whitespace-nowrap">{formatDateTime(p.recorded_at)}</td>
                                <td>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200/70">
                                    {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method}
                                  </span>
                                </td>
                                <td className="font-semibold text-slate-800 font-mono text-xs">{p.reference || '—'}</td>
                                <td className="text-slate-500 text-xs">{p.notes || '—'}</td>
                                <td className="text-slate-600 font-medium text-xs">{p.profiles?.full_name || 'Staff'}</td>
                                <td className="text-right pr-6 font-black text-emerald-600">{formatCurrency(p.amount)}</td>
                              </tr>
                            ))}
                            {statement.payments.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                                  No payments recorded.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: Job Orders */}
                {activeTab === 'jobs' && (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="table-container">
                        <table className="table-standard w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/80">
                              <th className="pl-6">Job No.</th>
                              <th>Date</th>
                              <th>Product</th>
                              <th>Dimensions</th>
                              <th>Qty</th>
                              <th>Status</th>
                              <th className="text-right pr-6">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {statement.jobs.map((j) => (
                              <tr key={j.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="pl-6 font-bold text-indigo-600">
                                  <Link href={`/dashboard/jobs/${j.id}`} className="hover:underline flex items-center gap-1.5">
                                    <span>{j.job_number}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </Link>
                                </td>
                                <td className="text-slate-600 font-medium whitespace-nowrap">{formatDate(j.created_at)}</td>
                                <td className="font-semibold text-slate-800">{j.product_types?.name || 'Standard Print'}</td>
                                <td className="text-slate-500 font-mono text-xs">
                                  {j.width} × {j.height} {j.dimension_unit}
                                </td>
                                <td className="font-semibold text-slate-700">{j.quantity}</td>
                                <td>
                                  <StatusBadge status={j.status} />
                                </td>
                                <td className="text-right pr-6 font-black text-slate-900">{formatCurrency(j.line_total)}</td>
                              </tr>
                            ))}
                            {statement.jobs.length === 0 && (
                              <tr>
                                <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                                  No jobs recorded.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-slate-400">
                Customer statement details could not be loaded.
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-6 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {statement?.summary.firstTransactionDate && (
                <span>
                  Client since <strong>{formatDate(statement.summary.firstTransactionDate)}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="cursor-pointer">
                Close
              </Button>
              <Link href={printUrl} target="_blank">
                <Button variant="primary" className="cursor-pointer shadow-md">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Official Statement
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
