import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, FileText, Package2, ReceiptText, Sparkles } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { generateReportPdf } from '../lib/reportPdf'
import { supabase } from '../lib/supabaseClient'

function getPaymentStatusColor(status) {
  switch (status) {
    case 'paid_in_full':
      return 'bg-emerald-500/20 text-emerald-300'
    case 'partial':
      return 'bg-amber-500/20 text-amber-300'
    case 'credit':
      return 'bg-red-500/20 text-red-300'
    case 'unpaid':
      return 'bg-slate-500/20 text-slate-300'
    default:
      return 'bg-slate-500/20 text-slate-300'
  }
}

function getPaymentStatusLabel(status) {
  switch (status) {
    case 'paid_in_full':
      return 'Paid in Full'
    case 'partial':
      return 'Partial'
    case 'credit':
      return 'Credit'
    case 'unpaid':
      return 'Unpaid'
    default:
      return status
  }
}

function Sales() {
  const { currentStaff, loading } = useAuth()
  const [sales, setSales] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchFilter, setBranchFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [searchParams] = useSearchParams()
  const invoiceQuery = searchParams.get('invoice')

  const canManageBranches = currentStaff?.role === 'company_admin'

  useEffect(() => {
    const fetchBranches = async () => {
      if (!currentStaff?.company_id) {
        setBranches([])
        setLoadingBranches(false)
        return
      }

      setLoadingBranches(true)
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('company_id', currentStaff.company_id)
        .order('name', { ascending: true })

      if (!error) {
        setBranches(data ?? [])
      } else {
        console.error('Error fetching branches:', error)
        setBranches([])
      }

      setLoadingBranches(false)
    }

    const fetchSales = async () => {
      if (!currentStaff?.company_id) {
        setSales([])
        setLoadingSales(false)
        return
      }

      setLoadingSales(true)
      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_price,
          amount_paid,
          payment_status,
          customer_id,
          customer_name,
          customer_contact,
          created_at,
          company_id,
          branch_id,
          part_id,
          sold_by,
          invoice_number,
          parts:part_id ( part_name, currency, oem_number, condition, donor_vehicle_id ),
          branches:branch_id ( name, location ),
          customers:customer_id ( full_name ),
          sold_by_staff:sold_by ( id, full_name )
        `)
        .eq('company_id', currentStaff.company_id)
        .order('created_at', { ascending: false })

      if (currentStaff?.role === 'branch_staff') {
        query = query.eq('branch_id', currentStaff.activeBranchId)
      }

      const { data, error } = await query

      if (!error) {
        setSales(data ?? [])
      } else {
        console.error('Error fetching sales:', error)
        setSales([])
      }

      setLoadingSales(false)
    }

    fetchBranches()
    fetchSales()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role])

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesBranch = branchFilter === 'all' || String(sale.branch_id) === branchFilter
      const saleDate = new Date(sale.created_at)
      const fromOk = !dateFrom || saleDate >= new Date(dateFrom)
      const toOk = !dateTo || saleDate <= new Date(`${dateTo}T23:59:59`)
      return matchesBranch && fromOk && toOk
    })
  }, [branchFilter, dateFrom, dateTo, sales])

  const pagedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredSales.slice(startIndex, startIndex + itemsPerPage)
  }, [currentPage, itemsPerPage, filteredSales])

  const selectedSale = useMemo(() => {
    if (!invoiceQuery) return null
    return sales.find((sale) => sale.invoice_number === invoiceQuery)
  }, [invoiceQuery, sales])

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / itemsPerPage))

  const handleExportPdf = () => {
    const rows = filteredSales.map((sale) => ({
      partName: sale.parts?.part_name ?? '—',
      branch: sale.branches?.name ?? '—',
      salePrice: `${sale.parts?.currency || 'AED'} ${Number(sale.sale_price || 0).toFixed(2)}`,
      customer: sale.customers?.full_name || sale.customer_name || '—',
      paymentStatus: getPaymentStatusLabel(sale.payment_status),
      date: new Date(sale.created_at).toLocaleDateString(),
      soldBy: sale.sold_by_staff?.full_name ?? '—',
      invoiceNumber: sale.invoice_number || '—',
    }))

    const columns = [
      { key: 'partName', label: 'Part', width: 2 },
      { key: 'branch', label: 'Branch', width: 2 },
      { key: 'salePrice', label: 'Sale Price', width: 1, align: 'right' },
      { key: 'customer', label: 'Customer', width: 2 },
      { key: 'paymentStatus', label: 'Payment Status', width: 1.5 },
      { key: 'date', label: 'Date', width: 1.2 },
      { key: 'soldBy', label: 'Sold By', width: 1.5 },
      { key: 'invoiceNumber', label: 'Invoice', width: 1.5 },
    ]

    generateReportPdf({
      companyName: currentStaff?.companyName || 'Auto Parts Inventory',
      reportTitle: 'Sales Report',
      columns,
      rows,
    })
  }

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [branchFilter, dateFrom, dateTo])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading sales...
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  const revenueTotal = filteredSales.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0)

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <Sparkles size={16} />
                Sales command center
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Sales History</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Review sold parts, customer details, and branch-level sales activity with a more refined operational view.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <ReceiptText size={16} className="text-cyan-300" />
                  Visible sales
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{filteredSales.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <FileText size={16} />
                  Revenue tracked
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{revenueTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Sales Records</h2>
              <p className="mt-1 text-sm text-slate-400">Filter by time range and branch to focus on the right operations.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  <CalendarRange size={15} className="text-cyan-300" />
                  <span>From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="bg-transparent text-white outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  <CalendarRange size={15} className="text-cyan-300" />
                  <span>To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="bg-transparent text-white outline-none"
                  />
                </label>
              </div>
              {canManageBranches ? (
                <select
                  value={branchFilter}
                  onChange={(event) => setBranchFilter(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white outline-none"
                >
                  <option value="all">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/invoices/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <Package2 size={18} />
                Create Invoice
              </Link>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                <FileText size={18} />
                Export PDF
              </button>
            </div>
          </div>

          {loadingSales ? (
            <div className="p-8 text-slate-400">Loading sales...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No sales found for the selected scope.</div>
          ) : (
            <>
              {invoiceQuery ? (
                <div className="border-b border-white/10 px-6 py-5">
                  {selectedSale ? (
                    <div className="rounded-[28px] border border-cyan-400/20 bg-slate-950/70 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Selected Invoice</p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">{selectedSale.invoice_number}</h3>
                          <p className="mt-1 text-sm text-slate-400">Viewing the sale record for this invoice.</p>
                        </div>
                        <Link
                          to="/sales"
                          className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
                        >
                          Clear selection
                        </Link>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Customer</p>
                          <p className="mt-2 text-sm text-slate-200">{selectedSale.customers?.full_name || selectedSale.customer_name || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Date</p>
                          <p className="mt-2 text-sm text-slate-200">{new Date(selectedSale.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
                          <p className="mt-2 text-sm text-slate-200">{getPaymentStatusLabel(selectedSale.payment_status)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 text-slate-300">
                      <p className="text-sm font-semibold text-white">No invoice found</p>
                      <p className="mt-2 text-sm">Invoice query <span className="font-mono text-cyan-300">{invoiceQuery}</span> did not match any sale records.</p>
                      <Link to="/sales" className="mt-4 inline-flex rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                        Back to full sales list
                      </Link>
                    </div>
                  )}
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Part</th>
                      <th className="px-6 py-3 font-medium">Branch</th>
                      <th className="px-6 py-3 font-medium">Sale Price</th>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Payment Status</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Sold By</th>
                      <th className="px-6 py-3 font-medium">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-900/50">
                    {pagedSales.map((sale) => (
                      <tr key={sale.id} className="align-middle transition hover:bg-slate-800/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                              <Package2 size={16} />
                            </div>
                            <div className="font-medium text-white">{sale.parts?.part_name ?? '—'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{sale.branches?.name ?? '—'}</td>
                        <td className="px-6 py-4 font-semibold text-white">{`${sale.parts?.currency || 'AED'} ${Number(sale.sale_price).toFixed(2)}`}</td>
                        <td className="px-6 py-4 text-slate-300">{sale.customers?.full_name || sale.customer_name || 'Walk-in Customer'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentStatusColor(sale.payment_status)}`}>
                            {getPaymentStatusLabel(sale.payment_status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{new Date(sale.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-slate-300">{sale.sold_by_staff?.id ?? '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            {sale.invoice_number ? (
                              <Link
                                to={`/invoices/${encodeURIComponent(sale.invoice_number)}`}
                                className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200 hover:underline"
                              >
                                {sale.invoice_number}
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                            <button
                              type="button"
                              onClick={() => downloadInvoicePdf({
                                supabaseClient: supabase,
                                companyId: sale.company_id,
                                branchId: sale.branch_id,
                                partId: sale.part_id,
                                sale,
                              })}
                              className="rounded-xl bg-amber-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-amber-400"
                            >
                              Download Invoice
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 ? (
                <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredSales.length)} of {filteredSales.length} sales
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-300">Page {currentPage} of {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default Sales
