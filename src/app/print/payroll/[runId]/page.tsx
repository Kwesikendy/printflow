import { createClient } from '@/lib/supabase/server'
import { PrintButton } from '@/components/print/PrintButton'

export const dynamic = 'force-dynamic'

export default async function PayrollRegisterPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8">Sign in to view this payroll report.</div>

  const { data: viewer } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null; error: any }

  if (!viewer || !['admin', 'accountant'].includes(viewer.role)) {
    return <div className="p-8">Admin or accountant access required.</div>
  }

  const [{ data: run }, { data: tenant }] = await Promise.all([
    (supabase.from('payroll_runs') as any)
      .select('*')
      .eq('id', runId)
      .eq('tenant_id', viewer.tenant_id)
      .maybeSingle(),
    (supabase.from('tenants') as any)
      .select('name, logo_url, currency')
      .eq('id', viewer.tenant_id)
      .maybeSingle(),
  ])

  if (!run || !tenant) return <div className="p-8">Payroll report not found.</div>

  const { data: entries } = await (supabase.from('payroll_entries') as any)
    .select('*')
    .eq('run_id', runId)
    .eq('tenant_id', viewer.tenant_id)
    .order('created_at', { ascending: true })

  const employeeIds = (entries || []).map((entry: any) => entry.employee_id)
  const { data: employeeProfiles } = employeeIds.length > 0
    ? await (supabase.from('profiles') as any)
        .select('id, full_name, email, role, department')
        .eq('tenant_id', viewer.tenant_id)
        .in('id', employeeIds)
    : { data: [] }

  const employeesById = new Map((employeeProfiles || []).map((employee: any) => [employee.id, employee]))
  const period = new Date(`${String(run.period_month).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
  const currency = tenant.currency || 'GHS'
  const money = (value: number) => `${currency} ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] bg-white px-5 py-8 text-slate-900 sm:px-8 print:min-h-0 print:max-w-none print:px-0 print:py-0">
      <style>{'@page { size: landscape; margin: 12mm; }'}</style>
      <div className="mb-6 flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5 print:mb-4">
        <div className="flex items-center gap-4">
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-12 max-w-36 object-contain" />}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Payroll register</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{tenant.name}</h1>
            <p className="mt-1 text-sm text-slate-500">Payroll period: {period}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 print:hidden">
          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${run.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : run.status === 'approved' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>{run.status}</span>
          <PrintButton label="Print payroll" />
        </div>
        <div className="hidden text-right print:block"><p className="text-xs font-bold uppercase text-slate-500">Status</p><p className="mt-1 text-sm font-bold capitalize">{run.status}</p></div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 print:mb-4 print:grid-cols-4 print:gap-2">
        <Summary label="Gross payroll" value={money(run.total_gross_salary)} />
        <Summary label="Employee deductions" value={money(Number(run.total_employee_ssnit) + Number(run.total_paye) + Number(run.total_other_deductions))} />
        <Summary label="Net payroll" value={money(run.total_net_salary)} />
        <Summary label="Total employer cost" value={money(run.total_employer_cost)} />
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[1100px] border-collapse text-left text-[10px] print:min-w-0 print:text-[9px]">
          <thead className="bg-slate-100 text-[9px] uppercase tracking-wide text-slate-600 print:bg-slate-100">
            <tr>
              <th className="border border-slate-300 px-2 py-2">Employee</th>
              <th className="border border-slate-300 px-2 py-2">Role / department</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Basic</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Allowances</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Gross</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Employee SSNIT</th>
              <th className="border border-slate-300 px-2 py-2 text-right">PAYE</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Other deductions</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Net pay</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Employer SSNIT</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Employer cost</th>
            </tr>
          </thead>
          <tbody>
            {(entries || []).map((entry: any) => {
              const employee = employeesById.get(entry.employee_id) as any
              return <tr key={entry.id} className="break-inside-avoid even:bg-slate-50/70">
                <td className="border border-slate-300 px-2 py-2"><p className="font-bold">{employee?.full_name || 'Former employee'}</p><p className="mt-0.5 text-slate-500">{employee?.email || ''}</p></td>
                <td className="border border-slate-300 px-2 py-2">{employee?.department || employee?.role || '—'}</td>
                <MoneyCell value={entry.basic_salary} money={money} />
                <MoneyCell value={entry.allowances} money={money} />
                <MoneyCell value={entry.gross_salary} money={money} strong />
                <MoneyCell value={entry.employee_ssnit} money={money} />
                <MoneyCell value={entry.paye} money={money} />
                <MoneyCell value={entry.other_deductions} money={money} />
                <MoneyCell value={entry.net_salary} money={money} strong />
                <MoneyCell value={entry.employer_ssnit} money={money} />
                <MoneyCell value={entry.employer_cost} money={money} strong />
              </tr>
            })}
            {(entries || []).length === 0 && <tr><td colSpan={11} className="border border-slate-300 px-4 py-10 text-center text-sm text-slate-500">This payroll run has no employee entries.</td></tr>}
          </tbody>
          <tfoot className="bg-slate-100 font-black print:bg-slate-100">
            <tr>
              <td className="border border-slate-300 px-2 py-2" colSpan={2}>Payroll totals</td>
              <MoneyCell value={run.total_basic_salary} money={money} strong />
              <MoneyCell value={run.total_allowances} money={money} strong />
              <MoneyCell value={run.total_gross_salary} money={money} strong />
              <MoneyCell value={run.total_employee_ssnit} money={money} strong />
              <MoneyCell value={run.total_paye} money={money} strong />
              <MoneyCell value={run.total_other_deductions} money={money} strong />
              <MoneyCell value={run.total_net_salary} money={money} strong />
              <MoneyCell value={run.total_employer_ssnit} money={money} strong />
              <MoneyCell value={run.total_employer_cost} money={money} strong />
            </tr>
          </tfoot>
        </table>
      </div>

      <footer className="mt-5 flex flex-wrap justify-between gap-3 border-t border-slate-300 pt-3 text-[10px] text-slate-500 print:mt-4">
        <span>Confidential payroll record · For authorised HR and Finance use.</span>
        <span>Generated {new Date().toLocaleString('en-GH', { timeZone: 'Africa/Accra', dateStyle: 'medium', timeStyle: 'short' })}</span>
      </footer>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 px-3 py-2.5 print:rounded-none"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value}</p></div>
}

function MoneyCell({ value, money, strong = false }: { value: number; money: (value: number) => string; strong?: boolean }) {
  return <td className={`whitespace-nowrap border border-slate-300 px-2 py-2 text-right ${strong ? 'font-black' : ''}`}>{money(Number(value) || 0)}</td>
}
