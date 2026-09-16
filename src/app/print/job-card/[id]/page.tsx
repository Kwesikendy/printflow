import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatDateTime } from '@/lib/utils'
import { JobBarcode } from '@/components/print/JobBarcode'

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
    <div className="bg-white min-h-screen flex items-start justify-center py-10 font-mono">
      <AutoPrint />

      {/* Receipt card — narrow, centered */}
      <div className="w-[340px] text-black text-[12px] leading-snug">

        {/* Logo + Shop Header */}
        <div className="text-center mb-4">
          <img
            src="/Print_DPI_Logo.png"
            alt="Print DPI"
            className="h-16 mx-auto mb-2 object-contain"
          />
          <p className="font-bold text-[15px] tracking-wide">{job.tenants?.name || 'Print DPI'}</p>
          <p className="text-[11px] text-gray-600">Accra, Ghana</p>
          <p className="text-[11px] text-gray-600">0598608209</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Order Number */}
        <div className="text-center mb-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Order Number</p>
          <div className="border-2 border-green-600 rounded-md inline-block px-6 py-1 mt-1">
            <p className="text-[26px] font-extrabold tracking-tight text-black">
              #{job.job_number}
            </p>
          </div>
        </div>

        {/* Paid / Unpaid status */}
        <div className="text-center mb-3">
          {isPaid ? (
            <span className="inline-flex items-center gap-1 text-green-700 font-bold text-[12px] uppercase tracking-wide">
              PAID IN FULL
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[12px] uppercase tracking-wide">
              PAYMENT PENDING
            </span>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Customer Info */}
        <div className="mb-3">
          <p className="font-bold text-[13px]">{job.customer_name}</p>
          {job.customer_phone && (
            <p className="text-gray-600">Phone: {job.customer_phone}</p>
          )}
          <p className="text-gray-500 text-[10px] mt-0.5">
            Source: {job.source === 'walk_in' ? 'Walk-In' : 'Marketing'}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Receipt Date */}
        <div className="text-center mb-3">
          <p className="font-bold uppercase tracking-widest text-[10px] text-gray-500">RECEIPT</p>
          <p className="text-[11px]">Date: {formatDateTime(job.created_at)}</p>
        </div>

        {/* Real Code 128 barcode */}
        <div className="flex justify-center mb-3">
          <JobBarcode value={job.job_number} />
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Items table */}
        <table className="w-full text-[11px] mb-2">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="text-left pb-1 font-bold">Item</th>
              <th className="text-center pb-1 font-bold">Qty</th>
              <th className="text-right pb-1 font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-dashed border-gray-300">
              <td className="py-2 pr-2">
                <p className="font-semibold">{job.product_types?.name}</p>
                <p className="text-gray-500 text-[10px]">
                  {job.width} × {job.height} {job.dimension_unit || 'cm'}
                </p>
                {job.notes && (
                  <p className="text-gray-500 text-[10px] italic">{job.notes}</p>
                )}
              </td>
              <td className="py-2 text-center">{job.quantity}</td>
              <td className="py-2 text-right font-semibold">GHS {Number(job.line_total).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="text-[11px] space-y-1 mb-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>GHS {Number(job.line_total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-[12px]">
            <span>Total:</span>
            <span>GHS {Number(invoice?.total || job.line_total).toFixed(2)}</span>
          </div>
          {paymentMethod && (
            <div className="flex justify-between text-gray-600">
              <span>Payment Method:</span>
              <span>{methodLabel[paymentMethod] || paymentMethod}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Paid summary */}
        <div className="text-center text-[11px] mb-3">
          {isPaid ? (
            <>
              <p className="text-green-700 font-bold">Fully Paid: GHS {Number(totalPaid || invoice?.total || job.line_total).toFixed(2)}</p>
              <p className="text-green-600 text-[10px]">Paid in Full</p>
            </>
          ) : (
            <>
              <p className="text-orange-600 font-bold">
                Balance Due: GHS {Number((invoice?.total || job.line_total) - totalPaid).toFixed(2)}
              </p>
            </>
          )}
        </div>

      </div>

      {/* Print button — hidden on print */}
      <div className="no-print fixed bottom-6 right-6">
        <PrintButton />
      </div>
    </div>
  )
}
