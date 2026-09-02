import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'

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
                    <span className={`badge ${pt.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {pt.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-4 text-center">MVP Demo: Editing product types requires database access.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader 
          title="Pricing Rules" 
          description="Unit costs per square area for each product and source combination." 
        />
        <CardContent>
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
                <tr key={rule.id}>
                  <td className="font-medium text-slate-900">{rule.product_types?.name}</td>
                  <td className="capitalize">{rule.source.replace('_', '-')}</td>
                  <td className="text-right text-green-600 font-medium">₵{rule.unit_cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-4 text-center">MVP Demo: Pricing rules are seeded. Updating rules via UI is scoped for next version.</p>
        </CardContent>
      </Card>
    </div>
  )
}
