import { useEffect, useMemo, useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, CreditCard, ReceiptText, UsersRound, Wallet2 } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
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

// Standard country list
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic',
  'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic', 'Czechia', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador',
  'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
  'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova',
  'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
  'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
  'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
  'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
]

function Customers() {
  const { currentStaff, loading } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    country: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')

  // Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    currency: 'AED',
    payment_method: 'cash',
    sale_id: '',
    notes: ''
  })
  const [unpaidSales, setUnpaidSales] = useState([])
  const [invoiceTotals, setInvoiceTotals] = useState({})
  const [loadingUnpaidSales, setLoadingUnpaidSales] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const canManageCustomers = currentStaff?.role === 'company_admin'
  const { t } = useTranslation()

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date)
  }

  const formatCurrency = (amount, currency = 'AED') => {
    const value = Number(amount || 0)
    return `${currency} ${value.toFixed(2)}`
  }

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!currentStaff?.company_id) {
        setCustomers([])
        setLoadingCustomers(false)
        return
      }

      setLoadingCustomers(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentStaff.company_id)
        .order('full_name', { ascending: true })

      if (!error) {
        setCustomers(data ?? [])
      } else {
        console.error('Error fetching customers:', error)
        setCustomers([])
      }

      setLoadingCustomers(false)
    }

    fetchCustomers()
  }, [currentStaff?.company_id])

  // Calculate outstanding balance for a customer grouped by currency
  const getOutstandingBalance = useMemo(() => {
    return async (customerId) => {
      if (!currentStaff?.company_id) return {}

      // Get sum of unpaid sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('sale_price, amount_paid, parts!inner(currency)')
        .eq('company_id', currentStaff.company_id)
        .eq('customer_id', customerId)
        .in('payment_status', ['partial', 'credit'])

      const totals = {}
      if (!salesError && sales) {
        sales.forEach((sale) => {
          // If a part exists, use its currency; else fallback to AED
          const c = (sale.parts && sale.parts.currency) ? sale.parts.currency : 'AED'
          const owed = Number(sale.sale_price || 0) - Number(sale.amount_paid || 0)
          totals[c] = (totals[c] || 0) + owed
        })
      }

      // Subtract additional payments not tied to a sale
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, currency')
        .eq('company_id', currentStaff.company_id)
        .eq('customer_id', customerId)
        .is('sale_id', null)
        .is('invoice_id', null)

      if (!paymentsError && payments) {
        payments.forEach((p) => {
          const c = p.currency || 'AED'
          totals[c] = (totals[c] || 0) - Number(p.amount || 0)
        })
      }

      // Format correctly, ignoring zero or negative balances unless necessary
      Object.keys(totals).forEach(c => {
        if (totals[c] < 0) totals[c] = 0
      })

      return totals
    }
  }, [currentStaff?.company_id])

  const [outstandingBalances, setOutstandingBalances] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  const visibleCustomers = useMemo(() => customers, [customers])
  const pagedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return visibleCustomers.slice(startIndex, startIndex + itemsPerPage)
  }, [currentPage, itemsPerPage, visibleCustomers])
  const totalPages = Math.max(1, Math.ceil(visibleCustomers.length / itemsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const fetchBalances = async () => {
    const balances = {}
    for (const customer of customers) {
      balances[customer.id] = await getOutstandingBalance(customer.id)
    }
    setOutstandingBalances(balances)
  }

  useEffect(() => {
    if (customers.length > 0) {
      fetchBalances()
    }
  }, [customers, getOutstandingBalance])

  const handleAddCustomer = async (e) => {
    e.preventDefault()

    if (!form.full_name.trim()) {
      setMessage(t('customers.fullNameRequired'))
      setMessageType('error')
      return
    }

    setSubmitting(true)
    setMessage('')

    if (editingId) {
      const { data: updateData, error } = await supabase
        .from('customers')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          country: form.country,
          notes: form.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .select('id')

      if (error) {
        setMessage(error.message)
        setMessageType('error')
      } else if (!updateData || updateData.length === 0) {
        setMessage(t('customers.updateFailedPermission'))
        setMessageType('error')
      } else {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  full_name: form.full_name,
                  phone: form.phone,
                  email: form.email,
                  address: form.address,
                  country: form.country,
                  notes: form.notes,
                }
              : c
          )
        )
        setMessage(t('customers.customerUpdated'))
        setMessageType('success')
        setEditingId(null)
        resetForm()
        setTimeout(() => setShowAddModal(false), 1500)
      }
    } else {
      const { error } = await supabase.from('customers').insert([
        {
          company_id: currentStaff.company_id,
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          country: form.country,
          notes: form.notes,
        },
      ])

      if (error) {
        setMessage(error.message)
        setMessageType('error')
      } else {
        setMessage(t('customers.customerAdded'))
        setMessageType('success')
        resetForm()
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', currentStaff.company_id)
          .order('full_name', { ascending: true })
        if (data) {
          setCustomers(data)
        }
        setTimeout(() => setShowAddModal(false), 1500)
      }
    }

    setSubmitting(false)
  }

  const openEditModal = (customer) => {
    setForm({
      full_name: customer.full_name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      country: customer.country || '',
      notes: customer.notes || '',
    })
    setEditingId(customer.id)
    setShowAddModal(true)
    setMessage('')
  }

  const resetForm = () => {
    setForm({
      full_name: '',
      phone: '',
      email: '',
      address: '',
      country: '',
      notes: '',
    })
    setEditingId(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowAddModal(true)
    setMessage('')
  }

  const fetchPaymentHistory = async (customerId) => {
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, currency, payment_method, payment_date, notes, sales(invoice_number)')
      .eq('company_id', currentStaff.company_id)
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      
    if (!error) {
      setPaymentHistory(data || [])
    } else {
      setPaymentHistory([])
    }
    setLoadingHistory(false)
  }

  const openHistoryModal = (customer) => {
    setHistoryCustomer(customer)
    setShowHistoryModal(true)
    fetchPaymentHistory(customer.id)
  }

  const closeHistoryModal = () => {
    setShowHistoryModal(false)
    setHistoryCustomer(null)
    setPaymentHistory([])
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setUnpaidSales([])
    setInvoiceTotals({})
    setPaymentForm({
      amount: '',
      currency: 'AED',
      payment_method: 'cash',
      sale_id: '',
      notes: ''
    })
    setMessage('')
  }

  const openPaymentModal = async (customer) => {
    setPaymentCustomer(customer)
    setMessage('')
    setShowPaymentModal(true)
    
    let defaultCurrency = 'AED'
    const balances = outstandingBalances[customer.id]
    if (balances && Object.keys(balances).length > 0) {
      // Find the currency with the highest balance to default to
      const highest = Object.keys(balances).reduce((a, b) => balances[a] > balances[b] ? a : b)
      defaultCurrency = highest
    }

    setPaymentForm({
      amount: '',
      currency: defaultCurrency,
      payment_method: 'cash',
      sale_id: '',
      notes: ''
    })

    setLoadingUnpaidSales(true)
    const { data, error } = await supabase
      .from('sales')
      .select('id, invoice_id, invoice_number, sale_price, amount_paid, payment_status, created_at, parts(currency, part_name)')
      .eq('company_id', currentStaff.company_id)
      .eq('customer_id', customer.id)
      .in('payment_status', ['partial', 'credit'])
      .order('created_at', { ascending: false })
      
    if (!error) {
      const distinctInvoiceIds = [...new Set(
        (data || []).map(row => row.invoice_id).filter(Boolean)
      )]

      let invoiceTotalsMap = {}
      if (distinctInvoiceIds.length > 0) {
        const { data: invoiceRows } = await supabase
          .from('invoices')
          .select('id, total_amount, amount_paid, currency')
          .in('id', distinctInvoiceIds)

        invoiceTotalsMap = Object.fromEntries(
          (invoiceRows || []).map(inv => [inv.id, inv])
        )
      }

      setInvoiceTotals(invoiceTotalsMap)
      setUnpaidSales(data || [])
    } else {
      setInvoiceTotals({})
      setUnpaidSales([])
    }
    setLoadingUnpaidSales(false)
  }

  const groupedUnpaidSales = useMemo(() => {
    const groups = {}
    unpaidSales.forEach((row) => {
      const key = String(row.invoice_id || row.id)
      if (!groups[key]) {
        const realInvoice = row.invoice_id ? invoiceTotals[row.invoice_id] : null
        groups[key] = {
          key,
          invoiceId: row.invoice_id || null,
          invoiceNumber: row.invoice_number,
          currency: realInvoice?.currency || row.parts?.currency || 'AED',
          totalPrice: realInvoice ? Number(realInvoice.total_amount) : 0,
          totalPaid: realInvoice ? Number(realInvoice.amount_paid) : 0,
          usingRealInvoiceTotals: Boolean(realInvoice),
          rows: [],
        }
      }
      if (!groups[key].usingRealInvoiceTotals) {
        groups[key].totalPrice += Number(row.sale_price || 0)
        groups[key].totalPaid += Number(row.amount_paid || 0)
      }
      groups[key].rows.push(row)
    })
    return Object.values(groups)
  }, [unpaidSales, invoiceTotals])

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    const amount = Number(paymentForm.amount)
    if (amount <= 0) {
      setMessage(t('customers.amountMustBeGreaterThanZero'))
      setMessageType('error')
      setSubmitting(false)
      return
    }

    if (paymentForm.sale_id) {
      const group = groupedUnpaidSales.find((g) => String(g.key) === String(paymentForm.sale_id))
      if (!group) {
        setMessage(t('customers.invalidInvoiceGroup'))
        setMessageType('error')
        setSubmitting(false)
        return
      }

      const groupRemaining = Number(group.totalPrice || 0) - Number(group.totalPaid || 0)
      if (amount > groupRemaining) {
        setMessage(t('customers.amountExceedsBalance', { currency: group.currency, amount: groupRemaining.toFixed(2) }))
        setMessageType('error')
        setSubmitting(false)
        return
      }

      const rowsWithRemaining = group.rows
        .map((r) => ({
          ...r,
          remaining: Number(r.sale_price || 0) - Number(r.amount_paid || 0)
        }))
        .filter((r) => r.remaining > 0)

      const totalRemaining = rowsWithRemaining.reduce((sum, r) => sum + r.remaining, 0)

      const distributions = rowsWithRemaining.map((r) => ({
        ...r,
        paidNow: totalRemaining > 0 ? Number((amount * (r.remaining / totalRemaining)).toFixed(2)) : 0
      }))

      const totalAssigned = distributions.reduce((sum, d) => sum + d.paidNow, 0)
      const roundingDiff = Number((amount - totalAssigned).toFixed(2))
      if (roundingDiff !== 0 && distributions.length > 0) {
        distributions[distributions.length - 1].paidNow = Number(
          (distributions[distributions.length - 1].paidNow + roundingDiff).toFixed(2)
        )
      }

      const paymentEntries = distributions.map((d) => ({
        company_id: currentStaff.company_id,
        customer_id: paymentCustomer.id,
        sale_id: d.id,
        invoice_id: group.invoiceId || null,
        amount: d.paidNow,
        currency: paymentForm.currency,
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes
          ? `Payment for ${d.parts?.part_name || 'item'} — ${paymentForm.notes}`
          : `Payment for ${d.parts?.part_name || 'item'}`,
        recorded_by: currentStaff.id,
        payment_date: new Date().toISOString().split('T')[0],
      }))

      const { error: insertError } = await supabase.from('payments').insert(paymentEntries)
      if (insertError) {
        setMessage(insertError.message)
        setMessageType('error')
        setSubmitting(false)
        return
      }

      for (const d of distributions) {
        const newPaid = Number(d.amount_paid || 0) + d.paidNow
        const newStatus = newPaid >= Number(d.sale_price) ? 'paid' : 'partial'

        const { error: updateError } = await supabase
          .from('sales')
          .update({ amount_paid: newPaid, payment_status: newStatus })
          .eq('id', d.id)

        if (updateError) {
          setMessage(t('customers.somePaymentsFailedUpdate', { error: updateError.message }))
          setMessageType('error')
          setSubmitting(false)
          return
        }
      }

      if (group.invoiceId) {
        const { data: freshInvoice, error: freshInvoiceError } = await supabase
          .from('invoices')
          .select('amount_paid, total_amount')
          .eq('id', group.invoiceId)
          .single()

        if (freshInvoiceError) {
          console.error('Failed to fetch fresh invoice totals:', freshInvoiceError)
        } else {
          const newInvoicePaid = Number(freshInvoice.amount_paid || 0) + amount
          const newInvoiceStatus = newInvoicePaid >= Number(freshInvoice.total_amount) ? 'paid' : 'partial'

          const { error: invoiceUpdateError } = await supabase
            .from('invoices')
            .update({ amount_paid: newInvoicePaid, payment_status: newInvoiceStatus })
            .eq('id', group.invoiceId)

          if (invoiceUpdateError) {
            console.error('Failed to sync invoice totals:', invoiceUpdateError)
          }
        }
      }
    } else {
      const payload = {
        company_id: currentStaff.company_id,
        customer_id: paymentCustomer.id,
        amount: amount,
        currency: paymentForm.currency,
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes || null,
        recorded_by: currentStaff.id,
        payment_date: new Date().toISOString().split('T')[0]
      }

      const { error: insertError } = await supabase.from('payments').insert([payload])
      if (insertError) {
        setMessage(insertError.message)
        setMessageType('error')
        setSubmitting(false)
        return
      }
    }

    setMessage(t('customers.paymentRecorded'))
    setMessageType('success')
    
    const newBalances = { ...outstandingBalances }
    newBalances[paymentCustomer.id] = await getOutstandingBalance(paymentCustomer.id)
    setOutstandingBalances(newBalances)
    
    if (showHistoryModal && historyCustomer?.id === paymentCustomer.id) {
      fetchPaymentHistory(paymentCustomer.id)
    }

    setTimeout(() => {
      closePaymentModal()
      setSubmitting(false)
    }, 1500)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {t('customers.loadingCustomers')}
        </div>
      </main>
    )
  }

  if (!canManageCustomers) {
    return <Navigate to="/" replace />
  }

  const totalOutstandingBalance = Object.values(outstandingBalances).reduce((sum, balanceMap) => {
    if (!balanceMap) return sum
    return sum + Object.values(balanceMap).reduce((balanceSum, amount) => balanceSum + Number(amount || 0), 0)
  }, 0)
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, visibleCustomers.length)
  const total = visibleCustomers.length

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <BadgeCheck size={16} />
                {t('customers.relationshipHub')}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('customers.title')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                {t('customers.description')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <UsersRound size={16} className="text-cyan-300" />
                  {t('customers.activeCustomers')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{customers.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <Wallet2 size={16} />
                  {t('customers.outstandingValue')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{totalOutstandingBalance.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${messageType === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-200'}`}>
            {message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            <UsersRound size={18} />
            {t('customers.addCustomer')}
          </button>
        </div>

        {loadingCustomers ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <p className="text-slate-400">{t('customers.loadingCustomers')}</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-10 text-center shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
              <UsersRound size={28} className="mx-auto text-cyan-300" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">{t('customers.noCustomersYet')}</h2>
            <p className="mt-2 text-sm text-slate-400">{t('customers.addFirstCustomer')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">{t('customers.colCustomer')}</th>
                    <th className="px-6 py-3 font-medium">{t('customers.colPhone')}</th>
                    <th className="px-6 py-3 font-medium">{t('customers.colOutstandingBalance')}</th>
                    <th className="px-6 py-3 font-medium">{t('customers.colPaymentHistory')}</th>
                    {canManageCustomers ? <th className="px-6 py-3 font-medium">{t('customers.colActions')}</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/50">
                  {pagedCustomers.map((customer) => {
                    const balances = outstandingBalances[customer.id]
                    const hasBalances = balances && Object.keys(balances).some(k => balances[k] > 0)
                    
                    return (
                      <Fragment key={customer.id}>
                        <tr className="align-top transition hover:bg-slate-800/60">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                                <UsersRound size={18} />
                              </div>
                              <div>
                                <div className="font-semibold text-white">{customer.full_name}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{t('customers.customerProfile')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">{customer.phone || '—'}</td>
                          <td className="px-6 py-4">
                            {!balances ? (
                              <span className="text-slate-400">{t('customers.calculating')}</span>
                            ) : hasBalances ? (
                              <div className="flex flex-col gap-1">
                                {Object.entries(balances)
                                  .filter(([_, amt]) => amt > 0)
                                  .map(([curr, amt]) => (
                                    <span key={curr} className="font-semibold text-rose-400">
                                      {curr} {Number(amt).toFixed(2)}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">0.00</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => {
                                if (showHistoryModal && historyCustomer?.id === customer.id) {
                                  closeHistoryModal()
                                } else {
                                  openHistoryModal(customer)
                                }
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                            >
                              <ReceiptText size={14} />
                              {showHistoryModal && historyCustomer?.id === customer.id ? t('customers.hideHistory') : t('customers.viewHistory')}
                            </button>
                          </td>
                          {canManageCustomers ? (
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal(customer)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/20 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30 whitespace-nowrap"
                                >
                                  <CreditCard size={15} />
                                  {t('customers.recordPayment')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(customer)}
                                  className="rounded-xl bg-slate-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-600"
                                >
                                  {t('customers.edit')}
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  {t('customers.showingRange', { 
                    start: (currentPage - 1) * itemsPerPage + 1, 
                    end: Math.min(currentPage * itemsPerPage, visibleCustomers.length), 
                    total: visibleCustomers.length 
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('customers.previous')}
                  </button>
                  <span className="text-sm text-slate-300">{t('customers.pageOf', { current: currentPage, total: totalPages })}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('customers.next')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {showPaymentModal && paymentCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
              <h2 className="text-xl font-semibold text-white">{t('customers.recordPaymentFor', { name: paymentCustomer.full_name })}</h2>
              
              <div className="mb-4 mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="mb-2 text-sm text-slate-400">{t('customers.currentOutstandingBalance')}</p>
                {outstandingBalances[paymentCustomer.id] && Object.keys(outstandingBalances[paymentCustomer.id]).some(k => outstandingBalances[paymentCustomer.id][k] > 0) ? (
                  <div className="flex flex-col gap-1">
                    {Object.entries(outstandingBalances[paymentCustomer.id])
                      .filter(([_, amt]) => amt > 0)
                      .map(([curr, amt]) => (
                        <span key={curr} className="text-lg font-semibold text-rose-400">
                          {curr} {Number(amt).toFixed(2)}
                        </span>
                      ))}
                  </div>
                ) : (
                  <span className="text-lg font-semibold text-white">0.00</span>
                )}
              </div>

              <form onSubmit={handleRecordPayment} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col text-sm text-slate-300">
                    {t('customers.amount')}
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm text-slate-300">
                    {t('customers.currency')}
                    <select
                      value={paymentForm.currency}
                      onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value })}
                      className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                    >
                      <option value="AED">AED</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.paymentMethod')}
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="cash">{t('customers.methodCash')}</option>
                    <option value="bank_transfer">{t('customers.methodBankTransfer')}</option>
                    <option value="card">{t('customers.methodCard')}</option>
                  </select>
                </label>

                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.linkToUnpaidSale')}
                  <select
                    value={paymentForm.sale_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, sale_id: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="">{t('customers.generalPaymentUnlinked')}</option>
                    {loadingUnpaidSales ? (
                      <option disabled>{t('customers.loadingSales')}</option>
                    ) : (
                      groupedUnpaidSales.map((group) => {
                        const owed = group.totalPrice - group.totalPaid
                        return (
                          <option key={group.key} value={group.key}>
                            {t('customers.invoiceOwes', { number: group.invoiceNumber || group.key, currency: group.currency, amount: owed.toFixed(2) })}
                          </option>
                        )
                      })
                    )}
                  </select>
                </label>

                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.notes')}
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                    rows="2"
                    placeholder={t('customers.notesPlaceholder')}
                  />
                </label>

                {message && (
                  <p className={`text-sm ${messageType === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {message}
                  </p>
                )}

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                  >
                    {t('customers.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? t('customers.saving') : t('customers.recordPayment')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showHistoryModal && historyCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{t('customers.paymentHistoryLabel')}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{historyCustomer.full_name}</h2>
                  <p className="mt-1 text-sm text-slate-400">{t('customers.recentPaymentRecords')}</p>
                </div>
                <button
                  type="button"
                  onClick={closeHistoryModal}
                  className="self-start rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                >
                  {t('customers.close')}
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                {loadingHistory ? (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-slate-400">{t('customers.loadingPaymentHistory')}</div>
                ) : paymentHistory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-6 text-slate-400">{t('customers.noPaymentsRecordedYet')}</div>
                ) : (
                  <div className="grid gap-4">
                    {paymentHistory.map((ph) => (
                      <div key={ph.id} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('customers.date')}</p>
                            <p className="text-lg font-semibold text-white">{formatDate(ph.payment_date)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('customers.amountLabel')}</p>
                            <p className="text-lg font-semibold text-emerald-300">{formatCurrency(ph.amount, ph.currency)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('customers.method')}</p>
                            <p className="text-sm text-slate-200">{(() => {
                              const { icon, label } = getPaymentMethodDisplay(ph.payment_method)
                              return `${icon} ${label}`
                            })()}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('customers.linkedSale')}</p>
                            {ph.sales?.invoice_number ? (
                              <Link
                                to={`/invoices/${encodeURIComponent(ph.sales.invoice_number)}`}
                                className="mt-2 inline-flex flex-col gap-1 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200 hover:underline"
                              >
                                <span>{ph.sales.invoice_number}</span>
                                <span className="text-xs text-slate-400">{t('customers.viewInvoice')}</span>
                              </Link>
                            ) : (
                              <div className="mt-2 text-sm text-slate-300">
                                <p>{t('customers.generalPaymentNoInvoice')}</p>
                                <p className="mt-1 text-xs text-slate-500">{t('customers.paymentDateLabel', { date: formatDate(ph.payment_date) })}</p>
                                {ph.notes ? (
                                  <p className="mt-1 text-xs text-slate-500">{t('customers.referenceLabel', { notes: ph.notes })}</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('customers.notes')}</p>
                            <p className="mt-2 text-sm text-slate-300">{ph.notes || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAddModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
              <h2 className="text-xl font-semibold text-white">{editingId ? t('customers.editCustomer') : t('customers.addCustomerTitle')}</h2>
              <form onSubmit={handleAddCustomer} className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.fullName')}
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.phone')}
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.email')}
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.address')}
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.country')}
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="">{t('customers.selectCountry')}</option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  {t('customers.notes')}
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                    rows="3"
                  />
                </label>

                {message ? (
                  <p className={`text-sm ${messageType === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {message}
                  </p>
                ) : null}

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setMessage('')
                    }}
                    className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                  >
                    {t('customers.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? t('customers.saving') : `${editingId ? t('customers.update') : t('customers.add')} ${t('customers.customerSuffix')}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default Customers
