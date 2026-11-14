import { NextRequest, NextResponse } from 'next/server'
import { runAutoBackup, getAutoBackupState } from '@/lib/auto-backup-scheduler'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret') || searchParams.get('key')
    const authHeader = req.headers.get('authorization')
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    const expectedSecret = process.env.CRON_SECRET || process.env.BACKUP_CRON_SECRET

    // If a CRON_SECRET is configured in environment variables, verify it
    if (expectedSecret && secret !== expectedSecret && bearerSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 })
    }

    const result = await runAutoBackup('API Cron Webhook')

    return NextResponse.json({
      success: result.success,
      fileName: result.fileName,
      totalRecords: result.totalRecords,
      sizeBytes: result.sizeBytes,
      driveUpload: result.driveUpload,
      error: result.error,
      state: getAutoBackupState(),
    })
  } catch (err: any) {
    console.error('[Cron Backup Route Error]:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Auto-backup failed' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
