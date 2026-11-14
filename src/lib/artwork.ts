/**
 * Artwork Download & Naming Utility
 * 
 * Ensures artwork files downloaded for production follow clean, meaningful names
 * (e.g. PF-261111-045_IBN_NART_SAV_with_Lamination.jpg or original artwork name)
 * instead of random server hash IDs (1794475362047_6e9kbu4.jpg).
 */

export interface ArtworkJobInfo {
  id?: string
  job_number?: string | null
  customer_name?: string | null
  artwork_url?: string | null
  width?: number | null
  height?: number | null
  dimension_unit?: string | null
  product_types?: {
    name?: string | null
  } | null
}

function sanitizePart(val: string): string {
  return val
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Derives a human-readable, production-ready filename for downloading artwork.
 */
export function getArtworkDownloadFilename(job: ArtworkJobInfo): string {
  if (!job.artwork_url) {
    return `${sanitizePart(job.job_number || 'JOB')}_artwork.pdf`
  }

  // 1. Check if original filename was preserved in query parameters (?name=... or ?download=...)
  try {
    const url = new URL(job.artwork_url)
    const queryName = url.searchParams.get('name') || url.searchParams.get('download') || url.searchParams.get('filename')
    if (queryName) {
      const decoded = decodeURIComponent(queryName).trim()
      if (decoded.length > 0 && decoded.includes('.')) {
        return sanitizePart(decoded)
      }
    }
  } catch {
    // If not a full URL or parse fails, continue
  }

  // 2. Extract file extension from URL pathname
  let ext = 'pdf'
  try {
    const rawPath = job.artwork_url.split('?')[0]
    const lastPart = rawPath.split('/').pop() || ''
    const parts = lastPart.split('.')
    if (parts.length > 1) {
      const candidateExt = parts.pop()?.toLowerCase() || ''
      if (/^[a-z0-9]{2,5}$/.test(candidateExt)) {
        ext = candidateExt
      }
    }
  } catch {
    ext = 'pdf'
  }

  // 3. Compose structured name: [JobNumber]_[Customer]_[Product]_[Size].[ext]
  const pieces: string[] = []

  if (job.job_number) {
    pieces.push(sanitizePart(job.job_number))
  }

  if (job.customer_name) {
    pieces.push(sanitizePart(job.customer_name))
  }

  if (job.product_types?.name) {
    pieces.push(sanitizePart(job.product_types.name))
  }

  if (job.width && job.height) {
    const unit = job.dimension_unit || 'cm'
    pieces.push(`${job.width}x${job.height}${unit}`)
  }

  const base = pieces.join('_')
  return `${base || 'Artwork'}.${ext}`
}

/**
 * Returns the download route URL with query params
 */
export function getArtworkDownloadUrl(job: ArtworkJobInfo): string {
  if (!job.artwork_url) return '#'
  const filename = getArtworkDownloadFilename(job)
  return `/api/storage/download?url=${encodeURIComponent(job.artwork_url)}&filename=${encodeURIComponent(filename)}`
}
