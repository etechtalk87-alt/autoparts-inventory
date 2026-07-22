import { useEffect, useMemo, useState, Fragment } from 'react'
import { BadgeCheck, CreditCard, ReceiptText, UsersRound, Wallet2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

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
  const [loadingUnpaidSales, setLoadingUnpaidSales] = useState(false)
  const [expandedCustomer, setExpandedCustomer] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const canManageCustomers = currentStaff?.role === 'company_admin'

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
      setMessage('Full name is required.')
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
        setMessage('Update failed - you may not have permission to modify this record.')
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
        setMessage('Customer updated successfully.')
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
        setMessage('Customer added successfully.')
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

  const toggleExpand = (customerId) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null)
    } else {
      setExpandedCustomer(customerId)
      fetchPaymentHistory(customerId)
    }
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
      .select('id, invoice_number, sale_price, amount_paid, payment_status, created_at, parts(currency)')
      .eq('company_id', currentStaff.company_id)
      .eq('customer_id', customer.id)
      .in('payment_status', ['partial', 'credit'])
      .order('created_at', { ascending: false })
      
    if (!error) {
      setUnpaidSales(data || [])
    } else {
      setUnpaidSales([])
    }
    setLoadingUnpaidSales(false)
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    const amount = Number(paymentForm.amount)
    if (amount <= 0) {
      setMessage('Amount must be greater than 0.')
      setMessageType('error')
      setSubmitting(false)
      return
    }

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
    
    if (paymentForm.sale_id) {
      payload.sale_id = paymentForm.sale_id
    }

    const { error: insertError } = await supabase.from('payments').insert([payload])

    if (insertError) {
      setMessage(insertError.message)
      setMessageType('error')
      setSubmitting(false)
      return
    }

    if (paymentForm.sale_id) {
      const { data: freshSale, error: freshSaleError } = await supabase
        .from('sales')
        .select('sale_price, amount_paid')
        .eq('id', paymentForm.sale_id)
        .single()

      if (freshSaleError) {
        setMessage(`Failed to fetch fresh sale data: ${freshSaleError.message}`)
        setMessageType('error')
        setSubmitting(false)
        return
      }

      let newPaid = Number(freshSale.amount_paid || 0) + amount
      let newStatus = 'partial'
      
      if (newPaid >= Number(freshSale.sale_price)) {
        newPaid = Number(freshSale.sale_price)
        newStatus = 'paid'
      }

      const { data: saleUpdateData, error: updateError } = await supabase
        .from('sales')
        .update({ amount_paid: newPaid, payment_status: newStatus })
        .eq('id', paymentForm.sale_id)
        .select('id')

      if (updateError) {
        setMessage(`Payment recorded, but failed to update sale: ${updateError.message}`)
        setMessageType('error')
        setSubmitting(false)
        return
      } else if (!saleUpdateData || saleUpdateData.length === 0) {
        setMessage('Payment recorded, but failed to update sale - you may not have permission to modify this record.')
        setMessageType('error')
        setSubmitting(false)
        return
      }
    }

    setMessage('Payment recorded successfully.')
    setMessageType('success')
    
    // Refresh balance for this customer
    const newBalances = { ...outstandingBalances }
    newBalances[paymentCustomer.id] = await getOutstandingBalance(paymentCustomer.id)
    setOutstandingBalances(newBalances)
    
    // Refresh expanded history if currently open
    if (expandedCustomer === paymentCustomer.id) {
      fetchPaymentHistory(paymentCustomer.id)
    }

    setTimeout(() => {
      setShowPaymentModal(false)
      setSubmitting(false)
    }, 1500)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading customers...
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

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <BadgeCheck size={16} />
                Customer relationship hub
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Customers</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Keep key client details, payment records, and outstanding balances organized in one polished workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <UsersRound size={16} className="text-cyan-300" />
                  Active customers
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{customers.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <Wallet2 size={16} />
                  Outstanding value
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
            Add Customer
          </button>
        </div>

        {loadingCustomers ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <p className="text-slate-400">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-10 text-center shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
              <UsersRound size={28} className="mx-auto text-cyan-300" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">No customers yet</h2>
            <p className="mt-2 text-sm text-slate-400">Add your first customer to begin tracking payments and relationships.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Phone</th>
                    <th className="px-6 py-3 font-medium">Outstanding Balance</th>
                    <th className="px-6 py-3 font-medium">Payment History</th>
                    {canManageCustomers ? <th className="px-6 py-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/50">
                  {customers.map((customer) => {
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
                                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Customer profile</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">{customer.phone || '—'}</td>
                          <td className="px-6 py-4">
                            {!balances ? (
                              <span className="text-slate-400">Calculating...</span>
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
                              onClick={() => toggleExpand(customer.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                            >
                              <ReceiptText size={14} />
                              {expandedCustomer === customer.id ? 'Hide History' : 'View History'}
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
                                  Record Payment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(customer)}
                                  className="rounded-xl bg-slate-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-600"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                        {expandedCustomer === customer.id && (
                          <tr>
                            <td colSpan={canManageCustomers ? 5 : 4} className="border-b border-white/10 bg-slate-950/50 px-6 py-4">
                              <h4 className="mb-3 font-semibold text-white">Payment History for {customer.full_name}</h4>
                              {loadingHistory ? (
                                <p className="text-sm text-slate-400">Loading...</p>
                              ) : paymentHistory.length === 0 ? (
                                <p className="text-sm text-slate-400">No payments recorded yet.</p>
                              ) : (
                                <table className="min-w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-left text-sm">
                                  <thead className="bg-slate-800 text-slate-300">
                                    <tr>
                                      <th className="px-4 py-2 font-medium">Date</th>
                                      <th className="px-4 py-2 font-medium">Amount</th>
                                      <th className="px-4 py-2 font-medium">Method</th>
                                      <th className="px-4 py-2 font-medium">Linked Sale</th>
                                      <th className="px-4 py-2 font-medium">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/10">
                                    {paymentHistory.map(ph => (
                                      <tr key={ph.id}>
                                        <td className="px-4 py-2 text-slate-300">{ph.payment_date}</td>
                                        <td className="px-4 py-2 font-medium text-white">{ph.currency || 'AED'} {Number(ph.amount).toFixed(2)}</td>
                                        <td className="px-4 py-2 capitalize text-slate-300">{ph.payment_method?.replace('_', ' ') || 'Cash'}</td>
                                        <td className="px-4 py-2 text-cyan-400">{ph.sales?.invoice_number || 'General Payment'}</td>
                                        <td className="px-4 py-2 text-slate-400">{ph.notes || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showPaymentModal && paymentCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
              <h2 className="text-xl font-semibold text-white">Record Payment for {paymentCustomer.full_name}</h2>
              
              <div className="mb-4 mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="mb-2 text-sm text-slate-400">Current Outstanding Balance:</p>
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
                    Amount *
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
                    Currency *
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
                  Payment Method *
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                  </select>
                </label>

                <label className="flex flex-col text-sm text-slate-300">
                  Link to Unpaid Sale (Optional)
                  <select
                    value={paymentForm.sale_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, sale_id: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="">-- General Payment (Unlinked) --</option>
                    {loadingUnpaidSales ? (
                      <option disabled>Loading sales...</option>
                    ) : (
                      unpaidSales.map(s => {
                        const owed = Number(s.sale_price) - Number(s.amount_paid || 0)
                        const c = s.parts?.currency || 'AED'
                        return (
                          <option key={s.id} value={s.id}>
                            Invoice #{s.invoice_number} - Owes {c} {owed.toFixed(2)}
                          </option>
                        )
                      })
                    )}
                  </select>
                </label>

                <label className="flex flex-col text-sm text-slate-300">
                  Notes
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                    rows="2"
                    placeholder="Reference #, cheque details, etc."
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
                    onClick={() => {
                      setShowPaymentModal(false)
                      setMessage('')
                    }}
                    className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Saving...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
              <h2 className="text-xl font-semibold text-white">{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <form onSubmit={handleAddCustomer} className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col text-sm text-slate-300">
                  Full Name *
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Phone
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Address
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Country
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Notes
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Saving...' : editingId ? 'Update' : 'Add'} Customer
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
