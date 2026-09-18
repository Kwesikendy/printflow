import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { 
  ProductsSection,
  PricingRulesSection
} from '@/components/admin/ProductForms'
import { getTenantUnitPricing } from '@/lib/pricing-server'

export default async function AdminProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let tenantId = '00000000-0000-0000-0000-000000000001'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single() as { data: { tenant_id: string } | null, error: any }
    if (profile?.tenant_id) tenantId = profile.tenant_id
  }

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
