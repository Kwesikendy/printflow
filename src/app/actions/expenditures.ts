'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getFinanceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', user: null, profile: null }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, tenant_id')
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
    .select('*, profiles(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .order('spent_at', { ascending: false })
    .limit(500)

  if (fetchError) {
    if (fetchError.message?.includes('expenditures') || fetchError.code === 'PGRST204' || fetchError.message?.includes('schema cache')) {
      return { data: [], error: 'The expenditures table is not installed in the database yet. Please run migration 017 in your Supabase SQL editor.' }
    }
    return { data: [], error: fetchError.message }
  }

  return { data: data || [] }
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
    .select('*, profiles(full_name)')
    .single()

  if (insertError) {
    if (insertError.message?.includes('expenditures') || insertError.code === 'PGRST204' || insertError.message?.includes('schema cache')) {
      return { error: 'The expenditures table is not installed in the database yet. Please run migration 017 in your Supabase SQL editor.' }
    }
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/finance/expenditures')
  revalidatePath('/dashboard/finance')
  return { success: true, data }
}
