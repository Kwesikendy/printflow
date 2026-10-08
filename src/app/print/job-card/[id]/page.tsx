import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDateTime, PRINT_ROOM_LABELS } from '@/lib/utils'
import QRCode from 'react-qr-code'

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const params = await props.params
  const supabase = await createClient()

  const { data: jobRaw } = await supabase
    .from('jobs')
    .select('job_number, customer_name')
    .eq('id', params.id)
    .single()

  const job = jobRaw as any
  if (!job) return { title: 'Job Card' }

  return {
    title: `JOB CARD — ${job.job_number} — ${job.customer_name}`,
  }
}

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

  // If this job is part of a multi-job group, automatically redirect to the consolidated group job card
  // so all jobs for this client are printed together on one ticket!
  if (job.group_id) {
    const roomParam = job.print_room ? `?room=${job.print_room}` : ''
    redirect(`/print/job-card/group/${job.group_id}${roomParam}`)
  }

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

  const pageTitle = `JOB CARD — ${job.job_number} — ${job.customer_name}`

  return (
    <div className="bg-white flex items-start justify-center py-6 font-mono print:min-h-0 print:h-auto print:py-0 print:px-0 print:m-0 print:block">
      <AutoPrint title={pageTitle} />
      <title>{pageTitle}</title>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0mm !important;
            size: 80mm auto !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-height: 0 !important;
            height: auto !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .ticket-container {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm 3mm 1mm 3mm !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}} />

      {/* Receipt card — compact for 80mm thermal roll printers */}
      <div className="ticket-container w-[340px] font-bold text-black text-[12px] leading-snug print:w-[80mm] print:max-w-full print:mx-auto print:p-0 print:pb-0">

        {/* Logo + Shop Header */}
        <div className="text-center mb-2">
          <img
            src="/Print_DPI_Logo.png"
            alt="Print DPI"
            className="h-12 mx-auto mb-1.5 object-contain"
          />
          <p className="font-extrabold text-[15px] tracking-wide text-black">{job.tenants?.name || 'Print DPI'}</p>
          <p className="font-bold text-[11px] text-black">Accra, Ghana</p>
          <p className="font-bold text-[11px] text-black">0598608209</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Order Number & Print Room */}
        <div className="text-center mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-black">Order Number</p>
          <div className="border-2 border-black rounded-md inline-block px-5 py-0.5 mt-0.5">
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
          <p className="font-bold text-[14px] text-black">{job.customer_name}</p>
          {job.customer_phone && (
            <p className="font-bold text-black text-[12px]">Phone: {job.customer_phone}</p>
          )}
          <p className="font-bold text-black text-[11px] mt-0.5">
            Source: {job.source === 'walk_in' ? 'Walk-In' : 'Marketing'}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Receipt Date */}
        <div className="text-center mb-2">
          <p className="font-extrabold uppercase tracking-widest text-[12px] text-black">JOB CARD</p>
          <p className="font-bold text-[11px] text-black">Date: {formatDateTime(job.created_at)}</p>
        </div>

        {/* Tracking QR Code */}
        {invoice && (
          <div className="flex flex-col items-center justify-center my-1.5">
            <p className="text-[10px] font-bold text-black mb-1 tracking-wider uppercase">Scan to Confirm Receipt</p>
            <QRCode value={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/track/invoice/${invoice.id}`} size={72} level="M" />
          </div>
        )}

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Items table */}
        <table className="w-full text-[12px] mb-1 text-black font-bold">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left pb-1 font-extrabold text-[13px]">Item</th>
              <th className="text-center pb-1 font-extrabold text-[13px]">Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-black">
              <td className="py-2 pr-2">
                <p className="font-extrabold text-[14px] text-black">{job.product_types?.name}</p>
                <p className="font-bold text-black text-[12px]">
                  {job.width} × {job.height} {job.dimension_unit || 'cm'}
                </p>
                {job.notes && (
                  <p className="font-bold text-black text-[11px] mt-1">{job.notes}</p>
                )}
              </td>
              <td className="py-2 text-center font-extrabold text-[16px] text-black">{job.quantity}</td>
            </tr>
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 my-2" />
        <div className="text-center font-bold text-[10px] text-black pb-0 tracking-wider">
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
