import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Wallet, Banknote, FileCheck, CircleDollarSign } from 'lucide-react'

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

function Payables() {
  const { currentStaff, loading } = useAuth()
  const [payables, setPayables] = useState([])
  const [loadingPayables, setLoadingPayables] = useState(true)

  const [payingId, setPayingId] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    if (!currentStaff?.company_id) return

    const fetchPayables = async () => {
      setLoadingPayables(true)
      const { data, error } = await supabase
        .from('payables')
        .select('id, amount, currency, amount_paid, status, created_at, vendor_id, donor_vehicle_id, vendors(full_name), donor_vehicles(make, model, year)')
        .eq('company_id', currentStaff.company_id)
        .order('created_at', { ascending: false })

      if (!error) {
        setPayables(data ?? [])
      } else {
        console.error('Error fetching payables:', error)
      }
      setLoadingPayables(false)
    }

    fetchPayables()
  }, [currentStaff?.company_id])

  const stats = useMemo(() => {
    let outstanding = 0
    let fullyPaid = 0
    
    payables.forEach(p => {
      if (p.status === 'paid') {
        fullyPaid++
      } else {
        outstanding += Number(p.amount) - Number(p.amount_paid)
      }
    })

    return {
      outstanding,
      fullyPaid,
      totalCount: payables.length,
      currency: payables[0]?.currency || 'AED' // using the most common or first currency for the summary display
    }
  }, [payables])

  const handleRecordPaymentClick = (payable) => {
    const remaining = Number(payable.amount) - Number(payable.amount_paid)
    setPaymentAmount(remaining.toString())
    setPaymentMethod('')
    setPaymentNotes('')
    setPaymentError('')
    setPayingId(payable.id)
  }

  const handlePaymentSubmit = async (event) => {
    event.preventDefault()
    setPaymentError('')
    const payable = payables.find((p) => p.id === payingId)
    if (!payable) return

    const remaining = Number(payable.amount) - Number(payable.amount_paid)
    const amt = Number(paymentAmount)

    if (Number.isNaN(amt) || amt <= 0) {
      setPaymentError('Amount must be greater than zero.')
      return
    }
    if (amt > remaining) {
      setPaymentError(`Amount cannot exceed the remaining balance of ${formatCurrency(remaining, payable.currency)}`)
      return
    }

    setSubmittingPayment(true)

    const { error: insertError } = await supabase.from('vendor_payments').insert({
      company_id: currentStaff.company_id,
      vendor_id: payable.vendor_id,
      payable_id: payable.id,
      amount: amt,
      currency: payable.currency,
      payment_method: paymentMethod || null,
      notes: paymentNotes || null,
      recorded_by: currentStaff.id,
    })

    if (insertError) {
      setPaymentError(`Failed to record payment: ${insertError.message}`)
      setSubmittingPayment(false)
      return
    }

    const newAmountPaid = Number(payable.amount_paid) + amt
    const newStatus = newAmountPaid >= Number(payable.amount) ? 'paid' : 'partial'

    const { data: updatedPayable, error: updateError } = await supabase
      .from('payables')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', payable.id)
      .select('id, amount, currency, amount_paid, status, created_at, vendor_id, donor_vehicle_id, vendors(full_name), donor_vehicles(make, model, year)')
      .single()

    if (updateError) {
      setPaymentError(`Payment recorded, but failed to update payable status: ${updateError.message}`)
      setSubmittingPayment(false)
      return
    }

    setPayables((prev) => prev.map((p) => (p.id === payingId ? updatedPayable : p)))
    setPayingId(null)
    setSubmittingPayment(false)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading payables...
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <Wallet size={16} />
                Accounts Payable
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Payables</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Track what you owe vendors for donor vehicles and manage outstanding balances.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Banknote size={16} className="text-cyan-300" />
                  Total Payables
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats.totalCount}</div>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <CircleDollarSign size={16} />
                  Outstanding
                </div>
                <div className="mt-2 text-lg font-semibold text-white">{formatCurrency(stats.outstanding, stats.currency)}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <FileCheck size={16} />
                  Fully Paid
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats.fullyPaid}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Vendor Ledgers</h2>
              <p className="mt-1 text-sm text-slate-400">Review pending and completed payments.</p>
            </div>
          </div>

          {loadingPayables ? (
            <div className="p-8 text-slate-400">Loading payables...</div>
          ) : payables.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <Wallet size={28} className="mx-auto text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No payables yet</h3>
                <p className="mt-1 text-sm text-slate-400">When you buy a donor vehicle and assign a vendor, it will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Vendor</th>
                    <th className="px-6 py-3 font-medium">Vehicle</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Paid</th>
                    <th className="px-6 py-3 font-medium">Remaining</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/50">
                  {payables.map((payable) => {
                    const remaining = Number(payable.amount) - Number(payable.amount_paid)
                    return (
                      <tr key={payable.id} className="align-middle transition hover:bg-slate-800/60">
                        <td className="px-6 py-4 font-semibold text-white">
                          {payable.vendors?.full_name || 'Unknown Vendor'}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {payable.donor_vehicles 
                            ? `${payable.donor_vehicles.year} ${payable.donor_vehicles.make} ${payable.donor_vehicles.model}`
                            : 'Unknown Vehicle'}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {formatCurrency(payable.amount, payable.currency)}
                        </td>
                        <td className="px-6 py-4 text-emerald-400 font-medium">
                          {formatCurrency(payable.amount_paid, payable.currency)}
                        </td>
                        <td className="px-6 py-4 text-slate-200 font-medium">
                          {formatCurrency(remaining, payable.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            payable.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                            payable.status === 'partial' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}>
                            {payable.status === 'paid' ? 'Paid' : payable.status === 'partial' ? 'Partial' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(payable.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {payable.status !== 'paid' ? (
                            <button
                              type="button"
                              onClick={() => handleRecordPaymentClick(payable)}
                              className="rounded-lg border border-cyan-500 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/10"
                            >
                              Record Payment
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {payingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-white">Record Payment</h2>
              <button
                type="button"
                onClick={() => setPayingId(null)}
                className="text-slate-400 transition hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6">
              {paymentError ? (
                <div className="mb-6 rounded-lg bg-rose-500/10 p-4 text-sm text-rose-400">
                  {paymentError}
                </div>
              ) : null}

              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-300">
                  Amount
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                    placeholder="0.00"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  Payment Method <span className="text-slate-500">(Optional)</span>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                    placeholder="e.g. Bank Transfer, Cash"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  Notes <span className="text-slate-500">(Optional)</span>
                  <textarea
                    rows={3}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                    placeholder="Transaction ID, reference, etc."
                  />
                </label>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayingId(null)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                  disabled={submittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submittingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default Payables
