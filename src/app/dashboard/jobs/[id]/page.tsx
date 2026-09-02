import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, SOURCE_LABELS, canCancelJob } from '@/lib/utils'
import { JobActions } from '@/components/jobs/JobActions'
import { PaymentForm } from '@/components/jobs/PaymentForm'
import { NoInvoicePanel } from '@/components/jobs/NoInvoicePanel'
import { Printer, FileText, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default async function JobDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  // Data fetch uses service client so invoices/payments are never blocked by RLS
  const { data: jobData } = await serviceSupabase
    .from('jobs')
    .select(`
      *,
      product_types(name),
      profiles(full_name),
      invoices(
        *,
        payments(
          *,
          profiles(full_name)
        )
      ),
      job_status_events(
        *,
        profiles(full_name)
      )
    `)
    .eq('id', params.id)
    .single()

  const job = jobData as any
  if (!job) notFound()

  const invoice = Array.isArray(job.invoices) ? job.invoices[0] : job.invoices
  const rawPayments = invoice?.payments || []
  const payments = Array.isArray(rawPayments) ? rawPayments : [rawPayments]
  const rawEvents = job.job_status_events || []
  const events = (Array.isArray(rawEvents) ? rawEvents : [rawEvents]).sort((a: any, b: any) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const isCancelled = job.status === 'cancelled'

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{job.job_number}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-slate-500 mt-1">Customer: <span className="text-slate-900">{job.customer_name}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/print/job-card/${job.id}`} target="_blank" className="btn btn-outline">
            <Printer className="w-4 h-4" /> Print Card
          </Link>
          {invoice && (
            <Link href={`/print/invoice/${job.id}`} target="_blank" className="btn btn-outline">
              <FileText className="w-4 h-4" /> Print Invoice
            </Link>
          )}
          <JobActions job={job} role={role} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Job Details & Invoice */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Job Specifications" />
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Product Type</p>
                  <p className="text-sm font-medium text-slate-900">{job.product_types?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Source</p>
                  <p className="text-sm font-medium text-slate-900">{SOURCE_LABELS[job.source as keyof typeof SOURCE_LABELS]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Quantity</p>
                  <p className="text-sm font-medium text-slate-900">{job.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Dimensions</p>
                  <p className="text-sm font-medium text-slate-900">{job.width} × {job.height}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Area</p>
                  <p className="text-sm font-medium text-slate-900">{job.area}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Phone</p>
                  <p className="text-sm font-medium text-slate-900">{job.customer_phone || 'N/A'}</p>
                </div>
              </div>
              
              {job.notes && (
                <div className="mt-6 pt-4 border-t border-indigo-100">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-600">{job.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader 
              title="Invoice & Payment" 
              action={invoice?.status === 'paid' && (
                <span className="flex items-center text-sm font-medium text-green-600 bg-green-400/10 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Paid
                </span>
              )}
            />
            <CardContent>
              {invoice ? (
                <div>
                  <div className="flex justify-between items-center mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Invoice Number</p>
                      <p className="text-sm font-medium text-slate-900">{invoice.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(invoice.total)}</p>
                    </div>
                  </div>

                  {invoice.status === 'unpaid' && !isCancelled && ['front_desk', 'admin'].includes(role) ? (
                    <PaymentForm invoice={invoice} jobId={job.id} />
                  ) : invoice.status === 'paid' ? (
                    <div className="mt-4 space-y-4">
                      {/* PAID banner */}
                      <div className="flex items-center gap-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-200">
                          <CheckCircle2 className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-emerald-800">Payment Confirmed</p>
                          {payments[0] && (
                            <p className="text-sm text-emerald-700 mt-0.5">
                              {formatCurrency(payments[0].amount)} via <span className="font-semibold capitalize">{payments[0].method === 'momo' ? 'Mobile Money' : payments[0].method}</span>
                              {payments[0].reference && <span className="text-emerald-600"> · Ref: {payments[0].reference}</span>}
                            </p>
                          )}
                          <p className="text-xs text-emerald-600 mt-1">
                            Recorded by {payments[0]?.profiles?.full_name} · {payments[0] && formatDateTime(payments[0].recorded_at)}
                          </p>
                        </div>
                        <Link
                          href={`/print/invoice/${job.id}`}
                          target="_blank"
                          className="btn btn-outline shrink-0 flex items-center gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                        >
                          <FileText className="w-4 h-4" />
                          Print Receipt
                        </Link>
                      </div>

                      {/* Full payment history (if multiple payments) */}
                      {payments.length > 1 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">All Payments</h4>
                          <table className="table-standard">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Reference</th>
                                <th>Recorded By</th>
                                <th className="text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map((p: any) => (
                                <tr key={p.id}>
                                  <td>{formatDateTime(p.recorded_at)}</td>
                                  <td className="capitalize">{p.method}</td>
                                  <td>{p.reference || '-'}</td>
                                  <td>{p.profiles?.full_name}</td>
                                  <td className="text-right text-green-600 font-medium">{formatCurrency(p.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <NoInvoicePanel jobId={job.id} role={role} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Timeline */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader title="Status Timeline" />
            <CardContent>
              <div className="relative border-l-2 border-indigo-200 ml-3 space-y-6 pl-5">
                {events.map((evt: any, i: number) => (
                  <div key={evt.id} className="relative">
                    <div className="absolute -left-[27px] mt-1.5 w-3 h-3 bg-indigo-500 rounded-full border-4 border-[#0f172a]" />
                    <p className="text-sm font-medium text-slate-900"><StatusBadge status={evt.to_status} /></p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(evt.created_at)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">by {evt.profiles?.full_name}</p>
                    {evt.notes && (
                      <div className="mt-2 text-xs text-slate-600 bg-slate-100/50 p-2 rounded">
                        {evt.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
