import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDateTime, PRINT_ROOM_LABELS } from '@/lib/utils'
import { JobBarcode } from '@/components/print/JobBarcode'
import QRCode from 'react-qr-code'

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
      tenants(name),
      invoices(
        id,
        invoice_number,
        total,
        status,
        issued_at,
        payments(amount, method)
      )
    `)
    .eq('id', params.id)
    .single()

  const job = data as any
  if (!job) notFound()

  // invoices join may return array or single object depending on the relationship
  const invoiceRaw = job.invoices
  const invoice = Array.isArray(invoiceRaw) ? invoiceRaw[0] : invoiceRaw
  const payments = invoice?.payments || []
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const isPaid = invoice?.status === 'paid' || totalPaid >= Number(invoice?.total || job.line_total)
  const paymentMethod = payments[0]?.method || null

  const methodLabel: Record<string, string> = {
    momo: 'Mobile Money',
    cash: 'Cash',
    other: 'Other',
  }

  // Extract job number digits for the "barcode" number display
  const jobNumDigits = job.job_number?.replace(/\D/g, '') || ''

  return (
    <div className="bg-white min-h-screen flex items-start justify-center py-10 font-mono print:min-h-0 print:h-auto print:py-0 print:px-0 print:m-0 print:block">
      <AutoPrint />
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0mm;
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            background: #ffffff !important;
          }
        }
      `}} />

      {/* Receipt card — compact for both thermal roll and desktop printers */}
      <div className="w-[340px] text-black text-[12px] leading-snug print:w-[80mm] print:max-w-full print:mx-auto print:p-3 print:pb-1">

        {/* Logo + Shop Header */}
        <div className="text-center mb-2">
          <img
            src="/Print_DPI_Logo.png"
            alt="Print DPI"
            className="h-12 mx-auto mb-1.5 object-contain"
          />
          <p className="font-bold text-[14px] tracking-wide">{job.tenants?.name || 'Print DPI'}</p>
          <p className="text-[10px] text-gray-600">Accra, Ghana</p>
          <p className="text-[10px] text-gray-600">0598608209</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Order Number & Print Room */}
        <div className="text-center mb-2">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Order Number</p>
          <div className="border-2 border-green-600 rounded-md inline-block px-5 py-0.5 mt-0.5">
            <p className="text-[24px] font-extrabold tracking-tight text-black">
              #{job.job_number}
            </p>
          </div>
          {job.print_room && (
            <p className="mt-1 font-bold text-[13px] uppercase tracking-wide">
              {PRINT_ROOM_LABELS[job.print_room] || job.print_room}
            </p>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Customer Info */}
        <div className="mb-2">
          <p className="font-bold text-[13px]">{job.customer_name}</p>
          {job.customer_phone && (
            <p className="text-gray-600 text-[11px]">Phone: {job.customer_phone}</p>
          )}
          <p className="text-gray-500 text-[10px] mt-0.5">
            Source: {job.source === 'walk_in' ? 'Walk-In' : 'Marketing'}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Receipt Date */}
        <div className="text-center mb-2">
          <p className="font-bold uppercase tracking-widest text-[10px] text-gray-500">JOB CARD</p>
          <p className="text-[11px]">Date: {formatDateTime(job.created_at)}</p>
        </div>

        {/* Real Code 128 barcode */}
        <div className="flex justify-center mb-2">
          <JobBarcode value={job.job_number} />
        </div>

        {/* Tracking QR Code */}
        {invoice && (
          <div className="flex flex-col items-center justify-center mb-2">
            <p className="text-[9px] text-gray-500 mb-1 tracking-wider uppercase">Scan to Confirm Receipt</p>
            <QRCode value={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/track/invoice/${invoice.id}`} size={64} level="L" />
          </div>
        )}

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Items table */}
        <table className="w-full text-[11px] mb-1">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="text-left pb-1 font-bold">Item</th>
              <th className="text-center pb-1 font-bold">Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-dashed border-gray-300">
              <td className="py-1.5 pr-2">
                <p className="font-semibold">{job.product_types?.name}</p>
                <p className="text-gray-500 text-[10px]">
                  {job.width} × {job.height} {job.dimension_unit || 'cm'}
                </p>
                {job.notes && (
                  <p className="text-gray-500 text-[10px] italic">{job.notes}</p>
                )}
              </td>
              <td className="py-1.5 text-center font-bold text-[14px]">{job.quantity}</td>
            </tr>
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 my-2" />
        <div className="text-center text-[9px] text-gray-400 pb-0.5 tracking-wider">
          *** END OF JOB TICKET ***
        </div>
      </div>

      {/* Print button — completely hidden during print */}
      <div className="no-print print:hidden fixed bottom-6 right-6">
        <PrintButton />
      </div>
    </div>
  )
}
