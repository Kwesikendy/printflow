import { createClient } from '@/lib/supabase/server'
import { NewJobForm } from '@/components/jobs/NewJobForm'
import { redirect } from 'next/navigation'
import { PageLoader } from '@/components/ui/EmptyState'

export default async function NewJobPage() {
  const supabase = await createClient()

  const [{ data: productTypes }, { data: pricingRules }, { data: standardSizes }] = await Promise.all([
    supabase.from('product_types').select('*').eq('is_active', true),
    supabase.from('pricing_rules').select('*'),
    supabase.from('standard_sizes').select('*')
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
      />
    </div>
  )
}
