'use client'

import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Printer } from 'lucide-react'
import { useMemo } from 'react'

interface FinanceReportPrintProps {
  tenantName: string
  logoUrl?: string | null
  payments: any[]
  unpaidInvoices: any[]
}

export function FinanceReportPrint({ tenantName, logoUrl, payments, unpaidInvoices }: FinanceReportPrintProps) {
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0)
  
  const paymentsByMethod = useMemo(() => {
    const map = new Map<string, number>()
    payments.forEach(p => {
      const method = PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method
      map.set(method, (map.get(method) || 0) + p.amount)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [payments])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen text-slate-900">
      {/* Controls (Hidden when printing) */}
      <div className="print:hidden mb-8 flex justify-end">
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
            <p className="text-slate-500 font-medium">Financial Report</p>
          </div>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p><strong>Generated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Total Payments:</strong> {payments.length}</p>
          <p><strong>Outstanding Invoices:</strong> {unpaidInvoices.length}</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Revenue (Received)</p>
          <p className="text-4xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Outstanding (Pending)</p>
          <p className="text-4xl font-black text-amber-500 tracking-tight">{formatCurrency(totalOutstanding)}</p>
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
            <p className="text-sm text-slate-500 italic">No payments recorded.</p>
          )}
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="mb-12">
        <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4">Received Payments Log</h2>
        {payments.length > 0 ? (
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
              {payments.map(p => (
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
          <p className="text-sm text-slate-500 italic">No payments found.</p>
        )}
      </div>

      {/* Outstanding Invoices Table */}
      <div className="break-inside-avoid">
        <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4">Outstanding Invoices (Unpaid / Partial)</h2>
        {unpaidInvoices.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
              <tr>
                <th className="py-3 px-4">Invoice No.</th>
                <th className="py-3 px-4">Date Issued</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unpaidInvoices.map(inv => (
                <tr key={inv.id}>
                  <td className="py-3 px-4 font-bold text-slate-700">{inv.invoice_number}</td>
                  <td className="py-3 px-4 text-slate-600">{new Date(inv.issued_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{inv.jobs?.customer_name || 'Unknown'}</td>
                  <td className="py-3 px-4">
                    <span className="uppercase text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-600">{formatCurrency(inv.total)}</td>
                </tr>
              ))}
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
