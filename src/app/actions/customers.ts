'use server'

import { createClient } from '@/lib/supabase/server'

export interface CustomerSuggestion {
  customer_name: string
  customer_phone: string | null
  source: string
}

export async function searchCustomers(query: string): Promise<CustomerSuggestion[]> {
  const q = query?.trim() || ''
  if (q.length < 1) return []

  const supabase = await createClient()

  const [customersRes, jobGroupsRes, jobsRes] = await Promise.all([
    supabase.from('customers').select('name, phone').ilike('name', `%${q}%`).order('created_at', { ascending: false }).limit(10),
    supabase.from('job_groups').select('customer_name, customer_phone, source').ilike('customer_name', `%${q}%`).order('created_at', { ascending: false }).limit(10),
    supabase.from('jobs').select('customer_name, customer_phone, source').ilike('customer_name', `%${q}%`).order('created_at', { ascending: false }).limit(10)
  ])

  const results = new Map<string, CustomerSuggestion>()

  const addResult = (name: string, phone: string | null, source: string) => {
    if (!name) return
    const key = name.toLowerCase()
    if (!results.has(key)) {
      results.set(key, {
        customer_name: name,
        customer_phone: phone,
        source: source || 'walk_in'
      })
    }
  }

  if (jobGroupsRes.data) {
    jobGroupsRes.data.forEach((r: any) => addResult(r.customer_name, r.customer_phone, r.source))
  }

  if (jobsRes.data) {
    jobsRes.data.forEach((r: any) => addResult(r.customer_name, r.customer_phone, r.source))
  }

  if (customersRes.data) {
    customersRes.data.forEach((r: any) => addResult(r.name, r.phone, 'walk_in'))
  }

  return Array.from(results.values()).slice(0, 10)
}
