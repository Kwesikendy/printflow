'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface CustomerSuggestion {
  customer_name: string
  customer_phone: string | null
  source: string
}

export async function searchCustomers(query: string = ''): Promise<CustomerSuggestion[]> {
  const q = query?.trim() || ''

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let tenantId = '00000000-0000-0000-0000-000000000001'
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single() as any
      if (profile?.tenant_id) {
        tenantId = profile.tenant_id
      }
    }

    const serviceSupabase = createServiceClient() as any

    let custQuery = serviceSupabase
      .from('customers')
      .select('name, phone, created_at')
      .eq('tenant_id', tenantId)

    let grpQuery = serviceSupabase
      .from('job_groups')
      .select('customer_name, customer_phone, source, created_at')
      .eq('tenant_id', tenantId)

    let jobsQuery = serviceSupabase
      .from('jobs')
      .select('customer_name, customer_phone, source, created_at')
      .eq('tenant_id', tenantId)

    if (q) {
      custQuery = custQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      grpQuery = grpQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
      jobsQuery = jobsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
    }

    const [customersRes, jobGroupsRes, jobsRes] = await Promise.all([
      custQuery.order('created_at', { ascending: false }).limit(15),
      grpQuery.order('created_at', { ascending: false }).limit(15),
      jobsQuery.order('created_at', { ascending: false }).limit(15)
    ])

    const results = new Map<string, CustomerSuggestion>()

    const addResult = (name: string, phone: string | null, source: string) => {
      const trimmed = (name || '').trim()
      if (!trimmed || trimmed === 'TEST_DELETE_ME') return
      const key = trimmed.toLowerCase()
      if (!results.has(key)) {
        results.set(key, {
          customer_name: trimmed,
          customer_phone: phone ? phone.trim() : null,
          source: source || 'walk_in'
        })
      } else if (phone && !results.get(key)!.customer_phone) {
        results.get(key)!.customer_phone = phone.trim()
      }
    }

    if (customersRes.data) {
      customersRes.data.forEach((r: any) => addResult(r.name, r.phone, 'walk_in'))
    }
    if (jobGroupsRes.data) {
      jobGroupsRes.data.forEach((r: any) => addResult(r.customer_name, r.customer_phone, r.source))
    }
    if (jobsRes.data) {
      jobsRes.data.forEach((r: any) => addResult(r.customer_name, r.customer_phone, r.source))
    }

    return Array.from(results.values()).slice(0, 10)
  } catch (err) {
    console.error('searchCustomers action error:', err)
    return []
  }
}
