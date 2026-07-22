import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [partSearch, setPartSearch] = useState('')
  const [lineItems, setLineItems] = useState([])
  const [removingIds, setRemovingIds] = useState([])
  const [justAddedId, setJustAddedId] = useState(null)
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
  const successRef = useRef(null)

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

    if (canManageBranches && !branchScopeId) {
      setParts([])
      return
    }

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

  const filteredAvailableParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase()

    if (!query) return parts

    return parts.filter((part) => {
      const haystack = `${part.part_name || ''} ${part.oem_number || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [partSearch, parts])

  const canCreateInvoice = Boolean(selectedCustomerId) && lineItems.length > 0
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
    setJustAddedId(part.id)
    setTimeout(() => setJustAddedId(null), 700)
  }

  const handleRemoveLineItem = (partId) => {
    // animate removal before actually removing from state
    setRemovingIds((prev) => [...prev, partId])
    setTimeout(() => {
      setLineItems((prev) => prev.filter((item) => item.part_id !== partId))
      setRemovingIds((prev) => prev.filter((id) => id !== partId))
    }, 260)
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
    setPartSearch('')
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

    setCreatedInvoice({
      id: invoiceId,
      invoiceNumber,
      branchId,
      branchName: selectedBranchName || 'Branch',
      customerName: selectedCustomerName || 'Customer',
      totalAmount,
      itemCount: lineItems.length,
      paymentStatus: dbPaymentStatus,
      amountPaid: finalAmountPaid,
      currency,
    })
    setSuccessMessage(`Invoice ${invoiceNumber} created successfully.`)
    setInvoiceMessage('')
    setSubmitting(false)

    // Clear selections after invoice creation
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setSelectedCustomerEmail('')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setLineItems([])
    setPartSearch('')
    setAmountPaid('')
    setPaymentStatus('paid_in_full')

    // Smooth scroll to the success panel
    setTimeout(() => {
      successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
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
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h1 className="text-3xl font-semibold">Create Invoice</h1>
          <p className="mt-2 text-sm text-slate-400">Build a multi-item invoice from in-stock parts.</p>
          {successMessage && createdInvoice ? (
            <div ref={successRef} className="mt-6 rounded-3xl border border-emerald-500/20 bg-slate-950/90 p-5 shadow-xl shadow-emerald-500/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">Invoice created</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{createdInvoice.invoiceNumber}</h2>
                  <p className="mt-1 text-sm text-slate-400">{createdInvoice.customerName} · {createdInvoice.branchName}</p>
                </div>
                <div className="rounded-3xl bg-slate-900/90 px-4 py-3 text-right text-sm text-slate-300 ring-1 ring-slate-700">
                  <p className="text-slate-400">Items</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{createdInvoice.itemCount}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Total</p>
                  <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(createdInvoice.totalAmount, createdInvoice.currency)}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Paid</p>
                  <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(createdInvoice.amountPaid, createdInvoice.currency)}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Status</p>
                  <p className="mt-2 text-xl font-semibold text-white">{createdInvoice.paymentStatus === 'paid' ? 'Paid' : createdInvoice.paymentStatus === 'paid_in_full' ? 'Paid in Full' : createdInvoice.paymentStatus === 'partial' ? 'Partial' : createdInvoice.paymentStatus === 'credit' ? 'Credit' : 'Unpaid'}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Download Invoice
                </button>
                <button
                  type="button"
                  onClick={handleCreateAnother}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-500 px-5 py-3 font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  Create Another
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/sales')}
                  className="inline-flex items-center justify-center rounded-full bg-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-600"
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
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">Available items</p>
                  <span className="text-xs text-slate-400">{filteredAvailableParts.length} shown</span>
                </div>

                <label className="mt-3 block text-xs uppercase tracking-wide text-slate-400">
                  Search parts
                  <input
                    type="text"
                    value={partSearch}
                    onChange={(event) => setPartSearch(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Search by part name or OEM"
                  />
                </label>

                {canManageBranches && !branchScopeId ? (
                  <p className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/70 p-3 text-slate-400">
                    Select a branch to see available parts
                  </p>
                ) : filteredAvailableParts.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/70 p-3 text-slate-400">
                    {partSearch.trim() ? 'No parts match your search for this branch.' : 'No in-stock parts available for this branch.'}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {filteredAvailableParts.map((part) => {
                      const alreadySelected = lineItems.some((item) => item.part_id === part.id)

                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => (alreadySelected ? handleRemoveLineItem(part.id) : handleAddLineItem(part))}
                          aria-pressed={alreadySelected}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition flex items-center justify-between ${alreadySelected ? 'border-emerald-500 bg-emerald-600/10 text-emerald-100 shadow-sm' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${alreadySelected ? 'bg-emerald-500 text-white shadow-md' : 'border border-slate-700 text-slate-400 bg-slate-900'}`}>
                              {alreadySelected ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                                  <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.2" className="text-slate-400" />
                                </svg>
                              )}
                            </div>

                            <div>
                              <p className="font-semibold text-white text-sm">{part.part_name}</p>
                              <p className="text-slate-400 text-xs">{part.oem_number || 'No OEM'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-sm font-medium">{formatCurrency(part.asking_price, part.currency)}</span>
                            {alreadySelected ? <span className="text-xs text-emerald-300 mt-1">Added</span> : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Invoice items</h2>
              <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-sm text-slate-300">
                {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'} selected
              </span>
            </div>
            {lineItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No items selected yet.</p>
            ) : (
              <div className="mt-4 space-y-4 divide-y divide-slate-800">
                {lineItems.map((item, idx) => {
                  const isRemoving = removingIds.includes(item.part_id)
                  const isJustAdded = justAddedId === item.part_id

                  return (
                    <div
                      key={item.part_id}
                      className={`grid gap-4 rounded-2xl border p-5 items-center md:grid-cols-[1fr_160px_220px_120px] transition-all duration-200 ease-out ${isRemoving ? 'opacity-0 scale-95 h-0 p-0 m-0 overflow-hidden' : 'border-slate-600 bg-slate-950 shadow-sm shadow-black/20'} ${isJustAdded ? 'ring-2 ring-emerald-400' : ''}`}
                      style={{ paddingTop: idx === 0 ? 20 : undefined }}
                    >
                      <div>
                        <p className="font-semibold text-white">{item.part_name}</p>
                        <p className="text-slate-400 text-sm">{item.oem_number || 'No OEM'}</p>
                        <p className="text-slate-400 text-sm">{item.currency}</p>
                      </div>

                      <div className="text-sm">
                        <div className="text-slate-400">Asking</div>
                        <div className="mt-1 text-slate-200">{formatCurrency(item.asking_price, item.currency)}</div>
                      </div>

                      <div>
                        <div className="text-sm text-slate-400">Sale Price</div>
                        <div className="mt-1 flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sale_price}
                            onChange={(event) => {
                              const value = event.target.value
                              setLineItems((prev) => prev.map((line) => (line.part_id === item.part_id ? { ...line, sale_price: value } : line)))
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.part_id)}
                            className="rounded-md border border-rose-500 px-3 py-2 text-sm text-rose-400 transition hover:bg-rose-500/10"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-slate-400">Line Total</div>
                        <div className="mt-1 text-slate-200 font-semibold">{formatCurrency(Number(item.sale_price || 0), item.currency)}</div>
                      </div>
                    </div>
                  )
                })}
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
                  <span className="text-slate-400">Total</span>
                  <strong className="text-xl font-bold text-white">{formatCurrency(totalAmount, lineItems[0]?.currency)}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between text-slate-400">
                  <span>Paid</span>
                  <strong>{formatCurrency(totalPaid, lineItems[0]?.currency)}</strong>
                </div>
              </div>

              {invoiceMessage ? <p className="text-sm text-rose-400">{invoiceMessage}</p> : null}
              {!canCreateInvoice && !submitting ? (
                <p className="text-sm text-slate-400" title="Select a customer and add at least one item to continue">
                  Select a customer and add at least one item to continue
                </p>
              ) : null}

              <button
                type="button"
                disabled={submitting || !canCreateInvoice}
                onClick={handleConfirmInvoice}
                className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                title={!canCreateInvoice ? 'Select a customer and add at least one item to continue' : ''}
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
