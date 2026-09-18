'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResponse } from './jobs'
import type { Profile, DimensionUnit, JobSource, ProductPricingScheme } from '@/types/database'
import { getTenantUnitPricing, saveTenantUnitPricing } from '@/lib/pricing-server'
import { toCmRate, fromCmRate } from '@/lib/pricing'

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

export async function updateProductType(
  id: string,
  name: string,
  isActive?: boolean
): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const trimmed = name?.trim()
  if (!trimmed) return { error: 'Product name is required' }

  const serviceSupabase = createServiceClient()
  const updatePayload: any = { name: trimmed }
  if (typeof isActive === 'boolean') updatePayload.is_active = isActive

  const { error } = await (serviceSupabase as any)
    .from('product_types')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) {
    console.error('Update product type error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/products')
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard/jobs/new')
  return { success: true }
}

export async function saveProductUnitPricing(
  productId: string,
  scheme: ProductPricingScheme
): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const tenantId = profile.tenant_id
  const serviceSupabase = createServiceClient()

  // 1. Verify product belongs to tenant
  const { data: product, error: pErr } = await (serviceSupabase as any)
    .from('product_types')
    .select('id, name')
    .eq('id', productId)
    .eq('tenant_id', tenantId)
    .single()

  if (pErr || !product) return { error: 'Product not found' }

  // 2. Load existing config and update
  const config = await getTenantUnitPricing(tenantId)
  config[productId] = scheme
  const saveRes = await saveTenantUnitPricing(tenantId, config)
  if (!saveRes.success) {
    console.warn('Failed to save unit pricing config to storage:', saveRes.error)
  }

  // 3. Upsert base unit costs into pricing_rules table for walk_in and marketing
  const sources: JobSource[] = ['walk_in', 'marketing']
  for (const src of sources) {
    const rates = scheme[src]
    if (rates) {
      // Find a valid rate to convert to base cm cost
      let baseCmCost: number | null = null
      const units: DimensionUnit[] = ['ft', 'in', 'm', 'cm']
      for (const u of units) {
        if (typeof rates[u] === 'number' && rates[u]! > 0) {
          baseCmCost = toCmRate(rates[u]!, u)
          break
        }
      }

      if (baseCmCost !== null && baseCmCost > 0) {
        const { error: upsertErr } = await (serviceSupabase as any)
          .from('pricing_rules')
          .upsert(
            {
              tenant_id: tenantId,
              product_type_id: productId,
              source: src,
              unit_cost: Number(baseCmCost.toFixed(6)),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'tenant_id, product_type_id, source' }
          )

        if (upsertErr) {
          console.error(`Error updating pricing_rule for ${src}:`, upsertErr)
        }
      }
    }
  }

  revalidatePath('/dashboard/admin/products')
  revalidatePath('/dashboard/jobs/new')
  return { success: true }
}

export async function createProductWithPricing(
  name: string,
  scheme?: ProductPricingScheme
): Promise<ActionResponse & { product?: any }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const trimmed = name?.trim()
  if (!trimmed) return { error: 'Product name is required' }

  const serviceSupabase = createServiceClient()

  // 1. Create product
  const { data: newProd, error: createErr } = await (serviceSupabase as any)
    .from('product_types')
    .insert({
      tenant_id: profile.tenant_id,
      name: trimmed,
      is_active: true
    })
    .select('id, name')
    .single()

  if (createErr || !newProd) {
    console.error('Create product error:', createErr)
    return { error: createErr?.message || 'Failed to create product' }
  }

  // 2. If scheme provided, save unit pricing & pricing rules
  if (scheme) {
    await saveProductUnitPricing(newProd.id, scheme)
  }

  revalidatePath('/dashboard/admin/products')
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard/jobs/new')
  return { success: true, product: newProd }
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
  const source = formData.get('source') as JobSource
  const unit = (formData.get('unit') as DimensionUnit) || 'ft'
  const rawCost = parseFloat(formData.get('unitCost') as string)

  if (!productTypeId || !source || isNaN(rawCost) || rawCost <= 0) {
    return { error: 'Invalid fields provided' }
  }

  const baseUnitCost = toCmRate(rawCost, unit)

  const { error } = await supabase.from('pricing_rules').insert({
    tenant_id: profile.tenant_id,
    product_type_id: productTypeId,
    source,
    unit_cost: Number(baseUnitCost.toFixed(6))
  } as any)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A pricing rule for this product and source already exists.' }
    }
    console.error('Create pricing rule error:', error)
    return { error: error.message }
  }

  // Also update tenant unit pricing config
  try {
    const config = await getTenantUnitPricing(profile.tenant_id)
    if (!config[productTypeId]) config[productTypeId] = {}
    if (!config[productTypeId][source]) config[productTypeId][source] = {}
    config[productTypeId][source]![unit] = rawCost
    await saveTenantUnitPricing(profile.tenant_id, config)
  } catch (err) {
    console.warn('Failed to update config from createPricingRule:', err)
  }

  revalidatePath('/dashboard/admin/products')
  return { success: true }
}

export async function updatePricingRule(
  id: string,
  rawCost: number,
  unit: DimensionUnit = 'ft',
  newProductTypeId?: string,
  newSource?: JobSource
): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: string } | null, error: any }
  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  if (isNaN(rawCost) || rawCost <= 0) {
    return { error: 'Invalid unit cost provided' }
  }

  const baseUnitCost = toCmRate(rawCost, unit)
  const serviceSupabase = createServiceClient()

  // Fetch the existing rule to know its product and source
  const { data: rule } = await serviceSupabase
    .from('pricing_rules')
    .select('product_type_id, source')
    .eq('id', id)
    .single() as { data: { product_type_id: string; source: string } | null, error: any }

  if (!rule) return { error: 'Pricing rule not found' }

  const finalProductTypeId = newProductTypeId || rule.product_type_id
  const finalSource = (newSource || rule.source) as JobSource

  const updatePayload: any = {
    unit_cost: Number(baseUnitCost.toFixed(6)),
    updated_at: new Date().toISOString()
  }
  if (newProductTypeId) updatePayload.product_type_id = newProductTypeId
  if (newSource) updatePayload.source = newSource

  const { error } = await (serviceSupabase as any)
    .from('pricing_rules')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A pricing rule for this product and source already exists.' }
    }
    console.error('Update pricing rule error:', error)
    return { error: error.message }
  }

  try {
    const config = await getTenantUnitPricing(profile.tenant_id)
    // If product or source changed, remove old entry
    if (rule.product_type_id !== finalProductTypeId || rule.source !== finalSource) {
      if (config[rule.product_type_id]?.[rule.source as JobSource]) {
        delete config[rule.product_type_id][rule.source as JobSource]
      }
    }
    if (!config[finalProductTypeId]) config[finalProductTypeId] = {}
    if (!config[finalProductTypeId][finalSource]) config[finalProductTypeId][finalSource] = {}
    config[finalProductTypeId][finalSource]![unit] = rawCost
    await saveTenantUnitPricing(profile.tenant_id, config)
  } catch (err) {
    console.warn('Failed to update config from updatePricingRule:', err)
  }

  revalidatePath('/dashboard/admin/products')
  return { success: true }
}

export async function deleteProductType(id: string): Promise<ActionResponse & { message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null, error: any }

  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const serviceSupabase = createServiceClient()

  // 1. Check if product exists for this tenant
  const { data: product, error: fetchErr } = await (serviceSupabase as any)
    .from('product_types')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  const productData = product as any
  if (fetchErr || !productData) {
    return { error: 'Product not found' }
  }

  // 2. Check if any jobs reference this product
  const { count: jobCount, error: countErr } = await serviceSupabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('product_type_id', id)
    .eq('tenant_id', profile.tenant_id)

  if (countErr) {
    return { error: 'Failed to verify product dependencies: ' + countErr.message }
  }

  if ((jobCount || 0) === 0) {
    // No jobs linked: safely delete pricing rules, then product type permanently
    await serviceSupabase
      .from('pricing_rules')
      .delete()
      .eq('product_type_id', id)
      .eq('tenant_id', profile.tenant_id)

    const { error: delErr } = await (serviceSupabase as any)
      .from('product_types')
      .delete()
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)

    if (delErr) {
      console.error('Delete product error:', delErr)
      return { error: delErr.message }
    }

    // Clean up unit pricing config if present
    try {
      const config = await getTenantUnitPricing(profile.tenant_id)
      if (config[id]) {
        delete config[id]
        await saveTenantUnitPricing(profile.tenant_id, config)
      }
    } catch (err) {
      console.warn('Failed to clean up unit pricing config on product deletion:', err)
    }

    revalidatePath('/dashboard/admin/products')
    revalidatePath('/dashboard/admin')
    revalidatePath('/dashboard/jobs/new')
    return { success: true, message: `"${productData.name}" has been permanently deleted.` }
  } else {
    // Jobs are linked: deactivate product and delete pricing rules so it can no longer be ordered
    await serviceSupabase
      .from('pricing_rules')
      .delete()
      .eq('product_type_id', id)
      .eq('tenant_id', profile.tenant_id)

    const { error: updateErr } = await (serviceSupabase as any)
      .from('product_types')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)

    if (updateErr) {
      console.error('Deactivate product error:', updateErr)
      return { error: updateErr.message }
    }

    revalidatePath('/dashboard/admin/products')
    revalidatePath('/dashboard/admin')
    revalidatePath('/dashboard/jobs/new')
    return { 
      success: true, 
      message: `"${productData.name}" is linked to ${jobCount} past order(s). It has been deactivated and removed from new orders.` 
    }
  }
}

export async function deletePricingRule(id: string): Promise<ActionResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null, error: any }

  const profile = profileData
  if (!profile || profile.role !== 'admin') return { error: 'Admin access required' }

  const serviceSupabase = createServiceClient()

  const { error } = await serviceSupabase
    .from('pricing_rules')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) {
    console.error('Delete pricing rule error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/products')
  return { success: true }
}
