'use server'

import { createClient } from '@/lib/supabase/server'

export interface CustomerSuggestion {
  customer_name: string
  customer_phone: string | null
  source: string
}

export async function searchCustomers(query: string): Promise<CustomerSuggestion[]> {
  if (!query || query.trim().length < 2) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('customers')
    .select('name, phone')
    .ilike('name', `%${query.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!data) return []

  return data.map((c: any) => ({
    customer_name: c.name,
    customer_phone: c.phone,
    source: 'walk_in' // default fallback since customers table doesn't store source
  }))
}
