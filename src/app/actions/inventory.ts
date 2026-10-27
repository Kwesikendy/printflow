'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function checkInventoryPermission() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', profile: null }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, email, tenant_id')
    .eq('id', user.id)
    .single()

  const profile = profileData as any
  if (!profile || !['admin', 'accountant'].includes(profile.role)) {
    return { error: 'Insufficient permissions. Only Admin and Accountant can manage inventory.', profile: null }
  }

  return { error: null, profile }
}

export async function getMaterialsAction(_tenantId?: string) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { data: [], error: permError || 'Unauthorized' }

  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase as any)
    .from('materials')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('name')
  return { data, error: error?.message }
}

export async function getInventoryLogsAction(_tenantId?: string, limit = 60) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { data: [], error: permError || 'Unauthorized' }

  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase as any)
    .from('inventory_logs')
    .select(`
      id,
      tenant_id,
      material_id,
      action,
      job_id,
      qty_change_rolls,
      qty_change_area,
      notes,
      created_at,
      materials(name, roll_width, roll_length),
      jobs(job_number, customer_name)
    `)
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data, error: error?.message }
}

export async function getProductTypesForMaterialsAction(_tenantId?: string) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { data: [], error: permError || 'Unauthorized' }

  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase as any)
    .from('product_types')
    .select('id, name, is_active, material_id')
    .eq('tenant_id', profile.tenant_id)
    .order('name')
  return { data, error: error?.message }
}

export async function createMaterialAction(payload: any) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { error: permError }

  const width = parseFloat(payload.roll_width)
  const height = parseFloat(payload.roll_height ?? payload.roll_length)
  const qty = parseFloat(payload.qty_rolls || 0)
  const cost = parseFloat(payload.unit_cost || 0)

  if (isNaN(width) || width <= 0) return { error: 'Valid roll width is required' }
  if (isNaN(height) || height <= 0) return { error: 'Valid roll height is required' }

  const nowIso = new Date().toISOString()
  const serviceSupabase = createServiceClient()
  const insertData: any = {
    tenant_id: profile.tenant_id,
    name: payload.name.trim(),
    unit: payload.unit || 'roll',
    roll_width: width,
    roll_length: height,
    qty_rolls: isNaN(qty) ? 0 : qty,
    unit_cost: isNaN(cost) ? 0 : cost,
    created_at: nowIso,
    updated_at: nowIso,
  }

  let { data: newMat, error } = await (serviceSupabase as any).from('materials').insert({
    ...insertData,
    roll_height: height,
  }).select().single()

  if (error && (error.message?.includes('roll_height') || error.message?.includes('schema cache'))) {
    const fallback = await (serviceSupabase as any).from('materials').insert(insertData).select().single()
    newMat = fallback.data
    error = fallback.error
  }

  if (error) return { error: error.message }

  if (newMat && !newMat.created_at) {
    newMat.created_at = nowIso
  }
  if (newMat && !newMat.updated_at) {
    newMat.updated_at = nowIso
  }

  // If initial quantity > 0, log opening stock
  let createdLog: any = null
  if (qty > 0 && newMat) {
    const area = width * height * qty
    const { data: logRow } = await (serviceSupabase as any).from('inventory_logs').insert({
      tenant_id: profile.tenant_id,
      material_id: newMat.id,
      action: 'add_stock',
      qty_change_rolls: qty,
      qty_change_area: area,
      created_at: nowIso,
      notes: `Opening stock: ${qty} rolls @ ${cost.toFixed(2)} GHS/roll`
    }).select('*, materials(name, roll_width, roll_length)').single()
    createdLog = logRow || {
      id: `log-${Date.now()}`,
      tenant_id: profile.tenant_id,
      material_id: newMat.id,
      action: 'add_stock',
      job_id: null,
      qty_change_rolls: qty,
      qty_change_area: area,
      created_at: nowIso,
      notes: `Opening stock: ${qty} rolls @ ${cost.toFixed(2)} GHS/roll`,
      materials: { name: newMat.name, roll_width: width, roll_length: height },
    }
  }

  revalidatePath('/dashboard/admin/inventory')
  return { success: true, data: newMat, log: createdLog }
}

export async function updateMaterialAction(materialId: string, payload: any) {
  const { error: permError } = await checkInventoryPermission()
  if (permError) return { error: permError }

  const width = parseFloat(payload.roll_width)
  const height = parseFloat(payload.roll_height ?? payload.roll_length)
  const cost = parseFloat(payload.unit_cost)
  const qty = payload.qty_rolls !== undefined ? parseFloat(payload.qty_rolls) : undefined

  if (isNaN(width) || width <= 0) return { error: 'Valid width is required' }
  if (isNaN(height) || height <= 0) return { error: 'Valid height is required' }

  const nowIso = new Date().toISOString()
  const serviceSupabase = createServiceClient()
  const updateData: any = {
    name: payload.name.trim(),
    unit: payload.unit || 'roll',
    roll_width: width,
    roll_length: height,
    unit_cost: isNaN(cost) ? 0 : cost,
    updated_at: nowIso
  }

  if (qty !== undefined && !isNaN(qty) && qty >= 0) {
    updateData.qty_rolls = qty
  }

  let { error } = await (serviceSupabase as any).from('materials').update({
    ...updateData,
    roll_height: height,
  }).eq('id', materialId)

  if (error && (error.message?.includes('roll_height') || error.message?.includes('schema cache'))) {
    const fallback = await (serviceSupabase as any).from('materials').update(updateData).eq('id', materialId)
    error = fallback.error
  }

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true, updatedAt: nowIso }
}

export async function addStockAction(materialId: string, qtyToAdd: number, costPerRoll: number, notes?: string) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { error: permError }

  if (isNaN(qtyToAdd) || qtyToAdd <= 0) return { error: 'Quantity must be greater than 0' }
  if (isNaN(costPerRoll) || costPerRoll < 0) return { error: 'Unit cost must be 0 or positive' }

  const serviceSupabase = createServiceClient()

  // Get current material
  const { data: materialData, error: fetchErr } = await (serviceSupabase as any)
    .from('materials')
    .select('qty_rolls, unit_cost, roll_width, roll_length, roll_height, unit, name')
    .eq('id', materialId)
    .single()
  
  const material = materialData as any
  if (fetchErr || !material) return { error: 'Material not found' }

  const unitLabel = material.unit === 'sheet' ? 'sheets' : material.unit === 'piece' ? 'pieces' : 'rolls'
  const unitSingular = material.unit === 'sheet' ? 'sheet' : material.unit === 'piece' ? 'piece' : 'roll'

  const currentQty = parseFloat(material.qty_rolls || 0)
  const currentCost = parseFloat(material.unit_cost || 0)
  const newQty = currentQty + qtyToAdd
  
  // Weighted-average cost calculation
  let newUnitCost = currentCost
  if (newQty > 0) {
    const totalCurrentValue = currentQty * currentCost
    const addedValue = qtyToAdd * costPerRoll
    newUnitCost = (totalCurrentValue + addedValue) / newQty
  }

  const nowIso = new Date().toISOString()
  const { error: updateErr } = await (serviceSupabase as any).from('materials').update({
    qty_rolls: newQty,
    unit_cost: newUnitCost,
    updated_at: nowIso
  }).eq('id', materialId)

  if (updateErr) return { error: updateErr.message }

  const addedArea = (parseFloat(material.roll_width) || 0) * (parseFloat(material.roll_height || material.roll_length) || 0) * qtyToAdd
  const noteText = notes?.trim() 
    ? `Added ${qtyToAdd} ${unitLabel} @ ${costPerRoll.toFixed(2)} GHS/${unitSingular} - ${notes.trim()}`
    : `Restocked: +${qtyToAdd} ${unitLabel} @ ${costPerRoll.toFixed(2)} GHS/${unitSingular}`

  // Log transaction
  const { data: logRow } = await (serviceSupabase as any).from('inventory_logs').insert({
    tenant_id: profile.tenant_id,
    material_id: materialId,
    action: 'add_stock',
    qty_change_rolls: qtyToAdd,
    qty_change_area: addedArea,
    created_at: nowIso,
    notes: noteText
  }).select('*, materials(name, roll_width, roll_length)').single()

  revalidatePath('/dashboard/admin/inventory')
  return {
    success: true,
    updatedAt: nowIso,
    log: logRow || {
      id: `log-${Date.now()}`,
      tenant_id: profile.tenant_id,
      material_id: materialId,
      action: 'add_stock',
      job_id: null,
      qty_change_rolls: qtyToAdd,
      qty_change_area: addedArea,
      created_at: nowIso,
      notes: noteText,
      materials: { name: material.name, roll_width: material.roll_width, roll_length: material.roll_length },
    }
  }
}

export async function adjustStockAction(
  materialId: string, 
  adjustmentType: 'deduct_waste' | 'recount' | 'correction', 
  rollsQty: number, 
  reasonNotes: string,
  dimensions?: { width: number; height: number }
) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { error: permError }

  const serviceSupabase = createServiceClient()

  const { data: materialData, error: fetchErr } = await (serviceSupabase as any)
    .from('materials')
    .select('qty_rolls, roll_width, roll_length, roll_height, unit, name')
    .eq('id', materialId)
    .single()

  const material = materialData as any
  if (fetchErr || !material) return { error: 'Material not found' }

  const unitArea = (parseFloat(material.roll_width) || 1) * (parseFloat(material.roll_height || material.roll_length) || 1)

  // If dimensions provided, calculate quantity based on wasted area
  let effectiveQty = rollsQty
  let noteSuffix = ''
  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    const wasteArea = dimensions.width * dimensions.height
    effectiveQty = wasteArea / (unitArea > 0 ? unitArea : 1)
    noteSuffix = ` [Waste: ${dimensions.width}m × ${dimensions.height}m = ${wasteArea.toFixed(2)} m²]`
  }

  if (isNaN(effectiveQty) || effectiveQty <= 0) return { error: 'Invalid quantity or dimensions' }
  if (!reasonNotes || !reasonNotes.trim()) return { error: 'Please provide a reason or note for this adjustment' }

  const currentQty = parseFloat(material.qty_rolls || 0)
  let newQty = currentQty
  let changeRolls = 0

  if (adjustmentType === 'deduct_waste' || adjustmentType === 'correction') {
    newQty = Math.max(0, currentQty - effectiveQty)
    changeRolls = -effectiveQty
  } else if (adjustmentType === 'recount') {
    // Physical inventory audit recount: effectiveQty is the new actual count
    changeRolls = effectiveQty - currentQty
    newQty = effectiveQty
  }

  const nowIso = new Date().toISOString()
  const { error: updateErr } = await (serviceSupabase as any).from('materials').update({
    qty_rolls: newQty,
    updated_at: nowIso
  }).eq('id', materialId)

  if (updateErr) return { error: updateErr.message }

  const changeArea = changeRolls * unitArea
  const fullNotes = `${reasonNotes.trim()}${noteSuffix}`

  const { data: logRow } = await (serviceSupabase as any).from('inventory_logs').insert({
    tenant_id: profile.tenant_id,
    material_id: materialId,
    action: adjustmentType,
    qty_change_rolls: changeRolls,
    qty_change_area: changeArea,
    created_at: nowIso,
    notes: fullNotes
  }).select('*, materials(name, roll_width, roll_length)').single()

  revalidatePath('/dashboard/admin/inventory')
  return {
    success: true,
    updatedAt: nowIso,
    log: logRow || {
      id: `log-${Date.now()}`,
      tenant_id: profile.tenant_id,
      material_id: materialId,
      action: adjustmentType,
      job_id: null,
      qty_change_rolls: changeRolls,
      qty_change_area: changeArea,
      created_at: nowIso,
      notes: fullNotes,
      materials: { name: material.name, roll_width: material.roll_width, roll_length: material.roll_length },
    }
  }
}

export async function deleteMaterialAction(materialId: string) {
  const { error: permError } = await checkInventoryPermission()
  if (permError) return { error: permError }

  const serviceSupabase = createServiceClient()

  // Nullify any product types linked to this material first
  await (serviceSupabase as any)
    .from('product_types')
    .update({ material_id: null })
    .eq('material_id', materialId)

  const { error } = await (serviceSupabase as any)
    .from('materials')
    .delete()
    .eq('id', materialId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function linkProductTypeToMaterialAction(productTypeId: string, materialId: string | null) {
  const { error: permError } = await checkInventoryPermission()
  if (permError) return { error: permError }

  const serviceSupabase = createServiceClient()
  const { error } = await (serviceSupabase as any)
    .from('product_types')
    .update({ material_id: materialId })
    .eq('id', productTypeId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard/queue')
  return { success: true }
}

export async function normalizeRollDimensionsAction() {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { error: permError || 'Unauthorized' }

  const { parseRollDimensions } = await import('@/lib/material-matching')
  const serviceSupabase = createServiceClient()

  const { data: materials, error: fetchErr } = await (serviceSupabase as any)
    .from('materials')
    .select('id, name, unit, roll_width, roll_length')
    .eq('tenant_id', profile.tenant_id)

  if (fetchErr || !materials) return { error: fetchErr?.message || 'Failed to load materials' }

  let fixedCount = 0
  const nowIso = new Date().toISOString()
  const updatedMaterials: Array<{ id: string; roll_width: number; roll_length: number; updated_at: string }> = []

  for (const m of materials) {
    const parsed = parseRollDimensions(m)
    if (parsed.isWidthMisconfiguredInDb) {
      const newWidth = Number(parsed.effectiveWidthM.toFixed(2))
      const newLength = Number(parsed.effectiveLengthM.toFixed(2))
      const { error: upErr } = await (serviceSupabase as any)
        .from('materials')
        .update({
          roll_width: newWidth,
          roll_length: newLength,
          updated_at: nowIso,
        })
        .eq('id', m.id)

      if (!upErr) {
        fixedCount++
        updatedMaterials.push({
          id: m.id,
          roll_width: newWidth,
          roll_length: newLength,
          updated_at: nowIso,
        })
      }
    }
  }

  revalidatePath('/dashboard/admin/inventory')
  revalidatePath('/dashboard/queue')
  return { success: true, fixedCount, updatedMaterials }
}

