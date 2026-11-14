import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const targetUrl = searchParams.get('url')
    const requestedName = searchParams.get('filename') || 'artwork.pdf'

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing artwork URL' }, { status: 400 })
    }

    // Sanitize filename to prevent header injection
    const safeFilename = requestedName
      .replace(/[\r\n"\\/;]/g, '_')
      .trim() || 'artwork.pdf'

    let fileResponse: Response | null = null

    // 1. Try direct fetch (works for public URLs and signed URLs)
    try {
      const resp = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'PrintFlow-Downloader/1.0',
        },
      })
      if (resp.ok) {
        fileResponse = resp
      }
    } catch (fetchErr) {
      console.warn('[Artwork Download] Direct fetch error:', fetchErr)
    }

    // 2. Fallback: if direct fetch failed or forbidden, try Supabase service client
    if (!fileResponse || !fileResponse.ok) {
      try {
        const urlObj = new URL(targetUrl)
        // Check if it's a Supabase storage path: .../storage/v1/object/public/artworks/<path>
        const match = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated)\/artworks\/(.+)$/)
        if (match && match[1]) {
          const storagePath = decodeURIComponent(match[1])
          const serviceSupabase = createServiceClient() as any
          const { data, error } = await serviceSupabase.storage
            .from('artworks')
            .download(storagePath)

          if (!error && data) {
            fileResponse = new Response(data)
          }
        }
      } catch (sbErr) {
        console.warn('[Artwork Download] Supabase service fallback error:', sbErr)
      }
    }

    if (!fileResponse || !fileResponse.ok || !fileResponse.body) {
      return NextResponse.json(
        { error: 'Artwork file could not be retrieved from storage' },
        { status: 404 }
      )
    }

    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream'
    const contentLength = fileResponse.headers.get('content-length')

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    // RFC 6266 + RFC 5987 standard attachment header
    const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
    const utf8Filename = encodeURIComponent(safeFilename)
    headers.set(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`
    )
    headers.set('Cache-Control', 'private, max-age=3600')

    return new NextResponse(fileResponse.body, {
      status: 200,
      headers,
    })
  } catch (err: any) {
    console.error('[Artwork Download Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to download artwork' },
      { status: 500 }
    )
  }
}
