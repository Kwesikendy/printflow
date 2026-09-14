import { type JobStatus, type Role } from '@/types/database'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// ============================================================
// GHS Currency Formatting
// ============================================================
export function formatCurrency(amount: number): string {
  return `₵${amount.toFixed(2)}`
}

// ============================================================
// Area Calculation
// ============================================================
export function calculateArea(width: number, height: number): number {
  return width * height
}

export function calculateLineTotal(area: number, unitCost: number, quantity: number): number {
  return Math.round(area * unitCost * quantity * 100) / 100
}

// ============================================================
// Job Status Labels & Colors
// ============================================================
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  quoted: 'Quoted',
  awaiting_payment: 'Awaiting Payment',
  paid_released: 'Paid – Released',
  in_production: 'In Production',
  completed: 'Completed',
  picked_up: 'Picked Up',
  cancelled: 'Cancelled',
}

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  quoted: 'bg-blue-100 text-blue-700',
  awaiting_payment: 'bg-yellow-100 text-yellow-700',
  paid_released: 'bg-green-100 text-green-700',
  in_production: 'bg-orange-100 text-orange-700',
  completed: 'bg-purple-100 text-purple-700',
  picked_up: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-700',
}

// ============================================================
// Role Labels
// ============================================================
export const ROLE_LABELS: Record<Role, string> = {
  front_desk: 'Front Desk',
  printer: 'Printer',
  accountant: 'Accountant',
  admin: 'Admin',
}

// ============================================================
// Payment Method Labels
// ============================================================
export const PAYMENT_METHOD_LABELS = {
  momo: 'Mobile Money',
  cash: 'Cash',
  other: 'Other',
} as const

// ============================================================
// Source Labels
// ============================================================
export const SOURCE_LABELS = {
  walk_in: 'Walk-In',
  marketing: 'Marketing',
} as const

// ============================================================
// Date Formatting
// ============================================================
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-GH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// Area Unit Labels
// ============================================================
export const AREA_UNIT_LABELS = {
  cm2: 'cm²',
  m2: 'm²',
  in2: 'in²',
} as const

// ============================================================
// Role Navigation Guards
// ============================================================
export function canAccessRoute(role: Role, pathname: string): boolean {
  if (role === 'admin') return true

  const printerRoutes = ['/dashboard/queue']
  const accountantRoutes = ['/dashboard/finance']
  const frontDeskRoutes = ['/dashboard/jobs', '/dashboard/pickup']

  if (role === 'printer') {
    return printerRoutes.some(r => pathname.startsWith(r))
  }
  if (role === 'accountant') {
    return accountantRoutes.some(r => pathname.startsWith(r)) ||
           pathname === '/dashboard'
  }
  if (role === 'front_desk') {
    return frontDeskRoutes.some(r => pathname.startsWith(r)) ||
           pathname === '/dashboard'
  }
  return false
}

// ============================================================
// Status Transition Helpers
// ============================================================
export function getDefaultDashboardPath(role: Role): string {
  switch (role) {
    case 'printer': return '/dashboard/queue'
    case 'accountant': return '/dashboard/finance'
    case 'front_desk': return '/dashboard/jobs'
    case 'admin': return '/dashboard/admin'
    default: return '/dashboard'
  }
}

// Check if a job can be cancelled
export function canCancelJob(status: JobStatus): boolean {
  return ['draft', 'quoted', 'awaiting_payment'].includes(status)
}

// Allowed next statuses based on role + current status
export function getAllowedTransitions(
  status: JobStatus,
  role: Role
): JobStatus[] {
  const transitions: Partial<Record<JobStatus, { statuses: JobStatus[]; roles: Role[] }[]>> = {
    draft: [{ statuses: ['quoted'], roles: ['front_desk', 'admin'] }],
    quoted: [{ statuses: ['awaiting_payment'], roles: ['front_desk', 'admin'] }],
    awaiting_payment: [{ statuses: ['paid_released'], roles: ['front_desk', 'admin'] }],
    paid_released: [{ statuses: ['in_production'], roles: ['printer', 'admin'] }],
    in_production: [{ statuses: ['completed'], roles: ['printer', 'admin'] }],
    completed: [{ statuses: ['picked_up'], roles: ['front_desk', 'admin'] }],
  }

  const result: JobStatus[] = []
  const possible = transitions[status] ?? []
  for (const t of possible) {
    if (t.roles.includes(role)) {
      result.push(...t.statuses)
    }
  }

  // Cancellation
  if (canCancelJob(status) && ['front_desk', 'admin'].includes(role)) {
    result.push('cancelled')
  }

  return result
}
