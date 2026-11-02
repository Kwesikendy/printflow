import fs from 'fs'
import path from 'path'
import { ZipArchive } from 'archiver'
import { createServiceClient } from '@/lib/supabase/server'
import { uploadBackupToDrive, cleanOldDriveBackups, type GoogleDriveUploadResult } from '@/lib/google-drive'

export const BACKUP_TABLES = [
  'tenants',
  'profiles',
  'product_types',
  'pricing_rules',
  'standard_sizes',
  'customers',
  'job_groups',
  'jobs',
  'job_status_events',
  'job_sequences',
  'invoices',
  'payments',
  'expenditures',
  'materials',
  'payroll_settings',
  'payroll_runs',
  'payroll_entries',
  'employee_leave_balances',
  'leave_requests',
]

export interface BackupManifest {
  createdAt: string
  generator: string
  version: string
  totalRecords: number
  tableCounts: Record<string, number>
  storageFilesCount: number
  includeStorage: boolean
}

export interface LocalBackupInfo {
  fileName: string
  sizeBytes: number
  createdAt: string
  hasStorage: boolean
}

export interface BackupResult {
  success: boolean
  fileName: string
  filePath: string
  sizeBytes: number
  recordCounts: Record<string, number>
  totalRecords: number
  driveUpload?: GoogleDriveUploadResult
  error?: string
}

const BACKUPS_DIR = path.join(process.cwd(), 'backups')

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true })
  }
}

/**
 * Paginates through all records in a Supabase table using the service client
 */
async function fetchTableData(supabase: any, table: string): Promise<any[]> {
  const pageSize = 1000
  let from = 0
  const records: any[] = []

  try {
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + pageSize - 1)

      if (error) {
        console.warn(`[Backup] Table ${table} fetch warning:`, error.message)
        break
      }

      if (!data || data.length === 0) break

      records.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
  } catch (err: any) {
    console.error(`[Backup] Error querying table ${table}:`, err.message)
  }

  return records
}

/**
 * Recursively lists all file keys in a Supabase storage bucket
 */
async function listStorageFiles(supabase: any, bucket: string, prefix = ''): Promise<string[]> {
  const files: string[] = []

  try {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error || !data) return files

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name
      // If item has no id or metadata, it is a directory folder in Supabase storage
      if (!item.id && !item.metadata) {
        const subFiles = await listStorageFiles(supabase, bucket, itemPath)
        files.push(...subFiles)
      } else {
        files.push(itemPath)
      }
    }
  } catch (err: any) {
    console.warn(`[Backup] Error listing storage bucket ${bucket}:`, err.message)
  }

  return files
}

/**
 * Core function to generate a complete backup archive (.zip)
 */
export async function createSystemBackup(options: {
  includeStorage?: boolean
  uploadToDrive?: boolean
  retentionDays?: number
}): Promise<BackupResult> {
  ensureBackupsDir()

  const { includeStorage = false, uploadToDrive = false, retentionDays = 30 } = options
  const supabase = createServiceClient()

  const timestamp = new Date()
  const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const fileName = `printflow-backup-${dateStr}${includeStorage ? '-full' : ''}.zip`
  const filePath = path.join(BACKUPS_DIR, fileName)

  const output = fs.createWriteStream(filePath)
  const archive = new ZipArchive({ zlib: { level: 9 } })

  return new Promise(async (resolve) => {
    output.on('close', async () => {
      const stats = fs.statSync(filePath)
      let driveUploadResult: GoogleDriveUploadResult | undefined

      if (uploadToDrive) {
        try {
          driveUploadResult = await uploadBackupToDrive(filePath, fileName)
          if (retentionDays > 0) {
            await cleanOldDriveBackups(retentionDays).catch((e) =>
              console.warn('[Backup] Drive cleanup error:', e)
            )
          }
        } catch (uploadErr: any) {
          console.error('[Backup] Google Drive upload failed:', uploadErr)
        }
      }

      // Auto-prune old local backups: keep only the last 7 to save disk space
      try {
        cleanOldLocalBackups(7)
      } catch (cleanErr: any) {
        console.warn('[Backup] Local cleanup warning:', cleanErr.message)
      }

      resolve({
        success: true,
        fileName,
        filePath,
        sizeBytes: stats.size,
        recordCounts: manifest.tableCounts,
        totalRecords: manifest.totalRecords,
        driveUpload: driveUploadResult,
      })
    })

    archive.on('error', (err) => {
      console.error('[Backup] Archive error:', err)
      resolve({
        success: false,
        fileName,
        filePath,
        sizeBytes: 0,
        recordCounts: {},
        totalRecords: 0,
        error: err.message,
      })
    })

    archive.pipe(output)

    // 1. Fetch data from all tables
    const tableCounts: Record<string, number> = {}
    const consolidatedData: Record<string, any[]> = {}
    let totalRecords = 0

    for (const table of BACKUP_TABLES) {
      const rows = await fetchTableData(supabase, table)
      tableCounts[table] = rows.length
      totalRecords += rows.length
      consolidatedData[table] = rows

      // Append individual table JSON to zip
      archive.append(JSON.stringify(rows, null, 2), {
        name: `database/${table}.json`,
      })
    }

    // Append consolidated all_data.json
    archive.append(JSON.stringify(consolidatedData, null, 2), {
      name: 'database/all_tables_consolidated.json',
    })

    // 2. Storage files (if requested)
    let storageFilesCount = 0
    if (includeStorage) {
      try {
        const filePaths = await listStorageFiles(supabase, 'artworks')
        for (const storagePath of filePaths) {
          const { data, error } = await supabase.storage.from('artworks').download(storagePath)
          if (!error && data) {
            const buffer = Buffer.from(await data.arrayBuffer())
            archive.append(buffer, { name: `storage/artworks/${storagePath}` })
            storageFilesCount++
          }
        }
      } catch (storageErr: any) {
        console.warn('[Backup] Storage download error:', storageErr.message)
      }
    }

    // 3. Manifest file
    const manifest: BackupManifest = {
      createdAt: timestamp.toISOString(),
      generator: 'PrintFlow Backup Engine',
      version: '1.0.0',
      totalRecords,
      tableCounts,
      storageFilesCount,
      includeStorage,
    }

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    // Finalize the archive
    await archive.finalize()
  })
}

/**
 * Lists all existing local backups in the backups/ folder
 */
export function getLocalBackups(): LocalBackupInfo[] {
  ensureBackupsDir()

  try {
    const files = fs.readdirSync(BACKUPS_DIR)
    const backupFiles = files.filter((f) => f.startsWith('printflow-backup-') && f.endsWith('.zip'))

    return backupFiles
      .map((fileName) => {
        const fullPath = path.join(BACKUPS_DIR, fileName)
        const stats = fs.statSync(fullPath)
        return {
          fileName,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
          hasStorage: fileName.includes('-full'),
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (err) {
    console.error('[Backup] Error reading local backups:', err)
    return []
  }
}

/**
 * Deletes a local backup file safely (prevents directory traversal)
 */
export function deleteLocalBackup(fileName: string): boolean {
  ensureBackupsDir()

  const safeFileName = path.basename(fileName)
  if (!safeFileName.startsWith('printflow-backup-') || !safeFileName.endsWith('.zip')) {
    throw new Error('Invalid backup file name.')
  }

  const targetPath = path.join(BACKUPS_DIR, safeFileName)
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
    return true
  }

  return false
}

/**
 * Retention policy: Keeps only the most recent N local backups (default 7)
 * to ensure local server disk space is never overwhelmed.
 */
export function cleanOldLocalBackups(keepLast = 7): number {
  const backups = getLocalBackups()
  if (backups.length <= keepLast) return 0

  const toDelete = backups.slice(keepLast)
  let deletedCount = 0

  for (const b of toDelete) {
    try {
      if (deleteLocalBackup(b.fileName)) {
        deletedCount++
      }
    } catch {
      // Ignore
    }
  }

  return deletedCount
}
