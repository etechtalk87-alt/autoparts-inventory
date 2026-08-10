import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { AlertCircle, CreditCard, ReceiptText, Sparkles, FileText } from 'lucide-react'
import { generateReportPdf } from '../lib/reportPdf'

function formatCurrency(value, currency = 'AED') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
}

function getStatusColor(status) {
  switch (status) {
    case 'unpaid': return 'bg-rose-500/20 text-rose-300'
    case 'partial': return 'bg-amber-500/20 text-amber-300'
    case 'credit': return 'bg-red-500/20 text-red-300'
    default: return 'bg-slate-500/20 text-slate-300'
  }
}

function getStatusLabel(status, t) {
  switch (status) {
    case 'unpaid': return t('sales.statusUnpaid')
    case 'partial': return t('sales.statusPartial')
    case 'credit': return t('sales.statusCredit')
    default: return status
  }
}

function Receivables() {
  const { currentStaff, loading } = useAuth()
  const { t } = useTranslation()
  const [sales, setSales] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [unlinkedPayments, setUnlinkedPayments] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)

  const canManageBranches = currentStaff?.role === 'company_admin'

  useEffect(() => {
    if (!currentStaff?.company_id) return

    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('company_id', currentStaff.company_id)
        .order('name')
      if (!error) setBranches(data ?? [])
    }

    const fetchReceivables = async () => {
      setLoadingSales(true)
      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_price,
          amount_paid,
          payment_status,
          customer_id,
          created_at,
          company_id,
          branch_id,
          invoice_number,
          parts:part_id ( part_name, currency ),
          branches:branch_id ( name ),
          customers:customer_id ( full_name, phone, email )
        `)
        .eq('company_id', currentStaff.company_id)
        .in('payment_status', ['unpaid', 'partial', 'credit'])
        .order('created_at', { ascending: false })

      if (currentStaff?.role === 'branch_staff') {
        query = query.eq('branch_id', currentStaff.activeBranchId)
      }

      const { data, error } = await query
      if (!error) {
        setSales(data ?? [])
      } else {
        console.error('Error fetching receivables:', error)
      }
      setLoadingSales(false)
    }

    const fetchUnlinkedPayments = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, currency')
        .eq('company_id', currentStaff.company_id)
        .is('sale_id', null)
        .is('invoice_id', null)
      if (!error) setUnlinkedPayments(data ?? [])
    }

    fetchBranches()
    fetchReceivables()
    fetchUnlinkedPayments()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role])

  const filtered = useMemo(() => {
    if (branchFilter === 'all') return sales
    return sales.filter((s) => String(s.branch_id) === branchFilter)
  }, [branchFilter, sales])

  const paged = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [currentPage, itemsPerPage, filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [currentPage, totalPages])
  useEffect(() => { setCurrentPage(1) }, [branchFilter])

  const totals = useMemo(() => {
    const acc = {}
    filtered.forEach((s) => {
      const currency = s.parts?.currency || s.currency || 'AED'
      const balance = Number(s.sale_price || 0) - Number(s.amount_paid || 0)
      acc[currency] = (acc[currency] || 0) + balance
    })

    // Subtract unlinked payments (advance payments not yet applied to an invoice)
    unlinkedPayments.forEach((p) => {
      const c = p.currency || 'AED'
      acc[c] = (acc[c] || 0) - Number(p.amount || 0)
    })

    // Floor at zero — matches Dashboard/Customers convention
    Object.keys(acc).forEach((c) => {
      if (acc[c] < 0) acc[c] = 0
    })

    return Object.entries(acc).map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency))
  }, [filtered, unlinkedPayments])

  const handleExportPdf = () => {
    const columns = [
      { key: 'invoice', label: 'Invoice #', width: 2 },
      { key: 'customer', label: 'Customer', width: 1.2 },
      { key: 'part', label: 'Part', width: 1.2 },
      { key: 'salePrice', label: 'Sale Price', align: 'right', width: 0.9 },
      { key: 'paid', label: 'Paid', align: 'right', width: 0.9 },
      { key: 'balanceDue', label: 'Balance Due', align: 'right', width: 0.9 },
      {
        key: 'status',
        label: 'Status',
        width: 0.8,
        render: (value, row) => ({
          text: value,
          color: row._rawStatus === 'partial' ? '#d97706' : row._rawStatus === 'credit' ? '#7c3aed' : '#dc2626',
        }),
      },
      { key: 'date', label: 'Date', width: 0.8 },
    ]

    const rows = filtered.map((sale) => {
      const currency = sale.parts?.currency || sale.currency || 'AED'
      const balance = Number(sale.sale_price || 0) - Number(sale.amount_paid || 0)
      const customerName = sale.customers?.full_name || '—'

      return {
        invoice: sale.invoice_number || '—',
        customer: customerName,
        part: sale.parts?.part_name || '—',
        salePrice: `${currency} ${Number(sale.sale_price || 0).toFixed(2)}`,
        paid: `${currency} ${Number(sale.amount_paid || 0).toFixed(2)}`,
        balanceDue: `${currency} ${balance.toFixed(2)}`,
        status: sale.payment_status === 'partial' ? 'Partial' : sale.payment_status === 'credit' ? 'Credit' : 'Unpaid',
        _rawStatus: sale.payment_status,
        date: new Date(sale.created_at).toLocaleDateString(),
      }
    })

    generateReportPdf({
      companyName: currentStaff?.companyName || 'Auto Parts Inventory',
      reportTitle: 'Outstanding Receivables Report',
      columns,
      rows,
    })
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {t('receivables.loading')}
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">

        {/* Header */}
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-sm font-medium text-rose-200">
                <Sparkles size={16} />
                {t('receivables.accountsReceivable')}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('receivables.title')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                {t('receivables.description')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <ReceiptText size={16} className="text-rose-300" />
                  {t('receivables.openInvoices')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{filtered.length}</div>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <CreditCard size={16} />
                  {t('receivables.totalOutstanding')}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {totals.length > 0 ? totals.map((e) => (
                    <span key={e.currency} className="text-lg font-semibold text-white">
                      {formatCurrency(e.amount, e.currency)}
                    </span>
                  )) : <span className="text-lg font-semibold text-white">—</span>}
                </div>
              </div>
              <div className="flex items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  <FileText size={18} />
                  {t('receivables.exportPdf')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Table card */}
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              {filtered.length} {filtered.length !== 1 ? t('receivables.outstandingInvoicePlural') : t('receivables.outstandingInvoiceSingular')}
            </p>
            {canManageBranches && branches.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">{t('receivables.branch')}</span>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option value="all">{t('receivables.allBranches')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loadingSales ? (
            <div className="p-8 text-slate-400">{t('receivables.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <AlertCircle size={28} className="mx-auto text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{t('receivables.noOutstandingReceivables')}</h3>
                <p className="mt-1 text-sm text-slate-400">{t('receivables.allInvoicesFullyPaid')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">{t('receivables.colInvoice')}</th>
                      <th className="px-6 py-3 font-medium">{t('receivables.colCustomer')}</th>
                      <th className="px-6 py-3 font-medium">{t('receivables.colPart')}</th>
                      <th className="px-6 py-3 font-medium">{t('receivables.colSalePrice')}</th>
                      <th className="px-6 py-3 font-medium">{t('receivables.colPaid')}</th>
                      <th className="px-6 py-3 font-medium">{t('receivables.colBalanceDue')}</th>
                      <th className="px-6 py-3 font-medium">{t('receivables.colStatus')}</th>
                      {canManageBranches && <th className="px-6 py-3 font-medium">{t('receivables.colBranch')}</th>}
                      <th className="px-6 py-3 font-medium">{t('receivables.colDate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-900/50">
                    {paged.map((sale) => {
                      const currency = sale.parts?.currency || sale.currency || 'AED'
                      const balance = Number(sale.sale_price || 0) - Number(sale.amount_paid || 0)
                      const customerName = sale.customers?.full_name || '—'
                      return (
                        <tr key={sale.id} className="align-middle transition hover:bg-slate-800/60">
                          <td className="px-6 py-4 font-mono text-xs text-slate-300">{sale.invoice_number || '—'}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{customerName}</div>
                            {(sale.customers?.phone || sale.customers?.email) && (
                              <div className="text-xs text-slate-500">{sale.customers?.phone || sale.customers?.email}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-300">{sale.parts?.part_name || '—'}</td>
                          <td className="px-6 py-4 font-semibold text-white">{formatCurrency(sale.sale_price, currency)}</td>
                          <td className="px-6 py-4 text-emerald-400">{formatCurrency(sale.amount_paid, currency)}</td>
                          <td className="px-6 py-4 font-bold text-rose-300">{formatCurrency(balance, currency)}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(sale.payment_status)}`}>
                              {getStatusLabel(sale.payment_status, t)}
                            </span>
                          </td>
                          {canManageBranches && <td className="px-6 py-4 text-slate-300">{sale.branches?.name ?? '—'}</td>}
                          <td className="px-6 py-4 text-slate-400">{new Date(sale.created_at).toLocaleDateString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    {t('receivables.showingRange', {
                      start: (currentPage - 1) * itemsPerPage + 1,
                      end: Math.min(currentPage * itemsPerPage, filtered.length),
                      total: filtered.length,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('receivables.previous')}
                    </button>
                    <span className="text-sm text-slate-300">{t('receivables.pageOf', { current: currentPage, total: totalPages })}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('receivables.next')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default Receivables
