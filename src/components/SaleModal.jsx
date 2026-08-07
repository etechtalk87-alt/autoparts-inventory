import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadInvoicePdf } from '../lib/invoicePdf'

const emptyCustomerForm = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  country: '',
  notes: '',
}

export default function SaleModal({ part, currentStaff, onClose, onSaleComplete }) {
  const [salePrice, setSalePrice] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState(emptyCustomerForm)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('paid_in_full')
  const [amountPaid, setAmountPaid] = useState('')
  const [selling, setSelling] = useState(false)
  const [saleMessage, setSaleMessage] = useState('')
  const [saleInvoice, setSaleInvoice] = useState(null)
  const [isWalkIn, setIsWalkIn] = useState(false)
  const searchTimerRef = useRef(null)

  useEffect(() => {
    if (!part) return
    setSalePrice(part.asking_price || '')
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setShowNewCustomerForm(false)
    setNewCustomerForm(emptyCustomerForm)
    setSaleMessage('')
    setSaleInvoice(null)
    setIsWalkIn(false)
  }, [part?.id])

  useEffect(() => {
    if (!currentStaff?.company_id) {
      setFilteredCustomers([])
      return
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const query = customerSearch.trim()

    if (!query) {
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
      const q = query.replace('%', '\\%')
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

  if (!part) return null

  const resetAndClose = () => {
    setSalePrice('')
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setShowNewCustomerForm(false)
    setNewCustomerForm(emptyCustomerForm)
    setSaleInvoice(null)
    setSaleMessage('')
    setIsWalkIn(false)
    onClose?.()
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

    setSelectedCustomerId(data.id)
    setSelectedCustomerName(data.full_name || '')
    setShowNewCustomerForm(false)
    setNewCustomerForm(emptyCustomerForm)
    setCustomerSearch('')
    setSaleMessage('')
    setCreatingCustomer(false)
  }

  const confirmSale = async () => {
    if (!part) {
      setSaleMessage('No part selected.')
      return
    }
    if (!salePrice) {
      setSaleMessage('Please enter a sale price.')
      return
    }
    if (!selectedCustomerId && !isWalkIn) {
      setSaleMessage('Please select or create a customer, or mark this as a Walk-in Sale.')
      return
    }

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
      console.error('Failed to get sequential invoice number, using fallback:', invoiceNumberError)
    }

    const generatedInvoiceNumber = invoiceNumberResult || `INV-FALLBACK-${Date.now()}`
    const dbPaymentStatus = paymentStatus === 'paid_in_full' ? 'paid' : paymentStatus

    const { data: saleData, error: saleInsertError } = await supabase
      .from('sales')
      .insert([
        {
          company_id: currentStaff.company_id,
          branch_id: part.branch_id,
          part_id: part.id,
          sold_by: currentStaff.id,
          sale_price: Number(salePrice),
          customer_id: isWalkIn ? null : selectedCustomerId,
          customer_name: null,
          customer_contact: null,
          payment_status: dbPaymentStatus,
          amount_paid: finalAmountPaid,
          invoice_number: generatedInvoiceNumber,
        },
      ])
      .select('id, invoice_number, created_at, sale_price, amount_paid, payment_status, branch_id, part_id, customer_id')
      .single()

    if (saleInsertError) {
      setSaleMessage(saleInsertError.message)
      setSelling(false)
      return
    }

    if (finalAmountPaid > 0) {
      const { error: paymentInsertError } = await supabase.from('payments').insert([{
        company_id: currentStaff.company_id,
        customer_id: isWalkIn ? null : selectedCustomerId,
        sale_id: saleData.id,
        amount: finalAmountPaid,
        currency: part.currency || 'AED',
        payment_method: 'initial_payment',
        notes: 'Upfront payment at time of sale',
        recorded_by: currentStaff.id,
        payment_date: new Date().toISOString().split('T')[0],
      }])

      if (paymentInsertError) {
        console.error('Failed to record initial payment:', paymentInsertError)
      }
    }

    const { data: updateData, error: updateError } = await supabase
      .from('parts')
      .update({ status: 'sold', date_sold: new Date().toISOString() })
      .eq('id', part.id)
      .select('id')

    if (updateError) {
      setSaleMessage(updateError.message)
      setSelling(false)
      return
    }

    if (!updateData || updateData.length === 0) {
      setSaleMessage('Update failed - you may not have permission to modify this record.')
      setSelling(false)
      return
    }

    setSalePrice('')
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setPaymentStatus('paid_in_full')
    setAmountPaid('')
    setCustomerSearch('')
    setIsWalkIn(false)
    setSaleInvoice(saleData)
    setSaleMessage('Part marked as sold. You can download the invoice below.')
    setSelling(false)

    onSaleComplete?.(part.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
        <h3 className="text-xl font-semibold">Mark Part as Sold</h3>
        <p className="mt-2 text-sm text-slate-400">
          Record the sale for {part.part_name}.
        </p>

        {!saleInvoice ? (
          <>
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

            <label className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={isWalkIn}
                onChange={(e) => {
                  setIsWalkIn(e.target.checked)
                  if (e.target.checked) {
                    setSelectedCustomerId(null)
                    setSelectedCustomerName('')
                    setCustomerSearch('')
                    setShowCustomerDropdown(false)
                    setShowNewCustomerForm(false)
                  }
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
              />
              <span className="text-sm text-slate-300">Walk-in Sale (no customer record)</span>
            </label>

            {!isWalkIn && (
              <>
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
                        ) : filteredCustomers.length > 0 ? (
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
              </>
            )}

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-300">Payment Status *</legend>
              {!selectedCustomerId && !isWalkIn ? (
                <p className="mt-2 text-sm text-slate-400">Select or create a customer to enable payment options.</p>
              ) : null}
              <div className="mt-2 space-y-2">
                <label className={`flex items-center gap-3 ${(!selectedCustomerId && !isWalkIn) ? 'opacity-60' : ''}`}>
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
                    disabled={(!selectedCustomerId && !isWalkIn)}
                  />
                  <span className="text-sm text-slate-300">Paid in Full</span>
                </label>
                <label className={`flex items-center gap-3 ${(!selectedCustomerId && !isWalkIn) ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="partial"
                    checked={paymentStatus === 'partial'}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="h-4 w-4"
                    disabled={(!selectedCustomerId && !isWalkIn)}
                  />
                  <span className="text-sm text-slate-300">Partial Payment</span>
                </label>
                <label className={`flex items-center gap-3 ${(!selectedCustomerId && !isWalkIn) ? 'opacity-60' : ''}`}>
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
                    disabled={(!selectedCustomerId && !isWalkIn)}
                  />
                  <span className="text-sm text-slate-300">Full Credit</span>
                </label>
              </div>
            </fieldset>

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

        {saleMessage ? (
          <p className={`mt-4 text-sm ${saleMessage.includes('Part marked as sold') ? 'text-emerald-400' : 'text-red-400'}`}>
            {saleMessage}
          </p>
        ) : null}

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
              onClick={resetAndClose}
              className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetAndClose}
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
  )
}