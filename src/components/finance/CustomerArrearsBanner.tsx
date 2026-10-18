'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { getCustomerArrearsAction, type CustomerArrearsSummary } from '@/app/actions/finance'
import { SettleCustomerBalanceModal } from './SettleCustomerBalanceModal'

interface CustomerArrearsBannerProps {
  customerName: string
  customerPhone?: string | null
  currentInvoiceId?: string
  currentRemaining?: number
  onSettled?: () => void
}

export function CustomerArrearsBanner({
  customerName,
  customerPhone,
  currentInvoiceId,
  currentRemaining = 0,
  onSettled
}: CustomerArrearsBannerProps) {
  const [arrears, setArrears] = useState<CustomerArrearsSummary | null>(null)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadArrears = () => {
    if (!customerName) return
    setLoading(true)
    getCustomerArrearsAction(customerName, currentInvoiceId)
      .then(data => {
        setArrears(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadArrears()
  }, [customerName, currentInvoiceId])

  if (!arrears || arrears.otherInvoicesCount === 0 || arrears.otherInvoicesBalance <= 0.05) {
    return null
  }

  const hasCurrentDebt = currentRemaining > 0.05

  return (
    <>
      <div className="rounded-2xl border-2 border-amber-300 bg-linear-to-br from-amber-50 via-white to-orange-50/50 p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-slate-900 tracking-tight">
                  Customer Has Outstanding Arrears
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {arrears.otherInvoicesCount} prior unpaid order{arrears.otherInvoicesCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                <strong>{customerName}</strong> has unsettled balances of{' '}
                <strong className="text-amber-700">{formatCurrency(arrears.otherInvoicesBalance)}</strong> on previous jobs.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Customer Debt
            </span>
            <span className="text-xl font-black text-amber-700">
              {formatCurrency(arrears.totalArrears)}
            </span>
          </div>
        </div>

        {/* Breakdown & 1-Click Action */}
        <div className="pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {hasCurrentDebt ? (
              <>
                Current order: <strong className="text-slate-800">{formatCurrency(currentRemaining)}</strong> · Prior arrears: <strong className="text-amber-700">{formatCurrency(arrears.otherInvoicesBalance)}</strong>
              </>
            ) : (
              <>
                Current order is settled · Prior arrears: <strong className="text-amber-700">{formatCurrency(arrears.otherInvoicesBalance)}</strong>
              </>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => setIsSettleModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pay All Arrears at a Go ({formatCurrency(arrears.totalArrears)})
          </Button>
        </div>
      </div>

      {/* Settle Customer Balance Modal */}
      <SettleCustomerBalanceModal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        onSuccess={() => {
          loadArrears()
          if (onSettled) onSettled()
          else window.location.reload()
        }}
        customerName={customerName}
        customerPhone={customerPhone || arrears.customerPhone}
        totalOutstanding={arrears.totalArrears}
        invoices={arrears.unpaidInvoices}
      />
    </>
  )
}
