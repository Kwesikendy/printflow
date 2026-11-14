'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Printer,
  ArrowLeft,
  Download,
  Calendar,
  Filter,
  Search,
  PackagePlus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react'

interface InventoryReportPrintProps {
  tenantName: string
  logoUrl?: string | null
  materials: any[]
  logs: any[]
  initialFocus?: string
  initialPeriod?: string
}

export function InventoryReportPrint({
  tenantName,
  logoUrl,
  materials,
  logs,
  initialFocus = 'add_stock',
  initialPeriod = 'all',
}: InventoryReportPrintProps) {
  const [focus, setFocus] = useState<string>(initialFocus)
  const [period, setPeriod] = useState<string>(initialPeriod)
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredLogs = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    return logs.filter((log) => {
      // 1. Focus / Action type filter
      if (focus !== 'all' && log.action !== focus) return false

      // 2. Material filter
      if (selectedMaterialId !== 'all' && log.material_id !== selectedMaterialId) return false

      // 3. Date period filter
      const logDate = new Date(log.created_at)
      if (period === 'today') {
        if (logDate < todayStart) return false
      } else if (period === 'week') {
        const weekAgo = new Date(todayStart)
        weekAgo.setDate(weekAgo.getDate() - 7)
        if (logDate < weekAgo) return false
      } else if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        if (logDate < monthStart) return false
      } else if (period === 'custom') {
        if (customStart) {
          const s = new Date(customStart + 'T00:00:00')
          if (logDate < s) return false
        }
        if (customEnd) {
          const e = new Date(customEnd + 'T23:59:59')
          if (logDate > e) return false
        }
      }

      // 4. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matName = (log.materials?.name || '').toLowerCase()
        const notes = (log.notes || '').toLowerCase()
        const jobNum = (log.jobs?.job_number || '').toLowerCase()
        if (!matName.includes(q) && !notes.includes(q) && !jobNum.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [logs, focus, period, customStart, customEnd, selectedMaterialId, searchQuery])

  // Summary totals for filtered logs
  const summary = useMemo(() => {
    let addedRolls = 0
    let addedArea = 0
    let addedCount = 0
    let deductedRolls = 0
    let deductedArea = 0

    for (const log of filteredLogs) {
      const r = Number(log.qty_change_rolls || 0)
      const a = Number(log.qty_change_area || 0)
      if (log.action === 'add_stock' || r > 0) {
        addedRolls += Math.max(0, r)
        addedArea += Math.max(0, a)
        addedCount++
      } else if (r < 0) {
        deductedRolls += Math.abs(r)
        deductedArea += Math.abs(a)
      }
    }

    const currentStockValuation = materials.reduce((sum, m) => {
      return sum + (Number(m.qty_rolls || 0) * Number(m.unit_cost || 0))
    }, 0)

    const currentTotalRolls = materials.reduce((sum, m) => sum + Number(m.qty_rolls || 0), 0)

    return {
      addedRolls,
      addedArea,
      addedCount,
      deductedRolls,
      deductedArea,
      currentStockValuation,
      currentTotalRolls,
    }
  }, [filteredLogs, materials])

  // Grouped summary per material for additions in the filtered range
  const materialSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        materialId: string
        name: string
        unit: string
        entries: number
        rollsAdded: number
        areaAdded: number
        rollsDeducted: number
        lastActivity: string
      }
    >()

    for (const log of filteredLogs) {
      const id = log.material_id
      const name = log.materials?.name || 'Unknown Material'
      const unit = log.materials?.unit || 'roll'
      if (!map.has(id)) {
        map.set(id, {
          materialId: id,
          name,
          unit,
          entries: 0,
          rollsAdded: 0,
          areaAdded: 0,
          rollsDeducted: 0,
          lastActivity: log.created_at,
        })
      }
      const row = map.get(id)!
      row.entries++
      const r = Number(log.qty_change_rolls || 0)
      const a = Number(log.qty_change_area || 0)
      if (r > 0) {
        row.rollsAdded += r
        row.areaAdded += Math.max(0, a)
      } else if (r < 0) {
        row.rollsDeducted += Math.abs(r)
      }
      if (new Date(log.created_at) > new Date(row.lastActivity)) {
        row.lastActivity = log.created_at
      }
    }

    return Array.from(map.values()).sort((a, b) => b.rollsAdded - a.rollsAdded || a.name.localeCompare(b.name))
  }, [filteredLogs])

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Time',
      'Material',
      'Action',
      'Qty Change (Rolls/Units)',
      'Area Change (m2)',
      'Notes / Reference',
    ]

    const rows = filteredLogs.map((log) => {
      const d = new Date(log.created_at)
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      const actionLabel =
        log.action === 'add_stock'
          ? 'Restocked / Added'
          : log.action === 'job_deduction'
          ? 'Job Deduction'
          : 'Adjustment / Reset'

      return [
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${(log.materials?.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${actionLabel}"`,
        Number(log.qty_change_rolls || 0).toFixed(2),
        Number(log.qty_change_area || 0).toFixed(2),
        `"${(log.notes || '').replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `PrintFlow_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const focusLabel =
    focus === 'add_stock'
      ? 'Stock Additions & Restocks'
      : focus === 'job_deduction'
      ? 'Production Deductions'
      : focus === 'adjust_stock'
      ? 'Adjustments & Audits'
      : 'All Inventory Movements'

  const periodLabel =
    period === 'today'
      ? 'Today'
      : period === 'week'
      ? 'Last 7 Days'
      : period === 'month'
      ? 'This Month'
      : period === 'custom'
      ? `${customStart || 'Start'} to ${customEnd || 'Present'}`
      : 'All Time'

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-8 print:py-0 px-4 sm:px-6">
      {/* Control Toolbar (Hidden when printing) */}
      <div className="max-w-5xl mx-auto mb-6 space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/inventory"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Inventory
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">Inventory Additions & Movement Report</h1>
              <p className="text-xs text-slate-500">Audit what was restocked or changed across any date range</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-xs font-semibold border-slate-200"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Report Type
            </label>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="add_stock">Additions &amp; Restocks Only</option>
              <option value="all">All Stock Movements</option>
              <option value="job_deduction">Production Deductions</option>
              <option value="adjust_stock">Adjustments &amp; Resets</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <PackagePlus className="w-3 h-3" /> Material
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="all">All Materials ({materials.length})</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Search className="w-3 h-3" /> Search Notes / Ref
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Waybill, supplier, job..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          {period === 'custom' && (
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">From:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">To:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="max-w-5xl mx-auto bg-white rounded-2xl print:rounded-none border border-slate-200 print:border-0 shadow-sm print:shadow-none p-6 sm:p-10 print:p-4 space-y-8">
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            {logoUrl && (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                <Image src={logoUrl} alt={tenantName} fill className="object-contain" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{tenantName}</p>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {focusLabel} Report
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Period: <strong className="text-slate-700">{periodLabel}</strong> · Generated{' '}
                {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-500">
            <span className="block font-semibold text-slate-700">Current Warehouse Stock Value</span>
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {formatCurrency(summary.currentStockValuation)}
            </span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              {summary.currentTotalRolls.toFixed(2)} total rolls across {materials.length} materials
            </span>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Log Entries
            </span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
              {filteredLogs.length}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Units Added
            </span>
            <span className="text-2xl font-extrabold text-emerald-700 font-mono mt-1 block">
              +{summary.addedRolls.toFixed(2)}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Area Added
            </span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
              +{summary.addedArea.toFixed(1)} <span className="text-xs font-normal text-slate-500">m²</span>
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Units Deducted
            </span>
            <span className="text-2xl font-extrabold text-slate-700 font-mono mt-1 block">
              -{summary.deductedRolls.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Summary by Material */}
        {materialSummary.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Summary by Material ({periodLabel})</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5">Material</th>
                    <th className="py-2.5 px-3.5 text-center">Events</th>
                    <th className="py-2.5 px-3.5 text-right">Total Added</th>
                    <th className="py-2.5 px-3.5 text-right">Area Added</th>
                    <th className="py-2.5 px-3.5 text-right">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materialSummary.map((row) => (
                    <tr key={row.materialId}>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{row.name}</td>
                      <td className="py-2.5 px-3.5 text-center font-mono text-slate-600">{row.entries}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">
                        {row.rollsAdded > 0 ? `+${row.rollsAdded.toFixed(2)} ${row.unit}s` : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                        {row.areaAdded > 0 ? `+${row.areaAdded.toFixed(1)} m²` : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-500">
                        {new Date(row.lastActivity).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Chronological Log */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Detailed Activity Ledger ({filteredLogs.length} entries)
          </h3>
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No inventory records match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5">Date &amp; Time</th>
                    <th className="py-2.5 px-3.5">Material</th>
                    <th className="py-2.5 px-3.5">Action</th>
                    <th className="py-2.5 px-3.5 text-right">Qty Change</th>
                    <th className="py-2.5 px-3.5 text-right">Area (m²)</th>
                    <th className="py-2.5 px-3.5">Notes / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const d = new Date(log.created_at)
                    const qty = Number(log.qty_change_rolls || 0)
                    const area = Number(log.qty_change_area || 0)
                    const isAdd = log.action === 'add_stock' || qty > 0

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          {log.materials?.name || 'Unknown Material'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              log.action === 'add_stock'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : log.action === 'job_deduction'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            )}
                          >
                            {log.action === 'add_stock' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : log.action === 'job_deduction' ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            {log.action === 'add_stock'
                              ? 'Added'
                              : log.action === 'job_deduction'
                              ? 'Job Used'
                              : 'Adjusted'}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-3.5 text-right font-mono font-bold whitespace-nowrap',
                            isAdd ? 'text-emerald-700' : 'text-slate-700'
                          )}
                        >
                          {qty > 0 ? `+${qty.toFixed(2)}` : qty.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                          {area > 0 ? `+${area.toFixed(1)}` : area.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 max-w-xs">
                          {log.notes || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
