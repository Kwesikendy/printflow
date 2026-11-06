import { NextRequest, NextResponse } from 'next/server'
import { createPresignedUploadUrl } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'

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

    const result = await createPresignedUploadUrl(
      targetKey,
      contentType || 'application/octet-stream',
      3600 // 1 hour validity
    )

    return NextResponse.json({
      success: true,
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      key: result.key,
    })
  } catch (err: any) {
    console.error('[R2 Presigned URL Generation Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate direct upload URL' },
      { status: 500 }
    )
  }
}
