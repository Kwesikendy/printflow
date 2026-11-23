'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Download,
  Plus,
  Receipt,
  Search,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createExpenditureAction,
  requestExpenditureDeletionAction,
  clearExpenditureDeletionRequestAction,
  approveExpenditureDeletionAction,
} from '@/app/actions/expenditures'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

const categories = ['Materials', 'Utilities', 'Transport', 'Maintenance', 'Staff', 'Rent', 'Other']
const quickReasons = [
  'Double entry',
  'Entered wrong amount',
  'Recorded on wrong date',
  'Cancelled / refunded expense',
]

interface ExpenditureManagerProps {
  initialExpenditures: any[]
  errorMessage?: string
  userRole?: string
}

export function ExpenditureManager({
  initialExpenditures,
  errorMessage,
  userRole = 'accountant',
}: ExpenditureManagerProps) {
  const [items, setItems] = useState(initialExpenditures)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    category: 'Materials',
    description: '',
    amount: '',
    vendor: '',
    reference: '',
    notes: '',
    spentAt: new Date().toISOString().slice(0, 10),
  })

  // Deletion request modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false)

  const isAdmin = userRole === 'admin'

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const haystack = `${item.description} ${item.vendor || ''} ${item.reference || ''}`.toLowerCase()
        if (query && !haystack.includes(query.toLowerCase())) return false
        if (category !== 'all' && item.category !== category) return false
        const date = new Date(item.spent_at).getTime()
        if (fromDate && date < new Date(`${fromDate}T00:00:00`).getTime()) return false
        if (toDate && date > new Date(`${toDate}T23:59:59`).getTime()) return false
        return true
      }),
    [items, query, category, fromDate, toDate]
  )

  const total = filtered.reduce((sum, item) => sum + Number(item.amount), 0)
  const pendingCount = useMemo(
    () => items.filter((i) => i.deletion_status === 'pending').length,
    [items]
  )

  const exportCsv = () => {
    const rows = [
      ['Date', 'Category', 'Description', 'Vendor', 'Reference', 'Amount', 'Status'],
      ...filtered.map((item) => [
        new Date(item.spent_at).toISOString().slice(0, 10),
        item.category,
        item.description,
        item.vendor || '',
        item.reference || '',
        Number(item.amount).toFixed(2),
        item.deletion_status === 'pending' ? 'Pending Deletion' : 'Active',
      ]),
    ]
    const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(
      rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    )}`
    const link = document.createElement('a')
    link.href = uri
    link.download = `PrintFlow_Expenditure_Report_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await createExpenditureAction({
        ...form,
        amount: Number(form.amount),
        spentAt: form.spentAt,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Expenditure recorded')
      if (result.data) setItems((previous) => [result.data, ...previous])
      setForm({
        category: 'Materials',
        description: '',
        amount: '',
        vendor: '',
        reference: '',
        notes: '',
        spentAt: new Date().toISOString().slice(0, 10),
      })
      setIsOpen(false)
    })
  }

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deleteTarget) return
    if (!deleteReason.trim()) {
      toast.error('Please enter a reason for deletion.')
      return
    }

    setIsSubmittingDelete(true)
    try {
      const res = await requestExpenditureDeletionAction(deleteTarget.id, deleteReason)
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        setItems((prev) => prev.map((it) => (it.id === deleteTarget.id ? res.data : it)))
        toast.success('Deletion request submitted and pending Admin approval.')
        setDeleteTarget(null)
        setDeleteReason('')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit deletion request')
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  const handleWithdrawRequest = async (id: string) => {
    startTransition(async () => {
      const res = await clearExpenditureDeletionRequestAction(id, false)
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        setItems((prev) => prev.map((it) => (it.id === id ? res.data : it)))
        toast.success('Deletion request withdrawn.')
      }
    })
  }

  const handleAdminApprove = async (id: string) => {
    startTransition(async () => {
      const res = await approveExpenditureDeletionAction(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        setItems((prev) => prev.filter((it) => it.id !== id))
        toast.success('Expenditure deletion approved and removed.')
      }
    })
  }

  const handleAdminReject = async (id: string) => {
    startTransition(async () => {
      const res = await clearExpenditureDeletionRequestAction(id, true)
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        setItems((prev) => prev.map((it) => (it.id === id ? res.data : it)))
        toast.success('Deletion request rejected; record kept.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-700 border border-rose-100">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Expenditure</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Record and report money spent by the business.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add expenditure
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold mb-1">Database Setup Required</p>
          <p className="text-amber-800">{errorMessage}</p>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <strong>
              {pendingCount} deletion request{pendingCount === 1 ? '' : 's'} pending Admin approval:
            </strong>{' '}
            {isAdmin
              ? 'You can approve or reject them directly below or from your Admin Dashboard.'
              : 'Flagged entries remain visible until an Administrator approves the deletion from their dashboard.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Filtered spend</p>
          <p className="mt-2 text-3xl font-black text-rose-900 font-mono tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-xs text-rose-700">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2">
          <p className="text-sm font-bold text-slate-800">Accountant workflow</p>
          <p className="mt-1 text-sm text-slate-500">
            Keep each purchase tied to a category, vendor, and reference. If a duplicate or mistake is
            entered, click <strong>Request Delete</strong> to submit it for Admin approval.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search expenditures"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, vendor, or reference"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          aria-label="Filter expenditure category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <input
          aria-label="From date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        />
        <input
          aria-label="To date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Vendor / Ref.</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const isDelPending = item.deletion_status === 'pending'
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'transition-colors',
                      isDelPending ? 'bg-amber-50/50 hover:bg-amber-50/80' : 'hover:bg-slate-50'
                    )}
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {formatDateTime(item.spent_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{item.description}</p>
                        {isDelPending && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            <Clock className="h-3 w-3" /> Pending Deletion
                          </span>
                        )}
                      </div>
                      {item.notes && <p className="mt-0.5 text-xs text-slate-500">{item.notes}</p>}
                      {isDelPending && item.deletion_reason && (
                        <p className="mt-1 text-xs font-medium text-amber-800">
                          Reason: &ldquo;{item.deletion_reason}&rdquo;
                          {item.deletion_requested_by_name
                            ? ` (by ${item.deletion_requested_by_name})`
                            : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.vendor || '-'}
                      {item.reference && (
                        <span className="block text-xs text-slate-400">{item.reference}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-rose-700 font-mono tabular-nums">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {isDelPending ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleAdminApprove(item.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                                title="Approve deletion and permanently remove"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleAdminReject(item.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                                title="Reject deletion request and keep record"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleWithdrawRequest(item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer disabled:opacity-50"
                              title="Cancel your deletion request"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Withdraw
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(item)
                            setDeleteReason('')
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                          title="Request Admin to delete this mistaken or duplicate entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Request Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No expenditures match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expenditure Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expenditure-title"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="expenditure-title" className="text-lg font-bold text-slate-900">
                  Add expenditure
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  This record will be available to accountant reports immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                >
                  <option value="">Select category</option>
                  {categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Date
                <input
                  required
                  type="date"
                  value={form.spentAt}
                  onChange={(e) => setForm({ ...form, spentAt: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Description
                <input
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. 5 rolls of Flexi"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Amount (GHS)
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Vendor
                <input
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Reference
                <input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Invoice or receipt no."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Notes
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {isPending ? 'Saving...' : 'Save expenditure'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Request Deletion Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-delete-title"
        >
          <form
            onSubmit={handleRequestDeletion}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="request-delete-title" className="text-base font-bold text-slate-900">
                    Request Expenditure Deletion
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pending until approved by an Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-slate-900">{deleteTarget.description}</span>
                <span className="font-bold text-rose-700 font-mono">
                  {formatCurrency(deleteTarget.amount)}
                </span>
              </div>
              <div className="text-slate-500">
                {deleteTarget.category} · {formatDateTime(deleteTarget.spent_at)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reason for deletion request *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {quickReasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDeleteReason(r)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                      deleteReason === r
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                required
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Explain why this entry should be deleted (e.g. Entered twice by mistake)..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isSubmittingDelete}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingDelete}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                {isSubmittingDelete ? 'Submitting...' : 'Submit Deletion Request'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
