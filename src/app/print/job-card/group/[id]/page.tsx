import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDateTime, PRINT_ROOM_LABELS } from '@/lib/utils'
import QRCode from 'react-qr-code'

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const params = await props.params
  const supabase = await createClient()

  const { data: groupRaw } = await supabase
    .from('job_groups')
    .select('customer_name')
    .eq('id', params.id)
    .single()

  const group = groupRaw as any
  if (!group) return { title: 'Job Card' }

  return {
    title: `JOB CARD — ${group.customer_name}`,
  }
}

export default async function GroupJobCardPrintPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ room?: string }>
}) {
  const params = await props.params
  const searchParams = await props.searchParams
  const roomFilter = searchParams.room || null

  const supabase = await createClient()

  const { data: groupData } = await supabase
    .from('job_groups')
    .select(`
      *,
      tenants(name),
      jobs(
        *,
        product_types(name)
      ),
      invoices:invoices!group_id(
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

  if (!groupData) notFound()

  const group = groupData as any
  const invoiceRaw = group.invoices
  const invoice = Array.isArray(invoiceRaw) ? invoiceRaw[0] : invoiceRaw
  const payments = invoice?.payments || []
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const isPaid = invoice?.status === 'paid' || totalPaid >= Number(invoice?.total || 0)

  // Filter jobs by print room if specified and matches exist, otherwise show all
  let jobs: any[] = group.jobs || []
  if (roomFilter) {
    const roomJobs = jobs.filter((j: any) => j.print_room === roomFilter)
    if (roomJobs.length > 0) {
      jobs = roomJobs
    }
  }

  if (jobs.length === 0) notFound()

  // Group by print room for display
  const printRooms = Array.from(new Set(jobs.map((j: any) => j.print_room || 'unassigned')))

  const methodLabel: Record<string, string> = {
    momo: 'Mobile Money',
    cash: 'Cash',
    other: 'Other',
  }
  const paymentMethod = payments[0]?.method || null

  const roomLabel = roomFilter
    ? (PRINT_ROOM_LABELS[roomFilter] || roomFilter)
    : (printRooms.length === 1 ? (PRINT_ROOM_LABELS[printRooms[0]] || printRooms[0]) : 'ALL ROOMS')

  // Use first job number for reference; show all job numbers in card
  const firstJob = jobs[0]

  const pageTitle = `JOB CARD — ${group.customer_name}`

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
            height: fit-content !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }
          .ticket-container {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm 3mm 0mm 3mm !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}} />

      {/* Receipt card — compact 80mm thermal width */}
      <div className="ticket-container w-[340px] font-extrabold text-black text-[15px] leading-snug print:w-[80mm] print:max-w-full print:mx-auto print:p-0">

        {/* Logo + Shop Header */}
        <div className="text-center mb-2">
          <img
            src="/Print_DPI_Logo.png"
            alt="Print DPI"
            className="h-12 mx-auto mb-1.5 object-contain"
          />
          <p className="font-black text-[18px] tracking-wide text-black">{group.tenants?.name || 'Print DPI'}</p>
          <p className="font-extrabold text-[14px] text-black">Accra, Ghana</p>
          <p className="font-extrabold text-[14px] text-black">0598608209</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Print Room Badge */}
        <div className="text-center mb-2">
          <p className="text-[14px] font-extrabold uppercase tracking-widest text-black">Print Room</p>
          <div className="border-2 border-black rounded-md inline-block px-5 py-0.5 mt-0.5">
            <p className="text-[21px] font-black tracking-tight text-black">
              {roomLabel}
            </p>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Customer Info */}
        <div className="mb-2">
          <p className="font-extrabold text-[17px] text-black">{group.customer_name}</p>
          {group.customer_phone && (
            <p className="font-extrabold text-black text-[15px]">Phone: {group.customer_phone}</p>
          )}
          <p className="font-extrabold text-black text-[14px] mt-0.5">
            Source: {firstJob.source === 'walk_in' ? 'Walk-In' : 'Marketing'}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Date & Label */}
        <div className="text-center mb-2">
          <p className="font-black uppercase tracking-widest text-[15px] text-black">JOB CARD</p>
          <p className="font-extrabold text-[14px] text-black">Date: {formatDateTime(group.created_at)}</p>
        </div>

        {/* Tracking QR Code */}
        {invoice && (
          <div className="flex flex-col items-center justify-center my-1.5">
            <p className="text-[13px] font-extrabold text-black mb-1 tracking-wider uppercase">Scan to Confirm Receipt</p>
            <QRCode value={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/track/invoice/${invoice.id}`} size={72} level="M" />
          </div>
        )}

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Jobs Table — all jobs in this card */}
        <table className="w-full text-[15px] mb-1 text-black font-extrabold">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left pb-1 font-black text-[14px]">#</th>
              <th className="text-left pb-1 font-black text-[14px]">Item</th>
              <th className="text-center pb-1 font-black text-[14px]">Qty</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job: any, idx: number) => (
              <tr key={job.id} className="border-b border-gray-300">
                <td className="py-1.5 pr-1 text-[14px] text-gray-800 align-top">{idx + 1}</td>
                <td className="py-1.5 pr-2 align-top">
                  <p className="font-black text-[16px] text-black">{job.product_types?.name}</p>
                  <p className="font-extrabold text-black text-[14px]">
                    {job.width} × {job.height} {job.dimension_unit || 'cm'}
                  </p>
                  <p className="text-[13px] text-gray-700 font-bold">{job.job_number}</p>
                  {job.notes && (
                    <p className="font-extrabold text-black text-[13px] mt-0.5 italic">{job.notes}</p>
                  )}
                </td>
                <td className="py-1.5 text-center font-black text-[19px] text-black align-top">{job.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 my-2" />
        <div className="text-center font-extrabold text-[13px] text-black tracking-wider">
          *** END OF JOB TICKET ***
        </div>
      </div>

      {/* Print button — hidden during print */}
      <div className="no-print print:hidden fixed bottom-6 right-6">
        <PrintButton />
      </div>
    </div>
  )
}
