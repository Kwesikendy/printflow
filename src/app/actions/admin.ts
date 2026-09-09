'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResponse } from './jobs'
import type { Profile } from '@/types/database'

export async function updateTenantSettings(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const name = formData.get('name') as string
  const currency = formData.get('currency') as string
  const areaUnit = formData.get('area_unit') as string
  const logoFile = formData.get('logo') as File | null

  if (!name || !currency || !areaUnit) {
    return { error: 'Missing required fields' }
  }

  let logoUrl: string | undefined = undefined

  if (logoFile && logoFile.size > 0) {
    const fileExt = logoFile.name.split('.').pop()
    const fileName = `tenant_${profile.tenant_id}_logo.${fileExt}`
    const filePath = `logos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('artworks')
      .upload(filePath, logoFile, { upsert: true })

    if (uploadError) {
      return { error: 'Failed to upload logo: ' + uploadError.message }
    }

    const { data: publicUrlData } = supabase.storage.from('artworks').getPublicUrl(filePath)
    logoUrl = publicUrlData.publicUrl
  }

  const updatePayload: any = { name, currency, area_unit: areaUnit }
  if (logoUrl !== undefined) updatePayload.logo_url = logoUrl

  const { error } = await (supabase as any)
    .from('tenants')
    .update(updatePayload)
    .eq('id', profile.tenant_id)

  if (error) {
    console.error('Update tenant error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createProductType(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const name = formData.get('name') as string
  if (!name) return { error: 'Product name is required' }

  const { error } = await supabase.from('product_types').insert({
    tenant_id: profile.tenant_id,
    name
  } as any)

  if (error) {
    console.error('Create product type error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/products')
  return { success: true }
}

export async function toggleProductType(id: string, isActive: boolean): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const { error } = await (supabase as any)
    .from('product_types')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/admin/products')
  return { success: true }
}

export async function createPricingRule(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const productTypeId = formData.get('productTypeId') as string
  const source = formData.get('source') as string
  const unitCost = parseFloat(formData.get('unitCost') as string)

  if (!productTypeId || !source || isNaN(unitCost) || unitCost <= 0) {
    return { error: 'Invalid fields provided' }
  }

  const { error } = await supabase.from('pricing_rules').insert({
    tenant_id: profile.tenant_id,
    product_type_id: productTypeId,
    source,
    unit_cost: unitCost
  } as any)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A pricing rule for this product and source already exists.' }
    }
    console.error('Create pricing rule error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/products')
  return { success: true }
}
