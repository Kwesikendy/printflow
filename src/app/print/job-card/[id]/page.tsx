import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDateTime } from '@/lib/utils'

export default async function JobCardPrintPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()

  const { data } = await supabase
    .from('jobs')
    .select(`
      *,
      product_types(name),
      tenants(name)
    `)
    .eq('id', params.id)
    .single()

  const job = data as any

  if (!job) notFound()

  return (
    <div className="max-w-3xl mx-auto p-8 font-sans text-black">
      <AutoPrint />
      
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">{job.tenants?.name}</h1>
          <p className="text-sm font-semibold mt-1">JOB CARD (INTERNAL / CUSTOMER COPY)</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold">{job.job_number}</h2>
          <p className="text-sm">Created: {formatDateTime(job.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Customer Details</h3>
          <p className="font-medium text-lg">{job.customer_name}</p>
          {job.customer_phone && <p>{job.customer_phone}</p>}
        </div>
      </div>

      <div className="mb-8 border-2 border-black p-4">
        <h3 className="font-bold text-sm uppercase mb-4 text-center tracking-widest">Job Specifications</h3>
        <div className="grid grid-cols-2 gap-y-4 text-lg">
          <div>
            <span className="font-semibold mr-2 text-gray-600">Product:</span> 
            {job.product_types?.name}
          </div>
          <div>
            <span className="font-semibold mr-2 text-gray-600">Dimensions:</span> 
            {job.width} × {job.height}
          </div>
          <div>
            <span className="font-semibold mr-2 text-gray-600">Quantity:</span> 
            <span className="font-bold border border-black px-2 py-0.5 rounded">{job.quantity}</span>
          </div>
          <div>
            <span className="font-semibold mr-2 text-gray-600">Total Area:</span> 
            {job.area}
          </div>
        </div>
      </div>

      {job.notes && (
        <div className="mb-8 border border-dashed border-gray-400 p-4">
          <h3 className="font-bold text-sm uppercase mb-1">Notes / Instructions</h3>
          <p className="text-base whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <div className="border-b border-black w-48 mx-auto mb-2" />
          <p>Customer Signature</p>
        </div>
        <div>
          <div className="border-b border-black w-48 mx-auto mb-2" />
          <p>Received By (Shop)</p>
        </div>
      </div>
      
      <div className="no-print mt-8 text-center text-sm text-gray-500">
        <p>This page is optimized for printing.</p>
        <PrintButton />
      </div>
    </div>
  )
}
