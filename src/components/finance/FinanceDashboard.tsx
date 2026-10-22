'use client'

import { useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { 
  getShiftDateString, 
  getShiftBoundsFromDateString, 
  getPreviousShiftDateString, 
  isTimestampInShift, 
  isInvoiceInShift 
} from '@/lib/workday'
import { isThisWeek, isThisMonth, parseISO } from 'date-fns'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { TrendingUp, AlertCircle, Calendar, Printer, Filter, Flag, Receipt, ArrowRight, ArrowUpRight, Users, X } from 'lucide-react'
import { CustomerSearchSection } from '@/components/finance/CustomerSearchSection'
import { CustomerStatementModal } from '@/components/finance/CustomerStatementModal'
import { EditInvoiceModal } from '@/components/finance/EditInvoiceModal'
import { InvoiceFlagButton } from '@/components/finance/InvoiceFlagButton'
import { RecordPaymentModal } from '@/components/finance/RecordPaymentModal'
import { OutstandingBalanceBreakdownModal, type OutstandingDebtor } from '@/components/finance/OutstandingBalanceBreakdownModal'

interface FinanceDashboardProps {
  payments: any[]
  unpaidInvoices: any[]
  expenditures?: any[]
}

const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981']

export function FinanceDashboard({ payments, unpaidInvoices, expenditures = [] }: FinanceDashboardProps) {
  const currentShiftDay = getShiftDateString()
  const [filterMode, setFilterMode] = useState<'day' | 'week' | 'month' | 'all'>('day')
  const [selectedDay, setSelectedDay] = useState<string>(currentShiftDay)
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; phone?: string | null } | null>(null)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false)
  const [debtorFilter, setDebtorFilter] = useState<string | null>(null)
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  const [showFlagged, setShowFlagged] = useState(false)

  // Shift bounds for currently selected shift date
  const shiftBounds = useMemo(() => {
    return getShiftBoundsFromDateString(selectedDay)
  }, [selectedDay])

  const handleSelectCustomer = (name: string, phone?: string | null) => {
    setSelectedCustomer({ name, phone })
    setIsStatementModalOpen(true)
  }

  const setCurrentShift = () => {
    setFilterMode('day')
    setSelectedDay(currentShiftDay)
  }

  const setPreviousShift = () => {
    setFilterMode('day')
    setSelectedDay(getPreviousShiftDateString(currentShiftDay))
  }

  const filteredPayments = useMemo(() => {
    if (filterMode === 'all') return payments
    
    return payments.filter(p => {
      if (!p.recorded_at) return false
      if (filterMode === 'day') {
        return isTimestampInShift(p.recorded_at, shiftBounds)
      }
      const date = parseISO(p.recorded_at)
      if (filterMode === 'week') return isThisWeek(date)
      if (filterMode === 'month') return isThisMonth(date)
      return true
    })
  }, [payments, filterMode, shiftBounds])

  // Summary Metrics
  const invoiceCandidates = useMemo(() => {
    return unpaidInvoices.filter(inv => {
      if (inv.jobs?.status === 'cancelled') return false
      // Hide group invoices where every job in the group is cancelled
      if (inv.group_id && inv.job_groups?.jobs) {
        const groupJobs: any[] = inv.job_groups.jobs
        if (groupJobs.length > 0 && groupJobs.every((j: any) => j.status === 'cancelled')) return false
      }
      if (filterMode === 'day') {
        return isInvoiceInShift(inv, shiftBounds)
      }
      const date = new Date(inv.issued_at)
      if (filterMode === 'week') {
        const d = new Date()
        d.setHours(0,0,0,0)
        d.setDate(d.getDate() - 7)
        return date >= d
      }
      if (filterMode === 'month') {
        const d = new Date()
        d.setHours(0,0,0,0)
        d.setMonth(d.getMonth() - 1)
        return date >= d
      }
      return true
    })
  }, [unpaidInvoices, filterMode, shiftBounds])

  const flaggedInvoiceCount = useMemo(
    () => invoiceCandidates.filter(inv => inv.is_flagged).length,
    [invoiceCandidates]
  )

  const filteredInvoices = useMemo(
    () => showFlagged ? invoiceCandidates : invoiceCandidates.filter(inv => !inv.is_flagged),
    [invoiceCandidates, showFlagged]
  )

  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      const aNum = a.invoice_number || ''
      const bNum = b.invoice_number || ''
      return bNum.localeCompare(aNum, undefined, { numeric: true })
    })
  }, [filteredInvoices])

  const displayedInvoices = useMemo(() => {
    return sortedInvoices.filter(inv => {
      const customerName = (inv.jobs?.customer_name || inv.job_groups?.customer_name || '').trim().toLowerCase()
      if (debtorFilter && customerName !== debtorFilter.toLowerCase()) {
        return false
      }
      if (onlyUnpaid) {
        const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
        const balance = Math.max(0, Number(inv.total) - paid)
        if (balance <= 0) return false
      }
      return true
    })
  }, [sortedInvoices, debtorFilter, onlyUnpaid])

  const totalRevenue = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  }, [filteredPayments])
  
  // Total payments collected in current shift
  const todayRevenue = useMemo(() => {
    return payments
      .filter(p => isTimestampInShift(p.recorded_at, shiftBounds))
      .reduce((sum, p) => sum + Number(p.amount), 0)
  }, [payments, shiftBounds])

  // Correctly compute outstanding balance (total minus payments made)
  const outstandingTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const balance = Math.max(0, Number(inv.total) - paid)
      return sum + balance
    }, 0)
  }, [filteredInvoices])

  // Clients contributing to the outstanding balance
  const outstandingContributors: OutstandingDebtor[] = useMemo(() => {
    const customerMap = new Map<string, OutstandingDebtor>()

    filteredInvoices.forEach(inv => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const balance = Math.max(0, Number(inv.total) - paid)
      if (balance <= 0) return

      const name = (inv.jobs?.customer_name || inv.job_groups?.customer_name || 'Walk-in Customer').trim()
      const phone = inv.jobs?.customer_phone || inv.job_groups?.customer_phone || null
      const key = name.toLowerCase()

      const existing = customerMap.get(key)
      if (existing) {
        existing.totalOutstanding += balance
        existing.unpaidInvoicesCount += 1
        if (inv.invoice_number) existing.invoiceNumbers.push(inv.invoice_number)
        if (!existing.phone && phone) existing.phone = phone
        if (new Date(inv.issued_at) > new Date(existing.latestIssuedAt)) {
          existing.latestIssuedAt = inv.issued_at
        }
      } else {
        customerMap.set(key, {
          name,
          phone,
          totalOutstanding: balance,
          unpaidInvoicesCount: 1,
          invoiceNumbers: inv.invoice_number ? [inv.invoice_number] : [],
          latestIssuedAt: inv.issued_at || new Date().toISOString()
        })
      }
    })

    return Array.from(customerMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding)
  }, [filteredInvoices])

  // Expenditures calculations
  const filteredExpenditures = useMemo(() => {
    if (!expenditures || expenditures.length === 0) return []
    if (filterMode === 'all') return expenditures
    
    return expenditures.filter(e => {
      if (!e.spent_at) return false
      if (filterMode === 'day') {
        return isTimestampInShift(e.spent_at, shiftBounds)
      }
      const date = parseISO(e.spent_at)
      if (filterMode === 'week') return isThisWeek(date)
      if (filterMode === 'month') return isThisMonth(date)
      return true
    })
  }, [expenditures, filterMode, shiftBounds])

  const totalExpenditure = useMemo(() => {
    return filteredExpenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredExpenditures])

  const netCashFlow = totalRevenue - totalExpenditure

  // Chart Data: Revenue by Source
  const sourceData = useMemo(() => {
    const walkIn = filteredPayments.filter(p => p.jobs?.source === 'walk_in').reduce((s, p) => s + Number(p.amount), 0)
    const marketing = filteredPayments.filter(p => p.jobs?.source === 'marketing').reduce((s, p) => s + Number(p.amount), 0)
    
    return [
      { name: 'Walk-In', value: walkIn },
      { name: 'Marketing', value: marketing }
    ].filter(d => d.value > 0)
  }, [filteredPayments])

  // Chart Data: Revenue by Product Type
  const productData = useMemo(() => {
    const map = new Map<string, number>()
    
    filteredPayments.forEach(p => {
      const productName = p.jobs?.product_types?.name || 'Multi-Item Order'
      map.set(productName, (map.get(productName) || 0) + Number(p.amount))
    })
    
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredPayments])

  const dateLabel = useMemo(() => {
    if (filterMode === 'all') return 'All Time'
    if (filterMode === 'week') return 'This Week'
    if (filterMode === 'month') return 'This Month'
    if (selectedDay === currentShiftDay) return `Current Shift (${shiftBounds.label})`
    return `Shift: ${shiftBounds.label}`
  }, [filterMode, selectedDay, currentShiftDay, shiftBounds])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Customer Financial Statements & Search Bar */}
      <motion.div variants={itemVariants}>
        <CustomerSearchSection
          onSelectCustomer={handleSelectCustomer}
          selectedCustomerName={selectedCustomer?.name}
        />
      </motion.div>

      {/* Date Filter Bar */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-2 mr-1">
            <Filter className="w-3.5 h-3.5" /> Shift Filter:
          </span>

          <button
            type="button"
            onClick={setCurrentShift}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'day' && selectedDay === currentShiftDay
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Current Shift (5 PM)
          </button>

          <button
            type="button"
            onClick={setPreviousShift}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'day' && selectedDay === getPreviousShiftDateString(currentShiftDay)
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Previous Shift
          </button>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1" title="Select Shift Date (starts at 5:00 PM)">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <input 
              type="date"
              value={filterMode === 'day' ? selectedDay : ''}
              onChange={(e) => {
                setSelectedDay(e.target.value)
                setFilterMode('day')
              }}
              className="bg-transparent border-none text-slate-700 text-xs font-semibold focus:outline-none focus:ring-0 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterMode('week')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'week'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            This Week
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            This Month
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Time
          </button>

          <button
            type="button"
            onClick={() => setShowFlagged(value => !value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              showFlagged ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            {showFlagged ? 'Showing flagged' : 'Hide flagged'}{flaggedInvoiceCount > 0 ? ` (${flaggedInvoiceCount})` : ''}
          </button>

          <button
            type="button"
            onClick={() => setIsBreakdownModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 shadow-2xs"
          >
            <Users className="w-3.5 h-3.5 text-amber-600" />
            Debtors Breakdown ({outstandingContributors.length})
          </button>
        </div>

        {/* Print Filtered Report Button */}
        <Link 
          href={`/print/finance-report?mode=${filterMode}&day=${selectedDay}`} 
          target="_blank"
        >
          <Button variant="outline" size="sm" className="bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Report ({dateLabel})
          </Button>
        </Link>
      </motion.div>

      {flaggedInvoiceCount > 0 && !showFlagged && (
        <motion.div variants={itemVariants} className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <Flag className="w-4 h-4 mt-0.5 shrink-0" />
          <p><strong>{flaggedInvoiceCount} invoice{flaggedInvoiceCount === 1 ? '' : 's'}</strong> marked for review are excluded from this dashboard and printed reports. Use “Showing flagged” to review or restore them.</p>
        </motion.div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <TrendingUp className="w-24 h-24 text-indigo-900" />
            </div>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100/50">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue ({dateLabel})</p>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-slate-400 mt-2">{filteredPayments.length} payments recorded</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group h-full border-rose-100">
            <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <Receipt className="w-24 h-24 text-rose-900" />
            </div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shadow-sm border border-rose-100/50">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spend ({dateLabel})</p>
                </div>
                <Link href="/dashboard/finance/expenditures" className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5">
                  Details <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="mt-3 text-3xl font-black text-rose-700 tracking-tight">{formatCurrency(totalExpenditure)}</p>
              <p className="text-xs text-slate-400 mt-2">{filteredExpenditures.length} expenses recorded</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <Calendar className="w-24 h-24 text-emerald-900" />
            </div>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg shadow-sm border ${netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' : 'bg-rose-50 text-rose-600 border-rose-100/50'}`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Position ({dateLabel})</p>
              </div>
              <p className={`mt-3 text-3xl font-black tracking-tight ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(netCashFlow)}
              </p>
              <p className="text-xs text-slate-400 mt-2">Revenue minus expenditure</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card 
            onClick={() => setIsBreakdownModalOpen(true)}
            className="relative overflow-hidden group h-full cursor-pointer hover:border-amber-300 hover:shadow-md transition-all border border-slate-200"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <AlertCircle className="w-24 h-24 text-amber-900" />
            </div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shadow-sm border border-amber-100/50">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Balance</p>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100/50">
                  Breakdown <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-amber-500 tracking-tight">{formatCurrency(outstandingTotal)}</p>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  {outstandingContributors.length} {outstandingContributors.length === 1 ? 'client owes' : 'clients owe'} in period
                </span>
                <span className="text-amber-600 font-bold group-hover:underline inline-flex items-center gap-0.5">
                  View list →
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader title="Revenue by Customer Source" description={dateLabel} />
            <CardContent>
              <div className="h-64">
                {sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                    No payment data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader title="Revenue by Product Type" description={dateLabel} />
            <CardContent>
              <div className="h-64">
                {productData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} fontSize={11} stroke="#94a3b8" />
                      <YAxis tickFormatter={(val) => `₵${val}`} fontSize={11} stroke="#94a3b8" />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']} />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                    No payment data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tables Row: Payments & Outstanding Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader title={`Received Payments Log (${dateLabel})`} description={`${filteredPayments.length} payments recorded`} />
            <CardContent className="p-0">
              <div className="table-container border-t border-slate-100 max-h-[420px] overflow-y-auto">
                <table className="table-standard w-full">
                  <thead className="bg-slate-50/50 sticky top-0">
                    <tr>
                      <th className="pl-6">Date & Time</th>
                      <th>Method</th>
                      <th className="text-right pr-6">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="pl-6 text-slate-600 font-medium text-xs">{formatDateTime(p.recorded_at)}</td>
                        <td>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm">
                            {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method}
                          </span>
                        </td>
                        <td className="text-right pr-6 text-emerald-600 font-bold">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                    {filteredPayments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-slate-400 font-medium">No payments found for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader 
              title={debtorFilter ? `Invoices: ${debtorFilter}` : "Recent Invoices"} 
              description={
                debtorFilter 
                  ? `Filtered to show records for ${debtorFilter}` 
                  : onlyUnpaid 
                    ? `Showing ${displayedInvoices.length} unpaid invoices in period`
                    : `${filteredInvoices.length} invoices generated in period`
              }
              action={
                <div className="flex items-center gap-2">
                  {debtorFilter && (
                    <button
                      type="button"
                      onClick={() => setDebtorFilter(null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors shadow-2xs"
                      title="Clear client filter"
                    >
                      <span>Client: {debtorFilter}</span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOnlyUnpaid(prev => !prev)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                      onlyUnpaid 
                        ? 'bg-amber-500 text-white border-amber-500 shadow-2xs' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    {onlyUnpaid ? 'Unpaid Only' : 'All Invoices'}
                  </button>
                </div>
              }
            />
            <CardContent className="p-0">
              <div className="table-container border-t border-slate-100 max-h-[420px] overflow-y-auto">
                <table className="table-standard w-full">
                  <thead className="bg-slate-50/50 sticky top-0">
                    <tr>
                      <th className="pl-4">Invoice</th>
                      <th>Customer</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Balance Due</th>
                      <th className="pr-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {displayedInvoices.map((inv) => {
                      const customerName = inv.jobs?.customer_name || inv.job_groups?.customer_name || 'Unknown'
                      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
                      const balance = Math.max(0, Number(inv.total) - paid)
                      const payUrl = inv.group_id 
                        ? `/dashboard/jobs/group/${inv.group_id}` 
                        : (inv.job_id ? `/dashboard/jobs/${inv.job_id}` : `/dashboard/jobs`)

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="pl-4 font-bold text-slate-900 text-xs">{inv.invoice_number}</td>
                          <td className="text-slate-700 font-medium text-xs">
                            <button
                              type="button"
                              onClick={() => handleSelectCustomer(customerName)}
                              className="text-left font-semibold hover:text-indigo-600 hover:underline cursor-pointer transition-colors"
                              title="View Customer Statement"
                            >
                              {customerName}
                            </button>
                          </td>
                          <td className="text-right text-slate-500 text-xs font-medium">{formatCurrency(inv.total)}</td>
                          <td className="text-right text-amber-600 font-bold text-xs">
                            {balance > 0 ? formatCurrency(balance) : <span className="text-emerald-600">Paid</span>}
                          </td>
                          <td className="text-right pr-4 flex items-center justify-end gap-1">
                            <InvoiceFlagButton invoice={inv} />
                            <EditInvoiceModal invoice={inv} />
                            {balance > 0 && (
                              <RecordPaymentModal
                                invoice={inv}
                                balance={balance}
                                customerName={customerName}
                                payUrl={payUrl}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {displayedInvoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400 font-medium">No invoices found matching current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Customer Financial Statement Modal */}
      <CustomerStatementModal
        customerName={selectedCustomer?.name || null}
        customerPhone={selectedCustomer?.phone}
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
      />

      {/* Outstanding Balance Contributors Breakdown Modal */}
      <OutstandingBalanceBreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        contributors={outstandingContributors}
        totalOutstanding={outstandingTotal}
        filterLabel={dateLabel}
        onSelectCustomer={handleSelectCustomer}
        onFilterCustomer={(customerName) => {
          setDebtorFilter(customerName)
        }}
      />
    </motion.div>
  )
}
