export type SubstrateFamily =
  | 'flexi'
  | 'sav'
  | 'one_way'
  | 'reflective'
  | 'pvc'
  | 'backlit'
  | 'canvas'
  | 'mesh'
  | 'board'
  | 'paper'
  | 'dtf'
  | 'other'

export type FinishType = 'matte' | 'glossy' | null

export interface MaterialLike {
  id: string
  name: string
  unit?: string
  roll_width: number
  roll_length?: number
  roll_height?: number
  qty_rolls: number
  unit_cost?: number
}

export interface ParsedRollDimensions {
  effectiveWidthM: number
  effectiveLengthM: number
  effectiveAreaPerRollM2: number
  widthFeetLabel: string | null
  widthSummary: string
  isWidthMisconfiguredInDb: boolean
  family: SubstrateFamily
  finish: FinishType
}

const FEET_TO_METERS = 0.3048

/**
 * Standard print shop roll widths in meters when a roll name specifies feet (e.g. "3FT", "4FT", "5FT", "10FT")
 * without an explicit meter width, or when the DB roll_width was mistakenly entered as 50m.
 */
const STANDARD_FT_TO_METERS: Record<number, number> = {
  2: 0.61,
  3: 0.914, // 3ft SAV / Flexi roll (~0.914m / 36in)
  4: 1.22,  // 4ft SAV / Flexi roll (~1.22m - 1.3m)
  5: 1.52,  // 5ft SAV / Flexi roll (~1.52m - 1.85m)
  6: 1.83,
  8: 2.44,
  10: 3.2,  // 10ft Flexi roll (3.2m)
}

export function detectSubstrateFamily(rawName?: string | null): {
  family: SubstrateFamily
  finish: FinishType
  familyLabel: string
} {
  const s = (rawName || '').toLowerCase().replace(/[-_]/g, ' ')

  let finish: FinishType = null
  if (/\b(matte|matt)\b/.test(s)) {
    finish = 'matte'
  } else if (/\b(glossy|gloss)\b/.test(s)) {
    finish = 'glossy'
  }

  if (/\b(one\s*way|owv|perforated|vision)\b/.test(s)) {
    return { family: 'one_way', finish, familyLabel: 'One Way Vision' }
  }
  if (/\b(reflective|reflector|honeycomb)\b/.test(s)) {
    return { family: 'reflective', finish, familyLabel: 'Reflective Media' }
  }
  if (/\b(backlit|back\s*lit|lightbox|light\s*box)\b/.test(s)) {
    return { family: 'backlit', finish, familyLabel: 'Backlit Media' }
  }
  if (/\b(canvas)\b/.test(s)) {
    return { family: 'canvas', finish, familyLabel: 'Canvas Roll' }
  }
  if (/\b(mesh)\b/.test(s)) {
    return { family: 'mesh', finish, familyLabel: 'Mesh Banner' }
  }
  if (/\b(sav|sticker|vinyl|decal|car\s*branding|wall\s*branding|window\s*branding|clear\s*sticker|transparent\s*sticker|label)\b/.test(s)) {
    return { family: 'sav', finish, familyLabel: 'SAV / Vinyl Roll' }
  }
  if (/\b(flexi|flexy|banner|billboard|bunting|backdrop|pull\s*up|pullup|roll\s*up|rollup)\b/.test(s)) {
    return { family: 'flexi', finish, familyLabel: 'Flexi Roll' }
  }
  if (/\b(pvc)\b/.test(s)) {
    return { family: 'pvc', finish, familyLabel: 'PVC Roll' }
  }
  if (/\b(foam\s*board|foamboard|forex|corex|coroplast|acrylic|perspex|alucobond|board)\b/.test(s)) {
    return { family: 'board', finish, familyLabel: 'Rigid Board / Sheet' }
  }
  if (/\b(dtf|sublimation|heat\s*transfer|shirt|jersey)\b/.test(s)) {
    return { family: 'dtf', finish, familyLabel: 'DTF / Transfer' }
  }
  if (/\b(flyer|brochure|poster|business\s*card|call\s*card|letterhead|invoice\s*book|receipt|envelope|a4|a3|a2|a1|a0|paper)\b/.test(s)) {
    return { family: 'paper', finish, familyLabel: 'Paper / Sheet Print' }
  }

  return { family: 'other', finish, familyLabel: 'General Media' }
}

/**
 * Extracts the true roll width (m) and length (m) from a material record,
 * automatically recovering from cases where `roll_width` was mistakenly entered as 50m
 * (e.g. "SAV-GLOSSY 3FT -50M" with roll_width=50, roll_length=50).
 */
export function parseRollDimensions(material: MaterialLike): ParsedRollDimensions {
  const name = material.name || ''
  const dbWidth = Number(material.roll_width) || 0
  const dbLength = Number(material.roll_height ?? material.roll_length) || 50
  const { family, finish } = detectSubstrateFamily(name)

  // 1. Check for feet pattern in name, e.g. "3FT", "4FT", "5FT", "10FT"
  const ftMatch = name.match(/(?:^|[\s\-_])(\d+(?:\.\d+)?)\s*(?:ft|feet)\b/i)
  const parsedFeet = ftMatch ? parseFloat(ftMatch[1]) : null

  // 2. Check for meter numbers in name, e.g. "3.2M", "1.3M", "1.85M", "50M"
  const meterMatches = Array.from(name.matchAll(/(?:^|[\s\-_])(\d+(?:\.\d+)?)\s*m\b/gi)).map(m => parseFloat(m[1]))
  // Meter widths are always <= 6.5m (e.g., 1.07m, 1.27m, 1.3m, 1.52m, 1.85m, 3.2m, 5m)
  const parsedWidthMeters = meterMatches.find(v => v > 0.2 && v <= 6.5) ?? null
  // Meter lengths are typically >= 20m (e.g., 30m, 50m, 100m)
  const parsedLengthMeters = meterMatches.find(v => v >= 20) ?? null

  let effectiveWidthM = dbWidth
  let isWidthMisconfiguredInDb = false

  if (parsedWidthMeters) {
    // Explicit meter width in the name (like "1.3M", "1.85M", "3.2M")
    if (dbWidth <= 0 || dbWidth > 6.5 || Math.abs(dbWidth - parsedWidthMeters) > 0.5) {
      effectiveWidthM = parsedWidthMeters
      if (dbWidth > 6.5) isWidthMisconfiguredInDb = true
    } else {
      effectiveWidthM = dbWidth
    }
  } else if (parsedFeet && parsedFeet > 0 && parsedFeet <= 20) {
    const standardM = STANDARD_FT_TO_METERS[parsedFeet] || Number((parsedFeet * FEET_TO_METERS).toFixed(2))
    // If DB width is > 6.5m (e.g., 50m entered by mistake on "SAV-GLOSSY 3FT -50M"), use the feet width!
    if (dbWidth <= 0 || dbWidth > 6.5) {
      effectiveWidthM = standardM
      isWidthMisconfiguredInDb = dbWidth > 6.5
    }
  }

  if (effectiveWidthM <= 0) {
    effectiveWidthM = 1.52
  }

  const effectiveLengthM = dbLength > 0 && dbLength <= 500 ? dbLength : (parsedLengthMeters || 50)
  const effectiveAreaPerRollM2 = Number((effectiveWidthM * effectiveLengthM).toFixed(2))

  // Build human-friendly label like "3FT (0.91m)" or "4FT (1.3m)" or "10FT (3.2m)"
  let widthFeetLabel: string | null = null
  if (parsedFeet) {
    widthFeetLabel = `${parsedFeet}FT`
  } else {
    const approxFt = Math.round(effectiveWidthM / FEET_TO_METERS)
    if (approxFt > 0 && approxFt <= 16) {
      widthFeetLabel = `~${approxFt}FT`
    }
  }

  const widthSummary = widthFeetLabel
    ? `${widthFeetLabel} (${Number(effectiveWidthM.toFixed(2))}m)`
    : `${Number(effectiveWidthM.toFixed(2))}m`

  return {
    effectiveWidthM,
    effectiveLengthM,
    effectiveAreaPerRollM2,
    widthFeetLabel,
    widthSummary,
    isWidthMisconfiguredInDb,
    family,
    finish,
  }
}

export interface JobConsumptionInfo {
  widthM: number
  heightM: number
  widthFt: number
  heightFt: number
  shortSideM: number
  longSideM: number
  shortSideFt: number
  longSideFt: number
  totalAreaM2: number
  totalAreaFt2: number
  quantity: number
  inferredFromProductName: boolean
}

/**
 * Converts a job's dimensions to meters and feet, and extracts embedded dimensions
 * for fixed-price items like "PULLUP FLEXY 80 X 200CM" or "PVC 80 X 200CM".
 */
export function calculateJobConsumption(
  width: number,
  height: number,
  quantity: number,
  dimensionUnit?: string | null,
  productName?: string | null
): JobConsumptionInfo {
  const unit = (dimensionUnit || 'cm').toLowerCase()
  const qty = Math.max(1, Number(quantity) || 1)
  let rawW = Number(width) || 0
  let rawH = Number(height) || 0
  let effectiveUnit = unit
  let inferredFromProductName = false

  // If fixed-price item was saved with placeholder 1x1 dimensions, check product name for "80 X 200CM" or "3 X 6FT"
  if (rawW <= 1 && rawH <= 1 && productName) {
    const dimMatch = productName.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(cm|m|ft|in)\b/i)
    if (dimMatch) {
      rawW = parseFloat(dimMatch[1])
      rawH = parseFloat(dimMatch[2])
      effectiveUnit = dimMatch[3].toLowerCase()
      inferredFromProductName = true
    }
  }

  let widthM = rawW
  let heightM = rawH

  switch (effectiveUnit) {
    case 'cm':
      widthM = rawW / 100
      heightM = rawH / 100
      break
    case 'mm':
      widthM = rawW / 1000
      heightM = rawH / 1000
      break
    case 'ft':
      widthM = rawW * FEET_TO_METERS
      heightM = rawH * FEET_TO_METERS
      break
    case 'in':
      widthM = rawW * 0.0254
      heightM = rawH * 0.0254
      break
    case 'm':
    default:
      widthM = rawW
      heightM = rawH
      break
  }

  const widthFt = widthM / FEET_TO_METERS
  const heightFt = heightM / FEET_TO_METERS
  const shortSideM = Math.min(widthM, heightM)
  const longSideM = Math.max(widthM, heightM)
  const shortSideFt = Math.min(widthFt, heightFt)
  const longSideFt = Math.max(widthFt, heightFt)
  const totalAreaM2 = Number((widthM * heightM * qty).toFixed(3))
  const totalAreaFt2 = Number((widthFt * heightFt * qty).toFixed(2))

  return {
    widthM: Number(widthM.toFixed(3)),
    heightM: Number(heightM.toFixed(3)),
    widthFt: Number(widthFt.toFixed(2)),
    heightFt: Number(heightFt.toFixed(2)),
    shortSideM: Number(shortSideM.toFixed(3)),
    longSideM: Number(longSideM.toFixed(3)),
    shortSideFt: Number(shortSideFt.toFixed(2)),
    longSideFt: Number(longSideFt.toFixed(2)),
    totalAreaM2,
    totalAreaFt2,
    quantity: qty,
    inferredFromProductName,
  }
}

export interface MaterialRecommendation {
  recommendedMaterial: (MaterialLike & { parsed: ParsedRollDimensions }) | null
  reason: string
  familyLabel: string
  familyCandidates: Array<MaterialLike & { parsed: ParsedRollDimensions }>
  allMaterialsEnriched: Array<MaterialLike & { parsed: ParsedRollDimensions }>
  consumption: JobConsumptionInfo
  rollsToDeduct: number
}

/**
 * Smart matcher that selects the best warehouse roll for a print job:
 * 1. Identifies the substrate family from the product name (or from its linked default material).
 * 2. Finds all warehouse rolls in that substrate family.
 * 3. Auto-selects the smallest roll width in stock (`effectiveWidthM >= job.shortSideM`) that fits the job.
 */
export function recommendMaterialForJob(
  job: {
    width: number
    height: number
    quantity: number
    dimension_unit?: string | null
    product_type_id?: string | null
    product_types?: { name?: string | null; material_id?: string | null } | null
  },
  materials: MaterialLike[],
  linkedMaterialIdOverride?: string | null
): MaterialRecommendation {
  const productName = job.product_types?.name || ''
  const defaultLinkedId = linkedMaterialIdOverride ?? job.product_types?.material_id ?? null

  const consumption = calculateJobConsumption(
    job.width,
    job.height,
    job.quantity,
    job.dimension_unit,
    productName
  )

  const allMaterialsEnriched = materials.map(m => ({
    ...m,
    parsed: parseRollDimensions(m),
  }))

  // Determine target family & finish from product name, or from its explicitly linked material
  let { family: targetFamily, finish: targetFinish, familyLabel } = detectSubstrateFamily(productName)
  const explicitlyLinkedMat = defaultLinkedId
    ? allMaterialsEnriched.find(m => m.id === defaultLinkedId) || null
    : null

  if ((targetFamily === 'other' || targetFamily === 'paper') && explicitlyLinkedMat) {
    targetFamily = explicitlyLinkedMat.parsed.family
    familyLabel = detectSubstrateFamily(explicitlyLinkedMat.name).familyLabel
    if (!targetFinish) targetFinish = explicitlyLinkedMat.parsed.finish
  }

  // Find all rolls belonging to the same substrate family
  let familyCandidates = allMaterialsEnriched.filter(m => {
    if (targetFamily !== 'other' && targetFamily !== 'paper') {
      if (m.parsed.family === targetFamily) return true
      // PVC banners can fall back to Flexi rolls if no dedicated PVC roll exists
      if (targetFamily === 'pvc' && m.parsed.family === 'flexi') return true
    }
    return false
  })

  // Also check token overlap if family was 'other'
  if (familyCandidates.length === 0 && productName) {
    const productTokens = productName
      .toLowerCase()
      .split(/[\s\-_/(),]+/)
      .filter(t => t.length >= 3 && !['the', 'and', 'for', 'with', 'print', 'printing'].includes(t))

    familyCandidates = allMaterialsEnriched.filter(m => {
      const mLower = m.name.toLowerCase()
      return productTokens.some(tok => mLower.includes(tok))
    })
  }

  // Ensure explicitly linked material is included in familyCandidates if not already
  if (explicitlyLinkedMat && !familyCandidates.some(c => c.id === explicitlyLinkedMat.id)) {
    familyCandidates = [explicitlyLinkedMat, ...familyCandidates]
  }

  // Sort family candidates ascending by effectiveWidthM, then descending by stock (qty_rolls)
  familyCandidates.sort((a, b) => {
    const widthDiff = a.parsed.effectiveWidthM - b.parsed.effectiveWidthM
    if (Math.abs(widthDiff) > 0.03) return widthDiff
    // Prefer explicitly linked material if same width and has stock
    if (a.id === defaultLinkedId && a.qty_rolls > 0) return -1
    if (b.id === defaultLinkedId && b.qty_rolls > 0) return 1
    return (Number(b.qty_rolls) || 0) - (Number(a.qty_rolls) || 0)
  })

  if (familyCandidates.length === 0) {
    return {
      recommendedMaterial: null,
      reason: targetFamily === 'paper'
        ? 'Paper / sheet item (no wide-format roll required unless selected)'
        : 'No matching roll family found — select roll manually if needed',
      familyLabel,
      familyCandidates: [],
      allMaterialsEnriched,
      consumption,
      rollsToDeduct: 0,
    }
  }

  // Filter candidates by finish preference if product explicitly specifies Matte or Glossy
  let pool = familyCandidates
  if (targetFinish) {
    const finishMatches = pool.filter(m => m.parsed.finish === targetFinish)
    if (finishMatches.length > 0) {
      pool = finishMatches
    }
  }

  // Prefer in-stock rolls (qty_rolls > 0)
  const inStockPool = pool.filter(m => (Number(m.qty_rolls) || 0) > 0)
  const activePool = inStockPool.length > 0 ? inStockPool : pool

  // Tolerance of 0.035m (3.5cm) so a 3ft (0.914m) job fits a 0.90m/0.91m 3FT roll
  // and a 4ft (1.219m) job fits a 1.20m/1.22m 4FT roll
  const TOLERANCE_M = 0.035
  const requiredWidthM = consumption.shortSideM

  // 1. Check if the job's widthM or heightM fits a roll without rotation, or via shortest side
  const fittingRolls = activePool.filter(
    m => m.parsed.effectiveWidthM + TOLERANCE_M >= requiredWidthM
  )

  let chosen: (MaterialLike & { parsed: ParsedRollDimensions }) | null = null
  let reason = ''

  if (fittingRolls.length > 0) {
    // fittingRolls is already sorted ascending by effectiveWidthM, and by highest stock for ties!
    chosen = fittingRolls[0]
    reason = `Auto-picked smallest fitting ${familyLabel} (${chosen.parsed.widthSummary}) for ${consumption.widthFt}ft × ${consumption.heightFt}ft job`
  } else {
    // Job's shortest side exceeds all roll widths (e.g. large billboard panelled across widest roll)
    // Pick the widest roll available in the active pool
    const sortedDesc = [...activePool].sort((a, b) => {
      const widthDiff = b.parsed.effectiveWidthM - a.parsed.effectiveWidthM
      if (Math.abs(widthDiff) > 0.03) return widthDiff
      return (Number(b.qty_rolls) || 0) - (Number(a.qty_rolls) || 0)
    })
    chosen = sortedDesc[0]
    reason = `Job exceeds single roll width — selected widest ${familyLabel} (${chosen.parsed.widthSummary})`
  }

  const rollArea = chosen ? chosen.parsed.effectiveAreaPerRollM2 : 0
  const rollsToDeduct = rollArea > 0 ? Number((consumption.totalAreaM2 / rollArea).toFixed(4)) : 0

  return {
    recommendedMaterial: chosen,
    reason,
    familyLabel,
    familyCandidates,
    allMaterialsEnriched,
    consumption,
    rollsToDeduct,
  }
}
