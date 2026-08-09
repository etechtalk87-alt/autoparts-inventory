import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Download, Home, ReceiptText, Share2 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { downloadInvoicePdf, shareInvoicePdf } from '../lib/invoicePdf'
import { supabase } from '../lib/supabaseClient'

function getPaymentMethodDisplay(method) {
  const map = {
    cash: { icon: '💵', label: 'Cash' },
    bank_transfer: { icon: '🏦', label: 'Bank Transfer' },
    card: { icon: '💳', label: 'Card' },
    online: { icon: '📱', label: 'Online' },
    invoice_payment: { icon: '🧾', label: 'Invoice Payment' },
  }
  return map[method] || { icon: '💰', label: method || 'Cash' }
}

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

function getInvoiceStatusLabel(status, t) {
  switch (status) {
    case 'paid':
    case 'paid_in_full':
      return t('sales.statusPaidInFull')
    case 'partial':
      return t('sales.statusPartial')
    case 'credit':
      return t('sales.statusCredit')
    case 'unpaid':
      return t('sales.statusUnpaid')
    default:
      return status || '—'
  }
}

function InvoiceDetail() {
  const { currentStaff, loading } = useAuth()
  const { t } = useTranslation()
  const { invoiceNumber } = useParams()
  const [sale, setSale] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [isMultiItem, setIsMultiItem] = useState(false)
  const [loadingSale, setLoadingSale] = useState(true)
  const [error, setError] = useState('')
  const [paymentHistory, setPaymentHistory] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [refundHistory, setRefundHistory] = useState([])
  const [loadingRefunds, setLoadingRefunds] = useState(true)
  const [sharing, setSharing] = useState(false)

  const handleShare = async () => {
    setSharing(true)
    try {
      await shareInvoicePdf({
        supabaseClient: supabase,
        companyId: invoiceDisplay?.company_id || sale?.company_id,
        branchId: invoiceDisplay?.branch_id || sale?.branch_id,
        partId: isMultiItem ? invoiceDisplay?.lineItems?.[0]?.part_id : sale?.part_id,
        sale: isMultiItem ? invoiceDisplay?.lineItems?.[0] : sale,
      })
    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      setSharing(false)
    }
  }

  const formatPartDisplay = () => {
    if (!isMultiItem) {
      return sale?.parts?.part_name || '–'
    }

    const lineItems = invoice?.lineItems || []
    if (lineItems.length === 0) {
      return t('invoiceDetail.noItems')
    }

    const names = lineItems
      .slice(0, 3)
      .map((item) => item.parts?.part_name || 'Part')

    return names.join(', ') + (lineItems.length > 3 ? ` ${t('invoiceDetail.moreItems', { count: lineItems.length - 3 })}` : '')
  }

  useEffect(() => {
    const fetchSale = async () => {
      if (!currentStaff?.company_id || !invoiceNumber) {
        setSale(null)
        setInvoice(null)
        setIsMultiItem(false)
        setLoadingSale(false)
        return
      }

      setLoadingSale(true)
      const invoiceParam = decodeURIComponent(invoiceNumber || '').trim()

      const { data: invoiceRow, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_number, payment_status, amount_paid, currency, total_amount, subtotal, vat_amount, created_at, customer_id, branch_id, company_id')
        .eq('company_id', currentStaff.company_id)
        .eq('invoice_number', invoiceParam)
        .maybeSingle()

      if (invoiceError) {
        console.error('Error fetching invoice row:', invoiceError)
        setError(invoiceError.message || 'Unable to load invoice details.')
        setSale(null)
        setInvoice(null)
        setIsMultiItem(false)
        setLoadingSale(false)
        return
      }

      if (invoiceRow) {
        const { data: salesRows, error: salesRowsError } = await supabase
          .from('sales')
          .select(`
            id,
            invoice_id,
            sale_price,
            amount_paid,
            payment_status,
            customer_id,
            customer_name,
            customer_contact,
            created_at,
            branch_id,
            company_id,
            part_id,
            sold_by,
            invoice_number,
            parts:part_id ( part_name, oem_number, condition, currency )
          `)
          .eq('invoice_id', invoiceRow.id)

        if (salesRowsError) {
          console.error('Error fetching invoice sales rows:', salesRowsError)
          setError(salesRowsError.message || 'Unable to load invoice line items.')
          setSale(null)
          setInvoice(null)
          setIsMultiItem(false)
          setLoadingSale(false)
          return
        }

        if (!Array.isArray(salesRows) || salesRows.length === 0) {
          setError('Invoice line items not found.')
          setSale(null)
          setInvoice(null)
          setIsMultiItem(false)
          setLoadingSale(false)
          return
        }

        const [customerResult, branchResult] = await Promise.all([
          supabase
            .from('customers')
            .select('full_name, phone, email, address')
            .eq('id', invoiceRow.customer_id)
            .maybeSingle(),
          supabase
            .from('branches')
            .select('name, location')
            .eq('id', invoiceRow.branch_id)
            .maybeSingle(),
        ])

        setInvoice({
          ...invoiceRow,
          lineItems: salesRows,
          currency: invoiceRow.currency || salesRows[0]?.parts?.currency || 'AED',
          customers: customerResult.data || null,
          branches: branchResult.data || null,
        })
        setSale(null)
        setIsMultiItem(true)
        setError('')
        setLoadingSale(false)
        return
      }

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
        setInvoice(null)
        setIsMultiItem(false)
        setLoadingSale(false)
        return
      }

      if (!data) {
        setError('Invoice not found.')
        setSale(null)
        setInvoice(null)
        setIsMultiItem(false)
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
      setInvoice(null)
      setIsMultiItem(false)
      setError('')
      setLoadingSale(false)
    }

    fetchSale()
  }, [currentStaff?.company_id, invoiceNumber])

  useEffect(() => {
    const fetchPayments = async () => {
      const saleIds = isMultiItem ? invoice?.lineItems?.map((item) => item.id) : [sale?.id].filter(Boolean)

      if (!currentStaff?.company_id || saleIds.length === 0) {
        setPaymentHistory([])
        setLoadingPayments(false)
        return
      }

      setLoadingPayments(true)
      let query = supabase
        .from('payments')
        .select('id, amount, currency, payment_method, payment_date, notes, recorded_by, staff:recorded_by ( full_name )')
        .eq('company_id', currentStaff.company_id)

      if (isMultiItem) {
        query = query.in('sale_id', saleIds)
      } else {
        query = query.eq('sale_id', saleIds[0])
      }

      const { data, error: paymentsError } = await query
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
  }, [currentStaff?.company_id, isMultiItem, invoice?.lineItems, sale?.id])

  useEffect(() => {
    const fetchRefunds = async () => {
      const saleIds = isMultiItem ? invoice?.lineItems?.map((item) => item.id) : [sale?.id].filter(Boolean)

      if (!currentStaff?.company_id || saleIds.length === 0) {
        setRefundHistory([])
        setLoadingRefunds(false)
        return
      }

      setLoadingRefunds(true)
      let query = supabase
        .from('refunds')
        .select('id, amount, currency, reason, part_condition_on_return, created_at, processed_by, staff:processed_by ( full_name )')
        .eq('company_id', currentStaff.company_id)

      if (isMultiItem) {
        query = query.in('sale_id', saleIds)
      } else {
        query = query.eq('sale_id', saleIds[0])
      }

      const { data, error: refundsError } = await query.order('created_at', { ascending: false })

      if (!refundsError) {
        setRefundHistory(data || [])
      } else {
        console.error('Error fetching invoice refunds:', refundsError)
        setRefundHistory([])
      }
      setLoadingRefunds(false)
    }

    fetchRefunds()
  }, [currentStaff?.company_id, isMultiItem, invoice?.lineItems, sale?.id])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {t('invoiceDetail.loadingInvoice')}
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
          {t('invoiceDetail.loadingInvoice')}
        </div>
      </main>
    )
  }

  if (error || (!sale && !invoice)) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-slate-900/70 p-8 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-sm font-medium text-rose-200">
              <ReceiptText size={16} />
              {t('invoiceDetail.invoiceNotFound')}
            </div>
            <h1 className="text-3xl font-semibold text-white">{t('invoiceDetail.invoiceNotFound')}</h1>
            <p className="text-sm text-slate-400">{t('invoiceDetail.couldNotLocate', { invoiceNumber })}</p>
            <p className="text-sm text-slate-400">{error || t('invoiceDetail.verifyAndRetry')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/sales" className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">{t('invoiceDetail.backToSales')}</Link>
              <Link to="/customers" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">{t('invoiceDetail.customerList')}</Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const invoiceDisplay = isMultiItem ? invoice : sale
  const invoiceAmount = Number(invoiceDisplay?.sale_price || invoiceDisplay?.total_amount || 0)
  const invoicePaid = Number(invoiceDisplay?.amount_paid || 0)
  const remaining = invoiceAmount - invoicePaid

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <ReceiptText size={16} />
                {t('invoiceDetail.invoiceDetailBadge')}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">{invoiceDisplay?.invoice_number}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">{t('invoiceDetail.invoiceSummaryDesc')}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/sales" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">
                  {t('invoiceDetail.backToSales')}
                </Link>
                <Link to="/customers" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">
                  {t('invoiceDetail.backToCustomers')}
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.invoiceDate')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatDate(invoiceDisplay?.created_at)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.status')}</p>
                <p className="mt-2 text-lg font-semibold text-slate-200">{getInvoiceStatusLabel(invoiceDisplay?.payment_status, t)}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadInvoicePdf({
                  supabaseClient: supabase,
                  companyId: invoiceDisplay?.company_id || sale?.company_id,
                  branchId: invoiceDisplay?.branch_id || sale?.branch_id,
                  partId: isMultiItem ? invoiceDisplay?.lineItems?.[0]?.part_id : sale?.part_id,
                  sale: isMultiItem ? invoiceDisplay?.lineItems?.[0] : sale,
                })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                <Download size={16} />
                {t('invoiceDetail.downloadInvoice')}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                <Share2 size={16} />
                {sharing ? t('invoiceDetail.sharing') : t('invoiceDetail.share')}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">{t('invoiceDetail.paymentSummary')}</h2>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.totalAmount')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(invoiceAmount, invoiceDisplay?.currency || sale?.parts?.currency)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.amountPaid')}</p>
                <p className="mt-2 text-lg font-semibold text-emerald-300">{formatCurrency(invoicePaid, invoiceDisplay?.currency || sale?.parts?.currency)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.remainingBalance')}</p>
                <p className="mt-2 text-lg font-semibold text-rose-400">{formatCurrency(remaining, invoiceDisplay?.currency || sale?.parts?.currency)}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">{t('invoiceDetail.invoiceDetails')}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.customer')}</p>
                <p className="mt-2 text-sm text-slate-200">{invoiceDisplay?.customers?.full_name || invoiceDisplay?.customer_name || sale?.customers?.full_name || sale?.customer_name || t('invoiceDetail.walkInCustomer')}</p>
                {invoiceDisplay?.customers?.email ? <p className="mt-1 text-sm text-slate-400">{invoiceDisplay.customers.email}</p> : null}
                {invoiceDisplay?.customers?.phone ? <p className="mt-1 text-sm text-slate-400">{invoiceDisplay.customers.phone}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.branch')}</p>
                <p className="mt-2 text-sm text-slate-200">{invoice?.branches?.name || sale?.branches?.name || '–'}</p>
                {(invoice?.branches?.location || sale?.branches?.location) ? <p className="mt-1 text-sm text-slate-400">{invoice?.branches?.location || sale?.branches?.location}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.part')}</p>
                <p className="mt-2 text-sm text-slate-200">{formatPartDisplay()}</p>
                {!isMultiItem && sale?.parts?.oem_number ? <p className="mt-1 text-sm text-slate-400">{sale.parts.oem_number}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.soldBy')}</p>
                <p className="mt-2 text-sm text-slate-200">{isMultiItem ? '–' : (sale?.sold_by_staff?.full_name || sale?.sold_by || '–')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{t('invoiceDetail.paymentHistory')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('invoiceDetail.paymentHistoryDesc')}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-300">
              {paymentHistory.length} {paymentHistory.length === 1 ? t('invoiceDetail.paymentSingular') : t('invoiceDetail.paymentPlural')}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {loadingPayments ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-slate-400">{t('invoiceDetail.loadingPaymentHistory')}</div>
            ) : paymentHistory.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-6 text-slate-400">{t('invoiceDetail.noPaymentsRecorded')}</div>
            ) : (
              <div className="grid gap-4">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.7)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.date')}</p>
                        <p className="text-lg font-semibold text-white">{formatDate(payment.payment_date)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.amount')}</p>
                        <p className="text-lg font-semibold text-emerald-300">{formatCurrency(payment.amount, payment.currency)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.method')}</p>
                        <p className="text-sm text-slate-200">{(() => {
                          const { icon, label } = getPaymentMethodDisplay(payment.payment_method)
                          return `${icon} ${label}`
                        })()}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.notes')}</p>
                        <p className="mt-2 text-sm text-slate-300">{payment.notes || '—'}</p>
                      </div>
                      {payment.recorded_by ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.recordedBy')}</p>
                          <p className="mt-2 text-sm text-slate-300">{payment.staff?.full_name || t('invoiceDetail.staffMember')}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        {refundHistory.length > 0 && (
          <section className="rounded-[28px] border border-rose-500/20 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t('invoiceDetail.refundHistory')}</h2>
                <p className="mt-1 text-sm text-slate-400">{t('invoiceDetail.refundHistoryDesc')}</p>
              </div>
              <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
                {refundHistory.length} {refundHistory.length === 1 ? t('invoiceDetail.refundSingular') : t('invoiceDetail.refundPlural')}
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {refundHistory.map((refund) => (
                <div key={refund.id} className="rounded-3xl border border-rose-500/20 bg-slate-950/70 p-5 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.7)]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.date')}</p>
                      <p className="text-lg font-semibold text-white">{formatDate(refund.created_at)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.amount')}</p>
                      <p className="text-lg font-semibold text-rose-400">-{formatCurrency(refund.amount, refund.currency)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.partCondition')}</p>
                      <p className="text-sm text-slate-200">
                        {refund.part_condition_on_return === 'resellable' ? t('invoiceDetail.resellable') : t('invoiceDetail.damaged')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.reason')}</p>
                      <p className="mt-2 text-sm text-slate-300">{refund.reason || '—'}</p>
                    </div>
                    {refund.processed_by ? (
                      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('invoiceDetail.processedBy')}</p>
                        <p className="mt-2 text-sm text-slate-300">{refund.staff?.full_name || t('invoiceDetail.staffMember')}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default InvoiceDetail
