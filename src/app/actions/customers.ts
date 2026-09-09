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
    .from('jobs')
    .select('customer_name, customer_phone, source')
    .ilike('customer_name', `${query.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!data) return []

  // Deduplicate by customer_name (case-insensitive), keep most recent
  const seen = new Set<string>()
  const unique: CustomerSuggestion[] = []
  for (const row of data as CustomerSuggestion[]) {
    const key = row.customer_name.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(row)
    }
    if (unique.length >= 8) break
  }

  return unique
}
