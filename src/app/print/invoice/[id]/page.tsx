import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDate } from '@/lib/utils'

export default async function InvoicePrintPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()

  // Fetch the invoice using the provided ID.
  // Then fetch the associated jobs either via single job_id or group_id.
  const { data } = await supabase
    .from('invoices')
    .select(`
      *,
      tenants(name),
      payments(amount),
      job_groups(
        customer_name,
        customer_phone,
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
  let customerPhone = ''
  let jobsList: any[] = []

  if (invoice.group_id && invoice.job_groups) {
    customerName = invoice.job_groups.customer_name
    customerPhone = invoice.job_groups.customer_phone || ''
    jobsList = invoice.job_groups.jobs || []
  } else if (invoice.jobs) {
    customerName = invoice.jobs.customer_name
    customerPhone = invoice.jobs.customer_phone || ''
    jobsList = [invoice.jobs]
  } else {
    notFound()
  }

  // Sort jobs by created_at ascending
  jobsList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const totalPaid = (invoice.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0)
  const balance = invoice.total - totalPaid

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans text-black bg-white">
      <AutoPrint />
      
      <div className="flex justify-center mb-6">
        <img src="/Print_DPI_Logo.png" alt="Print dpi DIGITAL PRESS" className="h-24" />
      </div>

      <div className="text-sm font-semibold border-b-[1.5px] border-black pb-1 mb-1">
        INVOICE NO.{invoice.invoice_number}
      </div>
      
      <div className="flex justify-between items-center border-b-[1.5px] border-[#c8b488] pb-1 mb-1">
        <div className="text-sm font-semibold">{formatDate(invoice.issued_at)}</div>
        <div className="text-[#ec008c] font-bold text-sm uppercase">GHS {invoice.total}</div>
      </div>
      
      <div className="text-sm font-bold border-b-[1.5px] border-black pb-1 mb-1">
        PAYMENT DUE BY &nbsp; {formatDate(invoice.issued_at)}
      </div>
      
      <div className="text-sm border-b-[1.5px] border-black pb-1 mb-6">
        <span className="font-bold border-b-[1.5px] border-black inline-block uppercase">
          {customerName}
        </span>
        <div className="font-normal mt-1 text-xs">Accra</div>
      </div>

      <table className="w-full mb-8 text-left border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-1 px-2 font-bold uppercase w-24">QUANTITY</th>
            <th className="py-1 px-2 font-bold uppercase">DETAILS</th>
            <th className="py-1 px-2 font-bold uppercase text-center w-32">UNIT PRICE</th>
            <th className="py-1 px-2 font-bold uppercase text-center w-32">LINE TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {jobsList.map((job: any, index: number) => (
            <tr key={job.id} className={index % 2 === 0 ? "bg-[#e5e5e5]" : "bg-white"}>
              <td className="py-1 px-2">{job.quantity}</td>
              <td className="py-1 px-2 uppercase">{job.product_types?.name} {job.width} x {job.height} {job.dimension_unit}</td>
              <td className="py-1 px-2 text-center">{(job.line_total / job.quantity).toFixed(2)}</td>
              <td className="py-1 px-2 text-center">{job.line_total.toFixed(2)}</td>
            </tr>
          ))}
          {Array.from({ length: 8 }).map((_, i) => {
            const rowIndex = jobsList.length + i;
            return (
              <tr key={`empty-${i}`} className={rowIndex % 2 === 0 ? "bg-[#e5e5e5]" : "bg-white"}>
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2"></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mb-8">
        <div className="bg-[#e5e5e5] font-bold px-2 py-1 text-sm uppercase mb-1">
          NOTE
        </div>
        <div className="px-2 text-sm uppercase">
          UPFRONT PAYMENT
        </div>
      </div>

      <div className="flex flex-col items-end mb-8 text-sm">
        <div className="w-64 space-y-1 text-right">
          <div className="flex justify-between">
            <span>Discount</span>
            <span></span>
          </div>
          <div className="flex justify-between">
            <span>Net Total</span>
            <span>GHS {invoice.total}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-1">
            <span>Add VAT</span>
            <span></span>
          </div>
          <div className="flex justify-between font-semibold text-green-700 pt-1">
            <span>Amount Paid</span>
            <span>- GHS {totalPaid}</span>
          </div>
        </div>
        
        <div className="w-[450px] flex justify-between border-y-2 border-black mt-2 font-bold text-[#ec008c]">
          <div className="py-1 uppercase text-right flex-1 border-r-[1.5px] border-black pr-2">BALANCE DUE</div>
          <div className="py-1 pl-2 w-32 text-center">GHS {balance}</div>
        </div>
      </div>

      <div className="text-xs">
        <h3 className="font-bold text-[#ec008c] uppercase mb-2">PAYMENT DETAILS</h3>
        <table className="w-80">
          <tbody>
            <tr>
              <td className="py-[2px] text-gray-700">Name of Beneficiary:</td>
              <td className="py-[2px] uppercase">PRINT DPI</td>
            </tr>
            <tr>
              <td className="py-[2px] text-gray-700">Mobile Money No.</td>
              <td className="py-[2px] uppercase">598608209</td>
            </tr>
            <tr>
              <td className="py-[2px] text-gray-700">Name of Bank:</td>
              <td className="py-[2px] uppercase">FIDELIITY BANK</td>
            </tr>
            <tr>
              <td className="py-[2px] text-gray-700">Address of Bank:</td>
              <td className="py-[2px] uppercase">KANESHHIE</td>
            </tr>
            <tr>
              <td className="py-[2px] text-gray-700">Account Number:</td>
              <td className="py-[2px] uppercase">2400446763917</td>
            </tr>
            <tr>
              <td className="py-[2px] text-gray-700">SWIFT Code</td>
              <td className="py-[2px] uppercase">FBLIGHAC</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="no-print mt-16 text-center text-sm text-gray-500">
        <PrintButton />
      </div>
    </div>
  )
}
