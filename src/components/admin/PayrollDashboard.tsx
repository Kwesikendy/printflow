'use client'

import { useState, useTransition } from 'react'
import { Banknote, Building2, Check, CreditCard, FileText, LockKeyhole, Pencil, Plus, ReceiptText, ShieldCheck, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { approvePayrollRun, createPayrollRun, markPayrollRunPaid, updatePayrollProfile, updatePayrollSettings } from '@/app/actions/payroll'
import type { SalaryPaymentMethod } from '@/types/database'

export interface PayrollEmployee {
  id: string
  fullName: string
  email: string
  role: string
  department: string | null
  isActive: boolean
  monthlyBasicSalary: number
  monthlyAllowances: number
  monthlyOtherDeductions: number
  deductionNotes: string
  ssnitNumber: string
  ghanaCardNumber: string
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
  salaryPaymentMethod: SalaryPaymentMethod
}

export interface PayrollRunView {
  id: string
  periodMonth: string
  status: 'draft' | 'approved' | 'paid'
  totalGrossSalary: number
  totalPaye: number
  totalNetSalary: number
  totalEmployerCost: number
}

type PayrollSettingsView = {
  tax_year: number
  ssnit_employee_rate: number
  ssnit_employer_rate: number
  ssnit_ceiling: number
}

type PayrollEntryView = {
  id: string
  employee_id: string
  employeeName: string
  basic_salary: number
  allowances: number
  gross_salary: number
  employee_ssnit: number
  paye: number
  other_deductions: number
  net_salary: number
  employer_ssnit: number
  employer_cost: number
  deduction_notes: string | null
}

const paymentLabels: Record<SalaryPaymentMethod, string> = { bank: 'Bank transfer', mobile_money: 'Mobile Money', cash: 'Cash' }

export function PayrollDashboard({ employees: initialEmployees, settings: initialSettings, latestRun, latestEntries, runs }: { employees: PayrollEmployee[]; settings: PayrollSettingsView; latestRun: any; latestEntries: PayrollEntryView[]; runs: PayrollRunView[] }) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [settings, setSettings] = useState({
    employeeRate: Number(initialSettings.ssnit_employee_rate) || 5.5,
    employerRate: Number(initialSettings.ssnit_employer_rate) || 13,
    ceiling: Number(initialSettings.ssnit_ceiling) || 25000,
  })
  const [payrollMonth, setPayrollMonth] = useState(currentMonth())
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null)
  const [isPending, startTransition] = useTransition()

  const totals = latestRun ? {
    gross: Number(latestRun.total_gross_salary) || 0,
    paye: Number(latestRun.total_paye) || 0,
    net: Number(latestRun.total_net_salary) || 0,
    employerCost: Number(latestRun.total_employer_cost) || 0,
  } : { gross: 0, paye: 0, net: 0, employerCost: 0 }

  const saveEmployee = (formData: FormData) => {
    if (!editingEmployee) return
    const employeeId = editingEmployee.id
    const payload = {
      monthlyBasicSalary: Number(formData.get('monthly_basic_salary') || 0),
      monthlyAllowances: Number(formData.get('monthly_allowances') || 0),
      monthlyOtherDeductions: Number(formData.get('monthly_other_deductions') || 0),
      deductionNotes: String(formData.get('payroll_deduction_notes') || ''),
      ssnitNumber: String(formData.get('ssnit_number') || ''),
      ghanaCardNumber: String(formData.get('ghana_card_number') || ''),
      bankName: String(formData.get('bank_name') || ''),
      bankAccountName: String(formData.get('bank_account_name') || ''),
      bankAccountNumber: String(formData.get('bank_account_number') || ''),
      salaryPaymentMethod: String(formData.get('salary_payment_method') || 'bank') as SalaryPaymentMethod,
    }
    startTransition(async () => {
      const result = await updatePayrollProfile(employeeId, payload)
      if (result.error) {
        toast.error(result.error)
      } else {
        setEmployees(current => current.map(employee => employee.id === employeeId ? {
          ...employee,
          monthlyBasicSalary: payload.monthlyBasicSalary,
          monthlyAllowances: payload.monthlyAllowances,
          monthlyOtherDeductions: payload.monthlyOtherDeductions,
          deductionNotes: payload.deductionNotes,
          ssnitNumber: payload.ssnitNumber,
          ghanaCardNumber: payload.ghanaCardNumber,
          bankName: payload.bankName,
          bankAccountName: payload.bankAccountName,
          bankAccountNumber: payload.bankAccountNumber,
          salaryPaymentMethod: payload.salaryPaymentMethod,
        } : employee))
        setEditingEmployee(null)
        toast.success('Salary profile updated')
      }
    })
  }

  const saveSettings = () => {
    startTransition(async () => {
      const result = await updatePayrollSettings({ ssnitEmployeeRate: settings.employeeRate, ssnitEmployerRate: settings.employerRate, ssnitCeiling: settings.ceiling })
      if (result.error) toast.error(result.error)
      else toast.success('Payroll settings updated')
    })
  }

  const createRun = () => {
    startTransition(async () => {
      const result = await createPayrollRun(payrollMonth)
      if (result.error) toast.error(result.error)
      else { toast.success('Payroll draft created'); window.location.reload() }
    })
  }

  const advanceRun = () => {
    if (!latestRun) return
    startTransition(async () => {
      const result = latestRun.status === 'draft' ? await approvePayrollRun(latestRun.id) : await markPayrollRunPaid(latestRun.id)
      if (result.error) toast.error(result.error)
      else { toast.success(latestRun.status === 'draft' ? 'Payroll approved' : 'Payroll payment recorded'); window.location.reload() }
    })
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 p-6 sm:p-8 text-white shadow-[0_18px_50px_-20px_rgba(30,41,59,0.6)]">
        <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-indigo-200 text-sm font-semibold"><Banknote className="w-4 h-4" aria-hidden="true" /> HR payroll workspace</div><h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Salary & payroll</h1><p className="mt-2 text-indigo-100">Prepare employee pay, review deductions, approve the payroll, and hand the final release to Finance.</p></div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end"><label className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-200">Payroll month<input type="month" value={payrollMonth} onChange={event => setPayrollMonth(event.target.value)} className="mt-1.5 block rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-white/60" /></label><Button variant="primary" onClick={createRun} loading={isPending}><Plus className="w-4 h-4" aria-hidden="true" /> Create draft</Button></div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <PayrollSummary icon={<ReceiptText className="w-5 h-5" aria-hidden="true" />} label="Gross payroll" value={formatGhs(totals.gross)} detail={latestRun ? formatMonth(latestRun.period_month) : 'Create a draft to calculate'} tone="indigo" />
        <PayrollSummary icon={<ShieldCheck className="w-5 h-5" aria-hidden="true" />} label="PAYE withheld" value={formatGhs(totals.paye)} detail="Remit to GRA by due date" tone="amber" />
        <PayrollSummary icon={<Banknote className="w-5 h-5" aria-hidden="true" />} label="Net to employees" value={formatGhs(totals.net)} detail="After statutory deductions" tone="emerald" />
        <PayrollSummary icon={<Building2 className="w-5 h-5" aria-hidden="true" />} label="Employer cost" value={formatGhs(totals.employerCost)} detail="Gross plus employer SSNIT" tone="violet" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <Card noHover>
          <CardHeader title="Employee compensation" description="HR-owned salary inputs used when the next payroll draft is calculated." />
          <CardContent className="pt-0"><div className="table-container -mx-4 sm:-mx-6"><table className="table-standard min-w-[850px]"><thead><tr><th className="pl-4 sm:pl-6">Employee</th><th>Basic salary</th><th>Allowances</th><th>Other deductions</th><th>Pay method</th><th className="pr-4 sm:pr-6 text-right">Edit</th></tr></thead><tbody>{employees.map(employee => <tr key={employee.id}><td className="pl-4 sm:pl-6"><p className="font-bold text-slate-900">{employee.fullName}</p><p className="mt-1 text-xs text-slate-500">{employee.department || employee.role}{employee.isActive ? '' : ' · Inactive'}</p></td><td className="font-semibold text-slate-700">{formatGhs(employee.monthlyBasicSalary)}</td><td className="font-semibold text-slate-700">{formatGhs(employee.monthlyAllowances)}</td><td><p className="font-semibold text-slate-700">{formatGhs(employee.monthlyOtherDeductions)}</p>{employee.deductionNotes && <p className="mt-1 max-w-[150px] truncate text-xs text-slate-400" title={employee.deductionNotes}>{employee.deductionNotes}</p>}</td><td><span className="text-xs font-semibold text-slate-600">{paymentLabels[employee.salaryPaymentMethod]}</span></td><td className="pr-4 sm:pr-6 text-right"><button type="button" onClick={() => setEditingEmployee(employee)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit</button></td></tr>)}{employees.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">No employee profiles found.</td></tr>}</tbody></table></div></CardContent>
        </Card>

        <Card noHover>
          <CardHeader title="Payroll settings" description="Current statutory assumptions used for new drafts." />
          <CardContent className="space-y-4">
            <SettingInput label="Employee SSNIT rate" suffix="%" value={settings.employeeRate} onChange={value => setSettings(current => ({ ...current, employeeRate: value }))} />
            <SettingInput label="Employer pension contribution" suffix="%" value={settings.employerRate} onChange={value => setSettings(current => ({ ...current, employerRate: value }))} />
            <SettingInput label="SSNIT salary ceiling" suffix="GHS" value={settings.ceiling} onChange={value => setSettings(current => ({ ...current, ceiling: value }))} />
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><span className="font-bold">PAYE:</span> the configured 2026 graduated bands are used for chargeable income after employee SSNIT. Confirm rates with your accountant before approval.</div>
            <Button variant="outline" className="w-full" onClick={saveSettings} loading={isPending}><Check className="w-4 h-4" aria-hidden="true" /> Save settings</Button>
          </CardContent>
        </Card>
      </div>

      <Card noHover>
        <CardHeader title="Latest payroll run" description={latestRun ? `${formatMonth(latestRun.period_month)} · ${latestRun.status}` : 'No payroll run has been created yet.'} action={latestRun && <RunActionButton status={latestRun.status} onClick={advanceRun} loading={isPending} />} />
        <CardContent className="pt-0"><div className="table-container -mx-4 sm:-mx-6"><table className="table-standard min-w-[1050px]"><thead><tr><th className="pl-4 sm:pl-6">Employee</th><th>Gross</th><th>Employee SSNIT</th><th>PAYE</th><th>Other deductions</th><th>Net pay</th><th>Employer cost</th><th className="pr-4 sm:pr-6">Payslip</th></tr></thead><tbody>{latestEntries.map(entry => <tr key={entry.id}><td className="pl-4 sm:pl-6 font-bold text-slate-900">{entry.employeeName}</td><td>{formatGhs(entry.gross_salary)}</td><td>{formatGhs(entry.employee_ssnit)}</td><td>{formatGhs(entry.paye)}</td><td>{formatGhs(entry.other_deductions)}</td><td className="font-black text-emerald-700">{formatGhs(entry.net_salary)}</td><td>{formatGhs(entry.employer_cost)}</td><td className="pr-4 sm:pr-6"><a href={`/print/payslip/${latestRun?.id}/${entry.employee_id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"><FileText className="w-3.5 h-3.5" aria-hidden="true" /> View</a></td></tr>)}{latestEntries.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">Create a draft to see the employee-by-employee payroll calculation.</td></tr>}</tbody></table></div></CardContent>
      </Card>

      <Card noHover><CardHeader title="Payroll history" description="A record of draft, approved, and paid payroll periods." /><CardContent className="pt-0"><div className="table-container -mx-4 sm:-mx-6"><table className="table-standard min-w-[700px]"><thead><tr><th className="pl-4 sm:pl-6">Period</th><th>Status</th><th>Gross payroll</th><th>Net payroll</th><th className="pr-4 sm:pr-6">Employer cost</th></tr></thead><tbody>{runs.map(run => <tr key={run.id}><td className="pl-4 sm:pl-6 font-bold text-slate-900">{formatMonth(run.periodMonth)}</td><td><PayrollStatus status={run.status} /></td><td>{formatGhs(run.totalGrossSalary)}</td><td className="font-semibold text-emerald-700">{formatGhs(run.totalNetSalary)}</td><td className="pr-4 sm:pr-6">{formatGhs(run.totalEmployerCost)}</td></tr>)}{runs.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">No payroll history yet.</td></tr>}</tbody></table></div></CardContent></Card>

      {editingEmployee && <EmployeePayModal employee={editingEmployee} error={null} isPending={isPending} onClose={() => setEditingEmployee(null)} onSubmit={saveEmployee} />}
    </div>
  )
}

function EmployeePayModal({ employee, error, isPending, onClose, onSubmit }: { employee: PayrollEmployee; error: string | null; isPending: boolean; onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-label="Close salary profile dialog" /><Card noHover className="relative z-10 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"><CardContent className="p-6 sm:p-8"><div className="flex items-start justify-between gap-4 mb-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Salary profile</p><h2 className="mt-1 text-2xl font-black text-slate-900">{employee.fullName}</h2><p className="mt-1 text-sm text-slate-500">Keep payroll-sensitive data restricted to authorized HR administrators.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Close dialog"><X className="w-5 h-5" aria-hidden="true" /></button></div>{error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<form onSubmit={event => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }} className="space-y-5"><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><MoneyField name="monthly_basic_salary" label="Monthly basic salary" defaultValue={employee.monthlyBasicSalary} /><MoneyField name="monthly_allowances" label="Monthly allowances" defaultValue={employee.monthlyAllowances} /><MoneyField name="monthly_other_deductions" label="Other deductions" defaultValue={employee.monthlyOtherDeductions} /></div><label className="block text-sm font-semibold text-slate-700">Deduction notes<textarea name="payroll_deduction_notes" defaultValue={employee.deductionNotes} rows={2} className="input-standard mt-1.5 resize-none" placeholder="Loan, advance, insurance, or other authorised deduction" /></label><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><TextField name="ssnit_number" label="SSNIT number" defaultValue={employee.ssnitNumber} /><TextField name="ghana_card_number" label="Ghana Card number" defaultValue={employee.ghanaCardNumber} /><TextField name="bank_name" label="Bank / provider" defaultValue={employee.bankName} /><TextField name="bank_account_name" label="Account name" defaultValue={employee.bankAccountName} /><TextField name="bank_account_number" label="Account / wallet number" defaultValue={employee.bankAccountNumber} /><label className="block text-sm font-semibold text-slate-700">Payment method<select name="salary_payment_method" defaultValue={employee.salaryPaymentMethod} className="input-standard mt-1.5 appearance-none"><option value="bank">Bank transfer</option><option value="mobile_money">Mobile Money</option><option value="cash">Cash</option></select></label></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Salary and payment details are confidential and should only be accessed by authorised HR/Finance staff.</div><div className="flex flex-col-reverse sm:flex-row gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" className="flex-1" loading={isPending}><Check className="w-4 h-4" aria-hidden="true" /> Save salary profile</Button></div></form></CardContent></Card></div>
}

function MoneyField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) { return <label className="block text-sm font-semibold text-slate-700">{label}<div className="relative mt-1.5"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">GHS</span><input name={name} type="number" min="0" step="0.01" defaultValue={defaultValue} className="input-standard pl-12" /></div></label> }
function TextField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) { return <label className="block text-sm font-semibold text-slate-700">{label}<input name={name} defaultValue={defaultValue} className="input-standard mt-1.5" /></label> }
function SettingInput({ label, suffix, value, onChange }: { label: string; suffix: string; value: number; onChange: (value: number) => void }) { return <label className="block text-sm font-semibold text-slate-700">{label}<div className="relative mt-1.5"><input type="number" min="0" step="0.01" value={value} onChange={event => onChange(Number(event.target.value))} className="input-standard pr-14" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{suffix}</span></div></label> }
function RunActionButton({ status, onClick, loading }: { status: 'draft' | 'approved' | 'paid'; onClick: () => void; loading: boolean }) { if (status === 'paid') return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Paid</span>; return <Button variant={status === 'draft' ? 'primary' : 'success'} size="sm" onClick={onClick} loading={loading}>{status === 'draft' ? 'Approve payroll' : 'Record payment released'}</Button> }
function PayrollStatus({ status }: { status: 'draft' | 'approved' | 'paid' }) { const styles = { draft: 'bg-amber-50 text-amber-700 border-amber-100', approved: 'bg-indigo-50 text-indigo-700 border-indigo-100', paid: 'bg-emerald-50 text-emerald-700 border-emerald-100' }; return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${styles[status]}`}>{status}</span> }
function PayrollSummary({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: 'indigo' | 'amber' | 'emerald' | 'violet' }) { const tones = { indigo: 'bg-indigo-50 text-indigo-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' }; return <Card noHover><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs font-medium text-slate-500">{detail}</p></div><div className={`rounded-2xl p-3 ${tones[tone]}`}>{icon}</div></div></CardContent></Card> }
function formatGhs(value: number) { return `GHS ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function formatMonth(value: string) { return new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }) }
function currentMonth() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
