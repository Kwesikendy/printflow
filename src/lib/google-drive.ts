import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

export interface GoogleDriveStatus {
  isConfigured: boolean
  email?: string
  folderId?: string
  folderName?: string
  error?: string
}

export interface GoogleDriveUploadResult {
  fileId: string
  name: string
  webViewLink?: string
  sizeBytes?: number
}

export interface GoogleDriveBackupFile {
  id: string
  name: string
  sizeBytes?: number
  createdTime?: string
  webViewLink?: string
}

/**
 * Resolves Google Service Account credentials from:
 * 1. Environment variables: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID
 * 2. Service account JSON file: GOOGLE_APPLICATION_CREDENTIALS or 'google-service-account.json'
 */
function resolveCredentials() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()

  // 1. Check direct env vars
  const envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
  const envKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined

  if (envEmail && envKey && folderId) {
    return {
      email: envEmail,
      privateKey: envKey,
      folderId,
      source: 'environment',
    }
  }

  // 2. Check JSON file path if specified or local default file
  const jsonPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), 'google-service-account.json'),
  ].filter(Boolean) as string[]

  for (const jsonPath of jsonPaths) {
    try {
      if (fs.existsSync(jsonPath)) {
        const fileContent = fs.readFileSync(jsonPath, 'utf8')
        const parsed = JSON.parse(fileContent)
        if (parsed.client_email && parsed.private_key) {
          return {
            email: parsed.client_email as string,
            privateKey: parsed.private_key as string,
            folderId: folderId || parsed.folder_id || undefined,
            source: 'json_file',
          }
        }
      }
    } catch {
      // Continue to next option
    }
  }

  return {
    email: envEmail,
    privateKey: envKey,
    folderId,
    source: 'none',
  }
}

/**
 * Creates authenticated Google Drive client
 */
export function getDriveClient() {
  const creds = resolveCredentials()
  if (!creds.email || !creds.privateKey) {
    return null
  }

  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  const drive = google.drive({ version: 'v3', auth })
  return { drive, folderId: creds.folderId, email: creds.email }
}

/**
 * Checks connection status and folder permissions
 */
export async function getGoogleDriveConfigStatus(): Promise<GoogleDriveStatus> {
  const creds = resolveCredentials()

  if (!creds.email || !creds.privateKey) {
    return {
      isConfigured: false,
      error: 'Google Service Account credentials not provided.',
    }
  }

  if (!creds.folderId) {
    return {
      isConfigured: false,
      email: creds.email,
      error: 'GOOGLE_DRIVE_FOLDER_ID is missing. Please create a folder in Google Drive, share it with the service account email, and set the folder ID.',
    }
  }

  try {
    const client = getDriveClient()
    if (!client) {
      return { isConfigured: false, error: 'Could not initialize Google Drive client.' }
    }

    // Attempt to inspect folder
    const folderRes = await client.drive.files.get({
      fileId: creds.folderId,
      fields: 'id, name, mimeType, capabilities',
      supportsAllDrives: true,
    })

    return {
      isConfigured: true,
      email: creds.email,
      folderId: creds.folderId,
      folderName: folderRes.data.name || 'PrintFlow Backups',
    }
  } catch (err: any) {
    return {
      isConfigured: false,
      email: creds.email,
      folderId: creds.folderId,
      error: err.message || 'Failed to authenticate with Google Drive.',
    }
  }
}

/**
 * Uploads a local file (e.g. backup zip) to the configured Google Drive folder
 */
export async function uploadBackupToDrive(
  filePath: string,
  fileName: string
): Promise<GoogleDriveUploadResult> {
  const client = getDriveClient()
  if (!client || !client.folderId) {
    throw new Error('Google Drive is not configured or folder ID is missing.')
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Local file not found at: ${filePath}`)
  }

  const fileStats = fs.statSync(filePath)
  const fileStream = fs.createReadStream(filePath)

  const response = await client.drive.files.create({
    requestBody: {
      name: fileName,
      parents: [client.folderId],
      description: `PrintFlow Automated Backup created on ${new Date().toISOString()}`,
    },
    media: {
      mimeType: 'application/zip',
      body: fileStream,
    },
    fields: 'id, name, webViewLink, size',
    supportsAllDrives: true,
  })

  return {
    fileId: response.data.id || '',
    name: response.data.name || fileName,
    webViewLink: response.data.webViewLink || undefined,
    sizeBytes: fileStats.size,
  }
}

/**
 * Lists backups stored in the Google Drive folder
 */
export async function listDriveBackups(): Promise<GoogleDriveBackupFile[]> {
  const client = getDriveClient()
  if (!client || !client.folderId) {
    return []
  }

  try {
    const response = await client.drive.files.list({
      q: `'${client.folderId}' in parents and trashed = false and name contains 'printflow-backup'`,
      fields: 'files(id, name, size, createdTime, webViewLink)',
      orderBy: 'createdTime desc',
      pageSize: 30,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    return (response.data.files || []).map((f) => ({
      id: f.id || '',
      name: f.name || '',
      sizeBytes: f.size ? parseInt(f.size, 10) : undefined,
      createdTime: f.createdTime || undefined,
      webViewLink: f.webViewLink || undefined,
    }))
  } catch (err) {
    console.error('Error listing drive backups:', err)
    return []
  }
}

/**
 * Deletes a specific backup from Google Drive
 */
export async function deleteDriveBackup(fileId: string): Promise<boolean> {
  const client = getDriveClient()
  if (!client) return false

  try {
    await client.drive.files.delete({
      fileId,
      supportsAllDrives: true,
    })
    return true
  } catch (err) {
    console.error('Error deleting drive backup:', err)
    return false
  }
}

/**
 * Retention policy: Deletes backups older than retentionDays
 */
export async function cleanOldDriveBackups(retentionDays = 30): Promise<number> {
  const files = await listDriveBackups()
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  let deletedCount = 0

  for (const file of files) {
    if (file.createdTime && new Date(file.createdTime).getTime() < cutoff) {
      const ok = await deleteDriveBackup(file.id)
      if (ok) deletedCount++
    }
  }

  return deletedCount
}
