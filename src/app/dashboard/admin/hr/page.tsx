import { createClient } from '@/lib/supabase/server'
import { HRDashboard, type HRDepartmentEmployee, type HRLeaveRequest } from '@/components/admin/HRDashboard'
import type { Role, PrintRoom } from '@/types/database'
import { getDefaultDepartment } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminHRPage() {
  const supabase = await createClient()
  const year = new Date().getFullYear()

  const [{ data: profiles }, { data: balances }, { data: leaveRequests }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    (supabase.from('employee_leave_balances') as any).select('employee_id, entitlement, used_days').eq('leave_year', year),
    (supabase.from('leave_requests') as any).select('*').order('created_at', { ascending: false }).limit(100),
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

  return <HRDashboard initialEmployees={employees} initialLeaveRequests={requests} year={year} />
}
