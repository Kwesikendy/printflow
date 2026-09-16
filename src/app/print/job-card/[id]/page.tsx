import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDate, formatDateTime } from '@/lib/utils'

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
    <div className="max-w-4xl mx-auto p-8 font-sans text-black bg-white">
      <AutoPrint />
      
      <div className="flex justify-center mb-6">
        <img src="/Print_DPI_Logo.png" alt="Print dpi DIGITAL PRESS" className="h-24" />
      </div>

      <div className="border-b-[1.5px] border-black pb-1 mb-1 flex justify-between items-end">
        <div className="text-sm font-semibold">
          JOB CARD (INTERNAL / CUSTOMER COPY)
        </div>
        <div className="text-sm font-semibold">
          {job.job_number}
        </div>
      </div>
      
      <div className="flex justify-between items-center border-b-[1.5px] border-[#c8b488] pb-1 mb-1">
        <div className="text-sm font-semibold">Created: {formatDateTime(job.created_at)}</div>
      </div>
      
      <div className="text-sm border-b-[1.5px] border-black pb-1 mb-6 mt-6">
        <span className="font-bold border-b-[1.5px] border-black inline-block uppercase">
          {job.customer_name}
        </span>
        <div className="font-normal mt-1 text-xs">{job.customer_phone || 'No phone provided'}</div>
      </div>

      <div className="mb-8 border-2 border-black p-4">
        <h3 className="font-bold text-sm uppercase mb-4 text-center tracking-widest text-[#ec008c]">Job Specifications</h3>
        <div className="grid grid-cols-2 gap-y-4 text-lg">
          <div>
            <span className="font-semibold mr-2 text-gray-600">Product:</span> 
            {job.product_types?.name}
          </div>
          <div>
            <span className="font-semibold mr-2 text-gray-600">Dimensions:</span> 
            {job.width} × {job.height} {job.dimension_unit || 'cm'}
          </div>
          <div>
            <span className="font-semibold mr-2 text-gray-600">Quantity:</span> 
            <span className="font-bold border border-black px-2 py-0.5 rounded">{job.quantity}</span>
          </div>
          <div>
            <span className="font-semibold mr-2 text-gray-600">Total Area:</span> 
            {job.area} {job.dimension_unit ? `${job.dimension_unit}²` : 'cm²'}
          </div>
        </div>
      </div>

      {job.notes && (
        <div className="mb-8 border border-dashed border-[#ec008c] p-4 bg-pink-50/30">
          <h3 className="font-bold text-sm uppercase mb-1 text-[#ec008c]">Notes / Instructions</h3>
          <p className="text-base whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      <div className="mt-24 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <div className="border-b-[1.5px] border-black w-56 mx-auto mb-2" />
          <p className="font-medium">Customer Signature</p>
        </div>
        <div>
          <div className="border-b-[1.5px] border-black w-56 mx-auto mb-2" />
          <p className="font-medium">Received By (Shop)</p>
        </div>
      </div>
      
      <div className="no-print mt-16 text-center text-sm text-gray-500">
        <p className="mb-4">This page is optimized for printing.</p>
        <PrintButton />
      </div>
    </div>
  )
}
