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

export async function getMaterialsAction(tenantId: string) {
  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase as any)
    .from('materials')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  return { data, error: error?.message }
}

export async function getInventoryLogsAction(tenantId: string, limit = 60) {
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
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data, error: error?.message }
}

export async function getProductTypesForMaterialsAction(tenantId: string) {
  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase as any)
    .from('product_types')
    .select('id, name, is_active, material_id')
    .eq('tenant_id', tenantId)
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

  const serviceSupabase = createServiceClient()
  const insertData: any = {
    tenant_id: profile.tenant_id,
    name: payload.name.trim(),
    unit: payload.unit || 'roll',
    roll_width: width,
    roll_length: height,
    qty_rolls: isNaN(qty) ? 0 : qty,
    unit_cost: isNaN(cost) ? 0 : cost,
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

  // If initial quantity > 0, log opening stock
  if (qty > 0 && newMat) {
    const area = width * height * qty
    await (serviceSupabase as any).from('inventory_logs').insert({
      tenant_id: profile.tenant_id,
      material_id: newMat.id,
      action: 'add_stock',
      qty_change_rolls: qty,
      qty_change_area: area,
      notes: `Opening stock: ${qty} rolls @ ${cost.toFixed(2)} GHS/roll`
    })
  }

  revalidatePath('/dashboard/admin/inventory')
  return { success: true, data: newMat }
}

export async function updateMaterialAction(materialId: string, payload: any) {
  const { error: permError } = await checkInventoryPermission()
  if (permError) return { error: permError }

  const width = parseFloat(payload.roll_width)
  const height = parseFloat(payload.roll_height ?? payload.roll_length)
  const cost = parseFloat(payload.unit_cost)

  if (isNaN(width) || width <= 0) return { error: 'Valid roll width is required' }
  if (isNaN(height) || height <= 0) return { error: 'Valid roll height is required' }

  const serviceSupabase = createServiceClient()
  const updateData: any = {
    name: payload.name.trim(),
    roll_width: width,
    roll_length: height,
    unit_cost: isNaN(cost) ? 0 : cost,
    updated_at: new Date().toISOString()
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
  return { success: true }
}

export async function addStockAction(materialId: string, qtyToAdd: number, costPerRoll: number, notes?: string) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { error: permError }

  if (isNaN(qtyToAdd) || qtyToAdd <= 0) return { error: 'Quantity of rolls must be greater than 0' }
  if (isNaN(costPerRoll) || costPerRoll < 0) return { error: 'Cost per roll must be 0 or positive' }

  const serviceSupabase = createServiceClient()

  // Get current material
  const { data: materialData, error: fetchErr } = await (serviceSupabase as any)
    .from('materials')
    .select('qty_rolls, unit_cost, roll_width, roll_length, name')
    .eq('id', materialId)
    .single()
  
  const material = materialData as any
  if (fetchErr || !material) return { error: 'Material not found' }

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

  const { error: updateErr } = await (serviceSupabase as any).from('materials').update({
    qty_rolls: newQty,
    unit_cost: newUnitCost,
    updated_at: new Date().toISOString()
  }).eq('id', materialId)

  if (updateErr) return { error: updateErr.message }

  const addedArea = (parseFloat(material.roll_width) || 0) * (parseFloat(material.roll_height || material.roll_length) || 0) * qtyToAdd

  // Log transaction
  await (serviceSupabase as any).from('inventory_logs').insert({
    tenant_id: profile.tenant_id,
    material_id: materialId,
    action: 'add_stock',
    qty_change_rolls: qtyToAdd,
    qty_change_area: addedArea,
    notes: notes?.trim() 
      ? `Added ${qtyToAdd} rolls @ ${costPerRoll.toFixed(2)} GHS/roll - ${notes.trim()}`
      : `Restocked: +${qtyToAdd} rolls @ ${costPerRoll.toFixed(2)} GHS/roll`
  })

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function adjustStockAction(
  materialId: string, 
  adjustmentType: 'deduct_waste' | 'recount' | 'correction', 
  rollsQty: number, 
  reasonNotes: string
) {
  const { error: permError, profile } = await checkInventoryPermission()
  if (permError || !profile) return { error: permError }

  if (isNaN(rollsQty) || rollsQty <= 0) return { error: 'Invalid quantity' }
  if (!reasonNotes || !reasonNotes.trim()) return { error: 'Please provide a reason or note for this adjustment' }

  const serviceSupabase = createServiceClient()

  const { data: materialData, error: fetchErr } = await (serviceSupabase as any)
    .from('materials')
    .select('qty_rolls, roll_width, roll_length, name')
    .eq('id', materialId)
    .single()

  const material = materialData as any
  if (fetchErr || !material) return { error: 'Material not found' }

  const currentQty = parseFloat(material.qty_rolls || 0)
  let newQty = currentQty
  let changeRolls = 0

  if (adjustmentType === 'deduct_waste' || adjustmentType === 'correction') {
    newQty = Math.max(0, currentQty - rollsQty)
    changeRolls = -rollsQty
  } else if (adjustmentType === 'recount') {
    // Physical inventory audit recount: rollsQty is the new actual count
    changeRolls = rollsQty - currentQty
    newQty = rollsQty
  }

  const { error: updateErr } = await (serviceSupabase as any).from('materials').update({
    qty_rolls: newQty,
    updated_at: new Date().toISOString()
  }).eq('id', materialId)

  if (updateErr) return { error: updateErr.message }

  const rollArea = (parseFloat(material.roll_width) || 0) * (parseFloat(material.roll_height || material.roll_length) || 0)
  const changeArea = changeRolls * rollArea

  await (serviceSupabase as any).from('inventory_logs').insert({
    tenant_id: profile.tenant_id,
    material_id: materialId,
    action: adjustmentType,
    qty_change_rolls: changeRolls,
    qty_change_area: changeArea,
    notes: reasonNotes.trim()
  })

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
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
  return { success: true }
}
