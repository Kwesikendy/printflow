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
  unpaidInvoices: any[]
  initialDateFilter?: string | null
}

export function FinanceReportPrint({
  tenantName,
  logoUrl,
  payments,
  unpaidInvoices,
  initialDateFilter
}: FinanceReportPrintProps) {
  // Default to today in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState<string>(initialDateFilter || todayStr)
  const [showAllDates, setShowAllDates] = useState<boolean>(initialDateFilter === 'all')

  // Filter payments by date if not 'all'
  const filteredPayments = useMemo(() => {
    if (showAllDates || !selectedDate) return payments
    return payments.filter(p => p.recorded_at && p.recorded_at.startsWith(selectedDate))
  }, [payments, selectedDate, showAllDates])

  const totalRevenue = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  }, [filteredPayments])

  // Correctly compute total outstanding balance (total minus paid so far)
  const totalOutstanding = useMemo(() => {
    return unpaidInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const balance = Math.max(0, Number(inv.total) - paid)
      return sum + balance
    }, 0)
  }, [unpaidInvoices])

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
    setShowAllDates(false)
    setSelectedDate(todayStr)
  }

  const setYesterday = () => {
    setShowAllDates(false)
    const y = new Date()
    y.setDate(y.getDate() - 1)
    setSelectedDate(y.toISOString().split('T')[0])
  }

  const formattedPeriodLabel = useMemo(() => {
    if (showAllDates) return 'All Recorded Dates'
    try {
      const [year, month, day] = selectedDate.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return selectedDate
    }
  }, [selectedDate, showAllDates])

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen text-slate-900">
      {/* Controls Bar (Hidden during print) */}
      <div className="print:hidden mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Day:
          </div>

          <button
            type="button"
            onClick={setToday}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !showAllDates && selectedDate === todayStr
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
              !showAllDates && selectedDate !== todayStr && selectedDate === (new Date(Date.now() - 86400000).toISOString().split('T')[0])
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Yesterday
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={showAllDates ? '' : selectedDate}
              onChange={e => {
                setShowAllDates(false)
                setSelectedDate(e.target.value)
              }}
              className="text-xs font-medium bg-transparent border-none text-slate-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAllDates(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              showAllDates
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Dates
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
          <p><strong>Outstanding Invoices:</strong> {unpaidInvoices.length}</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Revenue Received ({showAllDates ? 'All Time' : 'Selected Day'})</p>
          <p className="text-4xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Outstanding Balance (Pending)</p>
          <p className="text-4xl font-black text-amber-500 tracking-tight">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">Across {unpaidInvoices.length} unpaid / partial invoices</p>
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
        <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4">Outstanding Invoices (Unpaid & Partial Balances)</h2>
        {unpaidInvoices.length > 0 ? (
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
              {unpaidInvoices.map(inv => {
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
                          : 'text-amber-700 bg-amber-50 border-amber-200'
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
          <p className="text-sm text-slate-500 italic">No outstanding invoices at this time.</p>
        )}
      </div>

      <div className="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 print:block">
        Confidential Financial Report — {tenantName}
      </div>
    </div>
  )
}
