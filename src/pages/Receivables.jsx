import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { AlertCircle, CreditCard, ReceiptText, Sparkles } from 'lucide-react'

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

function getStatusLabel(status) {
  switch (status) {
    case 'unpaid': return 'Unpaid'
    case 'partial': return 'Partial'
    case 'credit': return 'Credit'
    default: return status
  }
}

function Receivables() {
  const { currentStaff, loading } = useAuth()
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading receivables...
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
                Accounts Receivable
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Outstanding Receivables</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Invoices with an outstanding balance — unpaid, partially paid, or credited customers.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <ReceiptText size={16} className="text-rose-300" />
                  Open invoices
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{filtered.length}</div>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <CreditCard size={16} />
                  Total outstanding
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {totals.length > 0 ? totals.map((e) => (
                    <span key={e.currency} className="text-lg font-semibold text-white">
                      {formatCurrency(e.amount, e.currency)}
                    </span>
                  )) : <span className="text-lg font-semibold text-white">—</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Table card */}
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">{filtered.length} outstanding invoice{filtered.length !== 1 ? 's' : ''}</p>
            {canManageBranches && branches.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Branch</span>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option value="all">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loadingSales ? (
            <div className="p-8 text-slate-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <AlertCircle size={28} className="mx-auto text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No outstanding receivables</h3>
                <p className="mt-1 text-sm text-slate-400">All invoices are fully paid.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Invoice #</th>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Part</th>
                      <th className="px-6 py-3 font-medium">Sale Price</th>
                      <th className="px-6 py-3 font-medium">Paid</th>
                      <th className="px-6 py-3 font-medium">Balance Due</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      {canManageBranches && <th className="px-6 py-3 font-medium">Branch</th>}
                      <th className="px-6 py-3 font-medium">Date</th>
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
                              {getStatusLabel(sale.payment_status)}
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
                    Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-300">Page {currentPage} of {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
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
