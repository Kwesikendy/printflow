import fs from 'fs'
import path from 'path'
import { createSystemBackup, type BackupResult } from '@/lib/backup'

const STATE_FILE = path.join(process.cwd(), 'backups', '.auto_backup_state.json')

export interface AutoBackupState {
  enabled: boolean
  lastRunAt: string | null
  lastFileName: string | null
  lastTotalRecords: number | null
  lastSuccess: boolean
  lastError: string | null
  schedule: string
}

function getInitialState(): AutoBackupState {
  return {
    enabled: true,
    lastRunAt: null,
    lastFileName: null,
    lastTotalRecords: null,
    lastSuccess: false,
    lastError: null,
    schedule: 'Daily at 23:00 UTC (End of Shift)',
  }
}

export function getAutoBackupState(): AutoBackupState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8')
      return { ...getInitialState(), ...JSON.parse(raw) }
    }
  } catch (err) {
    console.warn('[AutoBackup] Error reading state file:', err)
  }
  return getInitialState()
}

export function saveAutoBackupState(update: Partial<AutoBackupState>): AutoBackupState {
  try {
    const backupsDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }
    const current = getAutoBackupState()
    const nextState = { ...current, ...update }
    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2), 'utf-8')
    return nextState
  } catch (err) {
    console.warn('[AutoBackup] Error saving state file:', err)
    return { ...getInitialState(), ...update }
  }
}

let isRunningBackup = false

/**
 * Runs an automatic backup if not already running
 */
export async function runAutoBackup(reason = 'Automated Schedule'): Promise<BackupResult> {
  if (isRunningBackup) {
    return {
      success: false,
      fileName: '',
      filePath: '',
      sizeBytes: 0,
      recordCounts: {},
      totalRecords: 0,
      error: 'Backup already in progress',
    }
  }

  isRunningBackup = true
  console.log(`[AutoBackup] Starting automatic backup (${reason})...`)

  try {
    const result = await createSystemBackup({
      uploadToDrive: true,
      includeStorage: false, // Core database records (storage can be purged or backed up on-demand)
      retentionDays: 30,
    })

    saveAutoBackupState({
      lastRunAt: new Date().toISOString(),
      lastFileName: result.fileName,
      lastTotalRecords: result.totalRecords,
      lastSuccess: result.success,
      lastError: result.error || null,
    })

    console.log(`[AutoBackup] Completed successfully: ${result.fileName} (${result.totalRecords} records)`)
    return result
  } catch (err: any) {
    console.error('[AutoBackup] Failed:', err)
    saveAutoBackupState({
      lastRunAt: new Date().toISOString(),
      lastSuccess: false,
      lastError: err.message || 'Unknown backup error',
    })
    return {
      success: false,
      fileName: '',
      filePath: '',
      sizeBytes: 0,
      recordCounts: {},
      totalRecords: 0,
      error: err.message,
    }
  } finally {
    isRunningBackup = false
  }
}

let schedulerTimer: NodeJS.Timeout | null = null

/**
 * Evaluates whether an automated backup should execute right now
 */
async function checkSchedule() {
  const state = getAutoBackupState()
  if (!state.enabled) return

  const now = new Date()
  const hoursSinceLast = state.lastRunAt
    ? (now.getTime() - new Date(state.lastRunAt).getTime()) / (1000 * 60 * 60)
    : Infinity

  // Run if:
  // 1. Never run before, or
  // 2. More than 24 hours have elapsed, or
  // 3. It's late evening (>= 22:00) and no backup was taken today (>= 16 hours)
  const isShiftEnd = now.getUTCHours() >= 22
  const shouldRun = hoursSinceLast >= 24 || (isShiftEnd && hoursSinceLast >= 16)

  if (shouldRun) {
    console.log(`[AutoBackup] Triggering scheduled backup (Hours since last: ${hoursSinceLast.toFixed(1)}h)`)
    await runAutoBackup('Daily automated timer')
  }
}

/**
 * Boots the auto-backup background scheduler
 */
export function startAutoBackupScheduler() {
  if (schedulerTimer) {
    return // Already running
  }

  console.log('[AutoBackup] Auto-backup scheduler activated (Checks every 30 minutes)')

  // Initial check after 15 seconds to let server finish boot
  setTimeout(() => {
    checkSchedule().catch((err) => console.error('[AutoBackup] Check error:', err))
  }, 15000)

  // Periodic check every 30 minutes
  schedulerTimer = setInterval(() => {
    checkSchedule().catch((err) => console.error('[AutoBackup] Check error:', err))
  }, 30 * 60 * 1000)
}
