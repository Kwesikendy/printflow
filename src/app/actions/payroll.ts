'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SalaryPaymentMethod } from '@/types/database'

export interface PayrollActionResponse {
  success?: boolean
  error?: string
  runId?: string
}

const DEFAULT_PAYE_BANDS = [
  { limit: 588, rate: 0 },
  { limit: 80, rate: 5 },
  { limit: 100, rate: 10 },
  { limit: 2900, rate: 17.5 },
  { limit: 16000, rate: 25 },
  { limit: 30332, rate: 30 },
  { limit: null, rate: 35 },
]

type AdminContext = { userId: string; tenantId: string }

async function getAdminContext(): Promise<AdminContext | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null; error: any }

  if (!profile || profile.role !== 'admin') return { error: 'Only admins can manage payroll.' }
  return { userId: user.id, tenantId: profile.tenant_id }
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function calculatePaye(chargeableIncome: number, bands: Array<{ limit: number | null; rate: number }>) {
  let remaining = Math.max(0, chargeableIncome)
  let tax = 0
  for (const band of bands) {
    if (remaining <= 0) break
    const portion = band.limit === null ? remaining : Math.min(remaining, Number(band.limit))
    tax += portion * (Number(band.rate) / 100)
    remaining -= portion
  }
  return money(tax)
}

export async function updatePayrollProfile(employeeId: string, input: {
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
}): Promise<PayrollActionResponse> {
  const context = await getAdminContext()
  if ('error' in context) return context

  const numericValues = [input.monthlyBasicSalary, input.monthlyAllowances, input.monthlyOtherDeductions]
  if (numericValues.some(value => !Number.isFinite(value) || value < 0)) {
    return { error: 'Salary, allowances, and deductions must be valid non-negative amounts.' }
  }
  if (!['bank', 'mobile_money', 'cash'].includes(input.salaryPaymentMethod)) {
    return { error: 'Select a valid salary payment method.' }
  }

  const service = createServiceClient()
  const { error } = await (service.from('profiles') as any)
    .update({
      monthly_basic_salary: money(input.monthlyBasicSalary),
      monthly_allowances: money(input.monthlyAllowances),
      monthly_other_deductions: money(input.monthlyOtherDeductions),
      payroll_deduction_notes: input.deductionNotes.trim() || null,
      ssnit_number: input.ssnitNumber.trim() || null,
      ghana_card_number: input.ghanaCardNumber.trim() || null,
      bank_name: input.bankName.trim() || null,
      bank_account_name: input.bankAccountName.trim() || null,
      bank_account_number: input.bankAccountNumber.trim() || null,
      salary_payment_method: input.salaryPaymentMethod,
    })
    .eq('id', employeeId)
    .eq('tenant_id', context.tenantId)

  if (error) return { error: `Failed to save salary profile: ${error.message}` }
  revalidatePath('/dashboard/admin/hr/payroll')
  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}

export async function updatePayrollSettings(input: {
  ssnitEmployeeRate: number
  ssnitEmployerRate: number
  ssnitCeiling: number
}): Promise<PayrollActionResponse> {
  const context = await getAdminContext()
  if ('error' in context) return context

  if (![input.ssnitEmployeeRate, input.ssnitEmployerRate].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
    return { error: 'SSNIT rates must be between 0% and 100%.' }
  }
  if (!Number.isFinite(input.ssnitCeiling) || input.ssnitCeiling <= 0) {
    return { error: 'SSNIT ceiling must be greater than zero.' }
  }

  const service = createServiceClient()
  const { error } = await (service.from('payroll_settings') as any).upsert({
    tenant_id: context.tenantId,
    tax_year: 2026,
    ssnit_employee_rate: money(input.ssnitEmployeeRate),
    ssnit_employer_rate: money(input.ssnitEmployerRate),
    ssnit_ceiling: money(input.ssnitCeiling),
    paye_bands: DEFAULT_PAYE_BANDS,
    updated_by: context.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' })

  if (error) return { error: `Failed to save payroll settings: ${error.message}` }
  revalidatePath('/dashboard/admin/hr/payroll')
  return { success: true }
}

export async function createPayrollRun(period: string): Promise<PayrollActionResponse> {
  const context = await getAdminContext()
  if ('error' in context) return context
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { error: 'Choose a valid payroll month.' }

  const service = createServiceClient()
  const periodMonth = `${period}-01`
  const { data: existing } = await (service.from('payroll_runs') as any)
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('period_month', periodMonth)
    .maybeSingle()
  if (existing) return { error: 'A payroll run already exists for this month.' }

  const { data: settings } = await (service.from('payroll_settings') as any)
    .select('ssnit_employee_rate, ssnit_employer_rate, ssnit_ceiling, paye_bands')
    .eq('tenant_id', context.tenantId)
    .maybeSingle()

  const employeeRate = Number(settings?.ssnit_employee_rate) || 5.5
  const employerRate = Number(settings?.ssnit_employer_rate) || 13
  const ceiling = Number(settings?.ssnit_ceiling) || 25000
  const bands = Array.isArray(settings?.paye_bands) ? settings.paye_bands : DEFAULT_PAYE_BANDS

  const { data: employees, error: employeesError } = await (service.from('profiles') as any)
    .select('id, monthly_basic_salary, monthly_allowances, monthly_other_deductions, payroll_deduction_notes')
    .eq('tenant_id', context.tenantId)
    .eq('is_active', true)
    .order('full_name')
  if (employeesError) return { error: `Failed to load employees: ${employeesError.message}` }
  if (!employees || employees.length === 0) return { error: 'There are no active employees to include in payroll.' }

  const entries = employees.map((employee: any) => {
    const basicSalary = money(Number(employee.monthly_basic_salary) || 0)
    const allowances = money(Number(employee.monthly_allowances) || 0)
    const otherDeductions = money(Number(employee.monthly_other_deductions) || 0)
    const grossSalary = money(basicSalary + allowances)
    const ssnitBase = Math.min(basicSalary, ceiling)
    const employeeSsnit = money(ssnitBase * (employeeRate / 100))
    const employerSsnit = money(ssnitBase * (employerRate / 100))
    const paye = calculatePaye(grossSalary - employeeSsnit, bands)
    const netSalary = money(Math.max(0, grossSalary - employeeSsnit - paye - otherDeductions))
    return {
      tenant_id: context.tenantId,
      employee_id: employee.id,
      basic_salary: basicSalary,
      allowances,
      gross_salary: grossSalary,
      employee_ssnit: employeeSsnit,
      paye,
      other_deductions: otherDeductions,
      net_salary: netSalary,
      employer_ssnit: employerSsnit,
      employer_cost: money(grossSalary + employerSsnit),
      deduction_notes: employee.payroll_deduction_notes || null,
    }
  })

  const totals = entries.reduce((total: any, entry: any) => {
    total.total_basic_salary += entry.basic_salary
    total.total_allowances += entry.allowances
    total.total_gross_salary += entry.gross_salary
    total.total_employee_ssnit += entry.employee_ssnit
    total.total_paye += entry.paye
    total.total_other_deductions += entry.other_deductions
    total.total_net_salary += entry.net_salary
    total.total_employer_ssnit += entry.employer_ssnit
    total.total_employer_cost += entry.employer_cost
    return total
  }, {
    total_basic_salary: 0, total_allowances: 0, total_gross_salary: 0,
    total_employee_ssnit: 0, total_paye: 0, total_other_deductions: 0,
    total_net_salary: 0, total_employer_ssnit: 0, total_employer_cost: 0,
  })
  for (const key of Object.keys(totals)) totals[key] = money(totals[key])

  const { data: run, error: runError } = await (service.from('payroll_runs') as any)
    .insert({ tenant_id: context.tenantId, period_month: periodMonth, status: 'draft', created_by: context.userId, ...totals })
    .select('id')
    .single()
  if (runError || !run) return { error: `Failed to create payroll run: ${runError?.message || 'Unknown error'}` }

  const { error: entriesError } = await (service.from('payroll_entries') as any)
    .insert(entries.map((entry: any) => ({ ...entry, run_id: run.id })))
  if (entriesError) {
    await (service.from('payroll_runs') as any).delete().eq('id', run.id)
    return { error: `Failed to create payroll entries: ${entriesError.message}` }
  }

  revalidatePath('/dashboard/admin/hr/payroll')
  return { success: true, runId: run.id }
}

export async function approvePayrollRun(runId: string): Promise<PayrollActionResponse> {
  return updatePayrollRunStatus(runId, 'approved')
}

export async function markPayrollRunPaid(runId: string): Promise<PayrollActionResponse> {
  return updatePayrollRunStatus(runId, 'paid')
}

async function updatePayrollRunStatus(runId: string, status: 'approved' | 'paid'): Promise<PayrollActionResponse> {
  const context = await getAdminContext()
  if ('error' in context) return context
  const service = createServiceClient()
  const { data: run } = await (service.from('payroll_runs') as any)
    .select('status')
    .eq('id', runId)
    .eq('tenant_id', context.tenantId)
    .maybeSingle()
  if (!run) return { error: 'Payroll run not found.' }
  if (status === 'approved' && run.status !== 'draft') return { error: 'Only draft payroll runs can be approved.' }
  if (status === 'paid' && run.status !== 'approved') return { error: 'Only approved payroll runs can be marked as paid.' }

  const now = new Date().toISOString()
  const update = status === 'approved'
    ? { status, approved_by: context.userId, approved_at: now, updated_at: now }
    : { status, paid_by: context.userId, paid_at: now, updated_at: now }
  const { error } = await (service.from('payroll_runs') as any).update(update).eq('id', runId).eq('tenant_id', context.tenantId)
  if (error) return { error: `Failed to update payroll status: ${error.message}` }
  revalidatePath('/dashboard/admin/hr/payroll')
  return { success: true }
}
