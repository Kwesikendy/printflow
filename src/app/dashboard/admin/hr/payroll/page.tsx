import { createClient } from '@/lib/supabase/server'
import { PayrollDashboard, type PayrollEmployee, type PayrollRunView } from '@/components/admin/PayrollDashboard'
import type { SalaryPaymentMethod } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminPayrollPage() {
  const supabase = await createClient()

  const [{ data: profiles }, { data: settings }, { data: runs }] = await Promise.all([
    (supabase.from('profiles') as any)
      .select('id, full_name, email, role, department, is_active, monthly_basic_salary, monthly_allowances, monthly_other_deductions, payroll_deduction_notes, ssnit_number, ghana_card_number, bank_name, bank_account_name, bank_account_number, salary_payment_method')
      .order('full_name'),
    (supabase.from('payroll_settings') as any).select('*').maybeSingle(),
    (supabase.from('payroll_runs') as any).select('*').order('period_month', { ascending: false }).limit(12),
  ])

  const latestRun = runs?.[0] || null
  const { data: latestEntries } = latestRun
    ? await (supabase.from('payroll_entries') as any).select('*').eq('run_id', latestRun.id)
    : { data: [] }

  const employees: PayrollEmployee[] = (profiles || []).map((profile: any) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    department: profile.department || null,
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

  const employeeNames = new Map(employees.map(employee => [employee.id, employee.fullName]))
  const currentEntries = (latestEntries || []).map((entry: any) => ({
    ...entry,
    employeeName: employeeNames.get(entry.employee_id) || 'Former employee',
  }))

  const payrollSettings = settings || {
    tenant_id: '',
    tax_year: 2026,
    ssnit_employee_rate: 5.5,
    ssnit_employer_rate: 13,
    ssnit_ceiling: 25000,
    paye_bands: [],
  }

  const runViews: PayrollRunView[] = (runs || []).map((run: any) => ({
    id: run.id,
    periodMonth: run.period_month,
    status: run.status,
    totalGrossSalary: Number(run.total_gross_salary) || 0,
    totalPaye: Number(run.total_paye) || 0,
    totalNetSalary: Number(run.total_net_salary) || 0,
    totalEmployerCost: Number(run.total_employer_cost) || 0,
  }))

  return <PayrollDashboard employees={employees} settings={payrollSettings} latestRun={latestRun} latestEntries={currentEntries} runs={runViews} />
}
