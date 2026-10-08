'use client'

import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Printer, Calendar, Filter } from 'lucide-react'
import { useMemo, useState } from 'react'

interface FinanceReportPrintProps {
  tenantName: string
  logoUrl?: string | null
  payments: any[]
  unpaidInvoices: any[] // this now contains all invoices
  initialMode?: string
  initialDay?: string
}

export function FinanceReportPrint({
  tenantName,
  logoUrl,
  payments,
  unpaidInvoices,
  initialMode = 'day',
  initialDay
}: FinanceReportPrintProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [filterMode, setFilterMode] = useState<string>(initialMode)
  const [selectedDay, setSelectedDay] = useState<string>(initialDay || todayStr)

  // Filter payments by selected period
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (filterMode === 'all') return true
      const date = new Date(p.recorded_at)
      if (filterMode === 'day') return date.toISOString().startsWith(selectedDay)
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
  }, [payments, filterMode, selectedDay])

  // Filter invoices by selected period
  const filteredInvoices = useMemo(() => {
    return unpaidInvoices.filter(inv => {
      if (filterMode === 'all') return true
      const date = new Date(inv.issued_at)
      if (filterMode === 'day') return date.toISOString().startsWith(selectedDay)
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
  }, [unpaidInvoices, filterMode, selectedDay])

  const totalRevenue = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  }, [filteredPayments])

  // Correctly compute total outstanding balance (total minus paid so far)
  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const balance = Math.max(0, Number(inv.total) - paid)
      return sum + balance
    }, 0)
  }, [filteredInvoices])

  const paymentsByMethod = useMemo(() => {
    const map = new Map<string, number>()
    filteredPayments.forEach(p => {
      const method = PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method
      map.set(method, (map.get(method) || 0) + Number(p.amount))
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredPayments])

  const handlePrint = () => {
    window.print()
  }

  const setToday = () => {
    setFilterMode('day')
    setSelectedDay(todayStr)
  }

  const setYesterday = () => {
    setFilterMode('day')
    const y = new Date()
    y.setDate(y.getDate() - 1)
    setSelectedDay(y.toISOString().split('T')[0])
  }

  const formattedPeriodLabel = useMemo(() => {
    if (filterMode === 'all') return 'All Time'
    if (filterMode === 'week') return 'Last 7 Days'
    if (filterMode === 'month') return 'Last 30 Days'
    try {
      const [year, month, day] = selectedDay.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return selectedDay
    }
  }, [selectedDay, filterMode])

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen text-slate-900">
      {/* Controls Bar (Hidden during print) */}
      <div className="print:hidden mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Period:
          </div>

          <button
            type="button"
            onClick={setToday}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'day' && selectedDay === todayStr
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={setYesterday}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'day' && selectedDay === (new Date(Date.now() - 86400000).toISOString().split('T')[0])
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Yesterday
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'week'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Last 7 Days
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Last 30 Days
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={filterMode === 'day' ? selectedDay : ''}
              onChange={e => {
                setFilterMode('day')
                setSelectedDay(e.target.value)
              }}
              className="text-xs font-medium bg-transparent border-none text-slate-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Time
          </button>
        </div>

        <Button onClick={handlePrint} variant="primary" className="shadow-md">
          <Printer className="w-4 h-4 mr-2" />
          Print Document
        </Button>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={tenantName}
              width={160}
              height={50}
              className="object-contain"
              style={{ maxHeight: '60px', width: 'auto' }}
              unoptimized
            />
          ) : (
            <Image
              src={process.env.NEXT_PUBLIC_APP_LOGO || "/printflow-logo.jpg"}
              alt={process.env.NEXT_PUBLIC_APP_NAME || "PrintFlow"}
              width={160}
              height={50}
              className="object-contain"
              style={{ maxHeight: '60px', width: 'auto' }}
            />
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{tenantName}</h1>
            <p className="text-slate-500 font-medium">Daily Financial Report</p>
            <p className="text-sm font-bold text-indigo-700 mt-0.5">{formattedPeriodLabel}</p>
          </div>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p><strong>Generated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Payments Logged:</strong> {filteredPayments.length}</p>
          <p><strong>Invoices Issued:</strong> {filteredInvoices.length}</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Revenue Received ({filterMode === 'day' ? 'Selected Day' : filterMode === 'all' ? 'All Time' : 'Period'})</p>
          <p className="text-4xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Outstanding Balance (Pending)</p>
          <p className="text-4xl font-black text-amber-500 tracking-tight">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">Across all invoices issued in period</p>
        </div>
      </div>

      {/* Breakdown by Payment Method */}
      <div className="mb-10">
        <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4">Revenue Breakdown by Payment Method</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {paymentsByMethod.map(([method, amount]) => (
            <div key={method} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">{method}</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(amount)}</p>
            </div>
          ))}
          {paymentsByMethod.length === 0 && (
            <p className="text-sm text-slate-500 italic">No payments recorded for this period.</p>
          )}
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="mb-12">
        <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4">Received Payments Log ({formattedPeriodLabel})</h2>
        {filteredPayments.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map(p => (
                <tr key={p.id}>
                  <td className="py-3 px-4 text-slate-600">{formatDateTime(p.recorded_at)}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method}</td>
                  <td className="py-3 px-4 text-slate-600">{p.profiles?.full_name || 'System'}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500 italic">No payments found for this period.</p>
        )}
      </div>

      {/* Outstanding Invoices Table */}
      <div className="break-inside-avoid">
        <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4">Invoices Issued ({formattedPeriodLabel})</h2>
        {filteredInvoices.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
              <tr>
                <th className="py-3 px-3">Invoice No.</th>
                <th className="py-3 px-3">Date Issued</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-3 text-right">Invoice Total</th>
                <th className="py-3 px-3 text-right">Paid</th>
                <th className="py-3 px-3 text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv: any) => {
                const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
                const balance = Math.max(0, Number(inv.total) - paid)
                return (
                  <tr key={inv.id}>
                    <td className="py-3 px-3 font-bold text-slate-800">{inv.invoice_number}</td>
                    <td className="py-3 px-3 text-slate-600">{new Date(inv.issued_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 font-medium text-slate-700">{inv.jobs?.customer_name || inv.job_groups?.customer_name || 'Unknown'}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`uppercase text-[11px] font-bold px-2 py-0.5 rounded border ${
                        inv.status === 'partial'
                          ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                          : inv.status === 'unpaid'
                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-medium">{formatCurrency(inv.total)}</td>
                    <td className="py-3 px-3 text-right text-emerald-600 font-semibold">{formatCurrency(paid)}</td>
                    <td className="py-3 px-3 text-right font-bold text-amber-600">{formatCurrency(balance)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500 italic">No invoices issued in this period.</p>
        )}
      </div>

      <div className="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 print:block">
        Confidential Financial Report — {tenantName}
      </div>
    </div>
  )
}
