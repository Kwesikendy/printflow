import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDate } from '@/lib/utils'
import QRCode from 'react-qr-code'

export default async function InvoicePrintPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const qrData = `${siteUrl}/track/invoice/${invoice.id}`

  const docTitle = `${invoice.invoice_number.replace('-', '')}[${customerName}]`.toLowerCase()

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans text-black bg-white min-h-[900px] print:min-h-0 print:h-[95vh] flex flex-col">
      <AutoPrint />

      {/* Set the page title for PDF filename & suppress browser header/footer */}
      <title>{docTitle}</title>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 8mm;
            size: A4;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            color: #000000 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* Header with Shop Logo and QR Code */}
      <div className="flex justify-between items-center mb-6 pb-2">
        <img src="/Print_DPI_Logo.png" alt="Print DPI DIGITAL PRESS" className="h-20 object-contain" />
        <div className="flex flex-col items-end">
          <QRCode value={qrData} size={84} level="M" />
          <span className="text-[10px] font-bold text-black uppercase mt-1 tracking-wider">Scan to Track</span>
        </div>
      </div>

      <div className="text-base font-extrabold text-black border-b-2 border-black pb-1 mb-1 tracking-wide">
        INVOICE NO. {invoice.invoice_number}
      </div>
      
      <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-1">
        <div className="text-sm font-bold text-black">{formatDate(invoice.issued_at)}</div>
        <div className="text-black font-extrabold text-base uppercase">GHS {Number(invoice.total).toFixed(2)}</div>
      </div>
      
      <div className="text-sm font-extrabold text-black border-b-2 border-black pb-1 mb-1">
        PAYMENT DUE BY &nbsp; {formatDate(invoice.issued_at)}
      </div>
      
      <div className="text-sm border-b-2 border-black pb-1 mb-6">
        <span className="font-extrabold text-base text-black inline-block uppercase">
          {customerName}
        </span>
        {customerPhone && (
          <span className="text-sm font-bold text-black ml-3">({customerPhone})</span>
        )}
        <div className="font-bold text-xs text-black mt-0.5">Accra, Ghana</div>
      </div>

      <table className="w-full mb-8 text-left border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-black bg-slate-100">
            <th className="py-2 px-3 font-extrabold text-black uppercase w-24">QUANTITY</th>
            <th className="py-2 px-3 font-extrabold text-black uppercase">DETAILS</th>
            <th className="py-2 px-3 font-extrabold text-black uppercase text-center w-32">UNIT PRICE</th>
            <th className="py-2 px-3 font-extrabold text-black uppercase text-center w-32">LINE TOTAL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/40 border-b-2 border-black font-bold text-black">
          {jobsList.map((job: any, index: number) => (
            <tr key={job.id} className={index % 2 === 0 ? "bg-slate-50" : "bg-white"}>
              <td className="py-2 px-3 font-black text-black text-center">{job.quantity}</td>
              <td className="py-2 px-3 uppercase text-black font-bold">
                {job.product_types?.name} {job.width} × {job.height} {job.dimension_unit}
                {job.notes && <div className="text-xs text-black normal-case font-semibold">{job.notes}</div>}
              </td>
              <td className="py-2 px-3 text-center text-black font-bold">{(job.line_total / job.quantity).toFixed(2)}</td>
              <td className="py-2 px-3 text-center font-black text-black">{Number(job.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-6">
        <div className="bg-slate-100 font-black text-black px-3 py-1 text-xs uppercase mb-1 border-l-4 border-black">
          NOTE
        </div>
        <div className="px-3 text-sm font-black text-black uppercase tracking-wide">
          UPFRONT PAYMENT
        </div>
      </div>

      <div className="flex flex-col items-end mb-6 text-sm">
        <div className="w-72 space-y-1.5 text-right font-bold text-black">
          <div className="flex justify-between">
            <span className="text-black font-bold">Discount</span>
            <span className="text-black font-bold">0.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-black font-bold">Net Total</span>
            <span className="text-black font-black">GHS {Number(invoice.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-black pb-1.5">
            <span className="text-black font-bold">Add VAT</span>
            <span className="text-black font-bold">0.00</span>
          </div>
          <div className="flex justify-between font-black text-black pt-1">
            <span>Amount Paid</span>
            <span>- GHS {Number(totalPaid).toFixed(2)}</span>
          </div>
        </div>
        
        <div className="w-[450px] flex justify-between border-y-2 border-black mt-3 font-black text-black bg-slate-50 text-base">
          <div className="py-2 uppercase text-right flex-1 border-r-2 border-black pr-3 tracking-wider">BALANCE DUE</div>
          <div className="py-2 pl-3 w-36 text-center text-lg font-black text-black">GHS {Number(balance).toFixed(2)}</div>
        </div>
      </div>

      {/* Spacer to push footer to the bottom */}
      <div className="flex-1"></div>

      {/* Footer: Payment details */}
      <div className="text-xs mt-6 border-t-2 border-black pt-3">
        <h3 className="font-extrabold text-black text-sm uppercase mb-2 tracking-wider">PAYMENT DETAILS</h3>
        <table className="w-96 text-black font-bold">
          <tbody>
            <tr>
              <td className="py-0.5 text-black font-bold w-44">Name of Beneficiary:</td>
              <td className="py-0.5 uppercase font-extrabold text-black">PRINT DPI</td>
            </tr>
            <tr>
              <td className="py-0.5 text-black font-bold">Mobile Money No.</td>
              <td className="py-0.5 uppercase font-extrabold text-black">0598608209</td>
            </tr>
            <tr>
              <td className="py-0.5 text-black font-bold">Name of Bank:</td>
              <td className="py-0.5 uppercase font-extrabold text-black">FIDELITY BANK</td>
            </tr>
            <tr>
              <td className="py-0.5 text-black font-bold">Address of Bank:</td>
              <td className="py-0.5 uppercase font-extrabold text-black">KANESHIE</td>
            </tr>
            <tr>
              <td className="py-0.5 text-black font-bold">Account Number:</td>
              <td className="py-0.5 uppercase font-extrabold text-black">2400446763917</td>
            </tr>
            <tr>
              <td className="py-0.5 text-black font-bold">SWIFT Code:</td>
              <td className="py-0.5 uppercase font-extrabold text-black">FBLIGHAC</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="no-print mt-6 text-center text-sm text-gray-500">
        <PrintButton />
      </div>
    </div>
  )
}
