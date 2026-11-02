'use server'

import { createClient } from '@/lib/supabase/server'
import {
  createSystemBackup,
  getLocalBackups,
  deleteLocalBackup,
  type LocalBackupInfo,
  type BackupResult,
} from '@/lib/backup'
import {
  getGoogleDriveConfigStatus,
  listDriveBackups,
  deleteDriveBackup,
  type GoogleDriveStatus,
  type GoogleDriveBackupFile,
} from '@/lib/google-drive'
import { revalidatePath } from 'next/cache'

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = (await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null; error: any }

  if (!profile || profile.role !== 'admin') {
    throw new Error('Admin privileges required')
  }

  return { user, profile }
}

export interface BackupOverviewResponse {
  localBackups: LocalBackupInfo[]
  driveBackups: GoogleDriveBackupFile[]
  googleDriveStatus: GoogleDriveStatus
  error?: string
}

/**
 * Gets the list of local backups, Google Drive backups, and Drive configuration status
 */
export async function getBackupOverviewAction(): Promise<BackupOverviewResponse> {
  try {
    await verifyAdmin()

    const [driveStatus, localBackups] = await Promise.all([
      getGoogleDriveConfigStatus(),
      Promise.resolve(getLocalBackups()),
    ])

    let driveBackups: GoogleDriveBackupFile[] = []
    if (driveStatus.isConfigured) {
      driveBackups = await listDriveBackups()
    }

    return {
      localBackups,
      driveBackups,
      googleDriveStatus: driveStatus,
    }
  } catch (err: any) {
    return {
      localBackups: [],
      driveBackups: [],
      googleDriveStatus: { isConfigured: false },
      error: err.message,
    }
  }
}

/**
 * Triggers on-demand system backup
 */
export async function triggerBackupAction(options: {
  includeStorage?: boolean
  uploadToDrive?: boolean
}): Promise<BackupResult> {
  try {
    await verifyAdmin()

    const result = await createSystemBackup({
      includeStorage: options.includeStorage ?? false,
      uploadToDrive: options.uploadToDrive ?? false,
      retentionDays: 30,
    })

    revalidatePath('/dashboard/admin/backups')
    return result
  } catch (err: any) {
    return {
      success: false,
      fileName: '',
      filePath: '',
      sizeBytes: 0,
      recordCounts: {},
      totalRecords: 0,
      error: err.message || 'Failed to generate backup.',
    }
  }
}

/**
 * Deletes a local backup archive
 */
export async function deleteLocalBackupAction(fileName: string) {
  try {
    await verifyAdmin()
    deleteLocalBackup(fileName)
    revalidatePath('/dashboard/admin/backups')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Deletes a Google Drive backup
 */
export async function deleteDriveBackupAction(fileId: string) {
  try {
    await verifyAdmin()
    const success = await deleteDriveBackup(fileId)
    revalidatePath('/dashboard/admin/backups')
    return { success }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Tests connection to Google Drive
 */
export async function testDriveConnectionAction(): Promise<GoogleDriveStatus> {
  try {
    await verifyAdmin()
    const status = await getGoogleDriveConfigStatus()
    return status
  } catch (err: any) {
    return {
      isConfigured: false,
      error: err.message,
    }
  }
}
