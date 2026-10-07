'use client'

import { useState, useTransition, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, PRINT_ROOM_LABELS, cn } from '@/lib/utils'
import {
  Users,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  ChevronRight,
  CheckCircle2,
  Play,
  Search,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { getStaffDailyWorkAction, type StaffActivityReport, type FrontOfficeWorkerStats, type PrintRoomWorkerStats } from '@/app/actions/staff-activity'
import { toast } from 'sonner'

export function StaffActivityDashboard({ initialReport }: { initialReport: StaffActivityReport }) {
  const [report, setReport] = useState<StaffActivityReport>(initialReport)
  const [activeTab, setActiveTab] = useState<'front_office' | 'print_room' | 'summary'>('front_office')
  const [selectedFoWorkerId, setSelectedFoWorkerId] = useState<string | null>(
    initialReport.frontOffice.workers[0]?.profileId || null
  )
  const [selectedPrWorkerId, setSelectedPrWorkerId] = useState<string | null>(
    initialReport.printRoom.workers[0]?.profileId || null
  )

  const [searchFoQuery, setSearchFoQuery] = useState('')
  const [searchPrQuery, setSearchPrQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  // Handle shift / date selection
  const handleShiftChange = (dateIso?: string) => {
    startTransition(async () => {
      const res = await getStaffDailyWorkAction(dateIso)
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        setReport(res.data)
        if (res.data.frontOffice.workers.length > 0) {
          setSelectedFoWorkerId(res.data.frontOffice.workers[0].profileId)
        } else {
          setSelectedFoWorkerId(null)
        }
        if (res.data.printRoom.workers.length > 0) {
          setSelectedPrWorkerId(res.data.printRoom.workers[0].profileId)
        } else {
          setSelectedPrWorkerId(null)
        }
        toast.success(`Loaded shift: ${res.data.shiftBounds.label}`)
      }
    })
  }

  // Active worker objects
  const selectedFoWorker = useMemo(() => {
    return report.frontOffice.workers.find(w => w.profileId === selectedFoWorkerId) || report.frontOffice.workers[0] || null
  }, [report.frontOffice.workers, selectedFoWorkerId])

  const selectedPrWorker = useMemo(() => {
    return report.printRoom.workers.find(w => w.profileId === selectedPrWorkerId) || report.printRoom.workers[0] || null
  }, [report.printRoom.workers, selectedPrWorkerId])

  // Filtered jobs for selected Front Office worker
  const filteredFoJobs = useMemo(() => {
    if (!selectedFoWorker) return []
    if (!searchFoQuery.trim()) return selectedFoWorker.jobs
    const q = searchFoQuery.toLowerCase()
    return selectedFoWorker.jobs.filter(j =>
      j.jobNumber.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      j.productName.toLowerCase().includes(q)
    )
  }, [selectedFoWorker, searchFoQuery])

  // Filtered actions for selected Printer worker
  const filteredPrActions = useMemo(() => {
    if (!selectedPrWorker) return []
    if (!searchPrQuery.trim()) return selectedPrWorker.actions
    const q = searchPrQuery.toLowerCase()
    return selectedPrWorker.actions.filter(a =>
      a.jobNumber.toLowerCase().includes(q) ||
      a.customerName.toLowerCase().includes(q) ||
      a.productName.toLowerCase().includes(q)
    )
  }, [selectedPrWorker, searchPrQuery])

  return (
    <div className="space-y-8">
      {/* 5:00 PM SHIFT BAR & DATE SELECTOR */}
      <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-indigo-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              5:00 PM Work Day Cycle
            </span>
            {report.shiftBounds.isCurrent && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                Active Shift
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-slate-900 mt-1">
            {report.shiftBounds.label}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Work shifts and job IDs automatically reset every day at 5:00 PM (Accra GMT).
          </p>
        </div>

        {/* Date Selector controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={report.shiftBounds.isCurrent ? 'primary' : 'outline'}
            size="sm"
            loading={isPending}
            onClick={() => handleShiftChange(undefined)}
            className="text-xs"
          >
            <Clock className="w-3.5 h-3.5 mr-1" /> Current Shift
          </Button>

          <Button
            variant="outline"
            size="sm"
            loading={isPending}
            onClick={() => {
              const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
              handleShiftChange(yesterday.toISOString())
            }}
            className="text-xs"
          >
            Previous Shift
          </Button>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              className="bg-transparent text-xs text-slate-700 focus:outline-hidden"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                if (e.target.value) {
                  // Noon of selected date to guarantee shift detection
                  const d = new Date(`${e.target.value}T12:00:00Z`)
                  handleShiftChange(d.toISOString())
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-indigo-100/70 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Front Desk Jobs</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-3">{report.frontOffice.totalJobs}</p>
            <p className="text-xs text-slate-500 mt-1">
              Logged by {report.frontOffice.workers.length} front desk workers
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100/70 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Revenue Processed</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-emerald-600 mt-3">{formatCurrency(report.frontOffice.totalRevenue)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Top: <strong className="text-slate-800 font-semibold">{report.frontOffice.topPerformer || 'None'}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-100/70 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Print Jobs Completed</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-purple-700 mt-3">{report.printRoom.totalCompleted}</p>
            <p className="text-xs text-slate-500 mt-1">
              Produced by {report.printRoom.workers.length} printer operators
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-100/70 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Area Printed</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-3">{report.printRoom.totalAreaCompleted} m²</p>
            <p className="text-xs text-slate-500 mt-1">
              Top Printer: <strong className="text-slate-800 font-semibold">{report.printRoom.topPerformer || 'None'}</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DEPARTMENT TABS */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('front_office')}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all",
            activeTab === 'front_office'
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Users className="w-4 h-4" />
          Front Office Workers ({report.frontOffice.workers.length})
        </button>

        <button
          onClick={() => setActiveTab('print_room')}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all",
            activeTab === 'print_room'
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Printer className="w-4 h-4" />
          Print Room Workers ({report.printRoom.workers.length})
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all",
            activeTab === 'summary'
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Layers className="w-4 h-4" />
          Team Summary Table
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. FRONT OFFICE TAB */}
      {activeTab === 'front_office' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT: WORKERS LIST */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Front Office Worker
            </h3>

            {report.frontOffice.workers.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl">
                No front office workers found for this shift.
              </p>
            ) : (
              report.frontOffice.workers.map(w => {
                const isSelected = selectedFoWorker?.profileId === w.profileId
                return (
                  <div
                    key={w.profileId}
                    onClick={() => setSelectedFoWorkerId(w.profileId)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-500 shadow-sm ring-1 ring-indigo-500/30"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                      )}>
                        {w.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{w.fullName}</p>
                        <p className="text-xs text-slate-500">{w.email}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-slate-900 text-sm block">
                        {w.totalJobs} {w.totalJobs === 1 ? 'job' : 'jobs'}
                      </span>
                      <span className="text-xs text-emerald-600 font-semibold">
                        {formatCurrency(w.totalRevenue)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* RIGHT: SELECTED WORKER WORK BREAKDOWN */}
          <div className="lg:col-span-2 space-y-6">
            {selectedFoWorker ? (
              <>
                {/* Worker Header Card */}
                <Card className="border-indigo-100 bg-white">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-slate-900">{selectedFoWorker.fullName}</h3>
                          <span className="text-xs font-bold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                            Front Desk
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{selectedFoWorker.email}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Sales Processed</span>
                        <span className="text-2xl font-black text-emerald-600 block">
                          {formatCurrency(selectedFoWorker.totalRevenue)}
                        </span>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Jobs</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedFoWorker.totalJobs}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Orders</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedFoWorker.totalGroups}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Area</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedFoWorker.totalArea} m²</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Units</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedFoWorker.totalQuantity}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Worker's Jobs Table */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      Jobs Processed in this Shift ({filteredFoJobs.length})
                    </h4>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search jobs..."
                        value={searchFoQuery}
                        onChange={(e) => setSearchFoQuery(e.target.value)}
                        className="input-standard pl-8 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {filteredFoJobs.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                      <p className="text-sm text-slate-500 font-medium">No jobs processed by this worker during this shift.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="table-standard w-full">
                          <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-xs">
                              <th className="pl-6">Job No.</th>
                              <th>Customer</th>
                              <th>Product</th>
                              <th>Dimensions / Qty</th>
                              <th className="text-right">Line Total</th>
                              <th>Status</th>
                              <th className="pr-6">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredFoJobs.map((j) => (
                              <tr key={j.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="pl-6 font-bold text-slate-900">
                                  <Link
                                    href={`/dashboard/jobs/${j.id}`}
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-mono"
                                  >
                                    {j.jobNumber}
                                    <ArrowUpRight className="w-3 h-3" />
                                  </Link>
                                </td>
                                <td className="font-medium text-slate-800">
                                  {j.customerName}
                                  {j.customerPhone && (
                                    <span className="block text-[10px] text-slate-400">{j.customerPhone}</span>
                                  )}
                                </td>
                                <td className="font-semibold text-slate-700">{j.productName}</td>
                                <td>
                                  {j.width} × {j.height} {j.dimensionUnit}
                                  <span className="block text-[10px] text-slate-400 font-medium">Qty: {j.quantity}</span>
                                </td>
                                <td className="text-right font-bold text-emerald-600">
                                  {formatCurrency(j.lineTotal)}
                                </td>
                                <td>
                                  <StatusBadge status={j.status as any} />
                                </td>
                                <td className="pr-6 text-slate-500">
                                  {formatDateTime(j.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-sm text-slate-500">Please select an employee on the left to see their work.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PRINT ROOM TAB */}
      {activeTab === 'print_room' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT: PRINTERS LIST */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Print Room Worker
            </h3>

            {report.printRoom.workers.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl">
                No print room production events found for this shift.
              </p>
            ) : (
              report.printRoom.workers.map(w => {
                const isSelected = selectedPrWorker?.profileId === w.profileId
                return (
                  <div
                    key={w.profileId}
                    onClick={() => setSelectedPrWorkerId(w.profileId)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                      isSelected
                        ? "bg-purple-50/70 border-purple-500 shadow-sm ring-1 ring-purple-500/30"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        isSelected ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-700"
                      )}>
                        {w.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 text-sm">{w.fullName}</p>
                          {w.printRoom && (
                            <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                              {PRINT_ROOM_LABELS[w.printRoom] || w.printRoom}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{w.email}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-slate-900 text-sm block">
                        {w.totalCompletedJobs} completed
                      </span>
                      <span className="text-xs text-purple-600 font-semibold">
                        {w.totalAreaCompleted} m²
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* RIGHT: SELECTED PRINTER PRODUCTION BREAKDOWN */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPrWorker ? (
              <>
                {/* Printer Header Card */}
                <Card className="border-purple-100 bg-white">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-slate-900">{selectedPrWorker.fullName}</h3>
                          <span className="text-xs font-bold uppercase bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                            Printer
                          </span>
                          {selectedPrWorker.printRoom && (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {PRINT_ROOM_LABELS[selectedPrWorker.printRoom] || selectedPrWorker.printRoom}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{selectedPrWorker.email}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Jobs Completed</span>
                        <span className="text-2xl font-black text-purple-700 block">
                          {selectedPrWorker.totalCompletedJobs} jobs
                        </span>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Area</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedPrWorker.totalAreaCompleted} m²</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Units</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedPrWorker.totalQuantityCompleted}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Started In Prod</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedPrWorker.totalInProductionJobs}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block font-semibold uppercase">Total Actions</span>
                        <span className="text-xl font-bold text-slate-900 mt-0.5 block">{selectedPrWorker.totalActions}</span>
                      </div>
                    </div>

                    {/* Product types breakdown */}
                    {Object.keys(selectedPrWorker.productTypeCounts).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Products Printed
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(selectedPrWorker.productTypeCounts).map(([name, count]) => (
                            <span key={name} className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200">
                              {name}: <strong className="text-slate-900 font-bold">{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Printer Actions Table */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      Production Log in this Shift ({filteredPrActions.length})
                    </h4>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search production log..."
                        value={searchPrQuery}
                        onChange={(e) => setSearchPrQuery(e.target.value)}
                        className="input-standard pl-8 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {filteredPrActions.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                      <p className="text-sm text-slate-500 font-medium">No print production events recorded by this worker in this shift.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="table-standard w-full">
                          <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-xs">
                              <th className="pl-6">Job No.</th>
                              <th>Customer</th>
                              <th>Product</th>
                              <th>Dimensions / Qty</th>
                              <th>Action Taken</th>
                              <th className="pr-6">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredPrActions.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="pl-6 font-bold text-slate-900">
                                  <Link
                                    href={`/dashboard/jobs/${a.jobId}`}
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-mono"
                                  >
                                    {a.jobNumber}
                                    <ArrowUpRight className="w-3 h-3" />
                                  </Link>
                                </td>
                                <td className="font-medium text-slate-800">{a.customerName}</td>
                                <td className="font-semibold text-slate-700">{a.productName}</td>
                                <td>
                                  {a.width} × {a.height} {a.dimensionUnit}
                                  <span className="block text-[10px] text-slate-400 font-medium">Qty: {a.quantity} ({a.area} m²)</span>
                                </td>
                                <td>
                                  {a.actionType === 'completed' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-bold">
                                      <CheckCircle2 className="w-3 h-3" /> Completed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-bold">
                                      <Play className="w-3 h-3" /> Started
                                    </span>
                                  )}
                                </td>
                                <td className="pr-6 text-slate-500">
                                  {formatDateTime(a.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-sm text-slate-500">Please select a printer on the left to inspect their work.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TEAM SUMMARY TAB */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Staff Work Rate & Performance Comparison
              </h3>

              <div className="overflow-x-auto">
                <table className="table-standard w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs">
                      <th className="pl-6">Employee</th>
                      <th>Department</th>
                      <th className="text-center">Jobs Handled</th>
                      <th className="text-center">Units Output</th>
                      <th className="text-right">Volume / Value</th>
                      <th className="pr-6 text-right">Work Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {/* Front Desk Workers */}
                    {report.frontOffice.workers.map(w => (
                      <tr key={`fo_${w.profileId}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="pl-6 font-bold text-slate-900">
                          {w.fullName}
                          <span className="block text-[10px] text-slate-400 font-normal">{w.email}</span>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold">
                            Front Office
                          </span>
                        </td>
                        <td className="text-center font-bold text-slate-800">{w.totalJobs} jobs</td>
                        <td className="text-center font-medium text-slate-700">{w.totalQuantity} units</td>
                        <td className="text-right font-bold text-emerald-600">{formatCurrency(w.totalRevenue)}</td>
                        <td className="pr-6 text-right">
                          {w.totalJobs > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No jobs logged</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Print Room Workers */}
                    {report.printRoom.workers.map(w => (
                      <tr key={`pr_${w.profileId}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="pl-6 font-bold text-slate-900">
                          {w.fullName}
                          <span className="block text-[10px] text-slate-400 font-normal">{w.email}</span>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold">
                            Print Room {w.printRoom ? `(${PRINT_ROOM_LABELS[w.printRoom] || w.printRoom})` : ''}
                          </span>
                        </td>
                        <td className="text-center font-bold text-slate-800">{w.totalCompletedJobs} completed</td>
                        <td className="text-center font-medium text-slate-700">{w.totalQuantityCompleted} units</td>
                        <td className="text-right font-bold text-purple-700">{w.totalAreaCompleted} m²</td>
                        <td className="pr-6 text-right">
                          {w.totalCompletedJobs > 0 || w.totalInProductionJobs > 0 ? (
                            <span className="inline-flex items-center gap-1 text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full text-[10px]">
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No prints logged</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
