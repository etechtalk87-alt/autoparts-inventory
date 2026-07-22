import { useEffect, useMemo, useRef, useState } from 'react'
import { CarFront, BadgeCheck, PencilLine, Plus, Sparkles, Trash2, Warehouse } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { logAuditEvent } from '../lib/auditLog'

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

function DonorVehicles() {
  const { currentStaff, loading } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchFilter, setBranchFilter] = useState('all')
  const [form, setForm] = useState({ make: '', model: '', year: '', vin: '', notes: '', purchase_price: '', purchase_currency: 'AED' })
  const [submitting, setSubmitting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const listRef = useRef(null)
  const [decodingVin, setDecodingVin] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [vinFeedback, setVinFeedback] = useState(null)

  const canManageBranch = currentStaff?.role === 'company_admin'

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

  const fetchVehicles = async () => {
    if (!currentStaff?.company_id) {
      setVehicles([])
      setLoadingVehicles(false)
      return
    }

    setLoadingVehicles(true)
    let query = supabase
      .from('donor_vehicles')
      .select('id, make, model, year, vin, notes, purchase_price, purchase_currency, company_id, branch_id, branches(name)')
      .eq('company_id', currentStaff.company_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (currentStaff?.role === 'branch_staff') {
      query = query.eq('branch_id', currentStaff.branch_id)
    }

    const { data, error } = await query

    if (!error) {
      setVehicles(data ?? [])
    } else {
      console.error('Error fetching donor vehicles:', error)
      setVehicles([])
    }

    setLoadingVehicles(false)
  }

  useEffect(() => {
    fetchBranches()
    fetchVehicles()
  }, [currentStaff?.company_id, currentStaff?.branch_id, currentStaff?.role])

  const visibleVehicles = useMemo(() => {
    if (branchFilter === 'all') return vehicles
    return vehicles.filter((vehicle) => String(vehicle.branch_id) === branchFilter)
  }, [branchFilter, vehicles])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading donor vehicles...
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  const handleDecodeVin = async () => {
    const trimmedVin = form.vin.trim().toUpperCase()

    if (!trimmedVin) {
      setVinFeedback({ type: 'error', message: 'Enter a VIN before decoding.' })
      return
    }

    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/
    if (!vinRegex.test(trimmedVin)) {
      setVinFeedback({ type: 'error', message: 'Please enter a valid 17-character VIN.' })
      return
    }

    setDecodingVin(true)
    setVinFeedback(null)

    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(trimmedVin)}?format=json`)

      if (!response.ok) {
        throw new Error('Unable to decode VIN right now.')
      }

      const data = await response.json()
      const results = Array.isArray(data?.Results) ? data.Results : []

      const findValue = (name) => {
        const row = results.find((item) => item?.Variable === name)
        return row?.Value?.toString().trim() || ''
      }

      const decodedMake = findValue('Make')
      const decodedModel = findValue('Model')
      const decodedYear = findValue('Model Year')
      const errorCode = findValue('Error Code')
      const errorText = findValue('Error Text') || 'VIN could not be decoded. You can still fill the fields manually.'

      if (errorCode !== '0') {
        setVinFeedback({
          type: 'error',
          message: errorText,
        })
        return
      }

      if (!decodedMake && !decodedModel) {
        setVinFeedback({
          type: 'error',
          message: 'VIN could not be decoded. You can still fill the fields manually.',
        })
        return
      }

      setForm((prev) => ({
        ...prev,
        vin: trimmedVin,
        make: prev.make.trim() ? prev.make : decodedMake,
        model: prev.model.trim() ? prev.model : decodedModel,
        year: prev.year ? prev.year : decodedYear,
      }))
      setVinFeedback({ type: 'success', message: 'VIN decoded successfully.' })
    } catch (error) {
      setVinFeedback({
        type: 'error',
        message: error.message || 'VIN could not be decoded. You can still fill the fields manually.',
      })
    } finally {
      setDecodingVin(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!form.make.trim() || !form.model.trim() || !form.year.trim()) {
      setErrorMessage('Please provide make, model, and year.')
      return
    }

    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      vin: form.vin.trim() || null,
      notes: form.notes.trim() || null,
      purchase_price: form.purchase_price !== '' ? Number(form.purchase_price) : null,
      purchase_currency: form.purchase_price !== '' ? form.purchase_currency || 'AED' : null,
      company_id: currentStaff.company_id,
      branch_id: currentStaff.role === 'branch_staff' ? currentStaff.branch_id : form.branch_id || null,
    }

    setSubmitting(true)

    if (editingId) {
      const { data, error } = await supabase
        .from('donor_vehicles')
        .update(payload)
        .eq('id', editingId)
        .select('id, make, model, year, vin, notes, company_id, branch_id, branches(name)')

      if (error) {
        setErrorMessage(error.message)
      } else if (!data || data.length === 0) {
        setErrorMessage('Update failed - you may not have permission to modify this record.')
      } else {
        setVehicles((prev) => prev.map((v) => (v.id === data[0].id ? data[0] : v)))
        setEditingId(null)
        setForm({ make: '', model: '', year: '', vin: '', notes: '' })
        setShowAddModal(false)
        setSuccessMessage('Donor vehicle updated successfully.')
        requestAnimationFrame(() => listRef.current?.focus())
      }
    } else {
      const { data, error } = await supabase
        .from('donor_vehicles')
        .insert([payload])
        .select('id, make, model, year, vin, notes, company_id, branch_id, branches(name)')
        .single()

      if (error) {
        setErrorMessage(error.message)
      } else {
        setVehicles((prev) => [data, ...prev])
        setForm({ make: '', model: '', year: '', vin: '', notes: '' })
        setShowAddModal(false)
        setSuccessMessage('Donor vehicle added successfully.')
        requestAnimationFrame(() => listRef.current?.focus())
      }
    }

    setSubmitting(false)
  }

  const startEditVehicle = (vehicle) => {
    setEditingId(vehicle.id)
    setForm({
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year ? String(vehicle.year) : '',
      vin: vehicle.vin || '',
      notes: vehicle.notes || '',
      purchase_price: vehicle.purchase_price != null ? String(vehicle.purchase_price) : '',
      purchase_currency: vehicle.purchase_currency || 'AED',
      branch_id: vehicle.branch_id || '',
    })
    setErrorMessage('')
    setSuccessMessage('')
    setShowAddModal(true)
  }

  const handleDeleteVehicle = async (vehicle) => {
    console.log('delete handler start', { vehicle, currentStaff })
    if (!vehicle) return

    setErrorMessage('')
    setSuccessMessage('')

    const ok = window.confirm(`Are you sure you want to delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`)
    console.log('delete confirm result', ok)
    if (!ok) return

    if (!currentStaff?.company_id) {
      setErrorMessage('You need an active company session to delete this vehicle.')
      return
    }

    const canManageVehicle = currentStaff?.role === 'company_admin' || String(vehicle.branch_id ?? '') === String(currentStaff?.branch_id ?? '')
    if (!canManageVehicle) {
      setErrorMessage('You do not have permission to delete this vehicle.')
      return
    }

    let linkedPartsQuery = supabase
      .from('parts')
      .select('id', { count: 'exact', head: true })
      .eq('donor_vehicle_id', vehicle.id)
      .eq('company_id', currentStaff.company_id)

    if (currentStaff?.role === 'branch_staff') {
      linkedPartsQuery = linkedPartsQuery.eq('branch_id', currentStaff.branch_id)
    }

    const { count: linkedPartsCount, error: linkedPartsError } = await linkedPartsQuery

    if (linkedPartsError) {
      setErrorMessage(linkedPartsError.message || 'Unable to verify linked parts before deleting this donor vehicle.')
      return
    }

    if ((linkedPartsCount ?? 0) > 0) {
      setErrorMessage(`This donor vehicle still has ${linkedPartsCount} linked part${linkedPartsCount === 1 ? '' : 's'}. Reassign or remove those parts before deleting the vehicle.`)
      return
    }

    const snapshot = {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      notes: vehicle.notes,
      company_id: vehicle.company_id,
      branch_id: vehicle.branch_id,
    }

    let updateQuery = supabase
      .from('donor_vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', vehicle.id)
      .eq('company_id', currentStaff.company_id)
      .select('id')

    if (currentStaff?.role === 'branch_staff') {
      updateQuery = updateQuery.eq('branch_id', currentStaff.branch_id)
    }

    const { data, error } = await updateQuery

    if (error) {
      setErrorMessage(error.message || 'Unable to delete this donor vehicle right now.')
      return
    }

    if (!data?.length) {
      setErrorMessage('The donor vehicle could not be marked as deleted. It may already be deleted or your access policy may be blocking the change.')
      return
    }

    await logAuditEvent({
      tableName: 'donor_vehicles',
      recordId: vehicle.id,
      action: 'soft_delete',
      performedBy: currentStaff.id,
      companyId: currentStaff.company_id,
      snapshot,
    })

    setVehicles((prev) => prev.filter((item) => item.id !== vehicle.id))
    setSuccessMessage('Donor vehicle deleted.')
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <Sparkles size={16} />
                Vehicle intake workspace
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Donor Vehicles</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Record donor vehicles for your company and assign them to the right branch with a refined operational flow.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <CarFront size={16} className="text-cyan-300" />
                  Vehicles tracked
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{visibleVehicles.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <BadgeCheck size={16} />
                  Branch aligned
                </div>
                <div className="mt-2 text-sm text-slate-300">Every vehicle stays connected to your branch structure.</div>
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
              <h2 className="text-xl font-semibold text-white">Existing Vehicles</h2>
              <p className="mt-1 text-sm text-slate-400">Monitor and manage the donor vehicles available across your branches.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {canManageBranch ? (
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  <Warehouse size={15} className="text-cyan-300" />
                  <span>Branch</span>
                  <select
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                    className="bg-transparent text-white outline-none"
                  >
                    <option value="all">All branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
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
                Add Vehicle
              </button>
            </div>
          </div>

          {loadingVehicles ? (
            <div className="p-8 text-slate-400">Loading vehicles...</div>
          ) : visibleVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <CarFront size={28} className="mx-auto text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No donor vehicles yet</h3>
                <p className="mt-1 text-sm text-slate-400">Add your first vehicle to start organizing your donor inventory.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Make</th>
                    <th className="px-6 py-3 font-medium">Model</th>
                    <th className="px-6 py-3 font-medium">Year</th>
                    <th className="px-6 py-3 font-medium">VIN</th>
                    <th className="px-6 py-3 font-medium">Purchase Price</th>
                    <th className="px-6 py-3 font-medium">Branch</th>
                    <th className="px-6 py-3 font-medium">Notes</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/50">
                  {visibleVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="align-middle transition hover:bg-slate-800/60">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                            <CarFront size={16} />
                          </div>
                          <div className="font-semibold text-white">{vehicle.make}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{vehicle.model}</td>
                      <td className="px-6 py-4 text-slate-300">{vehicle.year}</td>
                      <td className="px-6 py-4 text-slate-300">{vehicle.vin ?? '—'}</td>
                      <td className="px-6 py-4 font-semibold text-white">{vehicle.purchase_price != null ? formatCurrency(vehicle.purchase_price, vehicle.purchase_currency || 'AED') : '—'}</td>
                      <td className="px-6 py-4 text-slate-300">{vehicle.branches?.name ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-300">{vehicle.notes ?? '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(currentStaff.role === 'company_admin' || vehicle.branch_id === currentStaff.branch_id) && (
                            <>
                              <button type="button" onClick={() => startEditVehicle(vehicle)} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-950 transition hover:bg-slate-200">
                                <PencilLine size={15} />
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteVehicle(vehicle)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-500">
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
            <h3 className="text-xl font-semibold text-white">{editingId ? 'Edit Donor Vehicle' : 'Add Donor Vehicle'}</h3>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">Make</span>
                <input
                  type="text"
                  value={form.make}
                  onChange={(event) => setForm((prev) => ({ ...prev, make: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="Toyota"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">Model</span>
                <input
                  type="text"
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="Corolla"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">Year</span>
                <input
                  type="number"
                  value={form.year}
                  onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="2020"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">VIN (optional)</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={form.vin}
                    onChange={(event) => {
                      const nextVin = event.target.value
                      setForm((prev) => ({ ...prev, vin: nextVin }))
                      if (vinFeedback) {
                        setVinFeedback(null)
                      }
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                    placeholder="1HGCM82633A004352"
                  />
                  <button
                    type="button"
                    onClick={handleDecodeVin}
                    disabled={decodingVin || !form.vin.trim()}
                    className="rounded-xl border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decodingVin ? 'Decoding...' : 'Decode VIN'}
                  </button>
                </div>
                {vinFeedback ? (
                  <p className={`mt-2 text-sm ${vinFeedback.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {vinFeedback.message}
                  </p>
                ) : null}
              </label>
              {canManageBranch ? (
                <label className="text-sm text-slate-300">
                  <span className="mb-1.5 block font-medium">Branch</span>
                  <select
                    value={form.branch_id ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                    disabled={loadingBranches}
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">Purchase Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchase_price: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="5000.00"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">Currency</span>
                <select
                  value={form.purchase_currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchase_currency: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="text-sm text-slate-300 md:col-span-2 xl:col-span-1">
                <span className="mb-1.5 block font-medium">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="Condition, damage, or other notes"
                />
              </label>
              {errorMessage ? <p className="mt-4 text-sm text-red-400 md:col-span-2 xl:col-span-3">{errorMessage}</p> : null}
              {successMessage ? <p className="mt-4 text-sm text-emerald-400 md:col-span-2 xl:col-span-3">{successMessage}</p> : null}
              <div className="flex items-end md:col-span-2 xl:col-span-3">
                <div className="flex w-full justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setErrorMessage('')
                      setSuccessMessage('')
                      setEditingId(null)
                      setForm({ make: '', model: '', year: '', vin: '', notes: '', purchase_price: '', purchase_currency: 'AED' })
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
                    {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Vehicle'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default DonorVehicles
