import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, Boxes, Package2, PencilLine, Plus, Search, Sparkles, Trash2, Warehouse } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isAgingStock } from '../lib/aging'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { supabase } from '../lib/supabaseClient'
import { logAuditEvent } from '../lib/auditLog'
import TransferPartModal from '../components/TransferPartModal'
import AddEditPartModal from '../components/AddEditPartModal'

function Parts() {
  const { currentStaff, loading } = useAuth()
  const [parts, setParts] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingParts, setLoadingParts] = useState(true)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [searchParams] = useSearchParams()
  const [showAgingOnly, setShowAgingOnly] = useState(() => searchParams.get('aging') === 'true')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const currencyOptions = ['AED', 'USD']

  const [editingPart, setEditingPart] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const listRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [transferTarget, setTransferTarget] = useState(null)
  const [saleTarget, setSaleTarget] = useState(null)
  const [salePrice, setSalePrice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [selling, setSelling] = useState(false)
  const [saleMessage, setSaleMessage] = useState('')
  const [saleInvoice, setSaleInvoice] = useState(null)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('paid_in_full')
  const [amountPaid, setAmountPaid] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    country: '',
    notes: '',
  })
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  const canManageBranches = currentStaff?.role === 'company_admin'

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

  

  const fetchParts = async () => {
    if (!currentStaff?.company_id) {
      setParts([])
      setLoadingParts(false)
      return
    }

    setLoadingParts(true)
    let query = supabase
      .from('parts')
      .select('id, part_name, oem_number, category, condition, cost, asking_price, currency, status, company_id, branch_id, photo_url, date_added, created_at, donor_vehicles(make, model, year)')
      .eq('company_id', currentStaff.company_id)
      .order('part_name', { ascending: true })

    if (currentStaff?.role === 'branch_staff') {
      query = query.eq('branch_id', currentStaff.activeBranchId)
    }

    const { data, error } = await query

    if (!error) {
      setParts(data ?? [])
    } else {
      console.error('Error fetching parts:', error)
      setParts([])
    }

    setLoadingParts(false)
  }

  useEffect(() => {
    fetchBranches()
    fetchParts()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role])

  

  // Fetch customers for customer selector
  useEffect(() => {
    // Debounced server-backed search: queries customers by name or phone
    if (!currentStaff?.company_id) {
      setFilteredCustomers([])
      return
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    const query = customerSearch.trim()
    if (!query) {
      // show a small set of recent/first customers for quick select
      searchTimerRef.current = setTimeout(async () => {
        setSearchLoading(true)
        const { data, error } = await supabase
          .from('customers')
          .select('id, full_name, phone')
          .eq('company_id', currentStaff.company_id)
          .order('full_name', { ascending: true })
          .limit(5)

        if (!error) setFilteredCustomers(data ?? [])
        setSearchLoading(false)
      }, 150)
      return
    }

    setSearchLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      const q = query.replace("%", "\\%")
      // Use OR filtering for name or phone
      const filter = `full_name.ilike.%${q}%,phone.ilike.%${q}%`
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .eq('company_id', currentStaff.company_id)
        .or(filter)
        .order('full_name', { ascending: true })
        .limit(10)

      if (!error) setFilteredCustomers(data ?? [])
      setSearchLoading(false)
    }, 300)
  }, [customerSearch, currentStaff?.company_id])

  const filteredParts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase()

    return parts.filter((part) => {
      const matchesSearch =
        !needle ||
        part.part_name?.toLowerCase().includes(needle) ||
        part.oem_number?.toLowerCase().includes(needle)

      const matchesBranch = branchFilter === 'all' || String(part.branch_id) === branchFilter
      const matchesAging = !showAgingOnly || isAgingStock(part)

      return matchesSearch && matchesBranch && matchesAging
    })
  }, [branchFilter, parts, searchTerm, showAgingOnly])

  const pagedParts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredParts.slice(startIndex, startIndex + itemsPerPage)
  }, [currentPage, itemsPerPage, filteredParts])

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / itemsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, branchFilter, showAgingOnly])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading inventory...
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  const handleDeletePart = async (part) => {
    if (!part) return
    if (part.status === 'sold' || part.status === 'transferred') return

    const allowed = currentStaff.role === 'company_admin' || part.branch_id === currentStaff.activeBranchId
    if (!allowed) {
      setErrorMessage('You do not have permission to delete this part.')
      return
    }

    const ok = window.confirm(`Are you sure you want to delete ${part.part_name}? This cannot be undone.`)
    if (!ok) return

    const { data: existingPart, error: lookupError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', part.id)
      .single()

    if (lookupError) {
      setErrorMessage(lookupError.message || 'Unable to load part data for auditing.')
      return
    }

    const { data, error } = await supabase.from('parts').delete().eq('id', part.id).select('id')
    if (error) {
      if (error.code === '23503') {
        setErrorMessage('This part cannot be deleted because it has sales history. Parts with existing sales records are protected to preserve invoice accuracy.')
      } else {
        setErrorMessage(error.message)
      }
    } else if (!data || data.length === 0) {
      setErrorMessage('Update failed - you may not have permission to modify this record.')
    } else {
      if (existingPart) {
        await logAuditEvent({
          tableName: 'parts',
          recordId: part.id,
          action: 'delete',
          performedBy: currentStaff.id,
          companyId: currentStaff.company_id,
          snapshot: existingPart,
        })
      }
      setParts((prev) => prev.filter((p) => p.id !== part.id))
      setSuccessMessage('Part deleted.')
    }
  }

  const badgeClasses = {
    in_stock: 'bg-emerald-500/20 text-emerald-400',
    sold: 'bg-slate-500/20 text-slate-300',
    reserved: 'bg-amber-500/20 text-amber-400',
    pending: 'bg-cyan-500/20 text-cyan-400',
  }

  const openTransferModal = (part) => {
    setTransferTarget(part)
  }

  const openSaleModal = (part) => {
    setSaleTarget(part)
    setSalePrice(part.asking_price || '')
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setShowNewCustomerForm(false)
    setNewCustomerForm({
      full_name: '',
      phone: '',
      email: '',
      address: '',
      country: '',
      notes: '',
    })
    setSaleMessage('')
  }

  const handleCreateNewCustomer = async (e) => {
    e.preventDefault()

    if (!newCustomerForm.full_name.trim()) {
      setSaleMessage('Please enter customer name.')
      return
    }

    setCreatingCustomer(true)

    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          company_id: currentStaff.company_id,
          full_name: newCustomerForm.full_name,
          phone: newCustomerForm.phone || null,
          email: newCustomerForm.email || null,
          address: newCustomerForm.address || null,
          country: newCustomerForm.country || null,
          notes: newCustomerForm.notes || null,
        },
      ])
      .select('id, full_name, phone')
      .single()

    if (error) {
      setSaleMessage(`Error creating customer: ${error.message}`)
      setCreatingCustomer(false)
      return
    }

    // Add new customer to list
    setCustomers((prev) => [...prev, data])
    setSelectedCustomerId(data.id)
    setSelectedCustomerName(data.full_name || '')
    setShowNewCustomerForm(false)
    setNewCustomerForm({
      full_name: '',
      phone: '',
      email: '',
      address: '',
      country: '',
      notes: '',
    })
    setCustomerSearch('')
    setSaleMessage('')
    setCreatingCustomer(false)
  }

  const confirmSale = async () => {
    if (!saleTarget) {
      setSaleMessage('No part selected.')
      return
    }

    if (!salePrice) {
      setSaleMessage('Please enter a sale price.')
      return
    }

    if (!selectedCustomerId) {
      setSaleMessage('Please select or create a customer.')
      return
    }

    // Validate amount_paid
    let finalAmountPaid = 0
    if (paymentStatus === 'paid_in_full') {
      finalAmountPaid = Number(salePrice)
    } else if (paymentStatus === 'partial') {
      finalAmountPaid = Number(amountPaid || 0)
      if (finalAmountPaid <= 0 || finalAmountPaid >= Number(salePrice)) {
        setSaleMessage('Partial payment must be greater than 0 and less than sale price.')
        return
      }
    } else if (paymentStatus === 'credit') {
      finalAmountPaid = 0
    }

    setSelling(true)
    setSaleMessage('')

    const { data: invoiceNumberResult, error: invoiceNumberError } = await supabase
      .rpc('get_next_invoice_number', { p_company_id: currentStaff.company_id })

    if (invoiceNumberError || !invoiceNumberResult) {
      // Fall back to old behavior only if the new function somehow fails,
      // so a single sale isn't blocked entirely
      console.error('Failed to get sequential invoice number, using fallback:', invoiceNumberError)
    }

    const generatedInvoiceNumber = invoiceNumberResult || `INV-FALLBACK-${Date.now()}`

    const dbPaymentStatus = paymentStatus === 'paid_in_full' ? 'paid' : paymentStatus

    const { data: saleData, error: saleInsertError } = await supabase.from('sales').insert([
      {
        company_id: currentStaff.company_id,
        branch_id: saleTarget.branch_id,
        part_id: saleTarget.id,
        sold_by: currentStaff.id,
        sale_price: Number(salePrice),
        customer_id: selectedCustomerId,
        customer_name: null,
        customer_contact: null,
        payment_status: dbPaymentStatus,
        amount_paid: finalAmountPaid,
        invoice_number: generatedInvoiceNumber,
      },
    ]).select('id, invoice_number, created_at, sale_price, amount_paid, payment_status, branch_id, part_id, customer_id').single()

    if (saleInsertError) {
      setSaleMessage(saleInsertError.message)
      setSelling(false)
      return
    }

    if (finalAmountPaid > 0) {
      const { error: paymentInsertError } = await supabase.from('payments').insert([{
        company_id: currentStaff.company_id,
        customer_id: selectedCustomerId,
        sale_id: saleData.id,
        amount: finalAmountPaid,
        currency: saleTarget.currency || 'AED',
        payment_method: 'initial_payment',
        notes: 'Upfront payment at time of sale',
        recorded_by: currentStaff.id,
        payment_date: new Date().toISOString().split('T')[0]
      }])

      if (paymentInsertError) {
        console.error('Failed to record initial payment:', paymentInsertError)
      }
    }

    const { data: updateData, error: updateError } = await supabase
      .from('parts')
      .update({ status: 'sold', date_sold: new Date().toISOString() })
      .eq('id', saleTarget.id)
      .select('id')

    if (updateError) {
      setSaleMessage(updateError.message)
      setSelling(false)
      return
    } else if (!updateData || updateData.length === 0) {
      setSaleMessage('Update failed - you may not have permission to modify this record.')
      setSelling(false)
      return
    }

    setParts((prev) => prev.map((part) => (part.id === saleTarget.id ? { ...part, status: 'sold', date_sold: new Date().toISOString() } : part)))
    setSalePrice('')
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setCustomerSearch('')
    setSaleInvoice(saleData)
    setSaleMessage('Part marked as sold. You can download the invoice below.')
    setSelling(false)
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <Sparkles size={16} />
                Inventory control center
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Spare Parts Inventory</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Track spare parts by company and branch, and link them to donor vehicles in a more refined operational workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Boxes size={16} className="text-cyan-300" />
                  Visible inventory
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{filteredParts.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <BadgeCheck size={16} />
                  Branch ready
                </div>
                <div className="mt-2 text-sm text-slate-300">Each part remains aligned to your branch workflow.</div>
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div ref={listRef} tabIndex={-1} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl focus:outline-none">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Inventory List</h2>
              <p className="mt-1 text-sm text-slate-400">Search, filter, and manage parts without losing context.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-col gap-3 md:flex-row">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  <Search size={15} className="text-cyan-300" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="bg-transparent text-white outline-none"
                    placeholder="Search by part name or OEM"
                  />
                </label>
                {canManageBranches ? (
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                    <Warehouse size={15} className="text-cyan-300" />
                    <select
                      value={branchFilter}
                      onChange={(event) => setBranchFilter(event.target.value)}
                      className="bg-transparent text-white outline-none"
                    >
                      <option value="all">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={showAgingOnly}
                    onChange={(event) => setShowAgingOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  Show aging stock only
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('')
                  setSuccessMessage('')
                  setShowAddModal(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <Plus size={18} />
                Add Part
              </button>
            </div>
          </div>

          {loadingParts ? (
            <div className="p-8 text-slate-400">Loading parts...</div>
          ) : filteredParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 p-5">
                <Package2 size={28} className="mx-auto text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No parts found</h3>
                <p className="mt-1 text-sm text-slate-400">Try adjusting your search or branch filters to reveal more inventory.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Part</th>
                      <th className="px-6 py-3 font-medium">Source Vehicle</th>
                      <th className="px-6 py-3 font-medium">Condition</th>
                      <th className="px-6 py-3 font-medium">Cost</th>
                      <th className="px-6 py-3 font-medium">Asking Price</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-900/50">
                    {pagedParts.map((part) => (
                      <tr key={part.id} className="align-middle transition hover:bg-slate-800/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {part.photo_url ? (
                              <img
                                src={part.photo_url}
                                alt={part.part_name}
                                className="h-10 w-10 rounded-2xl object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                                <Package2 size={16} />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-white">{part.part_name}</div>
                              <div className="text-xs text-slate-400">{part.oem_number ?? '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {part.donor_vehicles ? (
                            <div
                              className="max-w-[180px] truncate text-sm text-slate-200"
                              title={`${part.donor_vehicles.make || ''} ${part.donor_vehicles.model || ''} ${part.donor_vehicles.year || ''}`.trim()}
                            >
                              {`${part.donor_vehicles.make || ''} ${part.donor_vehicles.model || ''} ${part.donor_vehicles.year || ''}`.trim() || '—'}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-300">{part.condition}</td>
                        <td className="px-6 py-4 font-semibold text-white">{`${part.currency || 'AED'} ${Number(part.cost).toFixed(2)}`}</td>
                        <td className="px-6 py-4 font-semibold text-white">{`${part.currency || 'AED'} ${Number(part.asking_price).toFixed(2)}`}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses[part.status] || 'bg-slate-500/20 text-slate-300'}`}>
                              {part.status?.replace('_', ' ')}
                            </span>
                            {isAgingStock(part) ? (
                              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                                Aging 60+
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {(currentStaff.role === 'company_admin' || part.branch_id === currentStaff.activeBranchId) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPart(part)
                                    setShowAddModal(true)
                                  }}
                                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-950 transition hover:bg-slate-200"
                                >
                                  <PencilLine size={15} />
                                  Edit
                                </button>

                                {part.status !== 'sold' && part.status !== 'transferred' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePart(part)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-500"
                                  >
                                    <Trash2 size={15} />
                                    Delete
                                  </button>
                                ) : null}

                                {part.status === 'in_stock' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openTransferModal(part)}
                                      className="rounded-xl bg-cyan-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
                                    >
                                      Transfer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openSaleModal(part)}
                                      className="rounded-xl bg-emerald-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
                                    >
                                      Mark as Sold
                                    </button>
                                  </>
                                )}
                              </>
                            )}
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
                    Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredParts.length)} of {filteredParts.length} parts
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

      <AddEditPartModal
        isOpen={showAddModal}
        editingPart={editingPart}
        branches={branches}
        loadingBranches={loadingBranches}
        canManageBranches={canManageBranches}
        currentStaff={currentStaff}
        currencyOptions={currencyOptions}
        onClose={() => {
          setShowAddModal(false)
          setEditingPart(null)
        }}
        onSaved={(savedPart) => {
          setParts((prev) => {
            const exists = prev.some((p) => p.id === savedPart.id)
            return exists
              ? prev.map((p) => (p.id === savedPart.id ? savedPart : p))
              : [savedPart, ...prev]
          })
          setShowAddModal(false)
          setEditingPart(null)
          requestAnimationFrame(() => listRef.current?.focus())
        }}
      />

      {saleTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
            <h3 className="text-xl font-semibold">Mark Part as Sold</h3>
            <p className="mt-2 text-sm text-slate-400">
              Record the sale for {saleTarget.part_name}.
            </p>

            {!saleInvoice ? (
              <>
                {/* Sale Price */}
                <label className="mt-4 block text-sm text-slate-300">
                  Sale Price *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  />
                </label>

                {/* Customer Selector */}
                <label className="mt-4 block text-sm text-slate-300">
                  Customer *
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={selectedCustomerId ? selectedCustomerName : customerSearch}
                      onChange={(event) => {
                        setCustomerSearch(event.target.value)
                        setSelectedCustomerId(null)
                        setSelectedCustomerName('')
                        setShowCustomerDropdown(true)
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search customer by name or phone..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    />
                    {showCustomerDropdown && (
                      <div className="absolute top-full mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 shadow-lg z-10">
                        {filteredCustomers.length > 0 && (
                          <div>
                            {filteredCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(customer.id)
                                  setSelectedCustomerName(customer.full_name || '')
                                  setCustomerSearch('')
                                  setShowCustomerDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
                              >
                                <div className="font-medium text-white">{customer.full_name}</div>
                                {customer.phone && <div className="text-xs text-slate-400">{customer.phone}</div>}
                              </button>
                            ))}
                          </div>
                        )}
                        {filteredCustomers.length === 0 && customerSearch.trim() ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewCustomerForm(true)
                              setShowCustomerDropdown(false)
                              setNewCustomerForm((prev) => ({ ...prev, full_name: customerSearch }))
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-cyan-400 hover:bg-slate-800 border-t border-slate-700 font-medium"
                          >
                            + Add '{customerSearch}' as new customer
                          </button>
                        ) : customers.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewCustomerForm(true)
                              setShowCustomerDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-cyan-400 hover:bg-slate-800 border-t border-slate-700 font-medium"
                          >
                            + Add new customer
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </label>

                {/* Inline New Customer Form */}
                {showNewCustomerForm && (
                  <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                    <h4 className="font-semibold text-white mb-3">Add New Customer</h4>
                    <label className="block text-sm text-slate-300 mb-3">
                      Full Name *
                      <input
                        type="text"
                        value={newCustomerForm.full_name}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, full_name: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                      />
                    </label>
                    <label className="block text-sm text-slate-300 mb-3">
                      Phone
                      <input
                        type="tel"
                        value={newCustomerForm.phone}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                      />
                    </label>
                    <label className="block text-sm text-slate-300 mb-3">
                      Email
                      <input
                        type="email"
                        value={newCustomerForm.email}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowNewCustomerForm(false)}
                        className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateNewCustomer}
                        disabled={creatingCustomer}
                        className="flex-1 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                      >
                        {creatingCustomer ? 'Creating...' : 'Create Customer'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment Status */}
                <fieldset className="mt-4">
                  <legend className="text-sm font-medium text-slate-300">Payment Status *</legend>
                  {!selectedCustomerId ? (
                    <p className="mt-2 text-sm text-slate-400">Select or create a customer to enable payment options.</p>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    <label className={`flex items-center gap-3 ${!selectedCustomerId ? 'opacity-60' : ''}`}>
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="paid_in_full"
                        checked={paymentStatus === 'paid_in_full'}
                        onChange={(e) => {
                          setPaymentStatus(e.target.value)
                          setAmountPaid('')
                        }}
                        className="h-4 w-4"
                        disabled={!selectedCustomerId}
                      />
                      <span className="text-sm text-slate-300">Paid in Full</span>
                    </label>
                    <label className={`flex items-center gap-3 ${!selectedCustomerId ? 'opacity-60' : ''}`}>
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="partial"
                        checked={paymentStatus === 'partial'}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="h-4 w-4"
                        disabled={!selectedCustomerId}
                      />
                      <span className="text-sm text-slate-300">Partial Payment</span>
                    </label>
                    <label className={`flex items-center gap-3 ${!selectedCustomerId ? 'opacity-60' : ''}`}>
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="credit"
                        checked={paymentStatus === 'credit'}
                        onChange={(e) => {
                          setPaymentStatus(e.target.value)
                          setAmountPaid('')
                        }}
                        className="h-4 w-4"
                        disabled={!selectedCustomerId}
                      />
                      <span className="text-sm text-slate-300">Full Credit</span>
                    </label>
                  </div>
                </fieldset>

                {/* Amount Paid (only for partial) */}
                {paymentStatus === 'partial' && (
                  <label className="mt-4 block text-sm text-slate-300">
                    Amount Paid *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountPaid}
                      onChange={(event) => setAmountPaid(event.target.value)}
                      placeholder={`Less than ${Number(salePrice).toFixed(2)}`}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    />
                  </label>
                )}
              </>
            ) : null}

            {saleMessage ? <p className={`mt-4 text-sm ${saleMessage.includes('Part marked as sold') ? 'text-emerald-400' : 'text-red-400'}`}>{saleMessage}</p> : null}
            {saleInvoice ? (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => downloadInvoicePdf({
                    supabaseClient: supabase,
                    companyId: currentStaff.company_id,
                    branchId: saleInvoice.branch_id,
                    partId: saleInvoice.part_id,
                    sale: saleInvoice,
                  })}
                  className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-400"
                >
                  Download Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaleTarget(null)
                    setSalePrice('')
                    setSelectedCustomerId(null)
                    setSelectedCustomerName('')
                    setPaymentStatus('paid_in_full')
                    setAmountPaid('')
                    setCustomerSearch('')
                    setShowCustomerDropdown(false)
                    setShowNewCustomerForm(false)
                    setNewCustomerForm({
                      full_name: '',
                      phone: '',
                      email: '',
                      address: '',
                      country: '',
                      notes: '',
                    })
                    setSaleInvoice(null)
                    setSaleMessage('')
                  }}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSaleTarget(null)
                    setSalePrice('')
                    setSelectedCustomerId(null)
                    setSelectedCustomerName('')
                    setPaymentStatus('paid_in_full')
                    setAmountPaid('')
                    setCustomerSearch('')
                    setShowCustomerDropdown(false)
                    setShowNewCustomerForm(false)
                    setNewCustomerForm({
                      full_name: '',
                      phone: '',
                      email: '',
                      address: '',
                      country: '',
                      notes: '',
                    })
                    setSaleInvoice(null)
                    setSaleMessage('')
                  }}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSale}
                  disabled={selling}
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selling ? 'Saving...' : 'Confirm Sale'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <TransferPartModal
        part={transferTarget}
        branches={branches}
        currentStaff={currentStaff}
        onClose={() => setTransferTarget(null)}
        onTransferComplete={(newBranchId) => {
          setParts((prev) => prev.map((part) => (part.id === transferTarget?.id ? { ...part, branch_id: newBranchId } : part)))
          setTransferTarget(null)
        }}
      />
    </main>
  )
}

export default Parts
