import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { AddProductTypeForm, ToggleProductTypeButton, AddPricingRuleForm, PricingRuleRow } from '@/components/admin/ProductForms'
export default async function AdminProductsPage() {
  const supabase = await createClient()

  const { data: productTypes } = await supabase
    .from('product_types')
    .select('*')
    .order('name')

  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('*, product_types(name)')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          title="Product Types" 
          description="Manage the types of items you print (e.g., Flyer, Banner)." 
        />
        <CardContent>
          <div className="table-container">
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {productTypes?.map((pt: any) => (
                  <tr key={pt.id}>
                    <td className="font-medium text-slate-900">{pt.name}</td>
                    <td>
                      <ToggleProductTypeButton product={pt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AddProductTypeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader 
          title="Pricing Rules" 
          description="Unit costs per square area for each product and source combination." 
        />
        <CardContent>
          <div className="table-container">
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Source</th>
                  <th className="text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules?.map((rule: any) => (
                  <PricingRuleRow key={rule.id} rule={rule} />
                ))}
              </tbody>
            </table>
          </div>
          <AddPricingRuleForm productTypes={productTypes || []} />
        </CardContent>
      </Card>
    </div>
  )
}
