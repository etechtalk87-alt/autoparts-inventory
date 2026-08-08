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
  const [selectedBranchId, setSelectedBranchId] = useState(currentStaff?.activeBranchId || '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [partSearch, setPartSearch] = useState('')
  const [lineItems, setLineItems] = useState([])
  const [removingIds, setRemovingIds] = useState([])
  const [justAddedId, setJustAddedId] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('paid_in_full')
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
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
  const branchScopeId = currentStaff?.role === 'branch_staff' ? currentStaff.activeBranchId : selectedBranchId

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
        query = query.eq('branch_id', currentStaff.activeBranchId)
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

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + Number(item.sale_price || 0), 0)
  }, [lineItems])

  const vatAmount = useMemo(() => {
    return currentStaff?.vatEnabled ? subtotal * 0.05 : 0
  }, [subtotal, currentStaff?.vatEnabled])

  const totalAmount = useMemo(() => {
    return subtotal + vatAmount
  }, [subtotal, vatAmount])

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

    if (lineItems.length > 0 && lineItems[0].currency !== part.currency) {
      setInvoiceMessage(
        `This invoice already has ${lineItems[0].currency} items. Remove them first to add a ${part.currency} item, or create a separate invoice.`
      )
      return
    }

    setInvoiceMessage('')

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
    setShowCustomerModal(false)
    setShowNewCustomerForm(false)
    setLineItems([])
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setPaymentNote('')
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

    const branchId = branchScopeId || currentStaff.activeBranchId
    const { data: invoiceNumberResult, error: invoiceNumberError } = await supabase
      .rpc('get_next_invoice_number', { p_company_id: currentStaff.company_id })

    if (invoiceNumberError || !invoiceNumberResult) {
      setInvoiceMessage('Failed to generate invoice number. Please try again.')
      setSubmitting(false)
      return
    }

    const currency = lineItems[0]?.currency || 'AED'
    const invoiceNumber = invoiceNumberResult
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
        subtotal: subtotal,
        vat_amount: vatAmount,
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
    const paidFraction = totalAmount > 0 ? finalAmountPaid / totalAmount : 0

    const amountPaidByItem = lineItems.map((item) => Number((Number(item.sale_price || 0) * paidFraction).toFixed(2)))
    const totalAssigned = amountPaidByItem.reduce((sum, value) => sum + value, 0)
    const roundingAdjustment = Number((finalAmountPaid - totalAssigned).toFixed(2))
    if (roundingAdjustment !== 0 && amountPaidByItem.length > 0) {
      amountPaidByItem[amountPaidByItem.length - 1] = Number((amountPaidByItem[amountPaidByItem.length - 1] + roundingAdjustment).toFixed(2))
    }

    const saleInserts = lineItems.map((item, index) => ({
      company_id: currentStaff.company_id,
      branch_id: item.branch_id,
      part_id: item.part_id,
      sold_by: currentStaff.id,
      sale_price: Number(item.sale_price || 0),
      customer_id: selectedCustomerId,
      payment_status: paymentStatus === 'paid_in_full' ? 'paid' : paymentStatus,
      amount_paid: amountPaidByItem[index],
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
    }))

    const { data: salesData, error: salesError } = await supabase.from('sales').insert(saleInserts).select('id, sale_price')
    if (salesError) {
      setInvoiceMessage(salesError.message)
      setSubmitting(false)
      return
    }

    const paymentEntries = []
    if (finalAmountPaid > 0) {
      salesData.forEach((sale, index) => {
        const amount = amountPaidByItem[index]
        if (amount > 0) {
          const partName = lineItems[index]?.part_name || 'item'
          const autoNote = `Payment for ${partName}`
          const finalNote = paymentNote.trim()
            ? `${autoNote} — ${paymentNote.trim()}`
            : autoNote

          paymentEntries.push({
            company_id: currentStaff.company_id,
            customer_id: selectedCustomerId,
            sale_id: sale.id,
            amount,
            currency,
            payment_method: 'invoice_payment',
            notes: finalNote,
            recorded_by: currentStaff.id,
            payment_date: new Date().toISOString().split('T')[0],
          })
        }
      })
    }

    if (paymentEntries.length > 0) {
      const { error: paymentError } = await supabase.from('payments').insert(paymentEntries)
      if (paymentError) {
        console.error('Failed to record invoice payments:', paymentError)
      }
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

    setCreatedInvoice({
      id: invoiceId,
      invoiceNumber,
      branchId,
      branchName: selectedBranchName || 'Branch',
      customerName: selectedCustomerName || 'Customer',
      subtotal,
      vatAmount,
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
    setPaymentNote('')
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
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Create Invoice</h1>
            <p className="mt-2 text-sm text-slate-400">Build a multi-item invoice from in-stock parts.</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="self-start rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Reset Form
          </button>
        </div>

        {successMessage && createdInvoice ? (
          <div ref={successRef} className="rounded-3xl border border-emerald-500/20 bg-slate-950/90 p-6 shadow-xl shadow-emerald-500/10">
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
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {createdInvoice.vatAmount > 0 ? (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Subtotal</p>
                    <p className="mt-2 text-xl font-semibold text-slate-300">{formatCurrency(createdInvoice.subtotal, createdInvoice.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">VAT (5%)</p>
                    <p className="mt-2 text-xl font-semibold text-slate-300">{formatCurrency(createdInvoice.vatAmount, createdInvoice.currency)}</p>
                  </div>
                </>
              ) : null}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Total</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(createdInvoice.totalAmount, createdInvoice.currency)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Paid</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(createdInvoice.amountPaid, createdInvoice.currency)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Status</p>
                <p className="mt-2 text-xl font-semibold text-white">{createdInvoice.paymentStatus === 'paid' ? 'Paid in Full' : createdInvoice.paymentStatus === 'partial' ? 'Partial' : createdInvoice.paymentStatus === 'credit' ? 'Credit' : 'Unpaid'}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={handleDownloadInvoice} className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">Download Invoice</button>
              <button type="button" onClick={handleCreateAnother} className="inline-flex items-center justify-center rounded-full border border-emerald-500 px-5 py-3 font-semibold text-emerald-100 transition hover:bg-emerald-500/20">Create Another</button>
              <button type="button" onClick={() => navigate('/sales')} className="inline-flex items-center justify-center rounded-full bg-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-600">Go to Sales</button>
            </div>
          </div>
        ) : null}

        {/* Row 1: Customer + Branch/Parts */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">

          {/* Customer card */}
          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            <div className="text-base font-semibold text-white">Customer</div>
            <button
              type="button"
              onClick={() => { setShowCustomerModal(true); setShowCustomerDropdown(true) }}
              className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-5 py-4 text-left text-white transition hover:border-cyan-500 hover:bg-slate-900"
            >
              {selectedCustomerId ? (
                <>
                  <span className="block text-lg font-semibold text-white">{selectedCustomerName}</span>
                  {selectedCustomerEmail ? <span className="mt-1 block text-sm text-slate-400">{selectedCustomerEmail}</span> : null}
                </>
              ) : (
                <span className="text-slate-400">Select a customer…</span>
              )}
            </button>
            <p className="text-xs text-slate-500">Search existing customers or add a new one.</p>

            {showCustomerModal ? (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-950/85 p-4">
                <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Customer selector</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">Choose or add a customer</h2>
                    </div>
                    <button type="button" onClick={() => { setShowCustomerModal(false); setShowNewCustomerForm(false) }} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Close</button>
                  </div>
                  <div className="space-y-5 p-6">
                    <label className="block text-sm text-slate-300">
                      Search customers
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(event) => { setCustomerSearch(event.target.value); setSelectedCustomerId(null); setSelectedCustomerName(''); setSelectedCustomerEmail(''); setShowCustomerDropdown(true) }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                        placeholder="Name, email, or phone"
                      />
                    </label>
                    <div className="space-y-3">
                      {showCustomerDropdown && filteredCustomers.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto rounded-[1.5rem] border border-slate-700 bg-slate-950 p-2 text-sm">
                          {filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => { setSelectedCustomerId(customer.id); setSelectedCustomerName(customer.full_name); setSelectedCustomerEmail(customer.email || ''); setCustomerSearch(''); setShowCustomerDropdown(false); setShowCustomerModal(false); setInvoiceMessage('') }}
                              className="w-full rounded-2xl px-4 py-3 text-left hover:bg-slate-800"
                            >
                              <p className="font-semibold text-white">{customer.full_name}</p>
                              {customer.email ? <p className="text-xs text-slate-400">{customer.email}</p> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <button type="button" onClick={() => setShowNewCustomerForm((prev) => !prev)} className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800">
                        {showNewCustomerForm ? 'Hide form' : '+ New customer'}
                      </button>
                      {showNewCustomerForm ? (
                        <form onSubmit={handleCreateCustomer} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-5 text-sm">
                          <label className="block">Name <input value={newCustomerForm.full_name} onChange={(e) => setNewCustomerForm((p) => ({ ...p, full_name: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none" required /></label>
                          <label className="block">Email <input type="email" value={newCustomerForm.email} onChange={(e) => setNewCustomerForm((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none" /></label>
                          <label className="block">Phone <input value={newCustomerForm.phone} onChange={(e) => setNewCustomerForm((p) => ({ ...p, phone: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none" /></label>
                          <div className="flex gap-3">
                            <button type="submit" disabled={creatingCustomer} className="rounded-2xl bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">{creatingCustomer ? 'Creating...' : 'Add customer'}</button>
                            <button type="button" onClick={() => setShowNewCustomerForm(false)} className="rounded-2xl border border-slate-700 px-5 py-2.5 text-slate-200 transition hover:bg-slate-800">Cancel</button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Branch + Available Parts */}
          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            {canManageBranches ? (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Select Branch</label>
                <select
                  value={branchScopeId}
                  onChange={(event) => setSelectedBranchId(event.target.value)}
                  className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (<option key={branch.id} value={branch.id}>{branch.name}</option>))}
                </select>
              </div>
            ) : null}
            <div className="flex-1 rounded-[1.5rem] border border-slate-700/50 bg-slate-950/50 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">Available items</p>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{filteredAvailableParts.length} shown</span>
              </div>
              <input
                type="text"
                value={partSearch}
                onChange={(event) => setPartSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                placeholder="Search by part name or OEM…"
              />
              <div className="flex-1 overflow-y-auto max-h-[380px] pr-1">
                {canManageBranches && !branchScopeId ? (
                  <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-700">
                    <p className="text-sm text-slate-400">Select a branch to see available parts</p>
                  </div>
                ) : filteredAvailableParts.length === 0 ? (
                  <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-700">
                    <p className="text-sm text-slate-400">{partSearch.trim() ? 'No parts match your search.' : 'No in-stock parts available.'}</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredAvailableParts.map((part) => {
                      const alreadySelected = lineItems.some((item) => item.part_id === part.id)
                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => (alreadySelected ? handleRemoveLineItem(part.id) : handleAddLineItem(part))}
                          aria-pressed={alreadySelected}
                          className={`w-full rounded-2xl border p-4 text-left transition ${alreadySelected ? 'border-emerald-500 bg-emerald-600/10' : 'border-slate-700 bg-slate-900/80 hover:border-cyan-500 hover:bg-slate-950'}`}
                        >
                          <p className="font-semibold text-white truncate">{part.part_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{part.oem_number || 'No OEM'}</p>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                            <span className="text-xs text-slate-500 uppercase">{part.currency}</span>
                            <span className="text-sm font-semibold text-white">{formatCurrency(part.asking_price, part.currency)}</span>
                          </div>
                          {alreadySelected ? <span className="mt-1 block text-xs text-emerald-400">✓ Added</span> : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Invoice Items */}
        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Invoice Items</h2>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-4 py-1.5 text-sm text-slate-300">{lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          {lineItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
              <p className="text-slate-400">No items selected yet. Click parts above to add them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr_auto] gap-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <div>Part</div><div>Asking Price</div><div>Sale Price</div><div className="text-right">Line Total</div><div className="w-24"></div>
              </div>
              {lineItems.map((item) => {
                const isRemoving = removingIds.includes(item.part_id)
                const isJustAdded = justAddedId === item.part_id
                return (
                  <div
                    key={item.part_id}
                    className={`grid gap-4 rounded-2xl border p-5 items-center md:grid-cols-[2fr_1fr_1.5fr_1fr_auto] transition-all duration-200 ${isRemoving ? 'opacity-0 scale-95 h-0 p-0 m-0 overflow-hidden border-transparent' : 'border-slate-700 bg-slate-950'} ${isJustAdded ? 'ring-2 ring-emerald-400 border-transparent' : ''}`}
                  >
                    <div>
                      <p className="font-semibold text-white">{item.part_name}</p>
                      <p className="text-sm text-slate-400">{item.oem_number || 'No OEM'} · {item.currency}</p>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-500 md:hidden mb-1">Asking</div>
                      <div className="text-slate-300">{formatCurrency(item.asking_price, item.currency)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-500 md:hidden mb-1">Sale Price</div>
                      <input
                        type="number" min="0" step="0.01" value={item.sale_price}
                        onChange={(event) => { const value = event.target.value; setLineItems((prev) => prev.map((line) => (line.part_id === item.part_id ? { ...line, sale_price: value } : line))) }}
                        className="w-full max-w-[180px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                      />
                    </div>
                    <div className="md:text-right">
                      <div className="text-xs font-bold uppercase text-slate-500 md:hidden mb-1">Total</div>
                      <div className="font-semibold text-white">{formatCurrency(Number(item.sale_price || 0), item.currency)}</div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => handleRemoveLineItem(item.part_id)} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500 hover:text-white">Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Row 3: Payment + Summary */}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">

          {/* Payment method */}
          <div className="flex flex-col gap-5 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Payment Method</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 transition hover:border-cyan-500">
                <input type="radio" name="paymentStatus" value="paid_in_full" checked={paymentStatus === 'paid_in_full'} onChange={() => { setPaymentStatus('paid_in_full'); setAmountPaid('') }} className="h-4 w-4 accent-cyan-500" />
                <span className="text-sm font-medium text-slate-200">Paid in Full</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 transition hover:border-cyan-500">
                <input type="radio" name="paymentStatus" value="partial" checked={paymentStatus === 'partial'} onChange={() => setPaymentStatus('partial')} className="h-4 w-4 accent-cyan-500" />
                <span className="text-sm font-medium text-slate-200">Partial</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 transition hover:border-cyan-500">
                <input type="radio" name="paymentStatus" value="credit" checked={paymentStatus === 'credit'} onChange={() => { setPaymentStatus('credit'); setAmountPaid('') }} className="h-4 w-4 accent-cyan-500" />
                <span className="text-sm font-medium text-slate-200">Full Credit</span>
              </label>
            </div>
            {paymentStatus === 'partial' ? (
              <div className="rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 space-y-4">
                <label className="block text-sm font-medium text-slate-300">
                  Amount Paid
                  <input
                    type="number" min="0" step="0.01" value={amountPaid}
                    onChange={(event) => setAmountPaid(event.target.value)}
                    className="mt-2 w-full max-w-sm rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                    placeholder={`Less than ${formatCurrency(totalAmount, lineItems[0]?.currency)}`}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  Payment note <span className="text-slate-500">(optional)</span>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(event) => setPaymentNote(event.target.value)}
                    className="mt-2 w-full max-w-sm rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                    placeholder="e.g. Cash upfront, remainder on delivery"
                  />
                </label>
              </div>
            ) : null}
          </div>

          {/* Summary + submit */}
          <div className="flex flex-col rounded-[1.75rem] border border-slate-800 bg-slate-900/95 p-6 shadow-sm">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Summary</p>
            <div className="flex-1 space-y-4 text-slate-300">
              {currentStaff?.vatEnabled ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="font-semibold text-white">{formatCurrency(subtotal, lineItems[0]?.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">VAT (5%)</span>
                    <span className="font-semibold text-white">{formatCurrency(vatAmount, lineItems[0]?.currency)}</span>
                  </div>
                </>
              ) : null}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-slate-400">Total</span>
                  <span className="text-2xl font-bold text-white">{formatCurrency(totalAmount, lineItems[0]?.currency)}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Paid</span>
                  <span className="text-lg font-semibold text-emerald-400">{formatCurrency(totalPaid, lineItems[0]?.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Balance Due</span>
                  <span className="text-sm font-semibold text-rose-400">{formatCurrency(totalAmount - totalPaid, lineItems[0]?.currency)}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {invoiceMessage ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-sm font-medium text-rose-400">{invoiceMessage}</div>
              ) : null}
              {!canCreateInvoice && !submitting ? (
                <p className="text-center text-sm text-slate-500">Select a customer and add at least one item to continue</p>
              ) : null}
              <button
                type="button"
                disabled={submitting || !canCreateInvoice}
                onClick={handleConfirmInvoice}
                className="w-full rounded-2xl bg-cyan-500 py-4 text-base font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none"
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
