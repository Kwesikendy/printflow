import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { 
  ProductsSection,
  PricingRulesSection
} from '@/components/admin/ProductForms'
import { getTenantUnitPricing } from '@/lib/pricing-server'

import { redirect } from 'next/navigation'

export default async function AdminProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, is_active')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string; is_active?: boolean } | null, error: any }

  if (!profile || profile.is_active === false || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  const tenantId = profile.tenant_id || '00000000-0000-0000-0000-000000000001'

  const [{ data: productTypes }, { data: pricingRules }, unitPricingConfig] = await Promise.all([
    supabase.from('product_types').select('*').order('name'),
    supabase.from('pricing_rules').select('*, product_types(name)'),
    getTenantUnitPricing(tenantId)
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          title="Products & Pricing Schemes" 
          description="Manage all product types and their customized pricing schemes across measurement units (ft, in, cm, m). You have full rights to edit names, statuses, custom rates, or delete products at will." 
        />
        <CardContent>
          <ProductsSection
            productTypes={productTypes || []}
            pricingRules={pricingRules || []}
            unitPricingConfig={unitPricingConfig}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader 
          title="Active Pricing Rules" 
          description="Unit pricing rules per square area for each product and customer source (walk-in vs marketing). Search and filter rules by product name, source, or unit rate." 
        />
        <CardContent>
          <PricingRulesSection
            pricingRules={pricingRules || []}
            productTypes={productTypes || []}
            unitPricingConfig={unitPricingConfig}
          />
        </CardContent>
      </Card>
    </div>
  )
}
