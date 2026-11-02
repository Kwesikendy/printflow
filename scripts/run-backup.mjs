import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ZipArchive } from 'archiver'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { google } from 'googleapis'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Load environment variables from .env.local
dotenv.config({ path: path.join(rootDir, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[Backup Error] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BACKUP_TABLES = [
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

const BACKUPS_DIR = path.join(rootDir, 'backups')
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true })
}

/**
 * Paginates through all records in a table
 */
async function fetchTableData(table) {
  const pageSize = 1000
  let from = 0
  const records = []

  try {
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + pageSize - 1)

      if (error) {
        console.warn(`  - [Table Warning] ${table}:`, error.message)
        break
      }
      if (!data || data.length === 0) break
      records.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
  } catch (err) {
    console.warn(`  - [Table Error] ${table}:`, err.message)
  }

  return records
}

/**
 * Checks Google Drive credentials
 */
function getGoogleDriveClient() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  const envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
  const envKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined

  let email = envEmail
  let privateKey = envKey

  // Also check local google-service-account.json if present
  const jsonPath = path.join(rootDir, 'google-service-account.json')
  if ((!email || !privateKey) && fs.existsSync(jsonPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      email = content.client_email
      privateKey = content.private_key
    } catch (e) {
      // Ignore
    }
  }

  if (!email || !privateKey || !folderId) {
    return null
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  return { drive: google.drive({ version: 'v3', auth }), folderId, email }
}

async function uploadToGoogleDrive(filePath, fileName) {
  const driveInfo = getGoogleDriveClient()
  if (!driveInfo) {
    console.log('[Google Drive] Credentials not found or folder ID not configured. Skipping cloud upload.')
    return null
  }

  console.log(`[Google Drive] Authenticated as ${driveInfo.email}. Uploading ${fileName}...`)
  const fileStats = fs.statSync(filePath)
  const fileStream = fs.createReadStream(filePath)

  try {
    const res = await driveInfo.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [driveInfo.folderId],
        description: `PrintFlow Automated Backup created on ${new Date().toISOString()}`,
      },
      media: {
        mimeType: 'application/zip',
        body: fileStream,
      },
      fields: 'id, name, webViewLink, size',
      supportsAllDrives: true,
    })

    console.log(`[Google Drive] Successfully uploaded! File ID: ${res.data.id}`)
    if (res.data.webViewLink) {
      console.log(`[Google Drive] View link: ${res.data.webViewLink}`)
    }
    return res.data
  } catch (err) {
    console.error(`[Google Drive Upload Error]:`, err.message)
    return null
  }
}

async function runBackup() {
  const startTime = Date.now()
  const timestamp = new Date()
  const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const fileName = `printflow-backup-${dateStr}.zip`
  const filePath = path.join(BACKUPS_DIR, fileName)

  console.log(`=======================================================`)
  console.log(`  PrintFlow Automated Backup Engine`)
  console.log(`  Timestamp: ${timestamp.toISOString()} (UTC)`)
  console.log(`  Target File: ${fileName}`)
  console.log(`=======================================================`)

  const output = fs.createWriteStream(filePath)
  const archive = new ZipArchive({ zlib: { level: 9 } })

  const archivePromise = new Promise((resolve, reject) => {
    output.on('close', resolve)
    archive.on('error', reject)
  })

  archive.pipe(output)

  const tableCounts = {}
  const consolidated = {}
  let totalRecords = 0

  console.log('\n[1/3] Extracting Database Tables...')
  for (const table of BACKUP_TABLES) {
    process.stdout.write(`  - Exporting '${table}'... `)
    const rows = await fetchTableData(table)
    tableCounts[table] = rows.length
    totalRecords += rows.length
    consolidated[table] = rows

    archive.append(JSON.stringify(rows, null, 2), {
      name: `database/${table}.json`,
    })
    console.log(`OK (${rows.length} rows)`)
  }

  archive.append(JSON.stringify(consolidated, null, 2), {
    name: 'database/all_tables_consolidated.json',
  })

  console.log('\n[2/3] Writing Manifest...')
  const manifest = {
    createdAt: timestamp.toISOString(),
    generator: 'PrintFlow Automated Backup CLI',
    version: '1.0.0',
    totalRecords,
    tableCounts,
  }

  archive.append(JSON.stringify(manifest, null, 2), {
    name: 'manifest.json',
  })

  console.log('\n[3/3] Compressing Archive...')
  await archive.finalize()
  await archivePromise

  const stats = fs.statSync(filePath)
  const sizeKb = (stats.size / 1024).toFixed(2)
  console.log(`\n✓ Archive generated successfully:`)
  console.log(`  Location: ${filePath}`)
  console.log(`  Size: ${sizeKb} KB`)
  console.log(`  Total records captured: ${totalRecords}`)

  // Google Drive upload if configured
  await uploadToGoogleDrive(filePath, fileName)

  // Prune local backups: Keep only the last 7 local archives
  try {
    const existing = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith('printflow-backup-') && f.endsWith('.zip'))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)

    if (existing.length > 7) {
      const toDelete = existing.slice(7)
      for (const oldFile of toDelete) {
        fs.unlinkSync(path.join(BACKUPS_DIR, oldFile.name))
        console.log(`  [Retention] Pruned old local backup: ${oldFile.name}`)
      }
    }
  } catch (cleanErr) {
    console.warn('  [Retention Warning] Could not clean old local backups:', cleanErr.message)
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nBackup completed in ${durationSec}s.`)
}

runBackup().catch((err) => {
  console.error('Fatal backup error:', err)
  process.exit(1)
})
