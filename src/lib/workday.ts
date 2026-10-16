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

/**
 * Returns the shift start date string (YYYY-MM-DD) for a given timestamp.
 * In Ghana (UTC+0), hours >= 17 start that day's shift (e.g. Oct 15 17:00 -> '2026-10-15').
 * Hours < 17 belong to the shift that began yesterday at 17:00 (e.g. Oct 16 03:00 -> '2026-10-15').
 */
export function getShiftDateString(reference: Date | string = new Date()): string {
  const d = typeof reference === 'string' ? new Date(reference) : reference
  const bounds = getWorkdayBounds(d)
  const y = bounds.start.getUTCFullYear()
  const m = String(bounds.start.getUTCMonth() + 1).padStart(2, '0')
  const day = String(bounds.start.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Returns the 6-digit YYMMDD code embedded in job and invoice numbers (e.g. '261015')
 */
export function getShiftDateCode(reference: Date | string = new Date()): string {
  const dateStr = getShiftDateString(reference)
  const [yyyy, mm, dd] = dateStr.split('-')
  return `${yyyy.slice(-2)}${mm}${dd}`
}

/**
 * Given a shift date string (YYYY-MM-DD), returns the 5:00 PM - 5:00 PM bounds for that shift.
 */
export function getShiftBoundsFromDateString(shiftDateStr: string): WorkdayBounds {
  const [y, m, d] = shiftDateStr.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d, 17, 0, 0, 0))
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
 * Returns the shift date string for the shift prior to the given shift date string.
 */
export function getPreviousShiftDateString(shiftDateStr: string): string {
  const [y, m, d] = shiftDateStr.split('-').map(Number)
  const prevDate = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0))
  const py = prevDate.getUTCFullYear()
  const pm = String(prevDate.getUTCMonth() + 1).padStart(2, '0')
  const pd = String(prevDate.getUTCDate()).padStart(2, '0')
  return `${py}-${pm}-${pd}`
}

/**
 * Checks whether a record's timestamp falls within the shift bounds.
 */
export function isTimestampInShift(
  timestamp: string | Date | null | undefined,
  shiftBounds: { start: Date; end: Date }
): boolean {
  if (!timestamp) return false
  const time = new Date(timestamp).getTime()
  return time >= shiftBounds.start.getTime() && time <= shiftBounds.end.getTime()
}

/**
 * Checks if an invoice belongs to a shift (either by timestamp in bounds or by matching shift code).
 */
export function isInvoiceInShift(
  invoice: { issued_at?: string | null; invoice_number?: string | null },
  shiftBounds: { start: Date; end: Date; label: string }
): boolean {
  if (isTimestampInShift(invoice.issued_at, shiftBounds)) {
    return true
  }
  // Secondary check: if the invoice number explicitly matches this shift's YYMMDD code
  if (invoice.invoice_number) {
    const y = String(shiftBounds.start.getUTCFullYear()).slice(-2)
    const m = String(shiftBounds.start.getUTCMonth() + 1).padStart(2, '0')
    const d = String(shiftBounds.start.getUTCDate()).padStart(2, '0')
    const shiftCode = `${y}${m}${d}`
    if (invoice.invoice_number.includes(`-${shiftCode}-`)) {
      return true
    }
  }
  return false
}

