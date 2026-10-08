import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { markInvoiceJobsCompleted } from '@/app/actions/track'
import { CheckCircle, Package, User, Phone } from 'lucide-react'
import { revalidatePath } from 'next/cache'

export default async function TrackInvoicePage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()

  const { data } = await supabase
    .from('invoices')
    .select(`
      *,
      tenants(name),
      job_groups(
        customer_name,
        jobs(
          *,
          product_types(name)
        )
      ),
      jobs(
        *,
        product_types(name)
      )
    `)
    .eq('id', params.id)
    .single()

  const invoice = data as any
  if (!invoice) notFound()

  let customerName = ''
  let jobsList: any[] = []

  if (invoice.group_id && invoice.job_groups) {
    customerName = invoice.job_groups.customer_name
    jobsList = invoice.job_groups.jobs || []
  } else if (invoice.jobs) {
    customerName = invoice.jobs.customer_name
    jobsList = [invoice.jobs]
  } else {
    notFound()
  }

  // Check if all jobs are picked up
  const allPickedUp = jobsList.length > 0 && jobsList.every((j: any) => j.status === 'picked_up')

  // We use a server action bound to the form to handle the completion
  const handleComplete = async (formData: FormData) => {
    'use server'
    const pickupName = formData.get('pickupName') as string
    const pickupPhone = formData.get('pickupPhone') as string
    await markInvoiceJobsCompleted(params.id, pickupName, pickupPhone)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-premium-card overflow-hidden mt-8">
        
        <div className="bg-gradient-to-r from-[#ec008c] to-[#9e005d] p-6 text-white text-center">
          <h1 className="text-2xl font-bold tracking-wider uppercase mb-1">Quality Check</h1>
          <p className="opacity-90 text-sm">Invoice #{invoice.invoice_number}</p>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">Customer</p>
            <p className="font-bold text-lg">{customerName}</p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Order Items</p>
            <div className="space-y-3">
              {jobsList.map((job) => (
                <div key={job.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="bg-white p-2 rounded shadow-sm">
                    <Package className="w-5 h-5 text-[#ec008c]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase">{job.product_types?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.width} x {job.height} {job.dimension_unit}
                    </p>
                    <p className="text-sm font-semibold mt-1">Qty: {job.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            {allPickedUp ? (
              <div className="flex flex-col items-center justify-center text-center p-4 bg-green-50 rounded-xl text-green-700">
                <CheckCircle className="w-12 h-12 mb-2 text-green-500" />
                <h3 className="font-bold text-lg">Job Completed</h3>
                <p className="text-sm opacity-90">This order has been picked up and confirmed by the customer.</p>
              </div>
            ) : (
              <form action={handleComplete} className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800 mb-2">
                  Please provide your details below to digitally sign off on the quality of your order and confirm receipt.
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" /> Full Name
                  </label>
                  <input 
                    type="text" 
                    name="pickupName" 
                    required 
                    placeholder="E.g. John Doe"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ec008c] focus:border-[#ec008c] outline-none transition-shadow"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-gray-400" /> Phone Number
                  </label>
                  <input 
                    type="tel" 
                    name="pickupPhone" 
                    required 
                    placeholder="E.g. 024XXXXXXX"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ec008c] focus:border-[#ec008c] outline-none transition-shadow"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#ec008c] hover:bg-[#c20073] text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Confirm Receipt
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
      
      <div className="mt-8 mb-4 text-center">
         <img src="/Print_DPI_Logo.png" alt="Print DPI" className="h-8 mx-auto grayscale opacity-50" />
      </div>
    </div>
  )
}
