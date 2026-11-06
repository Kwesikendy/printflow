'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { listR2Files, deleteFromR2 } from '@/lib/r2'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile as any).role !== 'admin') {
    return { error: 'Only administrators can perform storage maintenance', profile: null }
  }

  return { error: null, profile: profile as any }
}

export async function getStorageStatsAction() {
  const { error, profile } = await checkAdmin()
  if (error || !profile) return { error }

  const serviceSupabase = createServiceClient() as any
  const tenantId = profile.tenant_id

  const { data: jobs } = await serviceSupabase
    .from('jobs')
    .select('id, status, artwork_url')
    .eq('tenant_id', tenantId)

  const cleanableStatuses = new Set(['picked_up', 'completed', 'cancelled'])
  const fileToJob = new Map<string, any>()
  for (const j of jobs || []) {
    if (j.artwork_url) {
      const match = j.artwork_url.match(new RegExp(`${tenantId}/([^?]+)`))
      if (match) fileToJob.set(match[1], j)
    }
  }

  let allFiles: Array<{ name: string; size: number }> = []

  // 1. Fetch from Cloudflare R2
  try {
    const r2Files = await listR2Files(tenantId)
    for (const f of r2Files) {
      const fileName = f.key.replace(new RegExp(`^${tenantId}/`), '')
      allFiles.push({ name: fileName, size: f.size })
    }
  } catch (r2Err) {
    console.warn('[StorageStats] R2 list error:', r2Err)
  }

  // 2. Fetch from Supabase (safe if restricted)
  try {
    let offset = 0
    const limit = 100
    while (true) {
      const { data, error } = await serviceSupabase.storage
        .from('artworks')
        .list(tenantId, { limit, offset })
      if (error || !data || data.length === 0) break
      for (const item of data) {
        // avoid duplicates if same file exists in both
        if (!allFiles.some((f) => f.name === item.name)) {
          allFiles.push({ name: item.name, size: item.metadata?.size || 0 })
        }
      }
      if (data.length < limit) break
      offset += limit
    }
  } catch (sbErr) {
    console.warn('[StorageStats] Supabase storage list warning:', sbErr)
  }

  let totalBytes = 0
  let activeBytes = 0
  let activeCount = 0
  let cleanableBytes = 0
  let cleanableCount = 0

  for (const f of allFiles) {
    const size = f.size || 0
    totalBytes += size
    const job = fileToJob.get(f.name)
    if (!job || cleanableStatuses.has(job.status)) {
      cleanableBytes += size
      cleanableCount++
    } else {
      activeBytes += size
      activeCount++
    }
  }

  return {
    totalFiles: allFiles.length,
    totalBytes,
    activeFiles: activeCount,
    activeBytes,
    cleanableFiles: cleanableCount,
    cleanableBytes,
  }
}

export async function cleanCompletedArtworksAction() {
  const { error, profile } = await checkAdmin()
  if (error || !profile) return { error }

  const serviceSupabase = createServiceClient() as any
  const tenantId = profile.tenant_id

  const { data: jobs } = await serviceSupabase
    .from('jobs')
    .select('id, status, artwork_url')
    .eq('tenant_id', tenantId)

  const cleanableStatuses = new Set(['picked_up', 'completed', 'cancelled'])
  const fileToJob = new Map<string, any>()
  const jobsToUpdate: string[] = []

  for (const j of jobs || []) {
    if (j.artwork_url) {
      const match = j.artwork_url.match(new RegExp(`${tenantId}/([^?]+)`))
      if (match) {
        fileToJob.set(match[1], j)
        if (cleanableStatuses.has(j.status)) {
          jobsToUpdate.push(j.id)
        }
      }
    }
  }

  let allFiles: Array<{ name: string; size: number }> = []

  // 1. Fetch from Cloudflare R2
  try {
    const r2Files = await listR2Files(tenantId)
    for (const f of r2Files) {
      const fileName = f.key.replace(new RegExp(`^${tenantId}/`), '')
      allFiles.push({ name: fileName, size: f.size })
    }
  } catch (r2Err) {
    console.warn('[StorageClean] R2 list error:', r2Err)
  }

  // 2. Fetch from Supabase (safe if restricted)
  try {
    let offset = 0
    const limit = 100
    while (true) {
      const { data, error } = await serviceSupabase.storage
        .from('artworks')
        .list(tenantId, { limit, offset })
      if (error || !data || data.length === 0) break
      for (const item of data) {
        if (!allFiles.some((f) => f.name === item.name)) {
          allFiles.push({ name: item.name, size: item.metadata?.size || 0 })
        }
      }
      if (data.length < limit) break
      offset += limit
    }
  } catch (sbErr) {
    console.warn('[StorageClean] Supabase list warning:', sbErr)
  }

  const pathsToDelete: string[] = []
  let bytesFreed = 0

  for (const f of allFiles) {
    const job = fileToJob.get(f.name)
    const size = f.size || 0
    if (!job || cleanableStatuses.has(job.status)) {
      pathsToDelete.push(`${tenantId}/${f.name}`)
      bytesFreed += size
    }
  }

  if (pathsToDelete.length === 0) {
    return { success: true, message: 'Storage is already clean. No completed artworks to remove.', deletedCount: 0, bytesFreed: 0 }
  }

  // Delete from R2
  try {
    await deleteFromR2(pathsToDelete)
  } catch (r2DelErr) {
    console.warn('[StorageClean] R2 delete error:', r2DelErr)
  }

  // Delete from Supabase
  const chunkSize = 50
  for (let i = 0; i < pathsToDelete.length; i += chunkSize) {
    const chunk = pathsToDelete.slice(i, i + chunkSize)
    try {
      await serviceSupabase.storage.from('artworks').remove(chunk)
    } catch (sbDelErr) {
      // Ignore Supabase storage errors
    }
  }

  for (let i = 0; i < jobsToUpdate.length; i += chunkSize) {
    const chunk = jobsToUpdate.slice(i, i + chunkSize)
    await serviceSupabase.from('jobs').update({ artwork_url: null }).in('id', chunk)
  }

  revalidatePath('/dashboard/admin/settings')
  return {
    success: true,
    deletedCount: pathsToDelete.length,
    bytesFreed,
  }
}
