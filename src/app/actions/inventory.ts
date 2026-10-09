'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMaterialsAction(tenantId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('materials')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  return { data, error: error?.message }
}

export async function createMaterialAction(payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
  const profile = profileData as any
  if (!profile) return { error: 'Unauthorized' }

  const { error } = await (supabase as any).from('materials').insert({
    tenant_id: profile.tenant_id,
    name: payload.name,
    unit: payload.unit || 'roll',
    roll_width: parseFloat(payload.roll_width),
    roll_length: parseFloat(payload.roll_length),
    qty_rolls: parseFloat(payload.qty_rolls || 0),
    unit_cost: parseFloat(payload.unit_cost || 0),
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}

export async function addStockAction(materialId: string, qtyToAdd: number, costPerRoll: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profileData } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
  const profile = profileData as any
  if (!profile) return { error: 'Unauthorized' }

  // Get current material
  const { data: materialData, error: fetchErr } = await (supabase as any)
    .from('materials')
    .select('qty_rolls, unit_cost')
    .eq('id', materialId)
    .single()
  
  const material = materialData as any

  if (fetchErr || !material) return { error: 'Material not found' }

  // Update material
  const newQty = parseFloat(material.qty_rolls) + qtyToAdd
  
  // Calculate new average unit cost
  let newUnitCost = parseFloat(material.unit_cost)
  if (qtyToAdd > 0 && costPerRoll > 0) {
    const totalCurrentValue = parseFloat(material.qty_rolls) * parseFloat(material.unit_cost)
    const addedValue = qtyToAdd * costPerRoll
    newUnitCost = (totalCurrentValue + addedValue) / newQty
  }

  const { error: updateErr } = await (supabase as any).from('materials').update({
    qty_rolls: newQty,
    unit_cost: newUnitCost,
    updated_at: new Date().toISOString()
  }).eq('id', materialId)

  if (updateErr) return { error: updateErr.message }

  // Log transaction
  await (supabase as any).from('inventory_logs').insert({
    tenant_id: profile.tenant_id,
    material_id: materialId,
    action: 'add_stock',
    qty_change_rolls: qtyToAdd,
    qty_change_area: 0,
    notes: `Added stock: ${qtyToAdd} rolls @ ${costPerRoll} per roll`
  })

  revalidatePath('/dashboard/admin/inventory')
  return { success: true }
}
