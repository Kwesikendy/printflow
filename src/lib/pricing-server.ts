import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { getObjectFromR2, uploadToR2 } from '@/lib/r2'
import type { UnitPricingConfig } from '@/types/database'

const PRICING_CONFIG_PATH = (tenantId: string) => `${tenantId}/settings/unit_pricing.json`

const pricingCache = new Map<string, { config: UnitPricingConfig; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Loads the unit pricing configuration for a tenant from Cloudflare R2 (or Supabase fallback).
 */
export async function getTenantUnitPricing(tenantId: string): Promise<UnitPricingConfig> {
  const cached = pricingCache.get(tenantId)
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.config
  }

  const path = PRICING_CONFIG_PATH(tenantId)
  
  // Try R2 first
  try {
    const text = await getObjectFromR2(path)
    if (text) {
      const parsed = JSON.parse(text) as UnitPricingConfig
      pricingCache.set(tenantId, { config: parsed, timestamp: Date.now() })
      return parsed
    }
  } catch (r2Err) {
    // Continue to Supabase fallback
  }

  // Fallback to Supabase
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage
      .from('artworks')
      .download(path)

    if (error || !data) {
      return {}
    }

    const text = await data.text()
    return JSON.parse(text) as UnitPricingConfig
  } catch (err) {
    console.warn(`Failed to load unit pricing for tenant ${tenantId}:`, err)
    return {}
  }
}

/**
 * Saves the unit pricing configuration for a tenant into Cloudflare R2 (and Supabase).
 */
export async function saveTenantUnitPricing(
  tenantId: string,
  config: UnitPricingConfig
): Promise<{ success: boolean; error?: string }> {
  const path = PRICING_CONFIG_PATH(tenantId)
  const jsonStr = JSON.stringify(config, null, 2)
  pricingCache.set(tenantId, { config, timestamp: Date.now() })

  try {
    await uploadToR2({
      key: path,
      body: Buffer.from(jsonStr),
      contentType: 'application/json',
    })
    return { success: true }
  } catch (r2Err: any) {
    console.warn('[R2 save pricing failed, trying Supabase]:', r2Err.message)
    try {
      const supabase = createServiceClient()
      const { error } = await supabase.storage
        .from('artworks')
        .upload(path, Buffer.from(jsonStr), {
          upsert: true,
          contentType: 'application/json',
        })

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

