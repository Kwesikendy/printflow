'use client'

import { useMemo, useState, useTransition } from 'react'
import { BriefcaseBusiness, CalendarDays, CalendarRange, Check, ChevronDown, ClipboardCheck, Clock3, Mail, Phone, Plus, Search, ShieldCheck, Trash2, UserRound, UsersRound, X, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HRInviteUserModal } from '@/components/admin/HRInviteUserModal'
import { PayrollDashboard, type PayrollEmployee, type PayrollRunView } from '@/components/admin/PayrollDashboard'
import { deleteUser, updateEmployeeDepartment, updateEmployeeLeave } from '@/app/actions/users'
import { createLeaveRequest, reviewLeaveRequest } from '@/app/actions/hr'
import { ROLE_LABELS, PRINT_ROOM_LABELS } from '@/lib/utils'
import { toast } from 'sonner'
import { useSession } from '@/contexts/SessionContext'

export interface HRDepartmentEmployee {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: keyof typeof ROLE_LABELS
  department: string | null
  job_title: string | null
  employment_type: 'full_time' | 'part_time' | 'contract'
  employment_start_date: string | null
  print_room: keyof typeof PRINT_ROOM_LABELS | null
  is_active: boolean
  leave: { entitlement: number; used_days: number }
}

export interface HRLeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  leaveType: 'annual' | 'sick' | 'unpaid' | 'other'
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

const DEPARTMENTS = ['Front Desk', 'Print Room', 'Print Room 1', 'Print Room 2', 'Finance', 'Administration']
const EMPLOYMENT_LABELS = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' } as const

export interface HRPayrollWorkspace {
  employees: PayrollEmployee[]
  settings: {
    tax_year: number
    ssnit_employee_rate: number
    ssnit_employer_rate: number
    ssnit_ceiling: number
  }
  latestRun: any
  latestEntries: any[]
  runs: PayrollRunView[]
}

export function HRDashboard({ initialEmployees, initialLeaveRequests, year, payroll }: { initialEmployees: HRDepartmentEmployee[]; initialLeaveRequests: HRLeaveRequest[]; year: number; payroll: HRPayrollWorkspace }) {
  const { session } = useSession()
  const [activeSection, setActiveSection] = useState<'staff' | 'leave' | 'payroll'>('staff')
  const [employees, setEmployees] = useState(initialEmployees)
  const [requests, setRequests] = useState(initialLeaveRequests)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isPending, startTransition] = useTransition()
  const [savingLeaveId, setSavingLeaveId] = useState<string | null>(null)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [leaveInputs, setLeaveInputs] = useState<Record<string, string>>(
    Object.fromEntries(initialEmployees.map(employee => [employee.id, String(employee.leave.used_days)]))
  )

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim()
    return employees.filter(employee => {
      const matchesRole = roleFilter === 'all' || employee.role === roleFilter
      const searchable = [employee.full_name, employee.email, employee.phone, employee.department, employee.job_title]
        .filter(Boolean).join(' ').toLowerCase()
      return matchesRole && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [employees, query, roleFilter])

  const activeCount = employees.filter(employee => employee.is_active).length
  const totalUsed = employees.reduce((sum, employee) => sum + employee.leave.used_days, 0)
  const totalRemaining = employees.reduce((sum, employee) => sum + Math.max(employee.leave.entitlement - employee.leave.used_days, 0), 0)
  const pendingRequests = requests.filter(request => request.status === 'pending')

  const handleDepartmentChange = (employeeId: string, department: string) => {
    const previous = employees.find(employee => employee.id === employeeId)?.department || null
    setEmployees(current => current.map(employee => employee.id === employeeId ? { ...employee, department } : employee))
    startTransition(async () => {
      const result = await updateEmployeeDepartment(employeeId, department)
      if (result.error) {
        setEmployees(current => current.map(employee => employee.id === employeeId ? { ...employee, department: previous } : employee))
        toast.error(result.error)
      } else {
        toast.success('Assignment updated')
      }
    })
  }

  const handleLeaveSave = (employeeId: string) => {
    const usedDays = Number(leaveInputs[employeeId])
    setSavingLeaveId(employeeId)
    startTransition(async () => {
      const result = await updateEmployeeLeave(employeeId, usedDays)
      if (result.error) {
        toast.error(result.error)
      } else {
        setEmployees(current => current.map(employee => employee.id === employeeId
          ? { ...employee, leave: { ...employee.leave, used_days: usedDays } }
          : employee))
        toast.success('Leave balance updated')
      }
      setSavingLeaveId(null)
    })
  }

  const handleCreateLeaveRequest = (formData: FormData) => {
    setRequestError(null)
    startTransition(async () => {
      const result = await createLeaveRequest({
        employeeId: String(formData.get('employee_id') || ''),
        startDate: String(formData.get('start_date') || ''),
        endDate: String(formData.get('end_date') || ''),
        leaveType: String(formData.get('leave_type') || 'annual') as HRLeaveRequest['leaveType'],
        reason: String(formData.get('reason') || ''),
      })
      if (result.error) {
        setRequestError(result.error)
        toast.error(result.error)
      } else {
        toast.success('Leave request logged for review')
        setIsRequestModalOpen(false)
        window.location.reload()
      }
    })
  }

  const handleDelete = (employeeId: string) => {
    startTransition(async () => {
      const result = await deleteUser(employeeId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setEmployees(current => current.filter(employee => employee.id !== employeeId))
        setRequests(current => current.filter(request => request.employeeId !== employeeId))
        setConfirmDeleteId(null)
        toast.success('Staff account removed')
      }
    })
  }

  const handleReviewRequest = (request: HRLeaveRequest, status: 'approved' | 'rejected') => {
    setReviewingRequestId(request.id)
    startTransition(async () => {
      const result = await reviewLeaveRequest(request.id, status)
      if (result.error) {
        toast.error(result.error)
      } else {
        setRequests(current => current.map(item => item.id === request.id ? { ...item, status } : item))
        if (status === 'approved') {
          setEmployees(current => current.map(employee => employee.id === request.employeeId
            ? { ...employee, leave: { ...employee.leave, used_days: employee.leave.used_days + request.days } }
            : employee))
          setLeaveInputs(current => ({ ...current, [request.employeeId]: String((Number(current[request.employeeId]) || 0) + request.days) }))
        }
        toast.success(status === 'approved' ? 'Leave request approved' : 'Leave request rejected')
      }
      setReviewingRequestId(null)
    })
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-[0_18px_50px_-20px_rgba(79,70,229,0.55)]">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-indigo-100 text-sm font-semibold"><BriefcaseBusiness className="w-4 h-4" aria-hidden="true" /> People operations</div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">HR directory</h1>
            <p className="mt-2 max-w-xl text-indigo-100">Keep employee information, access roles, work assignments, and annual leave in one place.</p>
          </div>
          <HRInviteUserModal />
        </div>
      </section>

      <nav aria-label="HR workspace sections" className="flex w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm hide-scrollbar">
        {([
          ['staff', 'Staff directory', `${employees.length} people`],
          ['leave', 'Leave & attendance', `${pendingRequests.length} pending`],
          ['payroll', 'Payroll', 'Salary workspace'],
        ] as const).map(([section, label, detail]) => (
          <button key={section} type="button" onClick={() => setActiveSection(section)} className={`min-h-12 min-w-[150px] flex-1 rounded-xl px-4 py-2 text-left transition ${activeSection === section ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`} aria-current={activeSection === section ? 'page' : undefined}>
            <span className="block text-sm font-bold">{label}</span>
            <span className={`mt-0.5 block text-xs ${activeSection === section ? 'text-slate-300' : 'text-slate-400'}`}>{detail}</span>
          </button>
        ))}
      </nav>

      {activeSection !== 'payroll' && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard icon={<UsersRound className="w-5 h-5" aria-hidden="true" />} label="Team members" value={String(employees.length)} detail={`${activeCount} active`} tone="indigo" />
        <SummaryCard icon={<ShieldCheck className="w-5 h-5" aria-hidden="true" />} label="Active accounts" value={String(activeCount)} detail="Can access PrintFlow" tone="emerald" />
        <SummaryCard icon={<CalendarDays className="w-5 h-5" aria-hidden="true" />} label={`Leave used · ${year}`} value={`${totalUsed} days`} detail={`${totalRemaining} days remaining`} tone="amber" />
        <SummaryCard icon={<BriefcaseBusiness className="w-5 h-5" aria-hidden="true" />} label="Annual policy" value="20 days" detail="Per employee, per year" tone="violet" />
        <SummaryCard icon={<ClipboardCheck className="w-5 h-5" aria-hidden="true" />} label="Pending requests" value={String(pendingRequests.length)} detail="Need HR review" tone="rose" />
      </div>}

      {activeSection === 'leave' && <Card noHover>
        <CardHeader
          title="Leave requests"
          description="Review planned absences and keep approved leave tied to each employee’s annual balance."
          action={<Button variant="primary" size="sm" onClick={() => { setRequestError(null); setIsRequestModalOpen(true) }}><Plus className="w-4 h-4" aria-hidden="true" /> Log request</Button>}
        />
        <CardContent className="pt-0">
          <div className="table-container -mx-4 sm:-mx-6">
            <table className="table-standard min-w-[820px]">
              <thead><tr><th className="pl-4 sm:pl-6">Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th className="pr-4 sm:pr-6 text-right">Review</th></tr></thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id}>
                    <td className="pl-4 sm:pl-6"><p className="font-bold text-slate-900">{request.employeeName}</p><p className="mt-1 text-xs text-slate-500">Logged {formatDateTime(request.createdAt)}</p></td>
                    <td><span className="capitalize text-sm font-semibold text-slate-700">{request.leaveType} leave</span>{request.reason && <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500" title={request.reason}>{request.reason}</p>}</td>
                    <td><p className="text-sm font-semibold text-slate-700">{formatDate(request.startDate)} – {formatDate(request.endDate)}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CalendarRange className="w-3 h-3" aria-hidden="true" />Weekdays counted</p></td>
                    <td className="font-black text-slate-900">{request.days}</td>
                    <td><RequestStatus status={request.status} /></td>
                    <td className="pr-4 sm:pr-6 text-right">
                      {request.status === 'pending' ? <div className="flex justify-end gap-2"><button type="button" onClick={() => handleReviewRequest(request, 'approved')} disabled={isPending || reviewingRequestId === request.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Approve</button><button type="button" onClick={() => handleReviewRequest(request, 'rejected')} disabled={isPending || reviewingRequestId === request.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"><XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Reject</button></div> : <span className="text-xs font-medium text-slate-400">Reviewed</span>}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && <tr><td colSpan={6} className="py-12 text-center"><Clock3 className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" /><p className="mt-3 font-semibold text-slate-600">No leave requests yet.</p><p className="mt-1 text-sm text-slate-400">Log an absence when an employee submits one.</p></td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>}

      {activeSection === 'staff' && <Card noHover>
        <CardHeader
          title="Employee directory"
          description="Search profiles, change work assignments, and keep leave balances current."
          action={<span className="hidden sm:inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{filteredEmployees.length} shown</span>}
        />
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
            <label className="relative block w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)} className="input-standard pl-10" placeholder="Search name, role, or department" aria-label="Search employees" />
            </label>
            <label className="relative block w-full md:w-52">
              <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="input-standard appearance-none pr-10" aria-label="Filter employees by role">
                <option value="all">All roles</option>
                {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            </label>
          </div>

          <div className="table-container -mx-4 sm:-mx-6">
            <table className="table-standard min-w-[1050px]">
              <thead>
                <tr>
                  <th className="pl-4 sm:pl-6">Employee</th>
                  <th>Role</th>
                  <th>Assignment</th>
                  <th>Employment</th>
                  <th>Annual leave</th>
                  <th className="pr-4 sm:pr-6 text-right">Account</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(employee => {
                  const remaining = Math.max(employee.leave.entitlement - employee.leave.used_days, 0)
                  const percentUsed = employee.leave.entitlement ? Math.min((employee.leave.used_days / employee.leave.entitlement) * 100, 100) : 0
                  return (
                    <tr key={employee.id}>
                      <td className="pl-4 sm:pl-6 align-top">
                        <div className="flex items-start gap-3 min-w-[250px]">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-700">{initials(employee.full_name)}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate max-w-[210px]">{employee.full_name}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 truncate max-w-[230px]"><Mail className="w-3 h-3 shrink-0" aria-hidden="true" />{employee.email}</p>
                            {employee.phone && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone className="w-3 h-3" aria-hidden="true" />{employee.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="align-top">
                        <span className="inline-flex rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{ROLE_LABELS[employee.role]}</span>
                        <p className="mt-2 text-xs text-slate-500">{employee.job_title || 'No job title added'}</p>
                      </td>
                      <td className="align-top">
                        <label className="sr-only" htmlFor={`department-${employee.id}`}>Assignment for {employee.full_name}</label>
                        <div className="relative w-44">
                          <select id={`department-${employee.id}`} value={employee.department || ''} onChange={event => handleDepartmentChange(employee.id, event.target.value)} disabled={isPending} className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                            <option value="">Unassigned</option>
                            {DEPARTMENTS.map(department => <option key={department}>{department}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        </div>
                        {employee.role === 'printer' && <p className="mt-2 text-xs text-slate-500">{employee.print_room ? PRINT_ROOM_LABELS[employee.print_room] : 'No print room'}</p>}
                      </td>
                      <td className="align-top">
                        <p className="text-sm font-semibold text-slate-700">{EMPLOYMENT_LABELS[employee.employment_type]}</p>
                        <p className="mt-1 text-xs text-slate-500">{employee.employment_start_date ? formatDate(employee.employment_start_date) : 'Start date not set'}</p>
                      </td>
                      <td className="align-top min-w-[220px]">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-bold text-slate-800">{remaining} remaining</span>
                          <span className="text-slate-500">{employee.leave.used_days}/{employee.leave.entitlement} used</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${percentUsed >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentUsed}%` }} /></div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className="sr-only" htmlFor={`leave-${employee.id}`}>Used leave days for {employee.full_name}</label>
                          <input id={`leave-${employee.id}`} type="number" min="0" max="20" value={leaveInputs[employee.id] ?? employee.leave.used_days} onChange={event => setLeaveInputs(current => ({ ...current, [employee.id]: event.target.value }))} className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
                          <button type="button" onClick={() => handleLeaveSave(employee.id)} disabled={isPending || savingLeaveId === employee.id} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Save</button>
                        </div>
                      </td>
                      <td className="pr-4 sm:pr-6 align-top text-right">
                        {employee.id === session?.user.id ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</span> : confirmDeleteId === employee.id ? <div className="flex flex-col items-end gap-2"><span className="text-xs font-semibold text-red-600">Remove account?</span><span className="flex gap-2"><button type="button" onClick={() => handleDelete(employee.id)} disabled={isPending} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">Remove</button><button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">Cancel</button></span></div> : <div className="flex flex-col items-end gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${employee.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${employee.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{employee.is_active ? 'Active' : 'Inactive'}</span><button type="button" onClick={() => setConfirmDeleteId(employee.id)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove</button></div>}
                      </td>
                    </tr>
                  )
                })}
                {filteredEmployees.length === 0 && <tr><td colSpan={6} className="py-14 text-center"><UserRound className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" /><p className="mt-3 font-semibold text-slate-600">No employees match this view.</p><p className="mt-1 text-sm text-slate-400">Try a different search or add a new employee.</p></td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>}

      {activeSection === 'payroll' && <PayrollDashboard {...payroll} embedded />}

      {isRequestModalOpen && <LeaveRequestModal employees={employees} error={requestError} isPending={isPending} onClose={() => setIsRequestModalOpen(false)} onSubmit={handleCreateLeaveRequest} />}
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' }) {
  const tones = { indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600', rose: 'bg-rose-50 text-rose-600' }
  return <Card noHover><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs font-medium text-slate-500">{detail}</p></div><div className={`rounded-2xl p-3 ${tones[tone]}`}>{icon}</div></div></CardContent></Card>
}

function RequestStatus({ status }: { status: HRLeaveRequest['status'] }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rejected: 'bg-red-50 text-red-700 border-red-100',
  }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${styles[status]}`}>{status}</span>
}

function LeaveRequestModal({ employees, error, isPending, onClose, onSubmit }: { employees: HRDepartmentEmployee[]; error: string | null; isPending: boolean; onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-label="Close leave request dialog" />
      <Card noHover className="relative z-10 w-full max-w-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Leave management</p><h2 className="mt-1 text-2xl font-black text-slate-900">Log leave request</h2><p className="mt-1 text-sm text-slate-500">Create a request for HR review. Weekends are excluded from the day count.</p></div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Close dialog"><X className="w-5 h-5" aria-hidden="true" /></button>
          </div>
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={event => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Employee<select name="employee_id" required defaultValue="" className="input-standard mt-1.5 appearance-none"><option value="" disabled>Select employee</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.department || 'No assignment'}</option>)}</select></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm font-semibold text-slate-700">Start date<input name="start_date" required type="date" className="input-standard mt-1.5" /></label>
              <label className="block text-sm font-semibold text-slate-700">End date<input name="end_date" required type="date" className="input-standard mt-1.5" /></label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Leave type<select name="leave_type" defaultValue="annual" className="input-standard mt-1.5 appearance-none"><option value="annual">Annual leave</option><option value="sick">Sick leave</option><option value="unpaid">Unpaid leave</option><option value="other">Other</option></select></label>
            <label className="block text-sm font-semibold text-slate-700">Reason / notes<textarea name="reason" rows={3} className="input-standard mt-1.5 resize-none" placeholder="Optional context for the request" /></label>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" className="flex-1" loading={isPending}><ClipboardCheck className="w-4 h-4" aria-hidden="true" /> Submit for review</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}
