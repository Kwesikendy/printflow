import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PaymentForm } from '@/components/jobs/PaymentForm'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { FileText, CheckCircle2, ArrowLeft } from 'lucide-react'

export default async function JobGroupPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profileData as any)?.role || 'front_desk'

  const { data: groupData } = await supabase
    .from('job_groups')
    .select('*, jobs(*, product_types(name)), invoices:invoices!group_id(*, payments(*, profiles(full_name)))')
    .eq('id', id)
    .single()

  if (!groupData) notFound()

  const group = groupData as any
  const jobs: any[] = group.jobs || []
  const invoice = Array.isArray(group.invoices) ? group.invoices[0] : group.invoices
  const payments: any[] = invoice?.payments || []

  const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0)
  const remaining = invoice ? invoice.total - totalPaid : 0

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/jobs" className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Order for {group.customer_name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {group.customer_phone && <span>{group.customer_phone} · </span>}
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} · {formatDateTime(group.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {jobs.map((job: any, index: number) => (
            <Card key={job.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{job.product_types?.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{job.job_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <Link href={`/dashboard/jobs/${job.id}`} className="text-xs text-indigo-600 hover:underline font-medium">View detail ?</Link>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 rounded-xl p-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Dimensions</p>
                    <p className="text-sm font-semibold text-slate-800">{job.width} x {job.height} {job.dimension_unit || 'cm'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Qty</p>
                    <p className="text-sm font-semibold text-slate-800">{job.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Line Total</p>
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(job.line_total)}</p>
                  </div>
                </div>

                {job.notes && <p className="mt-3 text-sm text-slate-500 italic">Notes: {job.notes}</p>}
                {job.artwork_url && (
                  <a href={job.artwork_url} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline font-medium"
                  >
                    <FileText className="w-3.5 h-3.5" /> View Artwork
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="border-emerald-100">
            <CardHeader title="Invoice and Payment"
              action={invoice?.status === 'paid' && (
                <span className="flex items-center text-sm font-medium text-green-600 bg-green-400/10 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Paid
                </span>
              )}
            />
            <CardContent>
              {invoice ? (
                <div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Invoice No.</span>
                      <span className="font-semibold">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Grand Total</span>
                      <span className="text-xl font-bold">{formatCurrency(invoice.total)}</span>
                    </div>
                    {payments.length > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Paid</span>
                          <span className="text-emerald-600 font-semibold">-{formatCurrency(totalPaid)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-slate-200 pt-2 font-bold">
                          <span>Balance</span>
                          <span className="text-red-600">{formatCurrency(remaining)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {invoice.status !== 'paid' && ['front_desk', 'admin'].includes(role) && (
                    <PaymentForm invoice={invoice} jobId={jobs[0]?.id || ''} payments={payments} />
                  )}

                  {invoice.status === 'paid' && (
                    <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <p className="text-sm font-bold text-emerald-800">Fully Paid</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No invoice found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
