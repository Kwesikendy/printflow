/**
 * PrintFlow Workday Utilities
 * 
 * In Ghana (Africa/Accra = UTC+0), each operational workday begins at 17:00 (5:00 PM)
 * and concludes at 16:59:59 (4:59:59 PM) the following calendar day.
 * 
 * This 5:00 PM boundary triggers the daily sequence reset where job IDs and invoices
 * start over from number 1 (PF-00001, INV-00001).
 */

export interface WorkdayBounds {
  start: Date
  end: Date
  label: string
  isCurrent: boolean
}

/**
 * Returns the 5:00 PM workday bounds for any given reference timestamp (defaults to now).
 */
export function getWorkdayBounds(reference: Date | string = new Date()): WorkdayBounds {
  const refDate = typeof reference === 'string' ? new Date(reference) : reference
  
  // Hours in Africa/Accra (UTC+0)
  const hour = refDate.getUTCHours()

  let startYear = refDate.getUTCFullYear()
  let startMonth = refDate.getUTCMonth()
  let startDate = refDate.getUTCDate()

  if (hour < 17) {
    // If before 5:00 PM, the current shift started yesterday at 17:00
    const yesterday = new Date(Date.UTC(startYear, startMonth, startDate - 1, 17, 0, 0, 0))
    startYear = yesterday.getUTCFullYear()
    startMonth = yesterday.getUTCMonth()
    startDate = yesterday.getUTCDate()
  }

  const start = new Date(Date.UTC(startYear, startMonth, startDate, 17, 0, 0, 0))
  // End of this 24-hour shift cycle is 24 hours later minus 1ms
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)

  const now = new Date()
  const isCurrent = now.getTime() >= start.getTime() && now.getTime() <= end.getTime()

  const startLabel = start.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Accra'
  })

  const endLabel = end.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Accra'
  })

  return {
    start,
    end,
    label: `${startLabel} (5:00 PM) – ${endLabel} (5:00 PM)`,
    isCurrent
  }
}

/**
 * Formats a shift date string for display.
 */
export function formatWorkdayShift(start: Date): string {
  return start.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Accra'
  }) + ' (5:00 PM Shift)'
}
