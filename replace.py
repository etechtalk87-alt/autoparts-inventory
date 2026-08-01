import re

with open('src/pages/CreateInvoice.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the start of the main return block
start_idx = text.find('  return (\n    <main className="min-h-screen')
if start_idx == -1:
    start_idx = text.find('  return (\n')
    
# Extract the customer modal code accurately
modal_start = text.find('{showCustomerModal ? (')
modal_end_str = '            </div>\n\n            <div className="space-y-4 rounded-[1.75rem]'
modal_end = text.find(modal_end_str)
modal_code = text[modal_start:modal_end].strip()

# Now create the new return block
new_return = f'''  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8 lg:py-10">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Create Invoice</h1>
            <p className="mt-2 text-sm text-slate-400">Build a multi-item invoice from in-stock parts.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={{resetForm}}
              className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
            >
              Reset Form
            </button>
          </div>
        </div>

        {{successMessage && createdInvoice ? (
          <div ref={{successRef}} className="rounded-3xl border border-emerald-500/20 bg-slate-950/90 p-6 shadow-xl shadow-emerald-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-emerald-400/80">Invoice created</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{{createdInvoice.invoiceNumber}}</h2>
                <p className="mt-1 text-sm text-slate-400">{{createdInvoice.customerName}} · {{createdInvoice.branchName}}</p>
              </div>
              <div className="rounded-3xl bg-slate-900/90 px-6 py-3 text-right text-sm text-slate-300 ring-1 ring-slate-700">
                <p className="text-slate-400">Items</p>
                <p className="mt-1 text-2xl font-semibold text-white">{{createdInvoice.itemCount}}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {{createdInvoice.vatAmount > 0 ? (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Subtotal</p>
                    <p className="mt-2 text-xl font-semibold text-slate-300">{{formatCurrency(createdInvoice.subtotal, createdInvoice.currency)}}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">VAT (5%)</p>
                    <p className="mt-2 text-xl font-semibold text-slate-300">{{formatCurrency(createdInvoice.vatAmount, createdInvoice.currency)}}</p>
                  </div>
                </>
              ) : null}}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Total</p>
                <p className="mt-2 text-xl font-semibold text-white">{{formatCurrency(createdInvoice.totalAmount, createdInvoice.currency)}}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Paid</p>
                <p className="mt-2 text-xl font-semibold text-white">{{formatCurrency(createdInvoice.amountPaid, createdInvoice.currency)}}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 md:col-span-4 lg:col-span-1">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Status</p>
                <p className="mt-2 text-xl font-semibold text-white">{{createdInvoice.paymentStatus === 'paid' ? 'Paid' : createdInvoice.paymentStatus === 'paid_in_full' ? 'Paid in Full' : createdInvoice.paymentStatus === 'partial' ? 'Partial' : createdInvoice.paymentStatus === 'credit' ? 'Credit' : 'Unpaid'}}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={{handleDownloadInvoice}}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Download Invoice
              </button>
              <button
                type="button"
                onClick={{handleCreateAnother}}
                className="inline-flex items-center justify-center rounded-full border border-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={{() => navigate('/sales')}}
                className="inline-flex items-center justify-center rounded-full bg-slate-700 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-600"
              >
                Go to Sales
              </button>
            </div>
          </div>
        ) : null}}

        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr] xl:grid-cols-[1fr_2fr]">
            
            <div className="space-y-4 rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-6 shadow-sm shadow-black/20 flex flex-col">
              <div className="text-lg font-semibold text-white">Customer Details</div>
              
              <div className="flex-1 rounded-[1.5rem] border border-slate-700 bg-slate-900/50 p-5 shadow-inner">
                <div className="text-sm font-medium text-slate-300 mb-3">Selected Customer</div>
                <button
                  type="button"
                  onClick={{() => {{
                    setShowCustomerModal(true)
                    setShowCustomerDropdown(true)
                  }}}}
                  className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-5 py-4 text-left text-white transition hover:border-cyan-500 hover:bg-slate-900"
                >
                  {{selectedCustomerId ? (
                    <>
                      <span className="block font-semibold text-white text-lg">{{selectedCustomerName}}</span>
                      {{selectedCustomerEmail ? <span className="mt-1 block text-sm text-slate-400">{{selectedCustomerEmail}}</span> : null}}
                    </>
                  ) : (
                    <span className="text-slate-400">Select a customer</span>
                  )}}
                </button>
                <p className="mt-3 text-xs text-slate-500">Tap to search existing customers or add a new one.</p>

                {modal_code}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-6 shadow-sm shadow-black/20">
              {{canManageBranches ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Select Branch
                  </label>
                  <select
                    value={{selectedBranchId}}
                    onChange={{(event) => setSelectedBranchId(event.target.value)}}
                    className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  >
                    <option value="">Select branch</option>
                    {{branches.map((branch) => (
                      <option key={{branch.id}} value={{branch.id}}>{{branch.name}}</option>
                    ))}}
                  </select>
                </div>
              ) : null}}

              <div className="flex-1 rounded-[1.5rem] border border-slate-700/50 bg-slate-950/50 p-5 shadow-inner flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">Available items</p>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{{filteredAvailableParts.length}} shown</span>
                </div>

                <div className="mt-4">
                  <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">
                    Search parts
                  </label>
                  <input
                    type="text"
                    value={{partSearch}}
                    onChange={{(event) => setPartSearch(event.target.value)}}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500 focus:bg-slate-950"
                    placeholder="Search by part name or OEM"
                  />
                  <p className="mt-2 text-xs text-slate-500">Tap an item to add it to the invoice.</p>
                </div>

                <div className="mt-4 flex-1 overflow-y-auto max-h-[400px] pr-2">
                  {{filteredAvailableParts.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {{filteredAvailableParts.map((part) => (
                        <button
                          key={{part.id}}
                          type="button"
                          onClick={{() => handleAddLineItem(part)}}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-left transition shadow-sm hover:border-cyan-500 hover:bg-slate-950 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="font-semibold text-white truncate" title={{part.part_name}}>{{part.part_name}}</p>
                            <p className="text-sm text-slate-400">{{part.oem_number || 'No OEM'}}</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{{part.currency}}</span>
                            <span className="font-semibold text-white">{{formatCurrency(part.asking_price, part.currency)}}</span>
                          </div>
                        </button>
                      ))}}
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/30">
                      <p className="text-center text-sm text-slate-400">
                        {{canManageBranches && !branchScopeId
                          ? 'Select a branch to see available parts'
                          : partSearch.trim()
                            ? 'No parts match your search.'
                            : 'No in-stock parts available.'}}
                      </p>
                    </div>
                  )}}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-6 shadow-sm shadow-black/20">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-xl font-semibold">Invoice Items</h2>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm font-medium text-slate-300">
                {{lineItems.length}} {{lineItems.length === 1 ? 'item' : 'items'}} selected
              </span>
            </div>
            
            {{lineItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
                <p className="text-slate-400">No items selected yet. Add parts from the available items list above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden grid-cols-[2fr_1fr_1.5fr_1fr_auto] gap-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid">
                  <div>Part Details</div>
                  <div>Asking Price</div>
                  <div>Sale Price</div>
                  <div className="text-right">Line Total</div>
                  <div className="w-[100px]"></div>
                </div>
                
                <div className="space-y-3">
                  {{lineItems.map((item) => {{
                    const isRemoving = removingIds.includes(item.part_id)
                    const isJustAdded = justAddedId === item.part_id

                    return (
                      <div
                        key={{item.part_id}}
                        className={{`grid gap-4 rounded-2xl border p-5 items-center md:grid-cols-[2fr_1fr_1.5fr_1fr_auto] transition-all duration-200 ease-out ${{isRemoving ? 'opacity-0 scale-95 h-0 p-0 m-0 overflow-hidden border-transparent' : 'border-slate-700 bg-slate-900/60 shadow-sm'}} ${{isJustAdded ? 'ring-2 ring-emerald-400 border-transparent' : ''}}`}}
                      >
                        <div>
                          <p className="font-semibold text-white text-base">{{item.part_name}}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-400 text-sm">{{item.oem_number || 'No OEM'}}</span>
                            <span className="text-slate-600 text-xs px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800">{{item.currency}}</span>
                          </div>
                        </div>

                        <div className="text-sm">
                          <div className="text-slate-500 md:hidden mb-1 uppercase text-xs font-bold">Asking Price</div>
                          <div className="text-slate-300 font-medium">{{formatCurrency(item.asking_price, item.currency)}}</div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-500 md:hidden mb-2 uppercase text-xs font-bold">Sale Price</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={{item.sale_price}}
                            onChange={{(event) => {{
                              const value = event.target.value
                              setLineItems((prev) => prev.map((line) => (line.part_id === item.part_id ? {{ ...line, sale_price: value }} : line)))
                            }}}}
                            className="w-full max-w-[200px] rounded-xl border border-slate-600 bg-slate-950 px-4 py-2.5 text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>

                        <div className="text-left md:text-right">
                          <div className="text-sm text-slate-500 md:hidden mb-1 uppercase text-xs font-bold">Line Total</div>
                          <div className="text-slate-100 font-semibold text-lg">{{formatCurrency(Number(item.sale_price || 0), item.currency)}}</div>
                        </div>
                        
                        <div className="flex justify-end w-full md:w-[100px]">
                          <button
                            type="button"
                            onClick={{() => handleRemoveLineItem(item.part_id)}}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500 hover:text-white"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  }})}}
                </div>
              </div>
            )}}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="flex flex-col gap-6 rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-6 shadow-sm shadow-black/20">
              <div>
                <h2 className="text-xl font-semibold mb-4">Invoice Overview</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Customer</p>
                    <p className="mt-2 font-semibold text-white">{{selectedCustomerName || 'No customer selected'}}</p>
                    <p className="mt-1 text-sm text-slate-400">{{selectedCustomerEmail || 'N/A'}}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Branch</p>
                    <p className="mt-2 font-semibold text-white">{{selectedBranchName || 'No branch selected'}}</p>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-800/50"></div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 transition hover:border-cyan-500 hover:bg-slate-900">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="paid_in_full"
                      checked={{paymentStatus === 'paid_in_full'}}
                      onChange={{() => {{
                        setPaymentStatus('paid_in_full')
                        setAmountPaid('')
                      }}}}
                      className="h-4 w-4 text-cyan-500 accent-cyan-500"
                    />
                    <span className="text-sm font-medium text-slate-200">Paid in Full</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 transition hover:border-cyan-500 hover:bg-slate-900">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="partial"
                      checked={{paymentStatus === 'partial'}}
                      onChange={{() => setPaymentStatus('partial')}}
                      className="h-4 w-4 text-cyan-500 accent-cyan-500"
                    />
                    <span className="text-sm font-medium text-slate-200">Partial</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4 transition hover:border-cyan-500 hover:bg-slate-900">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="credit"
                      checked={{paymentStatus === 'credit'}}
                      onChange={{() => {{
                        setPaymentStatus('credit')
                        setAmountPaid('')
                      }}}}
                      className="h-4 w-4 text-cyan-500 accent-cyan-500"
                    />
                    <span className="text-sm font-medium text-slate-200">Full Credit</span>
                  </label>
                </div>
                
                {{paymentStatus === 'partial' ? (
                  <div className="mt-4 rounded-[1.25rem] border border-slate-700 bg-slate-900/50 p-4">
                    <label className="block text-sm font-medium text-slate-300">
                      Amount Paid
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={{amountPaid}}
                        onChange={{(event) => setAmountPaid(event.target.value)}}
                        className="mt-2 w-full max-w-sm rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        placeholder={{`Less than ${{formatCurrency(totalAmount, lineItems[0]?.currency)}}`}}
                      />
                    </label>
                  </div>
                ) : null}}
              </div>
            </div>

            <div className="flex flex-col rounded-[1.75rem] border border-slate-800 bg-slate-900/95 p-6 shadow-sm shadow-black/20">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Summary</p>
              
              <div className="mt-6 flex-1 space-y-4 text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">{{formatCurrency(subtotal, lineItems[0]?.currency)}}</span>
                </div>
                {{currentStaff?.vatEnabled ? (
                  <div className="flex items-center justify-between">
                    <span>VAT (5%)</span>
                    <span className="font-semibold text-white">{{formatCurrency(vatAmount, lineItems[0]?.currency)}}</span>
                  </div>
                ) : null}}
                
                <div className="my-4 border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-slate-400">Total</span>
                    <span className="text-2xl font-bold text-white">{{formatCurrency(totalAmount, lineItems[0]?.currency)}}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl bg-slate-950/80 border border-slate-800 p-5 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Total Paid</span>
                    <span className="text-lg font-semibold text-emerald-400">{{formatCurrency(totalPaid, lineItems[0]?.currency)}}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Balance Due</span>
                    <span className="text-sm font-semibold text-rose-400">{{formatCurrency(totalAmount - totalPaid, lineItems[0]?.currency)}}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {{invoiceMessage ? (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-medium text-rose-400 text-center">
                    {{invoiceMessage}}
                  </div>
                ) : null}}
                
                {{!canCreateInvoice && !submitting ? (
                  <div className="text-center text-sm font-medium text-slate-500">
                    Select a customer and add at least one item to continue
                  </div>
                ) : null}}

                <button
                  type="button"
                  disabled={{submitting || !canCreateInvoice}}
                  onClick={{handleConfirmInvoice}}
                  className="w-full rounded-2xl bg-cyan-500 py-4 text-base font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 hover:shadow-cyan-400/20 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none"
                >
                  {{submitting ? 'Creating Invoice...' : 'Create Invoice'}}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}}

export default CreateInvoice
'''

with open('src/pages/CreateInvoice.jsx', 'w', encoding='utf-8') as f:
    f.write(text[:start_idx] + new_return)
