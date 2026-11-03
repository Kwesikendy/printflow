'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  UserPlus, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  FileText, 
  Phone, 
  Mail, 
  CreditCard, 
  CheckCircle2, 
  Sparkles,
  HelpCircle,
  Building,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { createClientOrLegacyDebtAction, searchCustomers, type CustomerSuggestion } from '@/app/actions/customers'
import { toast } from 'sonner'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (customerName: string) => void
  initialCustomerName?: string
  initialCustomerPhone?: string
  defaultHasDebt?: boolean
}

export function AddClientModal({
  isOpen,
  onClose,
  onSuccess,
  initialCustomerName = '',
  initialCustomerPhone = '',
  defaultHasDebt = true
}: AddClientModalProps) {
  const [customerName, setCustomerName] = useState(initialCustomerName)
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone)
  const [customerEmail, setCustomerEmail] = useState('')
  const [source, setSource] = useState<'walk_in' | 'marketing'>('walk_in')
  const [companyName, setCompanyName] = useState('')
  const [notes, setNotes] = useState('')

  // Historical debt state
  const [hasHistoricalDebt, setHasHistoricalDebt] = useState(defaultHasDebt)
  const [debtAmount, setDebtAmount] = useState('')
  const [debtReason, setDebtReason] = useState('')
  const [debtDate, setDebtDate] = useState(() => new Date().toISOString().split('T')[0])
  const [legacyReference, setLegacyReference] = useState('')
  const [hasInitialPayment, setHasInitialPayment] = useState(false)
  const [initialPayment, setInitialPayment] = useState('')
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'cash' | 'momo' | 'other'>('cash')
  const [initialPaymentReference, setInitialPaymentReference] = useState('')

  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)

  // Reset or update state when opening
  useEffect(() => {
    if (isOpen) {
      setCustomerName(initialCustomerName)
      setCustomerPhone(initialCustomerPhone)
      setCustomerEmail('')
      setSource('walk_in')
      setCompanyName('')
      setNotes('')
      setHasHistoricalDebt(defaultHasDebt)
      setDebtAmount('')
      setDebtReason('')
      setDebtDate(new Date().toISOString().split('T')[0])
      setLegacyReference('')
      setHasInitialPayment(false)
      setInitialPayment('')
      setInitialPaymentMethod('cash')
      setInitialPaymentReference('')
      setSuggestions([])
      setSelectedSuggestion(null)
    }
  }, [isOpen, initialCustomerName, initialCustomerPhone, defaultHasDebt])

  // Look for existing customers while typing name
  useEffect(() => {
    if (!isOpen || !customerName || customerName.trim().length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(() => {
      searchCustomers(customerName.trim()).then(results => {
        // Exclude exact match if already selected
        const matches = results.filter(
          r => r.customer_name.toLowerCase() !== customerName.trim().toLowerCase()
        )
        setSuggestions(matches.slice(0, 3))
      }).catch(() => {})
    }, 250)

    return () => clearTimeout(timer)
  }, [customerName, isOpen])

  const handlePickSuggestion = (s: CustomerSuggestion) => {
    setCustomerName(s.customer_name)
    if (s.customer_phone) setCustomerPhone(s.customer_phone)
    if (s.source === 'marketing') setSource('marketing')
    setSelectedSuggestion(s.customer_name)
    setSuggestions([])
  }

  const numDebt = parseFloat(debtAmount) || 0
  const numPaid = hasInitialPayment ? (parseFloat(initialPayment) || 0) : 0
  const netRemaining = Math.max(0, numDebt - numPaid)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerName.trim()) {
      toast.error('Please enter customer or business name')
      return
    }

    if (hasHistoricalDebt) {
      if (numDebt <= 0) {
        toast.error('Please enter a valid debt amount greater than GHS 0.00')
        return
      }
      if (numPaid > numDebt) {
        toast.error('Initial payment cannot be greater than the total debt amount')
        return
      }
    }

    setLoading(true)

    try {
      const res = await createClientOrLegacyDebtAction({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        source,
        companyName: companyName.trim() || null,
        notes: notes.trim() || null,
        hasHistoricalDebt,
        debtAmount: numDebt,
        debtReason: debtReason.trim() || null,
        debtDate,
        legacyReference: legacyReference.trim() || null,
        initialPayment: numPaid,
        initialPaymentMethod,
        initialPaymentReference: initialPaymentReference.trim() || null
      })

      if (res.error) {
        toast.error(res.error)
        setLoading(false)
        return
      }

      toast.success(
        hasHistoricalDebt && numDebt > 0
          ? `Recorded ${customerName.trim()} with GHS ${numDebt.toFixed(2)} historical debt!`
          : `Client ${customerName.trim()} added successfully!`
      )

      onClose()
      if (onSuccess) {
        onSuccess(customerName.trim())
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save client details')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 z-10 my-8"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-500/10 via-amber-500/5 to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Customer Directory & Legacy Arrears
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    Add Client / Historical Debt
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Register past clients and record unpaid debts from before PrintFlow.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Section 1: Client Basic Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" />
                1. Client Contact Information
              </h3>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Customer / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value)
                    setSelectedSuggestion(null)
                  }}
                  placeholder="e.g. Samuel Mensah or Kingdom Books Ltd"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />

                {/* Suggestions chip if similar customer already found */}
                {suggestions.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs">
                    <span className="font-semibold text-amber-800 block mb-1.5">
                      Similar client already exists in system:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePickSuggestion(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>{s.customer_name}</span>
                          {s.customer_phone && <span className="text-slate-500 font-normal">({s.customer_phone})</span>}
                          <ArrowRight className="w-3 h-3 text-amber-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Phone Number <span className="text-slate-400 font-normal">(for WhatsApp & MoMo)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 0244 123 456"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Pricing Category / Tier
                  </label>
                  <select
                    value={source}
                    onChange={e => setSource(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer"
                  >
                    <option value="walk_in">Walk-in Customer (Standard Retail)</option>
                    <option value="marketing">Marketing / Agency (Contract Pricing)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      placeholder="e.g. client@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Company Name / Branch <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. Adum Branch or Graphic Corp"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Historical Debt Toggle */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0 mt-0.5">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Does this client owe money from before PrintFlow?
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Enable this to record past unpaid balances, manual invoice debts, or book arrears.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={hasHistoricalDebt}
                    onChange={e => setHasHistoricalDebt(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {hasHistoricalDebt && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 p-4.5 rounded-xl bg-slate-50 border border-slate-200/70"
                >
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Historical Debt Specifications
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-900">
                        Total Amount Owed (GHS) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">
                          GHS
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required={hasHistoricalDebt}
                          value={debtAmount}
                          onChange={e => setDebtAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-12 pr-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-base font-black text-amber-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Date Incurred / Legacy Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          value={debtDate}
                          onChange={e => setDebtDate(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        What does the client owe for?
                      </label>
                      <input
                        type="text"
                        value={debtReason}
                        onChange={e => setDebtReason(e.target.value)}
                        placeholder="e.g. 2x Roll-up Banners and 1000 flyers"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Old Receipt / Manual Invoice # <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={legacyReference}
                        onChange={e => setLegacyReference(e.target.value)}
                        placeholder="e.g. Book 3 #144 or REC-2025-08"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Partial Payment Toggle */}
                  <div className="pt-2 border-t border-slate-200/60">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={hasInitialPayment}
                        onChange={e => setHasInitialPayment(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Did this client make any partial deposit / upfront payment already?</span>
                    </label>

                    {hasInitialPayment && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">
                            Deposit Paid (GHS)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={debtAmount || undefined}
                            value={initialPayment}
                            onChange={e => setInitialPayment(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:bg-white outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">
                            Payment Method
                          </label>
                          <select
                            value={initialPaymentMethod}
                            onChange={e => setInitialPaymentMethod(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:bg-white outline-none cursor-pointer"
                          >
                            <option value="cash">Cash</option>
                            <option value="momo">Mobile Money (MoMo)</option>
                            <option value="other">Bank / Other</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">
                            Reference / Trans ID
                          </label>
                          <input
                            type="text"
                            value={initialPaymentReference}
                            onChange={e => setInitialPaymentReference(e.target.value)}
                            placeholder="e.g. MoMo Ref / Cash receipt"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:bg-white outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Realtime Debt Balance Preview */}
                  {numDebt > 0 && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-black text-amber-900 block">
                          Recorded Debt: {formatCurrency(numDebt)}
                          {numPaid > 0 && ` (Paid: ${formatCurrency(numPaid)})`}
                        </span>
                        <span className="text-amber-700 text-[11px]">
                          This will immediately show on the Front Desk order intake screen, Customer Statements, and Finance Outstanding Receivables.
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Net Arrears to Track
                        </span>
                        <span className="text-base font-black text-amber-700">
                          {formatCurrency(netRemaining)}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Internal Account Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Promised to pay balance by end of month. Handled by Manager."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={loading || !customerName.trim()}
                className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Client...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {hasHistoricalDebt && numDebt > 0
                        ? `Save Client & Debt (${formatCurrency(netRemaining)})`
                        : 'Save Client to Directory'}
                    </span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
