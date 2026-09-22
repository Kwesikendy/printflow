import { createClient } from '@/lib/supabase/server'
import { NewJobForm } from '@/components/jobs/NewJobForm'
import { PageLoader } from '@/components/ui/EmptyState'
import { getTenantUnitPricing } from '@/lib/pricing-server'
import type { Role } from '@/types/database'

export default async function NewJobPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let tenantId = '00000000-0000-0000-0000-000000000001'
  let role: Role = 'front_desk'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single() as { data: { tenant_id: string; role: Role } | null, error: any }
    if (profile?.tenant_id) tenantId = profile.tenant_id
    if (profile?.role) role = profile.role
  }

  const [{ data: productTypes }, { data: pricingRules }, { data: standardSizes }, unitPricingConfig] = await Promise.all([
    supabase.from('product_types').select('*').eq('is_active', true).order('name'),
    supabase.from('pricing_rules').select('*'),
    supabase.from('standard_sizes').select('*'),
    getTenantUnitPricing(tenantId)
  ])

  if (!productTypes || !pricingRules || !standardSizes) {
    return <PageLoader />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">New Job</h1>
        <p className="text-slate-500 mt-1">Create a new print job and generate a quote.</p>
      </div>

      <NewJobForm 
        productTypes={productTypes} 
        pricingRules={pricingRules} 
        standardSizes={standardSizes} 
        unitPricingConfig={unitPricingConfig}
        userRole={role}
      />
    </div>
  )
}
