import type { DimensionUnit, JobSource } from '@/types/database'

// Square centimeters per unit squared
export const SQ_CM_PER_UNIT: Record<DimensionUnit, number> = {
  cm: 1,
  m: 10000,
  ft: 929.0304, // 30.48 * 30.48
  in: 6.4516,   // 2.54 * 2.54
}

export const UNIT_LABELS: Record<DimensionUnit, string> = {
  ft: 'sq ft (ft²)',
  in: 'sq in (in²)',
  cm: 'sq cm (cm²)',
  m: 'sq m (m²)',
}

export const UNIT_SHORT_LABELS: Record<DimensionUnit, string> = {
  ft: 'ft²',
  in: 'in²',
  cm: 'cm²',
  m: 'm²',
}

export type UnitRates = Partial<Record<DimensionUnit, number>>

export interface ProductPricingScheme {
  walk_in?: UnitRates
  marketing?: UnitRates
  default_unit?: DimensionUnit
}

export type UnitPricingConfig = Record<string, ProductPricingScheme>

/**
 * Converts a rate from one unit squared to another unit squared based on geometric area.
 * e.g. ₵2.80 / ft² -> GHS / cm²
 */
export function convertRate(
  rate: number,
  fromUnit: DimensionUnit,
  toUnit: DimensionUnit
): number {
  if (fromUnit === toUnit) return rate
  const fromCm2 = SQ_CM_PER_UNIT[fromUnit]
  const toCm2 = SQ_CM_PER_UNIT[toUnit]
  const ratePerCm2 = rate / fromCm2
  return ratePerCm2 * toCm2
}

/**
 * Normalizes a unit rate to GHS / cm² for database storage.
 */
export function toCmRate(rate: number, unit: DimensionUnit): number {
  return rate / SQ_CM_PER_UNIT[unit]
}

/**
 * Converts a GHS / cm² cost from the database to a human rate for the given unit.
 */
export function fromCmRate(cmCost: number, unit: DimensionUnit): number {
  return cmCost * SQ_CM_PER_UNIT[unit]
}

/**
 * Resolves the unit rate for a product, source, and dimension unit.
 * Uses explicit custom override if defined in config, otherwise derives geometrically from base cm² cost.
 */
export function resolveUnitRate(
  config: UnitPricingConfig | null | undefined,
  productId: string,
  source: JobSource,
  unit: DimensionUnit,
  baseCmCost?: number
): number {
  const scheme = config?.[productId]
  const sourceRates = scheme?.[source]
  if (sourceRates && typeof sourceRates[unit] === 'number' && sourceRates[unit]! > 0) {
    return sourceRates[unit]!
  }

  // If there's another unit defined for this source, convert from it
  if (sourceRates) {
    const units: DimensionUnit[] = ['ft', 'in', 'm', 'cm']
    for (const u of units) {
      if (typeof sourceRates[u] === 'number' && sourceRates[u]! > 0) {
        return convertRate(sourceRates[u]!, u, unit)
      }
    }
  }

  // Fallback to converting from base cm cost
  if (typeof baseCmCost === 'number' && baseCmCost > 0) {
    return fromCmRate(baseCmCost, unit)
  }

  return 0
}
