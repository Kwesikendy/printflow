import { createClient } from '@/lib/supabase/server'
import { HRDashboard, type HRDepartmentEmployee, type HRLeaveRequest, type HRPayrollWorkspace } from '@/components/admin/HRDashboard'
import type { Role, PrintRoom, SalaryPaymentMethod } from '@/types/database'
import { getDefaultDepartment } from '@/lib/utils'

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminHRPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single() as { data: { role: string; is_active?: boolean } | null; error: any }

  if (!viewerProfile || viewerProfile.is_active === false || !['admin', 'accountant'].includes(viewerProfile.role)) {
    redirect('/dashboard')
  }

  const year = new Date().getFullYear()

  const [{ data: profiles }, { data: balances }, { data: leaveRequests }, { data: payrollSettings }, { data: payrollRuns }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    (supabase.from('employee_leave_balances') as any).select('employee_id, entitlement, used_days').eq('leave_year', year),
    (supabase.from('leave_requests') as any).select('*').order('created_at', { ascending: false }).limit(100),
    (supabase.from('payroll_settings') as any).select('*').maybeSingle(),
    (supabase.from('payroll_runs') as any).select('*').order('period_month', { ascending: false }).limit(12),
  ])

  const balanceByEmployee = new Map<string, { entitlement: number; used_days: number }>(
    (balances || []).map((balance: any) => [balance.employee_id, {
      entitlement: Number(balance.entitlement) || 20,
      used_days: Number(balance.used_days) || 0,
    }])
  )

  const employees: HRDepartmentEmployee[] = (profiles || []).map((profile: any) => ({
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone || null,
    role: profile.role as Role,
    department: profile.department || getDefaultDepartment(profile.role as Role, profile.print_room as PrintRoom | null),
    job_title: profile.job_title || null,
    employment_type: profile.employment_type || 'full_time',
    employment_start_date: profile.employment_start_date || null,
    print_room: profile.print_room as PrintRoom | null,
    is_active: profile.is_active,
    leave: balanceByEmployee.get(profile.id) || { entitlement: 20, used_days: 0 },
  }))

  const employeeById = new Map(employees.map(employee => [employee.id, employee]))
  const requests: HRLeaveRequest[] = (leaveRequests || []).map((request: any) => ({
    id: request.id,
    employeeId: request.employee_id,
    employeeName: employeeById.get(request.employee_id)?.full_name || 'Former employee',
    leaveType: request.leave_type,
    startDate: request.start_date,
    endDate: request.end_date,
    days: Number(request.days) || 0,
    reason: request.reason || null,
    status: request.status,
    createdAt: request.created_at,
  }))

  const payrollEmployees = (profiles || []).map((profile: any) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone || null,
    role: profile.role,
    department: profile.department || getDefaultDepartment(profile.role as Role, profile.print_room as PrintRoom | null),
    jobTitle: profile.job_title || null,
    employmentType: profile.employment_type || 'full_time',
    employmentStartDate: profile.employment_start_date || null,
    printRoom: profile.print_room || null,
    isActive: Boolean(profile.is_active),
    monthlyBasicSalary: Number(profile.monthly_basic_salary) || 0,
    monthlyAllowances: Number(profile.monthly_allowances) || 0,
    monthlyOtherDeductions: Number(profile.monthly_other_deductions) || 0,
    deductionNotes: profile.payroll_deduction_notes || '',
    ssnitNumber: profile.ssnit_number || '',
    ghanaCardNumber: profile.ghana_card_number || '',
    bankName: profile.bank_name || '',
    bankAccountName: profile.bank_account_name || '',
    bankAccountNumber: profile.bank_account_number || '',
    salaryPaymentMethod: (profile.salary_payment_method || 'bank') as SalaryPaymentMethod,
  }))

  const latestRun = payrollRuns?.[0] || null
  const employeeNames = new Map(payrollEmployees.map(employee => [employee.id, employee.fullName]))
  const { data: latestEntries } = latestRun
    ? await (supabase.from('payroll_entries') as any).select('*').eq('run_id', latestRun.id)
    : { data: [] }

  const payroll: HRPayrollWorkspace = {
    employees: payrollEmployees,
    settings: payrollSettings || { tax_year: 2026, ssnit_employee_rate: 5.5, ssnit_employer_rate: 13, ssnit_ceiling: 25000 },
    latestRun,
    latestEntries: (latestEntries || []).map((entry: any) => ({ ...entry, employeeName: employeeNames.get(entry.employee_id) || 'Former employee' })),
    runs: (payrollRuns || []).map((run: any) => ({
      id: run.id,
      periodMonth: run.period_month,
      status: run.status,
      totalGrossSalary: Number(run.total_gross_salary) || 0,
      totalPaye: Number(run.total_paye) || 0,
      totalNetSalary: Number(run.total_net_salary) || 0,
      totalEmployerCost: Number(run.total_employer_cost) || 0,
    })),
  }

  return <HRDashboard initialEmployees={employees} initialLeaveRequests={requests} year={year} payroll={payroll} />
}
