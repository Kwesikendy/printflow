'use client'

import { useState, useTransition, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  TrendingDown, 
  DollarSign, 
  Phone, 
  Mail, 
  FileText, 
  Receipt, 
  ExternalLink, 
  Plus, 
  Clock, 
  ArrowUpRight, 
  Printer, 
  ChevronRight
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AddClientModal } from '@/components/customers/AddClientModal'
import { CustomerStatementModal } from '@/components/finance/CustomerStatementModal'
import { SettleCustomerBalanceModal } from '@/components/finance/SettleCustomerBalanceModal'
import { getCustomerArrearsAction, type CustomerArrearsSummary } from '@/app/actions/finance'
import { getCustomersDirectoryAction, type CustomerWithBalance, type CustomerDirectoryResult } from '@/app/actions/customers'
import Link from 'next/link'
import { toast } from 'sonner'

interface ClientsDirectoryClientProps {
  initialData: CustomerDirectoryResult
  userRole?: string
}

export function ClientsDirectoryClient({ initialData, userRole }: ClientsDirectoryClientProps) {
  const [data, setData] = useState<CustomerDirectoryResult>(initialData)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'owing' | 'settled'>('all')
  const [isPending, startTransition] = useTransition()

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addModalInitialName, setAddModalInitialName] = useState('')
  const [addModalInitialPhone, setAddModalInitialPhone] = useState('')
  const [addModalDefaultHasDebt, setAddModalDefaultHasDebt] = useState(true)

  // Statement modal
  const [statementCustomer, setStatementCustomer] = useState<{ name: string; phone?: string | null } | null>(null)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)

  // Settle modal
  const [settleCustomer, setSettleCustomer] = useState<CustomerArrearsSummary | null>(null)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [settleLoading, setSettleLoading] = useState(false)

  const reloadData = () => {
    startTransition(async () => {
      try {
        const refreshed = await getCustomersDirectoryAction({ forceRefresh: true })
        setData(refreshed)
      } catch (err) {
        console.error('Failed to refresh customers directory:', err)
      }
    })
  }

  // Filter and search
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.customers.filter(c => {
      if (filterMode === 'owing' && !c.hasArrears) return false
      if (filterMode === 'settled' && c.hasArrears) return false

      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    })
  }, [data.customers, search, filterMode])

  const handleOpenAddModal = (customerName = '', customerPhone = '', hasDebt = true) => {
    setAddModalInitialName(customerName)
    setAddModalInitialPhone(customerPhone)
    setAddModalDefaultHasDebt(hasDebt)
    setIsAddModalOpen(true)
  }

  const handleOpenStatement = (name: string, phone?: string | null) => {
    setStatementCustomer({ name, phone })
    setIsStatementModalOpen(true)
  }

  const handleOpenSettle = async (name: string) => {
    setSettleLoading(true)
    try {
      const arrears = await getCustomerArrearsAction(name)
      if (!arrears || arrears.totalArrears <= 0.05) {
        toast.info(`${name} has no outstanding arrears.`)
        return
      }
      setSettleCustomer(arrears)
      setIsSettleModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load customer arrears')
    } finally {
      setSettleLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered Clients */}
        <Card className="relative overflow-hidden bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Clients
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              {data.summary.totalClients}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Registered customers in system
            </p>
          </CardContent>
        </Card>

        {/* Clients Owing (Debtors) */}
        <Card className="relative overflow-hidden bg-white border-amber-200/80 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Owing Clients
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">
              {data.summary.clientsOwing}
            </p>
            <p className="text-[11px] text-amber-800/80 mt-1 font-medium">
              Clients with unsettled arrears
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding Arrears */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-white to-transparent border-amber-300 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Total Receivables Owed
              </span>
              <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-900 mt-2">
              {formatCurrency(data.summary.totalArrears)}
            </p>
            <p className="text-[11px] text-amber-700 mt-1 font-medium">
              Combined legacy & active debt
            </p>
          </CardContent>
        </Card>

        {/* Settled Clients */}
        <Card className="relative overflow-hidden bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                In Good Standing
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
              {data.summary.clientsSettled}
            </p>
            <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">
              Clients with zero arrears
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar: Search, Filters, and Add Client Button */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client name, phone, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>

        {/* Right: Filter tabs & Primary Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Chips */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              All ({data.customers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('owing')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'owing' ? 'bg-amber-500 text-white shadow-2xs' : 'hover:text-amber-700'
              }`}
            >
              <span>Owing Arrears</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filterMode === 'owing' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {data.summary.clientsOwing}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('settled')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'settled' ? 'bg-white text-emerald-800 shadow-2xs' : 'hover:text-emerald-700'
              }`}
            >
              Good Standing ({data.summary.clientsSettled})
            </button>
          </div>

          {/* Add Client / Historical Debt Button */}
          <Button
            type="button"
            variant="primary"
            onClick={() => handleOpenAddModal('', '', true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Client / Legacy Debt</span>
          </Button>
        </div>
      </div>

      {/* Clients List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No clients found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search
                ? `No clients match the search query "${search}".`
                : filterMode === 'owing'
                  ? 'No clients currently have outstanding arrears.'
                  : 'Get started by adding your first client or recording a legacy debt.'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenAddModal('', '', true)}
              className="mt-2 text-xs font-bold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Add Client Now
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Customer / Business</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Pricing Tier</th>
                  <th className="py-3 px-4 text-right">Total Invoiced</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => (
                  <tr 
                    key={c.id + c.name} 
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* Customer Name & Stats */}
                    <td className="py-4 px-4 sm:px-6">
                      <div 
                        onClick={() => handleOpenStatement(c.name, c.phone)}
                        className="flex items-center gap-3 cursor-pointer group/name"
                        title="Click to view client statement & manage ledger"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-transform group-hover/name:scale-105 ${
                          c.hasArrears 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 group-hover/name:text-indigo-600 transition-colors">
                              {c.name}
                            </span>
                            {c.hasArrears && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                Owes Debt
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {c.totalJobs} order{c.totalJobs === 1 ? '' : 's'} recorded
                            {c.lastTransactionDate && ` · Last order ${formatDate(c.lastTransactionDate)}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contact details */}
                    <td className="py-4 px-4">
                      {c.phone ? (
                        <div className="space-y-0.5">
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.phone}</span>
                          </a>
                          {c.email && (
                            <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                              {c.email}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No phone logged</span>
                      )}
                    </td>

                    {/* Tier */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                        c.source === 'marketing'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.source === 'marketing' ? 'Marketing Agency' : 'Walk-in Retail'}
                      </span>
                    </td>

                    {/* Invoiced & Paid */}
                    <td className="py-4 px-4 text-right">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(c.totalInvoiced)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Paid: {formatCurrency(c.totalPaid)}
                      </div>
                    </td>

                    {/* Balance Due */}
                    <td className="py-4 px-4 text-right">
                      {c.hasArrears ? (
                        <div>
                          <span className="text-sm sm:text-base font-black text-amber-700 block">
                            {formatCurrency(c.balance)}
                          </span>
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                            Outstanding
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3" />
                          Settled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* If client owes arrears: 1-click settle button */}
                        {c.hasArrears && (
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => handleOpenSettle(c.name)}
                            disabled={settleLoading}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-xs cursor-pointer"
                          >
                            Settle
                          </Button>
                        )}

                        {/* Add legacy debt to this customer */}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleOpenAddModal(c.name, c.phone || '', true)}
                          title="Add opening balance or historical debt"
                          className="text-xs py-1.5 px-2.5 rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                          Add Debt
                        </Button>

                        {/* Financial Statement */}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleOpenStatement(c.name, c.phone)}
                          className="text-xs py-1.5 px-2.5 rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          Statement
                        </Button>

                        {/* Direct Print Statement Link */}
                        <Link
                          href={`/print/customer-statement?customer=${encodeURIComponent(c.name)}`}
                          target="_blank"
                          title="Open printable statement in new tab"
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Client / Historical Debt Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialCustomerName={addModalInitialName}
        initialCustomerPhone={addModalInitialPhone}
        defaultHasDebt={addModalDefaultHasDebt}
        onSuccess={(name) => {
          reloadData()
          toast.success(`Client ${name} updated in directory.`)
        }}
      />

      {/* Customer Financial Statement Modal */}
      {statementCustomer && (
        <CustomerStatementModal
          isOpen={isStatementModalOpen}
          onClose={() => {
            setIsStatementModalOpen(false)
            setStatementCustomer(null)
          }}
          customerName={statementCustomer.name}
          customerPhone={statementCustomer.phone}
          userRole={userRole}
          onCustomerUpdated={reloadData}
        />
      )}

      {/* Settle Customer Balance Modal */}
      {settleCustomer && (
        <SettleCustomerBalanceModal
          isOpen={isSettleModalOpen}
          onClose={() => {
            setIsSettleModalOpen(false)
            setSettleCustomer(null)
          }}
          onSuccess={() => {
            setIsSettleModalOpen(false)
            setSettleCustomer(null)
            reloadData()
            toast.success('Customer balance successfully settled!')
          }}
          customerName={settleCustomer.customerName}
          customerPhone={settleCustomer.customerPhone}
          totalOutstanding={settleCustomer.totalArrears}
          invoices={settleCustomer.unpaidInvoices}
        />
      )}
    </div>
  )
}
