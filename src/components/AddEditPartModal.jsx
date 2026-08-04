import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logAuditEvent } from '../lib/auditLog'

const emptyForm = {
  part_name: '',
  oem_number: '',
  category: '',
  condition: 'excellent',
  cost: '',
  asking_price: '',
  currency: 'AED',
  photo_url: '',
  donor_vehicle_id: '',
  branch_id: '',
  status: 'in_stock',
}

export default function AddEditPartModal({
  isOpen,
  editingPart,
  branches = [],
  loadingBranches,
  canManageBranches,
  currentStaff,
  currencyOptions = ['AED'],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [donorVehicles, setDonorVehicles] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (editingPart) {
      setForm({
        part_name: editingPart.part_name || '',
        oem_number: editingPart.oem_number || '',
        category: editingPart.category || '',
        condition: editingPart.condition || 'excellent',
        cost: editingPart.cost || '',
        asking_price: editingPart.asking_price || '',
        currency: editingPart.currency || 'AED',
        photo_url: editingPart.photo_url || '',
        donor_vehicle_id: editingPart.donor_vehicle_id || '',
        branch_id: editingPart.branch_id || (currentStaff?.role === 'branch_staff' ? currentStaff.activeBranchId : ''),
        status: editingPart.status || 'in_stock',
      })
      setPhotoPreview(editingPart.photo_url || null)
    } else {
      setForm({
        ...emptyForm,
        branch_id: currentStaff?.role === 'branch_staff' ? currentStaff.activeBranchId : '',
      })
      setPhotoPreview(null)
    }
    setPhotoFile(null)
    setErrorMessage('')
    setSuccessMessage('')
  }, [isOpen, editingPart?.id, currentStaff?.activeBranchId, currentStaff?.role])

  useEffect(() => {
    if (!isOpen || !currentStaff?.company_id) {
      setDonorVehicles([])
      return
    }

    const fetchVehicles = async () => {
      setLoadingVehicles(true)
      let query = supabase
        .from('donor_vehicles')
        .select('id, make, model, year')
        .eq('company_id', currentStaff.company_id)
        .is('deleted_at', null)

      if (currentStaff?.role === 'branch_staff') {
        query = query.eq('branch_id', currentStaff.activeBranchId)
      } else if (form.branch_id) {
        query = query.eq('branch_id', form.branch_id)
      }

      const { data, error } = await query.order('make', { ascending: true })

      if (!error) {
        setDonorVehicles(data ?? [])
      } else {
        console.error('Error fetching donor vehicles:', error)
        setDonorVehicles([])
      }
      setLoadingVehicles(false)
    }

    fetchVehicles()
  }, [isOpen, form.branch_id, currentStaff?.company_id, currentStaff?.role, currentStaff?.activeBranchId])

  if (!isOpen) return null

  const uploadPartPhoto = async (partId, file) => {
    const fileExt = file.name.split('.').pop()
    const filePath = `${currentStaff.company_id}/${partId}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('part-photos')
      .upload(filePath, file, { upsert: true })

    if (uploadError) throw new Error(uploadError.message)

    const { data: urlData } = supabase.storage
      .from('part-photos')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!form.part_name.trim() || !form.category.trim() || !form.cost || !form.asking_price) {
      setErrorMessage('Please fill in part name, category, cost, and asking price.')
      return
    }

    const payload = {
      part_name: form.part_name.trim(),
      oem_number: form.oem_number.trim() || null,
      category: form.category.trim(),
      condition: form.condition,
      cost: Number(form.cost),
      asking_price: Number(form.asking_price),
      currency: form.currency || 'AED',
      donor_vehicle_id: form.donor_vehicle_id || null,
      company_id: currentStaff.company_id,
      branch_id: currentStaff.role === 'branch_staff' ? currentStaff.activeBranchId : form.branch_id || null,
      status: form.status || 'in_stock',
    }

    setSubmitting(true)

    if (editingPart) {
      const { data: existingPart, error: lookupError } = await supabase
        .from('parts')
        .select('*')
        .eq('id', editingPart.id)
        .single()

      if (lookupError) {
        setErrorMessage(lookupError.message || 'Unable to load existing part data for auditing.')
        setSubmitting(false)
        return
      }

      const snapshot = existingPart ? {
        id: existingPart.id,
        part_name: existingPart.part_name,
        oem_number: existingPart.oem_number,
        category: existingPart.category,
        condition: existingPart.condition,
        cost: existingPart.cost,
        asking_price: existingPart.asking_price,
        currency: existingPart.currency,
        status: existingPart.status,
        company_id: existingPart.company_id,
        branch_id: existingPart.branch_id,
        donor_vehicle_id: existingPart.donor_vehicle_id,
      } : null

      const { data, error } = await supabase
        .from('parts')
        .update(payload)
        .eq('id', editingPart.id)
        .select('id, part_name, oem_number, category, condition, cost, asking_price, currency, status, company_id, branch_id, photo_url')

      if (error) {
        setErrorMessage(error.message)
        setSubmitting(false)
        return
      }

      if (!data || data.length === 0) {
        setErrorMessage('Update failed - you may not have permission to modify this record.')
        setSubmitting(false)
        return
      }

      const dataRow = data[0]

      if (photoFile) {
        try {
          const photoUrl = await uploadPartPhoto(editingPart.id, photoFile)
          await supabase.from('parts').update({ photo_url: photoUrl }).eq('id', editingPart.id)
          dataRow.photo_url = photoUrl
        } catch (err) {
          console.error('Photo upload failed:', err)
          setErrorMessage(`Part saved, but photo upload failed: ${err.message}`)
        }
      }

      if (snapshot && snapshot.donor_vehicle_id && payload.donor_vehicle_id !== snapshot.donor_vehicle_id) {
        await logAuditEvent({
          tableName: 'parts',
          recordId: editingPart.id,
          action: 'update',
          performedBy: currentStaff.id,
          companyId: currentStaff.company_id,
          snapshot,
        })
      }

      setSuccessMessage('Part updated successfully.')
      setSubmitting(false)
      onSaved?.(dataRow)
    } else {
      const { data, error } = await supabase
        .from('parts')
        .insert([payload])
        .select('id, part_name, oem_number, category, condition, cost, asking_price, currency, status, company_id, branch_id, photo_url')
        .single()

      if (error) {
        setErrorMessage(error.message)
        setSubmitting(false)
        return
      }

      if (photoFile) {
        try {
          const photoUrl = await uploadPartPhoto(data.id, photoFile)
          await supabase.from('parts').update({ photo_url: photoUrl }).eq('id', data.id)
          data.photo_url = photoUrl
        } catch (err) {
          console.error('Photo upload failed:', err)
          setErrorMessage(`Part saved, but photo upload failed: ${err.message}`)
        }
      }

      setSuccessMessage('Part added successfully.')
      setSubmitting(false)
      onSaved?.(data)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
        <h3 className="text-xl font-semibold">{editingPart ? 'Edit Part' : 'Add Part'}</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm text-slate-300">
            Part Name
            <input
              type="text"
              value={form.part_name}
              onChange={(event) => setForm((prev) => ({ ...prev, part_name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              placeholder="Headlight Assembly"
            />
          </label>
          <label className="text-sm text-slate-300">
            OEM Number
            <input
              type="text"
              value={form.oem_number}
              onChange={(event) => setForm((prev) => ({ ...prev, oem_number: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              placeholder="123456"
            />
          </label>
          <label className="text-sm text-slate-300">
            Category
            <input
              type="text"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              placeholder="Body"
            />
          </label>
          <label className="text-sm text-slate-300">
            Condition
            <select
              value={form.condition}
              onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="for parts">For Parts</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Cost
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              placeholder="120.00"
              disabled={editingPart && (form.status === 'sold' || form.status === 'transferred')}
            />
          </label>
          <label className="text-sm text-slate-300">
            Asking Price
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.asking_price}
              onChange={(event) => setForm((prev) => ({ ...prev, asking_price: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              placeholder="180.00"
            />
          </label>
          <label className="text-sm text-slate-300">
            Currency
            <select
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <span className="mb-1.5 block font-medium">Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  setPhotoFile(file)
                  setPhotoPreview(URL.createObjectURL(file))
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-slate-950 file:font-semibold"
            />
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="mt-3 h-32 w-32 rounded-xl object-cover border border-slate-700" />
            ) : form.photo_url ? (
              <img src={form.photo_url} alt="Current" className="mt-3 h-32 w-32 rounded-xl object-cover border border-slate-700" />
            ) : null}
          </label>
          {canManageBranches ? (
            <label className="text-sm text-slate-300">
              Branch
              <select
                value={form.branch_id}
                onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value, donor_vehicle_id: '' }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                disabled={loadingBranches}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-sm text-slate-300">
            Donor Vehicle
            <select
              value={form.donor_vehicle_id}
              onChange={(event) => setForm((prev) => ({ ...prev, donor_vehicle_id: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              disabled={loadingVehicles || (canManageBranches && !form.branch_id && currentStaff.role !== 'branch_staff') || (editingPart && (form.status === 'sold' || form.status === 'transferred'))}
            >
              <option value="">None</option>
              {donorVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} ({vehicle.year})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Status
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            >
              <option value="in_stock">In Stock</option>
              <option value="sold">Sold</option>
              <option value="reserved">Reserved</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          {errorMessage ? <p className="mt-2 text-sm text-red-400 md:col-span-2 xl:col-span-3">{errorMessage}</p> : null}
          {successMessage ? <p className="mt-2 text-sm text-emerald-400 md:col-span-2 xl:col-span-3">{successMessage}</p> : null}
          <div className="mt-2 flex justify-end gap-3 md:col-span-2 xl:col-span-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editingPart ? 'Save Changes' : 'Add Part'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}