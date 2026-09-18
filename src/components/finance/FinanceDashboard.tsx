'use client'

import { useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatDateTime, SOURCE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { TrendingUp, Banknote, AlertCircle, Calendar } from 'lucide-react'
import { CustomerSearchSection } from '@/components/finance/CustomerSearchSection'
import { CustomerStatementModal } from '@/components/finance/CustomerStatementModal'

interface FinanceDashboardProps {
  payments: any[]
  unpaidInvoices: any[]
}

const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981']

export function FinanceDashboard({ payments, unpaidInvoices }: FinanceDashboardProps) {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('month')
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; phone?: string | null } | null>(null)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)

  const handleSelectCustomer = (name: string, phone?: string | null) => {
    setSelectedCustomer({ name, phone })
    setIsStatementModalOpen(true)
  }

  const filteredPayments = useMemo(() => {
    if (dateFilter === 'all') return payments
    
    return payments.filter(p => {
      const date = parseISO(p.recorded_at)
      if (dateFilter === 'today') return isToday(date)
      if (dateFilter === 'week') return isThisWeek(date)
      if (dateFilter === 'month') return isThisMonth(date)
      return true
    })
  }, [payments, dateFilter])

  // Summary Metrics
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  
  const todayRevenue = payments
    .filter(p => isToday(parseISO(p.recorded_at)))
    .reduce((sum, p) => sum + p.amount, 0)

  const outstandingTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0)

  // Chart Data: Revenue by Source
  const sourceData = useMemo(() => {
    const walkIn = filteredPayments.filter(p => p.jobs?.source === 'walk_in').reduce((s, p) => s + p.amount, 0)
    const marketing = filteredPayments.filter(p => p.jobs?.source === 'marketing').reduce((s, p) => s + p.amount, 0)
    
    return [
      { name: 'Walk-In', value: walkIn },
      { name: 'Marketing', value: marketing }
    ].filter(d => d.value > 0)
  }, [filteredPayments])

  // Chart Data: Revenue by Product Type
  const productData = useMemo(() => {
    const map = new Map<string, number>()
    
    filteredPayments.forEach(p => {
      const productName = p.jobs?.product_types?.name || 'Unknown'
      map.set(productName, (map.get(productName) || 0) + p.amount)
    })
    
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredPayments])

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

      {/* Filter Row */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <div className="relative bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-xl overflow-hidden shadow-sm flex items-center px-4 py-2 hover:shadow-md transition-shadow">
          <Calendar className="w-4 h-4 text-indigo-500 mr-2" />
          <select 
            className="bg-transparent border-none text-slate-700 text-sm font-semibold focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-4"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Revenue ({dateFilter})</p>
              </div>
              <p className="mt-4 text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(totalRevenue)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <Banknote className="w-24 h-24 text-emerald-900" />
            </div>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shadow-sm border border-emerald-100/50">
                  <Banknote className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Today's Revenue</p>
              </div>
              <p className="mt-4 text-4xl font-black text-emerald-600 tracking-tight">{formatCurrency(todayRevenue)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <AlertCircle className="w-24 h-24 text-amber-900" />
            </div>
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shadow-sm border border-amber-100/50">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Outstanding Invoices</p>
                </div>
                <p className="mt-4 text-4xl font-black text-amber-500 tracking-tight">{formatCurrency(outstandingTotal)}</p>
              </div>
              <p className="text-sm font-medium text-amber-600/80 mt-2">{unpaidInvoices.length} invoices pending payment</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader title="Revenue by Source" />
            <CardContent className="h-80 pt-4">
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                    <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `₵${val}`} dx={-10} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9', opacity: 0.5}}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(226, 232, 240, 0.8)', color: '#0f172a', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1500} animationEasing="ease-out">
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 text-sm font-medium">No data for selected period</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader title="Revenue by Product Type" />
            <CardContent className="h-80">
              {productData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={productData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                      cornerRadius={6}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {productData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(226, 232, 240, 0.8)', color: '#0f172a', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 text-sm font-medium">No data for selected period</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader title="Recent Payments" description={`Showing payments for ${dateFilter}`} />
            <CardContent className="p-0">
              <div className="table-container border-t border-slate-100">
                <table className="table-standard w-full">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="pl-6">Date</th>
                      <th>Method</th>
                      <th className="text-right pr-6">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {filteredPayments.slice(0, 10).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="pl-6 text-slate-600 font-medium">{formatDateTime(p.recorded_at)}</td>
                        <td>
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200/60 shadow-sm">
                            {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}
                          </span>
                        </td>
                        <td className="text-right pr-6 text-emerald-600 font-bold">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                    {filteredPayments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-slate-400 font-medium">No payments found.</td>
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
            <CardHeader title="Outstanding Invoices" description="Jobs awaiting payment" />
            <CardContent className="p-0">
              <div className="table-container border-t border-slate-100">
                <table className="table-standard w-full">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="pl-6">Invoice No.</th>
                      <th>Customer</th>
                      <th className="text-right">Total</th>
                      <th className="pr-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {unpaidInvoices.slice(0, 10).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="pl-6 font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="text-slate-600 font-medium">
                          {inv.jobs?.customer_name ? (
                            <button
                              type="button"
                              onClick={() => handleSelectCustomer(inv.jobs.customer_name)}
                              className="text-left font-semibold text-slate-700 hover:text-indigo-600 hover:underline cursor-pointer transition-colors"
                              title="View Customer Financial Statement"
                            >
                              {inv.jobs.customer_name}
                            </button>
                          ) : (
                            'Unknown'
                          )}
                        </td>
                        <td className="text-right text-amber-500 font-bold">{formatCurrency(inv.total)}</td>
                        <td className="text-right pr-6">
                          <Link href={`/dashboard/jobs/${inv.job_id}`}>
                            <Button variant="ghost" size="sm" className="hover:bg-amber-50 hover:text-amber-700">Pay</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {unpaidInvoices.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-400 font-medium">No outstanding invoices.</td>
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
    </motion.div>
  )
}
