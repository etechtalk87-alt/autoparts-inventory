import { useEffect, useMemo, useState } from 'react'
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

  // Calculate outstanding balance for a customer
  const getOutstandingBalance = useMemo(() => {
    return async (customerId) => {
      if (!currentStaff?.company_id) return 0

      // Get sum of unpaid sales (where payment_status is 'partial' or 'credit')
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('sale_price, amount_paid')
        .eq('company_id', currentStaff.company_id)
        .eq('customer_id', customerId)
        .in('payment_status', ['partial', 'credit'])

      if (salesError) return 0

      let totalOutstanding = 0
      sales.forEach((sale) => {
        const owed = Number(sale.sale_price || 0) - Number(sale.amount_paid || 0)
        totalOutstanding += owed
      })

      // Subtract additional payments not tied to a sale
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('company_id', currentStaff.company_id)
        .eq('customer_id', customerId)
        .is('sale_id', null)

      if (!paymentsError && payments) {
        const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        totalOutstanding -= totalPayments
      }

      return Math.max(0, totalOutstanding)
    }
  }, [currentStaff?.company_id])

  // Precalculate outstanding balances for all customers
  const [outstandingBalances, setOutstandingBalances] = useState({})

  useEffect(() => {
    const calculateAllBalances = async () => {
      const balances = {}
      for (const customer of customers) {
        balances[customer.id] = await getOutstandingBalance(customer.id)
      }
      setOutstandingBalances(balances)
    }

    if (customers.length > 0) {
      calculateAllBalances()
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
      // Update existing customer
      const { error } = await supabase
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

      if (error) {
        setMessage(error.message)
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
      // Create new customer
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
        // Refetch customers
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (!canManageCustomers) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Customers</h1>
              <p className="mt-2 text-sm text-slate-400">Manage customer information and outstanding balances.</p>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Add Customer
            </button>
          </div>
        </div>

        {loadingCustomers ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
            <p className="text-slate-400">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
            <p className="text-slate-400">No customers found. Add one to get started.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Phone</th>
                    <th className="px-6 py-3 font-medium">Country</th>
                    <th className="px-6 py-3 font-medium">Outstanding Balance</th>
                    {canManageCustomers ? <th className="px-6 py-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/70">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 font-medium text-white">{customer.full_name}</td>
                      <td className="px-6 py-4">{customer.phone || '—'}</td>
                      <td className="px-6 py-4">{customer.country || '—'}</td>
                      <td className="px-6 py-4">
                        {outstandingBalances[customer.id] !== undefined
                          ? `AED ${Number(outstandingBalances[customer.id] || 0).toFixed(2)}`
                          : 'Calculating...'}
                      </td>
                      {canManageCustomers ? (
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => openEditModal(customer)}
                            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium transition hover:bg-slate-600"
                          >
                            Edit
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showAddModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <form onSubmit={handleAddCustomer} className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col text-sm text-slate-300">
                  Full Name *
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Phone
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Address
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Country
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
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
                    className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    rows="3"
                  />
                </label>

                {message ? (
                  <p
                    className={`text-sm ${messageType === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
                  >
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
                    className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
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
