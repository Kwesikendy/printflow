'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PENDING_TAG_PREFIX = '[[PENDING_DELETE:'
const PENDING_TAG_SUFFIX = ']]'

interface PendingDeleteMeta {
  reason: string
  requestedBy: string
  requestedByName: string
  requestedAt: string
}

function parseNotesMeta(rawNotes?: string | null): {
  cleanNotes: string | null
  meta: PendingDeleteMeta | null
} {
  if (!rawNotes) return { cleanNotes: null, meta: null }
  const startIdx = rawNotes.indexOf(PENDING_TAG_PREFIX)
  if (startIdx === -1) return { cleanNotes: rawNotes, meta: null }

  const endIdx = rawNotes.indexOf(PENDING_TAG_SUFFIX, startIdx)
  if (endIdx === -1) return { cleanNotes: rawNotes, meta: null }

  const jsonStr = rawNotes.slice(startIdx + PENDING_TAG_PREFIX.length, endIdx)
  const remaining = (rawNotes.slice(0, startIdx) + rawNotes.slice(endIdx + PENDING_TAG_SUFFIX.length)).trim()

  try {
    const parsed = JSON.parse(jsonStr) as PendingDeleteMeta
    return {
      cleanNotes: remaining || null,
      meta: parsed,
    }
  } catch {
    return { cleanNotes: rawNotes, meta: null }
  }
}

function encodeNotesMeta(cleanNotes: string | null, meta: PendingDeleteMeta): string {
  const tag = `${PENDING_TAG_PREFIX}${JSON.stringify(meta)}${PENDING_TAG_SUFFIX}`
  return cleanNotes ? `${tag}\n${cleanNotes}` : tag
}

function normalizeExpenditureRow(row: any) {
  if (!row) return row
  const { cleanNotes, meta } = parseNotesMeta(row.notes)
  const isNativePending = row.deletion_status === 'pending'
  const isPending = isNativePending || Boolean(meta)

  return {
    ...row,
    notes: cleanNotes,
    deletion_status: isPending ? 'pending' : null,
    deletion_reason: isNativePending ? row.deletion_reason : meta?.reason || null,
    deletion_requested_by: isNativePending ? row.deletion_requested_by : meta?.requestedBy || null,
    deletion_requested_by_name: row.requester?.full_name || meta?.requestedByName || row.profiles?.full_name || 'Accountant',
    deletion_requested_at: isNativePending ? row.deletion_requested_at : meta?.requestedAt || null,
  }
}

async function getFinanceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', user: null, profile: null }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, tenant_id, full_name')
    .eq('id', user.id)
    .single()

  const profile = profileData as any
  if (!profile || !['admin', 'accountant'].includes(profile.role)) {
    return { error: 'Insufficient permissions', user, profile: null }
  }

  return { error: null, user, profile }
}

export async function getExpendituresAction() {
  const { error, profile } = await getFinanceContext()
  if (error || !profile) return { error, data: [] }

  const serviceSupabase = createServiceClient()
  const { data, error: fetchError } = await (serviceSupabase as any)
    .from('expenditures')
    .select('*, profiles:recorded_by(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .order('spent_at', { ascending: false })
    .limit(500)

  if (fetchError) {
    if (fetchError.message?.includes('expenditures') || fetchError.code === 'PGRST204' || fetchError.message?.includes('schema cache')) {
      return { data: [], error: 'The expenditures table is not installed in the database yet. Please run migration 017 in your Supabase SQL editor.' }
    }
    return { data: [], error: fetchError.message }
  }

  return { data: (data || []).map(normalizeExpenditureRow) }
}

export async function createExpenditureAction(payload: {
  category: string
  description: string
  amount: number
  vendor?: string
  reference?: string
  notes?: string
  spentAt: string
}) {
  const { error, user, profile } = await getFinanceContext()
  if (error || !profile || !user) return { error }

  const category = payload.category?.trim()
  const description = payload.description?.trim()
  const amount = Number(payload.amount)
  if (!category || !description || !Number.isFinite(amount) || amount <= 0 || !payload.spentAt) {
    return { error: 'Category, description, date, and a positive amount are required.' }
  }

  const serviceSupabase = createServiceClient()
  const { data, error: insertError } = await (serviceSupabase as any)
    .from('expenditures')
    .insert({
      tenant_id: profile.tenant_id,
      category,
      description,
      amount: Math.round(amount * 100) / 100,
      vendor: payload.vendor?.trim() || null,
      reference: payload.reference?.trim() || null,
      notes: payload.notes?.trim() || null,
      spent_at: new Date(payload.spentAt).toISOString(),
      recorded_by: user.id,
    })
    .select('*, profiles:recorded_by(full_name)')
    .single()

  if (insertError) {
    if (insertError.message?.includes('expenditures') || insertError.code === 'PGRST204' || insertError.message?.includes('schema cache')) {
      return { error: 'The expenditures table is not installed in the database yet. Please run migration 017 in your Supabase SQL editor.' }
    }
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/finance/expenditures')
  revalidatePath('/dashboard/finance')
  return { success: true, data: normalizeExpenditureRow(data) }
}

/**
 * Accountant (or Admin) requests deletion of a mistaken or duplicate expenditure.
 * Remains pending until an Admin approves it from the Admin Dashboard.
 */
export async function requestExpenditureDeletionAction(expenditureId: string, reason: string) {
  const { error, user, profile } = await getFinanceContext()
  if (error || !profile || !user) return { error: error || 'Unauthorized' }

  const trimmedReason = reason?.trim()
  if (!trimmedReason) {
    return { error: 'Please provide a reason for requesting deletion (e.g. Double entry).' }
  }

  const serviceSupabase = createServiceClient()
  const { data: existing, error: fetchErr } = await (serviceSupabase as any)
    .from('expenditures')
    .select('id, notes, tenant_id')
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (fetchErr || !existing) {
    return { error: 'Expenditure record not found.' }
  }

  const nowIso = new Date().toISOString()

  // 1. Try native schema columns first (if migration 027 is applied)
  const { data: updated, error: nativeErr } = await (serviceSupabase as any)
    .from('expenditures')
    .update({
      deletion_status: 'pending',
      deletion_reason: trimmedReason,
      deletion_requested_by: user.id,
      deletion_requested_at: nowIso,
    })
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)
    .select('*, profiles:recorded_by(full_name)')
    .single()

  if (!nativeErr && updated) {
    revalidatePath('/dashboard/finance/expenditures')
    revalidatePath('/dashboard/admin')
    return {
      success: true,
      data: {
        ...normalizeExpenditureRow(updated),
        deletion_requested_by_name: profile.full_name || 'Accountant',
      },
    }
  }

  // 2. Fallback: store pending marker cleanly in notes if migration 027 is not yet applied
  const { cleanNotes } = parseNotesMeta(existing.notes)
  const encodedNotes = encodeNotesMeta(cleanNotes, {
    reason: trimmedReason,
    requestedBy: user.id,
    requestedByName: profile.full_name || 'Accountant',
    requestedAt: nowIso,
  })

  const { data: fallbackUpdated, error: fallbackErr } = await (serviceSupabase as any)
    .from('expenditures')
    .update({ notes: encodedNotes })
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)
    .select('*, profiles:recorded_by(full_name)')
    .single()

  if (fallbackErr) {
    return { error: fallbackErr.message }
  }

  revalidatePath('/dashboard/finance/expenditures')
  revalidatePath('/dashboard/admin')
  return { success: true, data: normalizeExpenditureRow(fallbackUpdated) }
}

/**
 * Accountant withdraws their own pending deletion request, or Admin rejects it.
 */
export async function clearExpenditureDeletionRequestAction(expenditureId: string, adminOnly = false) {
  const { error, profile } = await getFinanceContext()
  if (error || !profile) return { error: error || 'Unauthorized' }

  if (adminOnly && profile.role !== 'admin') {
    return { error: 'Only an Administrator can reject deletion requests.' }
  }

  const serviceSupabase = createServiceClient()
  const { data: existing, error: fetchErr } = await (serviceSupabase as any)
    .from('expenditures')
    .select('id, notes, tenant_id')
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (fetchErr || !existing) {
    return { error: 'Expenditure record not found.' }
  }

  const { cleanNotes } = parseNotesMeta(existing.notes)

  // Try clearing native columns + notes tag
  const { data: updated, error: nativeErr } = await (serviceSupabase as any)
    .from('expenditures')
    .update({
      notes: cleanNotes,
      deletion_status: null,
      deletion_reason: null,
      deletion_requested_by: null,
      deletion_requested_at: null,
    })
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)
    .select('*, profiles:recorded_by(full_name)')
    .single()

  if (!nativeErr && updated) {
    revalidatePath('/dashboard/finance/expenditures')
    revalidatePath('/dashboard/admin')
    return { success: true, data: normalizeExpenditureRow(updated) }
  }

  // Fallback: clear tag from notes only
  const { data: fallbackUpdated, error: fallbackErr } = await (serviceSupabase as any)
    .from('expenditures')
    .update({ notes: cleanNotes })
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)
    .select('*, profiles:recorded_by(full_name)')
    .single()

  if (fallbackErr) {
    return { error: fallbackErr.message }
  }

  revalidatePath('/dashboard/finance/expenditures')
  revalidatePath('/dashboard/admin')
  return { success: true, data: normalizeExpenditureRow(fallbackUpdated) }
}

/**
 * Admin permanently approves deletion of an expenditure record.
 */
export async function approveExpenditureDeletionAction(expenditureId: string) {
  const { error, profile } = await getFinanceContext()
  if (error || !profile) return { error: error || 'Unauthorized' }

  if (profile.role !== 'admin') {
    return { error: 'Only an Administrator can approve and delete expenditure records.' }
  }

  const serviceSupabase = createServiceClient()
  const { error: delErr } = await (serviceSupabase as any)
    .from('expenditures')
    .delete()
    .eq('id', expenditureId)
    .eq('tenant_id', profile.tenant_id)

  if (delErr) {
    return { error: delErr.message }
  }

  revalidatePath('/dashboard/finance/expenditures')
  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/admin')
  return { success: true }
}

/**
 * Fetches all expenditures currently pending deletion approval.
 */
export async function getPendingExpenditureDeletionsAction() {
  const { error, profile } = await getFinanceContext()
  if (error || !profile) return { data: [], error }

  const serviceSupabase = createServiceClient()
  const { data, error: fetchErr } = await (serviceSupabase as any)
    .from('expenditures')
    .select('*, profiles:recorded_by(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .order('spent_at', { ascending: false })
    .limit(500)

  if (fetchErr) {
    return { data: [], error: fetchErr.message }
  }

  const normalized = (data || []).map(normalizeExpenditureRow)
  const pending = normalized.filter((item: any) => item.deletion_status === 'pending')
  return { data: pending }
}
