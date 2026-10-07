import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDateTime, PRINT_ROOM_LABELS } from '@/lib/utils'
import { JobBarcode } from '@/components/print/JobBarcode'
import QRCode from 'react-qr-code'

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

  // Use first job number for barcode; show all job numbers in card
  const firstJob = jobs[0]

  return (
    <div className="bg-white flex items-start justify-center py-10 font-mono print:py-0 print:px-0 print:m-0 print:block">
      <AutoPrint />
      <title>{`JOB CARD — ${group.customer_name}`}</title>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `}} />

      {/* Receipt card — compact 80mm thermal width */}
      <div className="w-[340px] font-bold text-black text-[12px] leading-snug print:w-[80mm] print:max-w-full print:mx-auto print:p-0">

        {/* Logo + Shop Header */}
        <div className="text-center mb-2">
          <img
            src="/Print_DPI_Logo.png"
            alt="Print DPI"
            className="h-12 mx-auto mb-1.5 object-contain"
          />
          <p className="font-extrabold text-[15px] tracking-wide text-black">{group.tenants?.name || 'Print DPI'}</p>
          <p className="font-bold text-[11px] text-black">Accra, Ghana</p>
          <p className="font-bold text-[11px] text-black">0598608209</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Print Room Badge */}
        <div className="text-center mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-black">Print Room</p>
          <div className="border-2 border-black rounded-md inline-block px-5 py-0.5 mt-0.5">
            <p className="text-[18px] font-extrabold tracking-tight text-black">
              {roomLabel}
            </p>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Customer Info */}
        <div className="mb-2">
          <p className="font-bold text-[14px] text-black">{group.customer_name}</p>
          {group.customer_phone && (
            <p className="font-bold text-black text-[12px]">Phone: {group.customer_phone}</p>
          )}
          <p className="font-bold text-black text-[11px] mt-0.5">
            Source: {firstJob.source === 'walk_in' ? 'Walk-In' : 'Marketing'}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Date & Label */}
        <div className="text-center mb-2">
          <p className="font-extrabold uppercase tracking-widest text-[12px] text-black">JOB CARD</p>
          <p className="font-bold text-[11px] text-black">Date: {formatDateTime(group.created_at)}</p>
        </div>

        {/* Barcode — use first job number */}
        <div className="flex justify-center mb-2">
          <JobBarcode value={firstJob.job_number} />
        </div>

        {/* QR Code */}
        {invoice && (
          <div className="flex flex-col items-center justify-center mb-2">
            <p className="text-[10px] font-bold text-black mb-1 tracking-wider uppercase">Scan to Confirm Receipt</p>
            <QRCode value={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/track/invoice/${invoice.id}`} size={64} level="L" />
          </div>
        )}

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Jobs Table — all jobs in this card */}
        <table className="w-full text-[12px] mb-1 text-black font-bold">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left pb-1 font-extrabold text-[11px]">#</th>
              <th className="text-left pb-1 font-extrabold text-[11px]">Item</th>
              <th className="text-center pb-1 font-extrabold text-[11px]">Qty</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job: any, idx: number) => (
              <tr key={job.id} className="border-b border-gray-300">
                <td className="py-1.5 pr-1 text-[11px] text-gray-600 align-top">{idx + 1}</td>
                <td className="py-1.5 pr-2 align-top">
                  <p className="font-extrabold text-[13px] text-black">{job.product_types?.name}</p>
                  <p className="font-bold text-black text-[11px]">
                    {job.width} × {job.height} {job.dimension_unit || 'cm'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium">{job.job_number}</p>
                  {job.notes && (
                    <p className="font-bold text-black text-[10px] mt-0.5 italic">{job.notes}</p>
                  )}
                </td>
                <td className="py-1.5 text-center font-extrabold text-[16px] text-black align-top">{job.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 my-2" />
        <div className="text-center font-bold text-[10px] text-black tracking-wider">
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
