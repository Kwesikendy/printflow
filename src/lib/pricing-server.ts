import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import type { UnitPricingConfig } from '@/types/database'

const PRICING_CONFIG_PATH = (tenantId: string) => `${tenantId}/settings/unit_pricing.json`

/**
 * Loads the unit pricing configuration for a tenant from Supabase Storage.
 */
export async function getTenantUnitPricing(tenantId: string): Promise<UnitPricingConfig> {
  const supabase = createServiceClient()
  try {
    const { data, error } = await supabase.storage
      .from('artworks')
      .download(PRICING_CONFIG_PATH(tenantId))

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
 * Saves the unit pricing configuration for a tenant into Supabase Storage.
 */
export async function saveTenantUnitPricing(
  tenantId: string,
  config: UnitPricingConfig
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  try {
    const jsonStr = JSON.stringify(config, null, 2)
    const { error } = await supabase.storage
      .from('artworks')
      .upload(PRICING_CONFIG_PATH(tenantId), Buffer.from(jsonStr), {
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
