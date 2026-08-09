import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { generateReportPdf } from '../lib/reportPdf'
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
  const { t } = useTranslation()
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

  const handleExportPdf = async () => {
    const tEn = (key, fallback) => t(key, { lng: 'en', defaultValue: fallback })

    const columns = [
      { key: 'vendor', label: tEn('payables.colVendor', 'Vendor'), width: 1.5 },
      { key: 'vehicle', label: tEn('payables.colVehicle', 'Vehicle'), width: 2 },
      { key: 'amount', label: tEn('payables.colAmount', 'Amount'), align: 'right', width: 1 },
      { key: 'paid', label: tEn('payables.colPaid', 'Paid'), align: 'right', width: 1 },
      { key: 'remaining', label: tEn('payables.colRemaining', 'Remaining'), align: 'right', width: 1 },
      {
        key: 'status',
        label: tEn('payables.colStatus', 'Status'),
        width: 0.8,
        render: (value, row) => ({
          text: value,
          color: row._rawStatus === 'paid' ? '#059669' : row._rawStatus === 'partial' ? '#d97706' : '#dc2626',
        }),
      },
    ]

    const rows = payables.map((payable) => ({
      vendor: payable.vendors?.full_name || tEn('payables.unknownVendor', 'Unknown Vendor'),
      vehicle: payable.donor_vehicles
        ? `${payable.donor_vehicles.year} ${payable.donor_vehicles.make} ${payable.donor_vehicles.model}`
        : tEn('payables.unknownVehicle', 'Unknown Vehicle'),
      amount: formatCurrency(payable.amount, payable.currency),
      paid: formatCurrency(payable.amount_paid, payable.currency),
      remaining: formatCurrency(Number(payable.amount) - Number(payable.amount_paid), payable.currency),
      status: payable.status === 'paid' ? tEn('payables.statusPaid', 'Paid') : payable.status === 'partial' ? tEn('payables.statusPartial', 'Partial') : tEn('payables.statusUnpaid', 'Unpaid'),
      _rawStatus: payable.status,
    }))

    await generateReportPdf({
      companyName: currentStaff?.companyName || 'Auto Parts Inventory',
      reportTitle: tEn('payables.reportTitle', 'Payables Report'),
      columns,
      rows,
    })
  }

  const handlePaymentSubmit = async (event) => {
    event.preventDefault()
    setPaymentError('')
    const payable = payables.find((p) => p.id === payingId)
    if (!payable) return

    const remaining = Number(payable.amount) - Number(payable.amount_paid)
    const amt = Number(paymentAmount)

    if (Number.isNaN(amt) || amt <= 0) {
      setPaymentError(t('payables.amountMustBeGreaterThanZero', 'Amount must be greater than zero.'))
      return
    }
    if (amt > remaining) {
      setPaymentError(t('payables.amountExceedsRemaining', 'Amount cannot exceed the remaining balance of {{amount}}', { amount: formatCurrency(remaining, payable.currency) }))
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
      setPaymentError(t('payables.failedToRecord', 'Failed to record payment: {{error}}', { error: insertError.message }))
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
      setPaymentError(t('payables.recordedButFailedUpdate', 'Payment recorded, but failed to update payable status: {{error}}', { error: updateError.message }))
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
          {t('payables.loadingPayables', 'Loading payables...')}
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
                {t('payables.accountsPayable', 'Accounts Payable')}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('payables.title', 'Payables')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                {t('payables.description', 'Track what you owe vendors for donor vehicles and manage outstanding balances.')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Banknote size={16} className="text-cyan-300" />
                  {t('payables.totalPayables', 'Total Payables')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats.totalCount}</div>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <CircleDollarSign size={16} />
                  {t('payables.outstanding', 'Outstanding')}
                </div>
                <div className="mt-2 text-lg font-semibold text-white">{formatCurrency(stats.outstanding, stats.currency)}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <FileCheck size={16} />
                  {t('payables.fullyPaid', 'Fully Paid')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{stats.fullyPaid}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{t('payables.vendorLedgers', 'Vendor Ledgers')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('payables.vendorLedgersDesc', 'Review pending and completed payments.')}</p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              {t('payables.exportPdf', 'Export PDF')}
            </button>
          </div>

          {loadingPayables ? (
            <div className="p-8 text-slate-400">{t('payables.loadingPayables', 'Loading payables...')}</div>
          ) : payables.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <Wallet size={28} className="mx-auto text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{t('payables.noPayablesYet', 'No payables yet')}</h3>
                <p className="mt-1 text-sm text-slate-400">{t('payables.noPayablesDesc', 'When you buy a donor vehicle and assign a vendor, it will appear here.')}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">{t('payables.colVendor', 'Vendor')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colVehicle', 'Vehicle')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colAmount', 'Amount')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colPaid', 'Paid')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colRemaining', 'Remaining')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colStatus', 'Status')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colDate', 'Date')}</th>
                    <th className="px-6 py-3 font-medium">{t('payables.colActions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/50">
                  {payables.map((payable) => {
                    const remaining = Number(payable.amount) - Number(payable.amount_paid)
                    return (
                      <tr key={payable.id} className="align-middle transition hover:bg-slate-800/60">
                        <td className="px-6 py-4 font-semibold text-white">
                          {payable.vendors?.full_name || t('payables.unknownVendor', 'Unknown Vendor')}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {payable.donor_vehicles 
                            ? `${payable.donor_vehicles.year} ${payable.donor_vehicles.make} ${payable.donor_vehicles.model}`
                            : t('payables.unknownVehicle', 'Unknown Vehicle')}
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
                            {payable.status === 'paid' ? t('payables.statusPaid', 'Paid') : payable.status === 'partial' ? t('payables.statusPartial', 'Partial') : t('payables.statusUnpaid', 'Unpaid')}
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
                              {t('payables.recordPayment', 'Record Payment')}
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
              <h2 className="text-xl font-semibold text-white">{t('payables.recordPayment', 'Record Payment')}</h2>
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
                  {t('payables.amount', 'Amount')}
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                    placeholder={t('payables.amountPlaceholder', '0.00')}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  {t('payables.paymentMethodOptional', 'Payment Method (Optional)')}
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                    placeholder={t('payables.methodPlaceholder', 'e.g. Bank Transfer, Cash')}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  {t('payables.notesOptional', 'Notes (Optional)')}
                  <textarea
                    rows={3}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-500"
                    placeholder={t('payables.notesPlaceholder', 'Transaction ID, reference, etc.')}
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
                  {t('payables.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submittingPayment ? t('payables.recording', 'Recording...') : t('payables.recordPayment', 'Record Payment')}
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
