'use client'

import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  getShiftDateString,
  getShiftBoundsFromDateString,
  getPreviousShiftDateString,
  isInvoiceInShift
} from '@/lib/workday'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Printer, Calendar, Filter, ArrowUpDown, Flag, ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'

interface FlaggedInvoicesPrintProps {
  tenantName: string
  logoUrl?: string | null
  flaggedInvoices: any[]
  initialMode?: string
  initialDay?: string
}

export function FlaggedInvoicesPrint({
  tenantName,
  logoUrl,
  flaggedInvoices,
  initialMode = 'all',
  initialDay
}: FlaggedInvoicesPrintProps) {
  const currentShiftDateStr = getShiftDateString()
  const [filterMode, setFilterMode] = useState<string>(initialMode)
  const [selectedShiftDate, setSelectedShiftDate] = useState<string>(initialDay || currentShiftDateStr)
  const [sortAscending, setSortAscending] = useState<boolean>(false)

  // Shift bounds for the selected shift date
  const shiftBounds = useMemo(() => {
    return getShiftBoundsFromDateString(selectedShiftDate)
  }, [selectedShiftDate])

  // Filter flagged invoices by selected period
  const filteredInvoices = useMemo(() => {
    return flaggedInvoices.filter(inv => {
      if (filterMode === 'all') return true
      if (filterMode === 'day') {
        return isInvoiceInShift(inv, shiftBounds)
      }
      const date = new Date(inv.flagged_at || inv.issued_at)
      if (filterMode === 'week') {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - 7)
        return date >= d
      }
      if (filterMode === 'month') {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setMonth(d.getMonth() - 1)
        return date >= d
      }
      return true
    })
  }, [flaggedInvoices, filterMode, shiftBounds])

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      const aNum = a.invoice_number || ''
      const bNum = b.invoice_number || ''
      const cmp = aNum.localeCompare(bNum, undefined, { numeric: true })
      return sortAscending ? cmp : -cmp
    })
  }, [filteredInvoices, sortAscending])

  // Summary Metrics
  const totalDisputedGross = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
  }, [filteredInvoices])

  const totalPaymentsReceived = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
      return sum + paid
    }, 0)
  }, [filteredInvoices])

  const totalDisputedBalance = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
      const balance = Math.max(0, Number(inv.total || 0) - paid)
      return sum + balance
    }, 0)
  }, [filteredInvoices])

  const handlePrint = () => {
    window.print()
  }

  const setCurrentShift = () => {
    setFilterMode('day')
    setSelectedShiftDate(currentShiftDateStr)
  }

  const setPreviousShift = () => {
    setFilterMode('day')
    setSelectedShiftDate(getPreviousShiftDateString(currentShiftDateStr))
  }

  const formattedPeriodLabel = useMemo(() => {
    if (filterMode === 'all') return 'All Time (Full Disputed Ledger)'
    if (filterMode === 'week') return 'Last 7 Days'
    if (filterMode === 'month') return 'Last 30 Days'
    return `${shiftBounds.label}`
  }, [filterMode, shiftBounds])

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-white min-h-screen text-slate-900">
      {/* Controls Bar (Hidden during print) */}
      <div className="print:hidden mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/finance">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 border border-slate-200 bg-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Finance Dashboard
            </Button>
          </Link>

          <Link href={`/print/finance-report?mode=${filterMode}&day=${selectedShiftDate}`}>
            <Button variant="outline" size="sm" className="bg-white hover:bg-slate-50 text-indigo-700 border-slate-200 font-semibold">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Standard Shift Report
            </Button>
          </Link>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </div>

          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Time ({flaggedInvoices.length})
          </button>

          <button
            type="button"
            onClick={setCurrentShift}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'day' && selectedShiftDate === currentShiftDateStr
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Current Shift (5 PM)
          </button>

          <button
            type="button"
            onClick={setPreviousShift}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'day' && selectedShiftDate === getPreviousShiftDateString(currentShiftDateStr)
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Previous Shift
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'week'
                ? 'bg-rose-600 text-white shadow-sm'
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
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Last 30 Days
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1" title="Select Shift Date (starts at 5:00 PM)">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={filterMode === 'day' ? selectedShiftDate : ''}
              onChange={e => {
                setFilterMode('day')
                setSelectedShiftDate(e.target.value)
              }}
              className="text-xs font-medium bg-transparent border-none text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        <Button onClick={handlePrint} variant="danger" className="shadow-md bg-rose-600 hover:bg-rose-700 text-white font-bold">
          <Printer className="w-4 h-4 mr-2" />
          Print Flagged Report
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
              src={process.env.NEXT_PUBLIC_APP_LOGO || "/Print_DPI_Logo.png"}
              alt={process.env.NEXT_PUBLIC_APP_NAME || "PrintDpi"}
              width={160}
              height={50}
              className="object-contain"
              style={{ maxHeight: '60px', width: 'auto' }}
            />
          )}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 mb-1">
              <Flag className="w-3 h-3" /> Audit & Review Document
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{tenantName}</h1>
            <p className="text-slate-600 font-semibold">Flagged & Disputed Invoices Report</p>
            <p className="text-sm font-bold text-rose-700 mt-0.5">{formattedPeriodLabel}</p>
          </div>
        </div>
        <div className="text-right text-xs sm:text-sm text-slate-600 space-y-1">
          <p><strong>Generated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Total Flagged Records:</strong> <span className="font-bold text-rose-700">{filteredInvoices.length}</span></p>
          <p className="text-xs text-slate-500 italic">Excluded from daily shift revenue</p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-rose-50/60 border border-rose-200/80 p-5 rounded-2xl">
          <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">Total Flagged Invoices</p>
          <p className="text-3xl font-black text-rose-700 tracking-tight">{filteredInvoices.length}</p>
          <p className="text-xs text-rose-600 mt-1">Disputed or pending administrative review</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Total Disputed Gross Value</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalDisputedGross)}</p>
          <p className="text-xs text-slate-500 mt-1">Sum of billed amounts on flagged records</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">Withheld Outstanding Balance</p>
          <p className="text-3xl font-black text-amber-700 tracking-tight">{formatCurrency(totalDisputedBalance)}</p>
          <p className="text-xs text-amber-800 mt-1">Net receivable removed from customer ledgers</p>
        </div>
      </div>

      {/* Flagged Invoices Detailed Audit Table */}
      <div className="break-inside-avoid">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h2 className="text-lg font-bold text-slate-900">Disputed & Flagged Invoices Audit List</h2>
          </div>
          <button
            type="button"
            onClick={() => setSortAscending(prev => !prev)}
            className="print:hidden text-xs font-semibold text-slate-600 hover:text-rose-700 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Order: {sortAscending ? 'Ascending' : 'Descending'}
          </button>
        </div>

        {sortedInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/80 border-y border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Invoice No.</th>
                  <th className="py-3 px-3">Date Issued</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-4 w-2/5">Flag Reason & Auditor</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedInvoices.map((inv: any) => {
                  const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
                  const balance = Math.max(0, Number(inv.total || 0) - paid)
                  const customerName = inv.jobs?.customer_name || inv.job_groups?.customer_name || 'Walk-in Customer'
                  const customerPhone = inv.jobs?.customer_phone || inv.job_groups?.customer_phone

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <span className="font-mono">{inv.invoice_number}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {formatDateTime(inv.issued_at)}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800">
                        <div>{customerName}</div>
                        {customerPhone && <div className="text-[10px] text-slate-500 font-mono">{customerPhone}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="rounded-lg bg-rose-50/70 border border-rose-200/80 p-2 text-slate-800">
                          <p className="font-semibold text-rose-900 text-[11px] leading-snug">
                            {inv.flag_reason || 'No specific reason provided.'}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-rose-700/80">
                            {inv.flagged_at && (
                              <span>Flagged: {formatDateTime(inv.flagged_at)}</span>
                            )}
                            {inv.profiles?.full_name && (
                              <span>• By: <strong>{inv.profiles.full_name}</strong></span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-center whitespace-nowrap">
                        <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded border ${
                          inv.status === 'partial'
                            ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                            : inv.status === 'unpaid'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-700 font-medium whitespace-nowrap">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-emerald-600 font-semibold whitespace-nowrap">
                        {paid > 0 ? formatCurrency(paid) : '-'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-rose-700 whitespace-nowrap">
                        {formatCurrency(balance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-slate-700">
                    Grand Total ({filteredInvoices.length} Record{filteredInvoices.length === 1 ? '' : 's'}):
                  </td>
                  <td className="py-3 px-3 text-right text-slate-900 font-black">
                    {formatCurrency(totalDisputedGross)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-black">
                    {formatCurrency(totalPaymentsReceived)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700 font-black">
                    {formatCurrency(totalDisputedBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl my-4">
            <p className="text-sm font-semibold text-slate-700">No flagged invoices found for this period.</p>
            <p className="text-xs text-slate-500 mt-1">All invoices are clean or unflagged in this selected timeframe.</p>
          </div>
        )}
      </div>

      {/* Audit Certification / Sign-off Block for Printouts */}
      <div className="mt-14 pt-8 border-t border-slate-300 break-inside-avoid">
        <div className="grid grid-cols-2 gap-12 text-xs text-slate-700">
          <div>
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-8">Audited & Prepared By:</p>
            <div className="border-b border-slate-400 w-48 mb-2" />
            <p className="font-semibold">Accountant / Finance Officer</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Date: ________________________</p>
          </div>

          <div>
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-8">Confirmed & Authorized By:</p>
            <div className="border-b border-slate-400 w-48 mb-2" />
            <p className="font-semibold">Managing Director / Internal Auditor</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Date: ________________________</p>
          </div>
        </div>

        <div className="mt-10 text-center text-[10px] text-slate-400">
          Confidential Audit & Disputed Invoices Report - {tenantName} • Generated via PrintFlow Accounting Control Engine
        </div>
      </div>
    </div>
  )
}
