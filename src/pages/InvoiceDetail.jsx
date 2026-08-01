import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Download, Home, ReceiptText } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { supabase } from '../lib/supabaseClient'

function formatCurrency(amount, currency = 'AED') {
  const value = Number(amount || 0)
  return `${currency} ${value.toFixed(2)}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).format(date)
}

function InvoiceDetail() {
  const { currentStaff, loading } = useAuth()
  const { invoiceNumber } = useParams()
  const [sale, setSale] = useState(null)
  const [loadingSale, setLoadingSale] = useState(true)
  const [error, setError] = useState('')
  const [paymentHistory, setPaymentHistory] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(true)

  useEffect(() => {
    const fetchSale = async () => {
      if (!currentStaff?.company_id || !invoiceNumber) {
        setSale(null)
        setLoadingSale(false)
        return
      }

      setLoadingSale(true)
      const invoiceParam = decodeURIComponent(invoiceNumber || '').trim()

      let { data, error: fetchError } = await supabase
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
          invoice_number
        `)
        .eq('company_id', currentStaff.company_id)
        .eq('invoice_number', invoiceParam)
        .maybeSingle()

      if (!fetchError && !data) {
        const fallback = await supabase
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
            invoice_number
          `)
          .eq('company_id', currentStaff.company_id)
          .ilike('invoice_number', invoiceParam)
          .maybeSingle()

        data = fallback.data
        fetchError = fallback.error
      }

      if (fetchError) {
        console.error('Error fetching invoice detail:', fetchError)
        setError(fetchError.message || 'Unable to load invoice details.')
        setSale(null)
        setLoadingSale(false)
        return
      }

      if (!data) {
        setError('Invoice not found.')
        setSale(null)
        setLoadingSale(false)
        return
      }

      const [customerResult, branchResult, partResult] = await Promise.all([
        supabase
          .from('customers')
          .select('full_name, phone, email, address')
          .eq('id', data.customer_id)
          .maybeSingle(),
        supabase
          .from('branches')
          .select('name, location')
          .eq('id', data.branch_id)
          .maybeSingle(),
        supabase
          .from('parts')
          .select('part_name, currency, oem_number, condition, donor_vehicle_id')
          .eq('id', data.part_id)
          .maybeSingle(),
      ])

      setSale({
        ...data,
        customers: customerResult.data || null,
        branches: branchResult.data || null,
        parts: partResult.data || null,
      })
      setError('')
      setLoadingSale(false)
    }

    fetchSale()
  }, [currentStaff?.company_id, invoiceNumber])

  useEffect(() => {
    const fetchPayments = async () => {
      if (!currentStaff?.company_id || !sale?.id) {
        setPaymentHistory([])
        setLoadingPayments(false)
        return
      }

      setLoadingPayments(true)
      const { data, error: paymentsError } = await supabase
        .from('payments')
        .select('id, amount, currency, payment_method, payment_date, notes, recorded_by')
        .eq('company_id', currentStaff.company_id)
        .eq('sale_id', sale.id)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (!paymentsError) {
        setPaymentHistory(data || [])
      } else {
        console.error('Error fetching invoice payments:', paymentsError)
        setPaymentHistory([])
      }
      setLoadingPayments(false)
    }

    fetchPayments()
  }, [currentStaff?.company_id, sale?.id])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading invoice details...
        </div>
      </main>
    )
  }

  if (!currentStaff) {
    return <Navigate to="/login" replace />
  }

  if (loadingSale) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading invoice details...
        </div>
      </main>
    )
  }

  if (error || !sale) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-slate-900/70 p-8 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-sm font-medium text-rose-200">
              <ReceiptText size={16} />
              Invoice not found
            </div>
            <h1 className="text-3xl font-semibold text-white">Invoice not found</h1>
            <p className="text-sm text-slate-400">We could not locate an invoice with number <span className="font-mono text-cyan-300">{invoiceNumber}</span>.</p>
            <p className="text-sm text-slate-400">{error || 'Please verify the invoice number and try again.'}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/sales" className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">Back to Sales</Link>
              <Link to="/customers" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">Customer list</Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const remaining = Number(sale.sale_price || 0) - Number(sale.amount_paid || 0)

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <ReceiptText size={16} />
                Invoice detail
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">{sale.invoice_number}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">Invoice summary, payment progress, and customer information for this sale.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/sales" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">
                  Back to Sales
                </Link>
                <Link to="/customers" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">
                  Back to Customers
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Invoice Date</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatDate(sale.created_at)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-200">{sale.payment_status || '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadInvoicePdf({
                  supabaseClient: supabase,
                  companyId: sale.company_id,
                  branchId: sale.branch_id,
                  partId: sale.part_id,
                  sale,
                })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                <Download size={16} />
                Download Invoice
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Payment summary</h2>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total amount</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(sale.sale_price, sale.parts?.currency)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Amount paid</p>
                <p className="mt-2 text-lg font-semibold text-emerald-300">{formatCurrency(sale.amount_paid, sale.parts?.currency)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Remaining balance</p>
                <p className="mt-2 text-lg font-semibold text-rose-400">{formatCurrency(remaining, sale.parts?.currency)}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Invoice details</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Customer</p>
                <p className="mt-2 text-sm text-slate-200">{sale.customers?.full_name || sale.customer_name || '–'}</p>
                {sale.customers?.email ? <p className="mt-1 text-sm text-slate-400">{sale.customers.email}</p> : null}
                {sale.customers?.phone ? <p className="mt-1 text-sm text-slate-400">{sale.customers.phone}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Branch</p>
                <p className="mt-2 text-sm text-slate-200">{sale.branches?.name || '–'}</p>
                {sale.branches?.location ? <p className="mt-1 text-sm text-slate-400">{sale.branches.location}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Part</p>
                <p className="mt-2 text-sm text-slate-200">{sale.parts?.part_name || '–'}</p>
                {sale.parts?.oem_number ? <p className="mt-1 text-sm text-slate-400">{sale.parts.oem_number}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sold by</p>
                <p className="mt-2 text-sm text-slate-200">{sale.sold_by_staff?.full_name || sale.sold_by || '–'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Payment history</h2>
              <p className="mt-1 text-sm text-slate-400">Track payments applied to this invoice, including partial payments and references.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-300">
              {paymentHistory.length} payment{paymentHistory.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {loadingPayments ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-slate-400">Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-6 text-slate-400">No payments have been recorded for this invoice yet.</div>
            ) : (
              <div className="grid gap-4">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.7)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Date</p>
                        <p className="text-lg font-semibold text-white">{formatDate(payment.payment_date)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Amount</p>
                        <p className="text-lg font-semibold text-emerald-300">{formatCurrency(payment.amount, payment.currency)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Method</p>
                        <p className="text-sm text-slate-200">{payment.payment_method?.replace('_', ' ') || 'Cash'}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Notes</p>
                        <p className="mt-2 text-sm text-slate-300">{payment.notes || '—'}</p>
                      </div>
                      {payment.recorded_by ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recorded by</p>
                          <p className="mt-2 text-sm text-slate-300">{payment.recorded_by}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default InvoiceDetail
