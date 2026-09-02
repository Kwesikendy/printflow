'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { createInvoiceForJobAction } from '@/app/actions/jobs'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'

export function NoInvoicePanel({ jobId, role }: { jobId: string, role?: string }) {
  const [isPending, startTransition] = useTransition()
  const canAct = role === 'front_desk' || role === 'admin'

  if (!canAct) {
    return (
      <p className="text-sm text-slate-500">No invoice has been generated for this job yet.</p>
    )
  }

  const handleGenerate = () => {
    startTransition(async () => {
      const res = await createInvoiceForJobAction(jobId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Invoice generated — you can now record payment.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">Invoice not yet generated</p>
        </div>
        <p className="text-xs text-amber-700">
          This job was created before automatic invoicing. Click below to generate the invoice and proceed to collect payment.
        </p>
      </div>
      <Button
        variant="primary"
        loading={isPending}
        onClick={handleGenerate}
        className="shrink-0"
      >
        Generate Invoice
      </Button>
    </div>
  )
}
