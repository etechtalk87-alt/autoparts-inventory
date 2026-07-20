import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { supabase } from '../lib/supabaseClient'

function formatCurrency(value, currency = 'AED') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function CreateInvoice() {
  const { currentStaff, loading } = useAuth()
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [parts, setParts] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState(currentStaff?.branch_id || '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [lineItems, setLineItems] = useState([])
  const [paymentStatus, setPaymentStatus] = useState('paid_in_full')
  const [amountPaid, setAmountPaid] = useState('')
  const [invoiceMessage, setInvoiceMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [createdInvoice, setCreatedInvoice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ full_name: '', phone: '', email: '', address: '', country: '', notes: '' })
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const canManageBranches = currentStaff?.role === 'company_admin'
  const branchScopeId = currentStaff?.role === 'branch_staff' ? currentStaff.branch_id : selectedBranchId

  useEffect(() => {
    if (!currentStaff?.company_id) return

    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('company_id', currentStaff.company_id)
        .order('name', { ascending: true })

      if (!error) setBranches(data ?? [])
    }

    fetchBranches()
  }, [currentStaff?.company_id])

  useEffect(() => {
    if (!currentStaff?.company_id) return

    const fetchParts = async () => {
      let query = supabase
        .from('parts')
        .select('id, part_name, oem_number, asking_price, currency, status, branch_id')
        .eq('company_id', currentStaff.company_id)
        .eq('status', 'in_stock')

      if (!canManageBranches) {
        query = query.eq('branch_id', currentStaff.branch_id)
      } else if (branchScopeId) {
        query = query.eq('branch_id', branchScopeId)
      }

      const { data, error } = await query.order('part_name', { ascending: true })
      if (!error) setParts(data ?? [])
    }

    fetchParts()
  }, [currentStaff?.company_id, canManageBranches, branchScopeId])

  useEffect(() => {
    if (!currentStaff?.company_id) return

    const fetchCustomers = async () => {
      const query = supabase
        .from('customers')
        .select('id, full_name, phone, email')
        .eq('company_id', currentStaff.company_id)
        .order('full_name', { ascending: true })

      const { data, error } = await query
      if (!error) setCustomers(data ?? [])
    }

    fetchCustomers()
  }, [currentStaff?.company_id])

  useEffect(() => {
    if (!currentStaff?.company_id) return

    const q = customerSearch.trim()
    if (!q) {
      setFilteredCustomers(customers.slice(0, 5))
      return
    }

    setSearchLoading(true)
    const timeout = setTimeout(async () => {
      const filter = `%${q.replace('%', '\%')}%`
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone, email')
        .eq('company_id', currentStaff.company_id)
        .or(`full_name.ilike.${filter},email.ilike.${filter},phone.ilike.${filter}`)
        .order('full_name', { ascending: true })
        .limit(10)

      if (!error) setFilteredCustomers(data ?? [])
      setSearchLoading(false)
    }, 250)

    return () => clearTimeout(timeout)
  }, [customerSearch, currentStaff?.company_id, customers])

  const selectedBranchName = useMemo(() => {
    return branches.find((branch) => String(branch.id) === String(branchScopeId))?.name || ''
  }, [branches, branchScopeId])

  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + Number(item.sale_price || 0), 0)
  }, [lineItems])

  const totalPaid = useMemo(() => {
    if (paymentStatus === 'paid_in_full') return totalAmount
    if (paymentStatus === 'credit') return 0
    return Number(amountPaid || 0)
  }, [paymentStatus, totalAmount, amountPaid])

  const handleAddLineItem = (part) => {
    if (lineItems.some((item) => item.part_id === part.id)) return
    setLineItems((prev) => [...prev, {
      part_id: part.id,
      part_name: part.part_name,
      oem_number: part.oem_number,
      currency: part.currency,
      asking_price: Number(part.asking_price || 0),
      sale_price: Number(part.asking_price || 0),
      branch_id: part.branch_id,
    }])
  }

  const handleRemoveLineItem = (partId) => {
    setLineItems((prev) => prev.filter((item) => item.part_id !== partId))
  }

  const resetForm = () => {
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setSelectedCustomerEmail('')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setLineItems([])
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setInvoiceMessage('')
    setSuccessMessage('')
    setCreatedInvoice(null)
  }

  const handleCreateCustomer = async (event) => {
    event.preventDefault()

    if (!newCustomerForm.full_name.trim()) {
      setInvoiceMessage('Please enter customer name.')
      return
    }

    setCreatingCustomer(true)
    const { data, error } = await supabase
      .from('customers')
      .insert([{
        company_id: currentStaff.company_id,
        full_name: newCustomerForm.full_name,
        phone: newCustomerForm.phone || null,
        email: newCustomerForm.email || null,
        address: newCustomerForm.address || null,
        country: newCustomerForm.country || null,
        notes: newCustomerForm.notes || null,
      }])
      .select('id, full_name, email')
      .single()

    if (error) {
      setInvoiceMessage(error.message)
      setCreatingCustomer(false)
      return
    }

    setCustomers((prev) => [...prev, data])
    setSelectedCustomerId(data.id)
    setSelectedCustomerName(data.full_name)
    setSelectedCustomerEmail(data.email || '')
    setShowNewCustomerForm(false)
    setCustomerSearch('')
    setInvoiceMessage('')
    setCreatingCustomer(false)
  }

  const handleConfirmInvoice = async () => {
    if (!selectedCustomerId) {
      setInvoiceMessage('Please select or create a customer.')
      return
    }

    if (!lineItems.length) {
      setInvoiceMessage('Please add at least one item to the invoice.')
      return
    }

    setSubmitting(true)
    setInvoiceMessage('')
    setSuccessMessage('')

    if (paymentStatus === 'partial') {
      const paid = Number(amountPaid || 0)
      if (paid <= 0 || paid >= totalAmount) {
        setInvoiceMessage('Partial payment must be greater than 0 and less than the total amount.')
        setSubmitting(false)
        return
      }
    }

    if (canManageBranches && !selectedBranchId) {
      setInvoiceMessage('Please select a branch for the invoice.')
      setSubmitting(false)
      return
    }

    const branchId = branchScopeId || currentStaff.branch_id
    const currency = lineItems[0]?.currency || 'AED'
    const invoiceNumber = `INV-${selectedBranchName.slice(0, 2).toUpperCase() || 'BR'}-${Date.now()}`
    const dbPaymentStatus = paymentStatus === 'paid_in_full' ? 'paid' : paymentStatus
    const finalAmountPaid = paymentStatus === 'paid_in_full' ? totalAmount : paymentStatus === 'credit' ? 0 : Number(amountPaid || 0)

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        company_id: currentStaff.company_id,
        branch_id: branchId,
        customer_id: selectedCustomerId,
        invoice_number: invoiceNumber,
        currency,
        total_amount: totalAmount,
        payment_status: dbPaymentStatus,
        amount_paid: finalAmountPaid,
        created_by: currentStaff.id,
      }])
      .select('id')
      .single()

    if (invoiceError || !invoiceData?.id) {
      setInvoiceMessage(invoiceError?.message || 'Failed to create invoice.')
      setSubmitting(false)
      return
    }

    const invoiceId = invoiceData.id
    const saleInserts = lineItems.map((item) => ({
      company_id: currentStaff.company_id,
      branch_id: item.branch_id,
      part_id: item.part_id,
      sold_by: currentStaff.id,
      sale_price: Number(item.sale_price || 0),
      customer_id: selectedCustomerId,
      payment_status: paymentStatus === 'paid_in_full' ? 'paid' : paymentStatus,
      amount_paid: paymentStatus === 'paid_in_full' ? Number(item.sale_price || 0) : 0,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
    }))

    const { error: salesError } = await supabase.from('sales').insert(saleInserts)
    if (salesError) {
      setInvoiceMessage(salesError.message)
      setSubmitting(false)
      return
    }

    const partIds = lineItems.map((item) => item.part_id)
    const { error: updateError } = await supabase
      .from('parts')
      .update({ status: 'sold', date_sold: new Date().toISOString() })
      .in('id', partIds)

    if (updateError) {
      setInvoiceMessage(updateError.message)
      setSubmitting(false)
      return
    }

    if (paymentStatus !== 'paid_in_full') {
      const paymentEntry = {
        company_id: currentStaff.company_id,
        customer_id: selectedCustomerId,
        sale_id: null,
        amount: finalAmountPaid,
        currency,
        payment_method: 'invoice_payment',
        notes: `Invoice ${invoiceNumber} payment`,
        recorded_by: currentStaff.id,
        payment_date: new Date().toISOString().split('T')[0],
      }
      const { error: paymentError } = await supabase.from('payments').insert([paymentEntry])
      if (paymentError) {
        console.error('Failed to record invoice payment:', paymentError)
      }
    }

    setCreatedInvoice({ id: invoiceId, invoiceNumber, branchId })
    setSuccessMessage(`Invoice ${invoiceNumber} created successfully.`)
    setInvoiceMessage('')
    setSubmitting(false)
  }

  const handleDownloadInvoice = async () => {
    if (!createdInvoice) return

    await downloadInvoicePdf({
      supabaseClient: supabase,
      companyId: currentStaff.company_id,
      branchId: createdInvoice.branchId,
      sale: { invoice_id: createdInvoice.id },
    })
  }

  const handleCreateAnother = () => {
    resetForm()
  }

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
          <h1 className="text-3xl font-semibold">Create Invoice</h1>
          <p className="mt-2 text-sm text-slate-400">Build a multi-item invoice from in-stock parts.</p>
          {successMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <p className="font-semibold text-emerald-100">{successMessage}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Download Invoice
                </button>
                <button
                  type="button"
                  onClick={handleCreateAnother}
                  className="rounded-lg border border-emerald-500 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  Create Another
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/sales')}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-600"
                >
                  Go to Sales
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                Select Customer
                <input
                  type="text"
                  value={selectedCustomerId ? selectedCustomerName : customerSearch}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value)
                    setSelectedCustomerId(null)
                    setSelectedCustomerName('')
                    setSelectedCustomerEmail('')
                    setShowCustomerDropdown(true)
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  placeholder="Search by name, email, or phone"
                />
              </label>
              {showCustomerDropdown && filteredCustomers.length > 0 ? (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(customer.id)
                        setSelectedCustomerName(customer.full_name)
                        setSelectedCustomerEmail(customer.email || '')
                        setCustomerSearch('')
                        setShowCustomerDropdown(false)
                        setInvoiceMessage('')
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800"
                    >
                      {customer.full_name} {customer.email ? `(${customer.email})` : ''}
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedCustomerId ? (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">{selectedCustomerName}</p>
                  {selectedCustomerEmail ? <p>{selectedCustomerEmail}</p> : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowNewCustomerForm((prev) => !prev)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                {showNewCustomerForm ? 'Hide customer form' : 'Create new customer'}
              </button>

              {showNewCustomerForm ? (
                <form onSubmit={handleCreateCustomer} className="space-y-4 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
                  <label className="block">
                    Name
                    <input
                      value={newCustomerForm.full_name}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, full_name: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none"
                      required
                    />
                  </label>
                  <label className="block">
                    Email
                    <input
                      type="email"
                      value={newCustomerForm.email}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    Phone
                    <input
                      value={newCustomerForm.phone}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={creatingCustomer}
                    className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingCustomer ? 'Creating...' : 'Add customer'}
                  </button>
                </form>
              ) : null}
            </div>

            <div className="space-y-4">
              {canManageBranches ? (
                <label className="block text-sm text-slate-300">
                  Select Branch
                  <select
                    value={branchScopeId}
                    onChange={(event) => setSelectedBranchId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">Available items</p>
                {parts.length === 0 ? (
                  <p className="mt-2 text-slate-400">No in-stock parts available for this branch.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {parts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => handleAddLineItem(part)}
                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-white">{part.part_name}</p>
                            <p className="text-slate-400">{part.oem_number || 'No OEM'}</p>
                          </div>
                          <span>{formatCurrency(part.asking_price, part.currency)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-xl font-semibold">Invoice items</h2>
            {lineItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No items selected yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {lineItems.map((item) => (
                  <div key={item.part_id} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 md:grid-cols-[1fr_120px_100px_80px]">
                    <div>
                      <p className="font-semibold text-white">{item.part_name}</p>
                      <p className="text-slate-400 text-sm">{item.oem_number || 'No OEM'}</p>
                      <p className="text-slate-400 text-sm">{item.currency}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300">Asking</label>
                      <p className="mt-1 text-slate-200">{formatCurrency(item.asking_price, item.currency)}</p>
                    </div>
                    <label className="block text-sm text-slate-300">
                      Sale Price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.sale_price}
                        onChange={(event) => {
                          const value = event.target.value
                          setLineItems((prev) => prev.map((line) => line.part_id === item.part_id ? { ...line, sale_price: value } : line))
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                      />
                    </label>
                    <div className="flex items-end justify-between">
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(item.part_id)}
                        className="rounded-lg border border-rose-500 px-3 py-2 text-sm text-rose-400 transition hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                      <p className="text-sm text-slate-400">{formatCurrency(item.sale_price, item.currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-xl font-semibold">Payment</h2>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="paid_in_full"
                    checked={paymentStatus === 'paid_in_full'}
                    onChange={() => {
                      setPaymentStatus('paid_in_full')
                      setAmountPaid('')
                    }}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  Paid in Full
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="partial"
                    checked={paymentStatus === 'partial'}
                    onChange={() => setPaymentStatus('partial')}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  Partial
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="credit"
                    checked={paymentStatus === 'credit'}
                    onChange={() => {
                      setPaymentStatus('credit')
                      setAmountPaid('')
                    }}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  Full Credit
                </label>
              </div>

              {paymentStatus === 'partial' ? (
                <label className="block text-sm text-slate-300">
                  Amount Paid
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(event) => setAmountPaid(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    placeholder={`Less than ${formatCurrency(totalAmount, lineItems[0]?.currency)}`}
                  />
                </label>
              ) : null}

              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <strong>{formatCurrency(totalAmount, lineItems[0]?.currency)}</strong>
                </div>
                <div className="flex items-center justify-between pt-2 text-slate-400">
                  <span>Paid</span>
                  <strong>{formatCurrency(totalPaid, lineItems[0]?.currency)}</strong>
                </div>
              </div>

              {invoiceMessage ? <p className="text-sm text-rose-400">{invoiceMessage}</p> : null}

              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmInvoice}
                className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating invoice...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default CreateInvoice
