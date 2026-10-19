'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { LeaveRequestStatus, LeaveRequestType } from '@/types/database'

export interface HRActionResponse {
  success?: boolean
  error?: string
}

type AdminProfile = { id: string; tenant_id: string; role: string }

async function getAdminContext(): Promise<{ userId: string; profile: AdminProfile } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single() as { data: AdminProfile | null; error: any }

  if (!profile || profile.role !== 'admin') return { error: 'Only admins can manage leave requests.' }
  return { userId: user.id, profile }
}

function countWorkingDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  let days = 0
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days += 1
  }
  return days
}

export async function createLeaveRequest(input: {
  employeeId: string
  startDate: string
  endDate: string
  leaveType: LeaveRequestType
  reason: string
}): Promise<HRActionResponse> {
  const context = await getAdminContext()
  if ('error' in context) return context

  if (!input.employeeId || !input.startDate || !input.endDate) {
    return { error: 'Employee, start date, and end date are required.' }
  }

  if (!['annual', 'sick', 'unpaid', 'other'].includes(input.leaveType)) {
    return { error: 'Please select a valid leave type.' }
  }

  if (input.startDate > input.endDate) return { error: 'End date must be on or after the start date.' }
  if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
    return { error: 'Leave requests must stay within one calendar year.' }
  }

  const days = countWorkingDays(input.startDate, input.endDate)
  if (days < 1) return { error: 'The selected range contains no working days.' }

  const service = createServiceClient()
  const { data: employee } = await (service.from('profiles') as any)
    .select('id')
    .eq('id', input.employeeId)
    .eq('tenant_id', context.profile.tenant_id)
    .maybeSingle()
  if (!employee) return { error: 'Employee not found in your tenant.' }

  const { data: overlap } = await (service.from('leave_requests') as any)
    .select('id')
    .eq('tenant_id', context.profile.tenant_id)
    .eq('employee_id', input.employeeId)
    .in('status', ['pending', 'approved'])
    .lte('start_date', input.endDate)
    .gte('end_date', input.startDate)
    .limit(1)
  if (overlap && overlap.length > 0) return { error: 'This employee already has an overlapping leave request.' }

  const { error } = await (service.from('leave_requests') as any).insert({
    tenant_id: context.profile.tenant_id,
    employee_id: input.employeeId,
    requested_by: context.userId,
    start_date: input.startDate,
    end_date: input.endDate,
    days,
    leave_type: input.leaveType,
    reason: input.reason?.trim() || null,
    status: 'pending',
  })

  if (error) return { error: `Failed to create leave request: ${error.message}` }
  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}

export async function reviewLeaveRequest(
  requestId: string,
  status: Extract<LeaveRequestStatus, 'approved' | 'rejected'>,
  reviewNote = ''
): Promise<HRActionResponse> {
  const context = await getAdminContext()
  if ('error' in context) return context

  const service = createServiceClient()
  const { data: request, error: requestError } = await (service.from('leave_requests') as any)
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', context.profile.tenant_id)
    .single()
  if (requestError || !request) return { error: 'Leave request not found.' }
  if (request.status !== 'pending') return { error: 'This leave request has already been reviewed.' }

  if (status === 'approved') {
    const leaveYear = Number(String(request.start_date).slice(0, 4))
    const { data: balance } = await (service.from('employee_leave_balances') as any)
      .select('entitlement, used_days')
      .eq('employee_id', request.employee_id)
      .eq('leave_year', leaveYear)
      .maybeSingle()

    const entitlement = Number(balance?.entitlement) || 20
    const usedDays = Number(balance?.used_days) || 0
    if (usedDays + Number(request.days) > entitlement) {
      return { error: `Approval would exceed this employee's ${entitlement}-day allowance.` }
    }

    const { error: balanceError } = await (service.from('employee_leave_balances') as any)
      .upsert({
        tenant_id: context.profile.tenant_id,
        employee_id: request.employee_id,
        leave_year: leaveYear,
        entitlement,
        used_days: usedDays + Number(request.days),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'employee_id,leave_year' })
    if (balanceError) return { error: `Failed to update leave balance: ${balanceError.message}` }
  }

  const { error } = await (service.from('leave_requests') as any)
    .update({
      status,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('tenant_id', context.profile.tenant_id)

  if (error) return { error: `Failed to review leave request: ${error.message}` }
  revalidatePath('/dashboard/admin/hr')
  return { success: true }
}
