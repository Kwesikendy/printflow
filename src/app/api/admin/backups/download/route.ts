import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import fs from 'fs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()) as { data: { role: string } | null; error: any }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawFileName = searchParams.get('fileName')

    if (!rawFileName) {
      return NextResponse.json({ error: 'Missing fileName query parameter' }, { status: 400 })
    }

    const safeFileName = path.basename(rawFileName)
    if (!safeFileName.startsWith('printflow-backup-') || !safeFileName.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid backup filename' }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'backups', safeFileName)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404 })
    }

    const stats = fs.statSync(filePath)
    const fileStream = fs.createReadStream(filePath)

    // Convert Node ReadStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk))
        fileStream.on('end', () => controller.close())
        fileStream.on('error', (err) => controller.error(err))
      },
      cancel() {
        fileStream.destroy()
      },
    })

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('Download error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
