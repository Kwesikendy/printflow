'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatDateTime, SOURCE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface FinanceDashboardProps {
  payments: any[]
  unpaidInvoices: any[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6']

export function FinanceDashboard({ payments, unpaidInvoices }: FinanceDashboardProps) {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('month')

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

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card">
          <p className="text-sm font-medium text-slate-500">Total Revenue (Selected Period)</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-slate-500">Today's Revenue</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{formatCurrency(todayRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-slate-500">Outstanding Invoices</p>
          <p className="mt-2 text-3xl font-bold text-yellow-600">{formatCurrency(outstandingTotal)}</p>
          <p className="text-xs text-slate-500 mt-1">{unpaidInvoices.length} invoices pending</p>
        </div>
      </div>

      <div className="flex justify-end">
        <select 
          className="input-standard w-auto text-sm py-1.5"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Revenue by Source" />
          <CardContent className="h-72">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `₵${val}`} />
                  <Tooltip 
                    cursor={{fill: '#1e293b', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 text-sm">No data for selected period</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Revenue by Product Type" />
          <CardContent className="h-72">
            {productData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {productData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 text-sm">No data for selected period</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Recent Payments" description={`Showing payments for ${dateFilter}`} />
          <CardContent className="p-0 overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.recorded_at)}</td>
                    <td>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}</td>
                    <td className="text-right text-green-600 font-medium">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-slate-500">No payments found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Outstanding Invoices" description="Jobs awaiting payment" />
          <CardContent className="p-0 overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.slice(0, 10).map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium text-slate-900">{inv.invoice_number}</td>
                    <td>{inv.jobs?.customer_name}</td>
                    <td className="text-right text-yellow-600 font-medium">{formatCurrency(inv.total)}</td>
                    <td className="text-right">
                      <Link href={`/dashboard/jobs/${inv.job_id}`}>
                        <Button variant="ghost" size="sm">Pay</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {unpaidInvoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-slate-500">No outstanding invoices.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
