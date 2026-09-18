'use client'

import { formatCurrency, formatDateTime, formatDate, PAYMENT_METHOD_LABELS, SOURCE_LABELS } from '@/lib/utils'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Printer, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { AutoPrint } from '@/components/print/AutoPrint'
import type { CustomerStatementData } from '@/app/actions/finance'

interface CustomerStatementPrintProps {
  tenantName: string
  logoUrl?: string | null
  statement: CustomerStatementData
  periodLabel?: string
}

export function CustomerStatementPrint({
  tenantName,
  logoUrl,
  statement,
  periodLabel = 'All Time'
}: CustomerStatementPrintProps) {
  const { summary, ledger, invoices, payments, jobs, customerName, customerPhone, source } = statement
  const hasOutstanding = summary.balance > 0.05

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans text-slate-900 bg-white min-h-screen">
      <AutoPrint />

      {/* Action bar (Hidden when printing) */}
      <div className="print:hidden mb-6 flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.close()}
            className="cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Close Window
          </Button>
          <span>Official Customer Financial Statement for <strong>{customerName}</strong></span>
        </div>
        <Button onClick={handlePrint} variant="primary" className="shadow-md cursor-pointer">
          <Printer className="w-4 h-4 mr-2" />
          Print Document
        </Button>
      </div>

      {/* Statement Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
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
              src="/Print_DPI_Logo.png"
              alt={tenantName}
              width={160}
              height={50}
              className="object-contain"
              style={{ maxHeight: '60px', width: 'auto' }}
              onError={(e) => {
                // Fallback to text if image fails
                const target = e.target as HTMLElement
                target.style.display = 'none'
              }}
            />
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{tenantName}</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Financial & Accounts Department</p>
            <p className="text-xs text-slate-400">Accra, Ghana</p>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Statement of Account</h2>
          <div className="text-xs text-slate-600 mt-1 space-y-0.5">
            <p><strong>Statement Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p><strong>Period Covered:</strong> {periodLabel}</p>
            <p><strong>Status:</strong> {hasOutstanding ? 'OUTSTANDING BALANCE' : 'SETTLED IN FULL'}</p>
          </div>
        </div>
      </div>

      {/* Customer & Account Information Box */}
      <div className="grid grid-cols-2 gap-6 p-5 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-sm">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Holder</p>
          <p className="text-lg font-black text-slate-900 uppercase">{customerName}</p>
          {customerPhone && (
            <p className="text-slate-600 mt-0.5">Phone: <strong>{customerPhone}</strong></p>
          )}
          <p className="text-slate-500 text-xs mt-1">
            Channel: <span className="font-semibold uppercase">{SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source}</span>
          </p>
        </div>

        <div className="text-right flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Summary</p>
            <p className="text-xs text-slate-600">Total Invoices: <strong>{summary.invoicesCount}</strong></p>
            <p className="text-xs text-slate-600">Total Payments: <strong>{summary.paymentsCount}</strong></p>
            <p className="text-xs text-slate-600">Production Jobs: <strong>{summary.jobsCount}</strong></p>
          </div>
        </div>
      </div>

      {/* Financial Position Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-slate-200 p-4 rounded-xl text-center bg-white">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Billed (Invoices)</p>
          <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(summary.totalBilled)}</p>
        </div>
        <div className="border border-slate-200 p-4 rounded-xl text-center bg-white">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Received (Payments)</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(summary.totalPaid)}</p>
        </div>
        <div className={`p-4 rounded-xl text-center border-2 ${
          hasOutstanding ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300 bg-slate-50'
        }`}>
          <p className={`text-xs font-black uppercase tracking-wider ${
            hasOutstanding ? 'text-amber-700' : 'text-slate-600'
          }`}>
            Net Balance Due
          </p>
          <p className={`text-xl font-black mt-1 ${
            hasOutstanding ? 'text-amber-600' : 'text-slate-900'
          }`}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
      </div>

      {/* Chronological Statement Ledger */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wider border-b border-slate-300 pb-2 mb-3">
          Chronological Statement of Account (Ledger)
        </h3>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100/70 text-slate-700 uppercase font-bold">
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Reference</th>
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3 text-right">Debit (+)</th>
              <th className="py-2 px-3 text-right">Credit (-)</th>
              <th className="py-2 px-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {ledger.map((row) => (
              <tr key={row.id}>
                <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDate(row.date)}</td>
                <td className="py-2 px-3 font-bold text-slate-800">{row.reference}</td>
                <td className="py-2 px-3 text-slate-600">
                  <span>{row.description}</span>
                  {row.recordedBy && <span className="text-slate-400"> (Cashier: {row.recordedBy})</span>}
                </td>
                <td className="py-2 px-3 text-right font-semibold text-slate-900">
                  {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                </td>
                <td className="py-2 px-3 text-right font-semibold text-emerald-700">
                  {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                </td>
                <td className="py-2 px-3 text-right font-black whitespace-nowrap">
                  {formatCurrency(row.runningBalance)}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400 italic">No transactions recorded for this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Itemized Invoices & Payments (2-column layout or stacked) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 break-inside-avoid">
        {/* Invoices */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-2">
            Invoices Breakdown
          </h4>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-1">Invoice #</th>
                <th className="py-1">Status</th>
                <th className="py-1 text-right">Total</th>
                <th className="py-1 text-right">Paid</th>
                <th className="py-1 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-1.5 font-bold text-slate-800">{inv.invoice_number}</td>
                  <td className="py-1.5 uppercase font-semibold text-[10px]">{inv.status}</td>
                  <td className="py-1.5 text-right">{formatCurrency(inv.total)}</td>
                  <td className="py-1.5 text-right text-emerald-700">{formatCurrency(inv.amount_paid)}</td>
                  <td className="py-1.5 text-right font-bold text-amber-700">{formatCurrency(inv.balance_due)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-slate-400 italic">None</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payments */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-2">
            Payments Received
          </h4>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-1">Date</th>
                <th className="py-1">Method</th>
                <th className="py-1">Ref Code</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 text-slate-600">{formatDate(p.recorded_at)}</td>
                  <td className="py-1.5 font-semibold text-slate-700 uppercase">{p.method}</td>
                  <td className="py-1.5 text-slate-500 font-mono text-[10px]">{p.reference || '—'}</td>
                  <td className="py-1.5 text-right font-bold text-emerald-700">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-400 italic">None</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Banking / Remittance Information */}
      <div className="border-t border-slate-200 pt-4 mb-8 text-xs break-inside-avoid">
        <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Remittance / Payment Details</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Beneficiary</span>
            <span className="font-bold text-slate-800">PRINT DPI</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Mobile Money No.</span>
            <span className="font-bold text-slate-800">0598608209</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank & Branch</span>
            <span className="font-bold text-slate-800">FIDELITY BANK (KANESHIE)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
            <span className="font-bold text-slate-800 font-mono">2400446763917</span>
          </div>
        </div>
      </div>

      {/* Sign-off / Signature Section */}
      <div className="border-t-2 border-slate-900 pt-6 mt-8 grid grid-cols-2 gap-12 text-xs break-inside-avoid">
        <div>
          <p className="font-bold text-slate-800 uppercase mb-8">Prepared by (Finance / Accounts):</p>
          <div className="border-b border-slate-400 w-3/4 mb-1"></div>
          <p className="text-slate-500">Authorized Signature & Date</p>
        </div>
        <div>
          <p className="font-bold text-slate-800 uppercase mb-8">Customer Acknowledgment:</p>
          <div className="border-b border-slate-400 w-3/4 mb-1"></div>
          <p className="text-slate-500">Signature & Date</p>
        </div>
      </div>

      {/* Print Footer */}
      <div className="mt-12 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4">
        This document is an official computer-generated Financial Statement of Account issued by {tenantName}.
      </div>
    </div>
  )
}
