import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { downloadInvoicePdf } from '../lib/invoicePdf'
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
          sold_by_staff:sold_by ( id )
        `)
        .eq('company_id', currentStaff.company_id)
        .order('created_at', { ascending: false })

      if (currentStaff?.role === 'branch_staff') {
        query = query.eq('branch_id', currentStaff.branch_id)
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
  }, [currentStaff?.company_id, currentStaff?.branch_id, currentStaff?.role])

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesBranch = branchFilter === 'all' || String(sale.branch_id) === branchFilter
      const saleDate = new Date(sale.created_at)
      const fromOk = !dateFrom || saleDate >= new Date(dateFrom)
      const toOk = !dateTo || saleDate <= new Date(`${dateTo}T23:59:59`)
      return matchesBranch && fromOk && toOk
    })
  }, [branchFilter, dateFrom, dateTo, sales])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h1 className="text-3xl font-semibold">Sales History</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review sold parts, customer details, and branch-level sales activity.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 border-b border-slate-800 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">Sales Records</h2>
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="text-sm text-slate-300">
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="text-sm text-slate-300">
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                />
              </label>
              {canManageBranches ? (
                <select
                  value={branchFilter}
                  onChange={(event) => setBranchFilter(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                >
                  <option value="all">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          {loadingSales ? (
            <div className="p-6 text-slate-400">Loading sales...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-6 text-slate-400">No sales found for the selected scope.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
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
                <tbody className="divide-y divide-slate-800 bg-slate-900/70">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="align-middle">
                      <td className="px-6 py-4">{sale.parts?.part_name ?? '—'}</td>
                      <td className="px-6 py-4">{sale.branches?.name ?? '—'}</td>
                      <td className="px-6 py-4">{`${sale.parts?.currency || 'AED'} ${Number(sale.sale_price).toFixed(2)}`}</td>
                      <td className="px-6 py-4">{sale.customers?.full_name || sale.customer_name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getPaymentStatusColor(sale.payment_status)}`}>
                          {getPaymentStatusLabel(sale.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{new Date(sale.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{sale.sold_by_staff?.id ?? '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-slate-400">{sale.invoice_number || '—'}</span>
                          <button
                            type="button"
                            onClick={() => downloadInvoicePdf({
                              supabaseClient: supabase,
                              companyId: sale.company_id,
                              branchId: sale.branch_id,
                              partId: sale.part_id,
                              sale,
                            })}
                            className="rounded-lg bg-amber-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-amber-400"
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
          )}
        </div>
      </div>
    </main>
  )
}

export default Sales
