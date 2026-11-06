import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucketName = process.env.R2_BUCKET_NAME || 'printflow-artworks'
const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''

let s3ClientInstance: S3Client | null = null

export function getR2Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing Cloudflare R2 credentials in environment variables.')
  }

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return s3ClientInstance
}

export function getR2PublicUrl(key: string): string {
  const base = publicUrlBase.replace(/\/+$/, '')
  const cleanKey = key.replace(/^\/+/, '')
  return `${base}/${cleanKey}`
}

/**
 * Uploads a file buffer or stream directly to Cloudflare R2
 */
export async function uploadToR2(params: {
  key: string
  body: Buffer | Uint8Array | Blob | string
  contentType?: string
}) {
  const client = getR2Client()
  const cleanKey = params.key.replace(/^\/+/, '')

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
    Body: params.body as any,
    ContentType: params.contentType || 'application/octet-stream',
  })

  await client.send(command)
  return {
    key: cleanKey,
    publicUrl: getR2PublicUrl(cleanKey),
  }
}

/**
 * Downloads an object from Cloudflare R2 as text or Buffer
 */
export async function getObjectFromR2(key: string): Promise<string | null> {
  try {
    const client = getR2Client()
    const cleanKey = key.replace(/^\/+/, '')
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
    })
    const response = await client.send(command)
    if (!response.Body) return null
    const text = await response.Body.transformToString()
    return text
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null
    }
    console.warn(`[R2 GetObject Error for ${key}]:`, err.message)
    return null
  }
}

/**
 * Generates a presigned URL so the browser can directly PUT the file into R2
 * This completely avoids server memory bottlenecks on large 50MB+ artwork uploads!
 */
export async function createPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const client = getR2Client()
  const cleanKey = key.replace(/^\/+/, '')

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn })
  return {
    uploadUrl,
    key: cleanKey,
    publicUrl: getR2PublicUrl(cleanKey),
  }
}

/**
 * Deletes one or multiple keys from R2
 */
export async function deleteFromR2(keys: string | string[]) {
  const client = getR2Client()
  const keyList = Array.isArray(keys) ? keys : [keys]
  const validKeys = keyList.map((k) => k.replace(/^\/+/, '')).filter(Boolean)

  if (validKeys.length === 0) return

  if (validKeys.length === 1) {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: validKeys[0],
      })
    )
  } else {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: validKeys.map((Key) => ({ Key })),
        },
      })
    )
  }
}

/**
 * Lists files in R2 with an optional prefix
 */
export async function listR2Files(prefix?: string) {
  const client = getR2Client()
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix ? prefix.replace(/^\/+/, '') : undefined,
  })

  const response = await client.send(command)
  return (
    response.Contents?.map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified,
      publicUrl: getR2PublicUrl(item.Key || ''),
    })) || []
  )
}
