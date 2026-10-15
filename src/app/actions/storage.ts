'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  let allFiles: any[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { data } = await serviceSupabase.storage
      .from('artworks')
      .list(tenantId, { limit, offset })
    if (!data || data.length === 0) break
    allFiles = allFiles.concat(data)
    if (data.length < limit) break
    offset += limit
  }

  let totalBytes = 0
  let activeBytes = 0
  let activeCount = 0
  let cleanableBytes = 0
  let cleanableCount = 0

  for (const f of allFiles) {
    const size = f.metadata?.size || 0
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

  let allFiles: any[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { data } = await serviceSupabase.storage
      .from('artworks')
      .list(tenantId, { limit, offset })
    if (!data || data.length === 0) break
    allFiles = allFiles.concat(data)
    if (data.length < limit) break
    offset += limit
  }

  const pathsToDelete: string[] = []
  let bytesFreed = 0

  for (const f of allFiles) {
    const job = fileToJob.get(f.name)
    const size = f.metadata?.size || 0
    if (!job || cleanableStatuses.has(job.status)) {
      pathsToDelete.push(`${tenantId}/${f.name}`)
      bytesFreed += size
    }
  }

  if (pathsToDelete.length === 0) {
    return { success: true, message: 'Storage is already clean. No completed artworks to remove.', deletedCount: 0, bytesFreed: 0 }
  }

  const chunkSize = 50
  for (let i = 0; i < pathsToDelete.length; i += chunkSize) {
    const chunk = pathsToDelete.slice(i, i + chunkSize)
    await serviceSupabase.storage.from('artworks').remove(chunk)
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
