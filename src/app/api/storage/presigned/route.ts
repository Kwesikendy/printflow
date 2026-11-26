import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPresignedUploadUrl } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { filename, contentType, path: customPath } = body

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileExt = cleanFilename.split('.').pop() || 'dat'
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`

    const targetKey = customPath
      ? `${customPath.replace(/^\/+|\/+$/g, '')}/${uniqueName}`
      : uniqueName

    const { uploadUrl, publicUrl, key } = await createPresignedUploadUrl(
      targetKey,
      contentType || 'application/octet-stream'
    )

    return NextResponse.json({
      success: true,
      provider: 'r2',
      uploadUrl,
      publicUrl,
      key,
    })
  } catch (err: any) {
    console.error('[R2 Presigned URL Generation Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate R2 upload URL' },
      { status: 500 }
    )
  }
}
