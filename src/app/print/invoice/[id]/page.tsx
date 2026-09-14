import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AutoPrint, PrintButton } from '@/components/print/AutoPrint'
import { formatCurrency, formatDateTime } from '@/lib/utils'

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
    <div className="max-w-3xl mx-auto p-8 font-sans text-black">
      <AutoPrint />
      
      <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">{invoice.tenants?.name}</h1>
          <p className="text-sm text-gray-600 mt-1">Official Invoice / Receipt</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
          <p className="text-sm">Date: {formatDateTime(invoice.issued_at)}</p>
        </div>
      </div>

      <div className="mb-8 p-4 bg-gray-50 border border-gray-200">
        <h3 className="font-bold text-sm uppercase text-gray-500 mb-1">Billed To:</h3>
        <p className="font-semibold text-lg">{customerName}</p>
        {customerPhone && <p className="text-gray-700">{customerPhone}</p>}
      </div>

      <table className="w-full mb-8 text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 font-bold uppercase text-sm">Description</th>
            <th className="py-2 font-bold uppercase text-sm text-center">Dimensions</th>
            <th className="py-2 font-bold uppercase text-sm text-center">Qty</th>
            <th className="py-2 font-bold uppercase text-sm text-right">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {jobsList.map((job: any, index: number) => (
            <tr key={job.id} className="border-b border-gray-200">
              <td className="py-4">
                <p className="font-semibold">{jobsList.length > 1 ? `${index + 1}. ` : ''}{job.product_types?.name}</p>
                {job.notes && <p className="text-sm text-gray-600 mt-1">{job.notes}</p>}
                {jobsList.length > 1 && <p className="text-xs text-gray-400 mt-1 font-mono">Job #: {job.job_number}</p>}
              </td>
              <td className="py-4 text-center">{job.width} × {job.height} {job.dimension_unit}</td>
              <td className="py-4 text-center">{job.quantity}</td>
              <td className="py-4 text-right font-medium">{formatCurrency(job.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-2 text-right">
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="font-semibold">Subtotal:</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2 text-green-700">
            <span className="font-semibold">Amount Paid:</span>
            <span>-{formatCurrency(totalPaid)}</span>
          </div>
          <div className="flex justify-between pt-2 text-xl font-bold">
            <span>Balance Due:</span>
            <span>{formatCurrency(balance)}</span>
          </div>
        </div>
      </div>

      {invoice.status === 'paid' ? (
        <div className="text-center p-4 border-2 border-green-600 text-green-700 font-bold uppercase text-xl tracking-widest rotate-[-5deg] w-48 mx-auto opacity-75">
          PAID IN FULL
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-red-600">Please pay balance to proceed with production.</p>
      )}

      <div className="no-print mt-16 text-center text-sm text-gray-500">
        <PrintButton />
      </div>
    </div>
  )
}
