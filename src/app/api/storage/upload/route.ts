import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const customPath = (formData.get('path') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop() || 'dat'
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const targetKey = customPath ? `${customPath.replace(/\/+$/, '')}/${fileName}` : fileName

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await uploadToR2({
      key: targetKey,
      body: buffer,
      contentType: file.type || 'application/octet-stream',
    })

    return NextResponse.json({
      success: true,
      key: result.key,
      publicUrl: result.publicUrl,
    })
  } catch (err: any) {
    console.error('[R2 Upload Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to upload to Cloudflare R2' },
      { status: 500 }
    )
  }
}
