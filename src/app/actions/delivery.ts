'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type Job, type DeliveryStatus } from '@/types/database'

export type ActionResponse<T = any> = {
  error?: string
  success?: boolean
  data?: T
}

interface AuthProfile {
  tenant_id: string
  role: string
  email: string
}

async function getAuthProfile(supabase: any, userId: string): Promise<AuthProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id, role, email')
    .eq('id', userId)
    .single()
  return data as AuthProfile | null
}

export async function getDeliveryJobsAction(): Promise<ActionResponse<Job[]>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const profile = await getAuthProfile(supabase, user.id)
    if (!profile) return { error: 'Profile not found' }

    const isMavis = profile.email === 'm.adoko@printdpigh.com'
    if (profile.role !== 'admin' && profile.role !== 'front_desk' && !isMavis) {
      return { error: 'Insufficient permissions to view delivery queue' }
    }

    const serviceSupabase = createServiceClient() as any

    // Query jobs with delivery_method = 'delivery'
    const { data, error } = await serviceSupabase
      .from('jobs')
      .select(`
        *,
        product_types (id, name, is_fixed_price)
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('delivery_method', 'delivery')
      .order('updated_at', { ascending: false })

    if (error) {
      // If delivery_method column does not exist yet
      if (error.code === '42703' || error.message?.includes('delivery_method')) {
        console.warn('Delivery column does not exist yet. Please run migration 016_delivery_tracking.sql.')
        return { success: true, data: [] }
      }
      console.error('Fetch delivery jobs error:', error)
      return { error: error.message }
    }

    return { success: true, data: (data as Job[]) || [] }
  } catch (err: any) {
    console.error('getDeliveryJobsAction error:', err)
    return { error: err.message || 'Failed to load delivery queue' }
  }
}

export async function dispatchDeliveryJobAction(
  jobId: string,
  riderName: string,
  riderPhone: string,
  dispatchNotes?: string
): Promise<ActionResponse> {
  try {
    if (!jobId) return { error: 'Job ID is required' }
    if (!riderName.trim()) return { error: 'Rider / Courier name is required' }
    if (!riderPhone.trim()) return { error: 'Rider phone number is required' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const profile = await getAuthProfile(supabase, user.id)
    if (!profile) return { error: 'Profile not found' }

    const isMavis = profile.email === 'm.adoko@printdpigh.com'
    if (profile.role !== 'admin' && profile.role !== 'front_desk' && !isMavis) {
      return { error: 'Insufficient permissions' }
    }

    const serviceSupabase = createServiceClient() as any

    const updatePayload: any = {
      delivery_rider_name: riderName.trim(),
      delivery_rider_phone: riderPhone.trim(),
      delivery_status: 'dispatched',
      delivery_dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: updatedJob, error: updateError } = await serviceSupabase
      .from('jobs')
      .update(updatePayload)
      .eq('id', jobId)
      .eq('tenant_id', profile.tenant_id)
      .select('id, job_number, notes')
      .single()

    if (updateError) {
      console.error('Dispatch delivery update error:', updateError)
      return { error: updateError.message }
    }

    // Append dispatch note if provided
    if (dispatchNotes?.trim() && updatedJob) {
      const existingNotes = updatedJob.notes ? `${updatedJob.notes}\n` : ''
      const timestamp = new Date().toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
      const appendedNotes = `${existingNotes}[${timestamp} Dispatch: ${riderName.trim()} (${riderPhone.trim()}) - ${dispatchNotes.trim()}]`
      await serviceSupabase
        .from('jobs')
        .update({ notes: appendedNotes })
        .eq('id', jobId)
    }

    revalidatePath('/dashboard/delivery')
    revalidatePath('/dashboard/jobs')
    revalidatePath(`/dashboard/jobs/${jobId}`)
    return { success: true }
  } catch (err: any) {
    console.error('dispatchDeliveryJobAction error:', err)
    return { error: err.message || 'Failed to dispatch delivery' }
  }
}

export async function markJobDeliveredAction(
  jobId: string,
  deliveryConfirmationNotes?: string
): Promise<ActionResponse> {
  try {
    if (!jobId) return { error: 'Job ID is required' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const profile = await getAuthProfile(supabase, user.id)
    if (!profile) return { error: 'Profile not found' }

    const isMavis = profile.email === 'm.adoko@printdpigh.com'
    if (profile.role !== 'admin' && profile.role !== 'front_desk' && !isMavis) {
      return { error: 'Insufficient permissions' }
    }

    const serviceSupabase = createServiceClient() as any

    // Fetch existing job to get previous status & rider name
    const { data: currentJob, error: fetchErr } = await serviceSupabase
      .from('jobs')
      .select('id, status, delivery_rider_name, delivery_rider_phone')
      .eq('id', jobId)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (fetchErr || !currentJob) {
      return { error: 'Job not found' }
    }

    const now = new Date().toISOString()
    const riderInfo = currentJob.delivery_rider_name
      ? `Courier: ${currentJob.delivery_rider_name}`
      : 'Courier Delivery'

    const { error: updateError } = await serviceSupabase
      .from('jobs')
      .update({
        delivery_status: 'delivered',
        delivery_delivered_at: now,
        status: 'picked_up', // Fulfilled and delivered
        pickup_name: riderInfo,
        pickup_phone: currentJob.delivery_rider_phone || null,
        updated_at: now
      })
      .eq('id', jobId)
      .eq('tenant_id', profile.tenant_id)

    if (updateError) {
      console.error('Mark delivered error:', updateError)
      return { error: updateError.message }
    }

    // Record job status event transition
    await serviceSupabase
      .from('job_status_events')
      .insert({
        tenant_id: profile.tenant_id,
        job_id: jobId,
        from_status: currentJob.status,
        to_status: 'picked_up',
        actor_id: user.id
      })

    revalidatePath('/dashboard/delivery')
    revalidatePath('/dashboard/jobs')
    revalidatePath('/dashboard/pickup')
    revalidatePath(`/dashboard/jobs/${jobId}`)
    return { success: true }
  } catch (err: any) {
    console.error('markJobDeliveredAction error:', err)
    return { error: err.message || 'Failed to mark job as delivered' }
  }
}

export async function revertDeliveryToPendingAction(
  jobId: string
): Promise<ActionResponse> {
  try {
    if (!jobId) return { error: 'Job ID is required' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const profile = await getAuthProfile(supabase, user.id)
    if (!profile) return { error: 'Profile not found' }

    const isMavis = profile.email === 'm.adoko@printdpigh.com'
    if (profile.role !== 'admin' && profile.role !== 'front_desk' && !isMavis) {
      return { error: 'Insufficient permissions' }
    }

    const serviceSupabase = createServiceClient() as any

    const { error: updateError } = await serviceSupabase
      .from('jobs')
      .update({
        delivery_status: 'pending',
        delivery_rider_name: null,
        delivery_rider_phone: null,
        delivery_dispatched_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('tenant_id', profile.tenant_id)

    if (updateError) {
      return { error: updateError.message }
    }

    revalidatePath('/dashboard/delivery')
    revalidatePath('/dashboard/jobs')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to revert dispatch' }
  }
}
