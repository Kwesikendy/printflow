import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { filename, path: customPath } = body

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileExt = cleanFilename.split('.').pop() || 'dat'
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
    
    const targetKey = customPath 
      ? `${customPath.replace(/^\/+|\/+$/g, '')}/${uniqueName}` 
      : uniqueName

    const serviceSupabase = createServiceClient() as any
    const { data: signData, error: signError } = await serviceSupabase.storage
      .from('artworks')
      .createSignedUploadUrl(targetKey)

    if (signError) {
      console.error('[Supabase Storage Signed URL Error]:', signError)
      return NextResponse.json(
        { error: signError.message || 'Failed to generate storage upload URL' },
        { status: 500 }
      )
    }

    const { data: pubData } = serviceSupabase.storage
      .from('artworks')
      .getPublicUrl(targetKey)

    return NextResponse.json({
      success: true,
      path: signData.path,
      token: signData.token,
      signedUrl: signData.signedUrl,
      publicUrl: pubData.publicUrl,
      key: targetKey,
    })
  } catch (err: any) {
    console.error('[Storage Presigned URL Generation Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate direct upload URL' },
      { status: 500 }
    )
  }
}
