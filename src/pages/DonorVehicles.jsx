import { useEffect, useMemo, useRef, useState } from 'react'
import { CarFront, BadgeCheck, PencilLine, Plus, Sparkles, Trash2, Warehouse } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { currentStaff, loading } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchFilter, setBranchFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [form, setForm] = useState({ make: '', model: '', year: '', vin: '', notes: '', purchase_price: '', purchase_currency: 'AED' })
  const [submitting, setSubmitting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const listRef = useRef(null)
  const [decodingVin, setDecodingVin] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [vinFeedback, setVinFeedback] = useState(null)
  const [vendors, setVendors] = useState([])
  const [vendorSearch, setVendorSearch] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState(null)
  const [selectedVendorName, setSelectedVendorName] = useState('')
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [showNewVendorForm, setShowNewVendorForm] = useState(false)
  const [newVendorForm, setNewVendorForm] = useState({ full_name: '', phone: '', email: '' })
  const [creatingVendor, setCreatingVendor] = useState(false)
  // Teardown Checklist State
  const [partTemplates, setPartTemplates] = useState([])
  const [showTeardownModal, setShowTeardownModal] = useState(false)
  const [teardownVehicle, setTeardownVehicle] = useState(null)
  const [teardownItems, setTeardownItems] = useState([])
  const [savingTeardown, setSavingTeardown] = useState(false)
  const [teardownError, setTeardownError] = useState('')
  const [teardownSuccess, setTeardownSuccess] = useState('')
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
      query = query.eq('branch_id', currentStaff.activeBranchId)
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
    if (!currentStaff?.company_id) return
    const fetchPartTemplates = async () => {
      const { data, error } = await supabase
        .from('part_templates')
        .select('id, part_name, category')
        .eq('company_id', currentStaff.company_id)
        .order('sort_order')
        .order('part_name')
      if (!error) {
        setPartTemplates(data ?? [])
      }
    }
    fetchPartTemplates()
  }, [currentStaff?.company_id])

  useEffect(() => {
    if (!currentStaff?.company_id) return
    const fetchVendors = async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, full_name, phone, email')
        .eq('company_id', currentStaff.company_id)
        .order('full_name')
      if (!error) {
        setVendors(data ?? [])
      }
    }
    fetchVendors()
  }, [currentStaff?.company_id])

  useEffect(() => {
    fetchBranches()
    fetchVehicles()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role])

  const visibleVehicles = useMemo(() => {
    if (branchFilter === 'all') return vehicles
    return vehicles.filter((vehicle) => String(vehicle.branch_id) === branchFilter)
  }, [branchFilter, vehicles])

  useEffect(() => {
    setCurrentPage(1)
  }, [branchFilter, vehicles])

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase()
    if (!q) return vendors.slice(0, 5)
    return vendors.filter((v) => 
      v.full_name.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q) || v.phone?.includes(q)
    ).slice(0, 10)
  }, [vendors, vendorSearch])

  const pagedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return visibleVehicles.slice(startIndex, startIndex + itemsPerPage)
  }, [currentPage, itemsPerPage, visibleVehicles])

  const totalPages = Math.max(1, Math.ceil(visibleVehicles.length / itemsPerPage))

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {t('donorVehicles.loading')}
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
      setVinFeedback({ type: 'error', message: t('donorVehicles.vinEnterBeforeDecoding') })
      return
    }
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/
    if (!vinRegex.test(trimmedVin)) {
      setVinFeedback({ type: 'error', message: t('donorVehicles.vinInvalid') })
      return
    }
    setDecodingVin(true)
    setVinFeedback(null)
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(trimmedVin)}?format=json`)
      if (!response.ok) {
        throw new Error(t('donorVehicles.vinUnableRightNow'))
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
      const errorText = findValue('Error Text') || t('donorVehicles.vinCouldNotDecode')
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
          message: t('donorVehicles.vinCouldNotDecode'),
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
      setVinFeedback({ type: 'success', message: t('donorVehicles.vinDecodedSuccess') })
    } catch (error) {
      setVinFeedback({
        type: 'error',
        message: error.message || t('donorVehicles.vinCouldNotDecode'),
      })
    } finally {
      setDecodingVin(false)
    }
  }

  const resetVendorState = () => {
    setSelectedVendorId(null)
    setSelectedVendorName('')
    setVendorSearch('')
    setShowVendorDropdown(false)
    setShowNewVendorForm(false)
    setNewVendorForm({ full_name: '', phone: '', email: '' })
  }

  const handleCreateVendor = async (event) => {
    event.preventDefault()
    if (!newVendorForm.full_name.trim()) {
      setErrorMessage(t('donorVehicles.pleaseEnterVendorName'))
      return
    }
    setCreatingVendor(true)
    const { data, error } = await supabase
      .from('vendors')
      .insert([{
        company_id: currentStaff.company_id,
        full_name: newVendorForm.full_name,
        phone: newVendorForm.phone || null,
        email: newVendorForm.email || null,
      }])
      .select('id, full_name, phone, email')
      .single()
    if (error) {
      setErrorMessage(error.message)
      setCreatingVendor(false)
      return
    }
    setVendors((prev) => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setSelectedVendorId(data.id)
    setSelectedVendorName(data.full_name)
    setShowNewVendorForm(false)
    setVendorSearch('')
    setErrorMessage('')
    setCreatingVendor(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (!form.make.trim() || !form.model.trim() || !form.year.trim()) {
      setErrorMessage(t('donorVehicles.fillMakeModelYear'))
      return
    }
    if (canManageBranch && !form.branch_id) {
      setErrorMessage(t('donorVehicles.selectBranchRequired'))
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
      branch_id: currentStaff.role === 'branch_staff' ? currentStaff.activeBranchId : form.branch_id || null,
    }
    setSubmitting(true)
    if (editingId) {
      const { data, error } = await supabase
        .from('donor_vehicles')
        .update(payload)
        .eq('id', editingId)
        .select('id, make, model, year, vin, notes, purchase_price, purchase_currency, company_id, branch_id, branches(name)')
      if (error) {
        setErrorMessage(error.message)
      } else if (!data || data.length === 0) {
        setErrorMessage(t('donorVehicles.updateFailedPermission'))
      } else {
        setVehicles((prev) => prev.map((v) => (v.id === data[0].id ? data[0] : v)))
        setEditingId(null)
        setForm({ make: '', model: '', year: '', vin: '', notes: '' })
        resetVendorState()
        setShowAddModal(false)
        setSuccessMessage(t('donorVehicles.vehicleUpdated'))
        requestAnimationFrame(() => listRef.current?.focus())
      }
    } else {
      if (form.purchase_price !== '' && Number(form.purchase_price) > 0 && !selectedVendorId) {
        setErrorMessage(t('donorVehicles.selectOrCreateVendor'))
        setSubmitting(false)
        return
      }
      const { data, error } = await supabase
        .from('donor_vehicles')
        .insert([payload])
        .select('id, make, model, year, vin, notes, purchase_price, purchase_currency, company_id, branch_id, branches(name)')
        .single()
      if (error) {
        setErrorMessage(error.message)
      } else {
        let payableFailed = false
        if (form.purchase_price !== '' && Number(form.purchase_price) > 0 && selectedVendorId) {
          const { error: payableError } = await supabase.from('payables').insert([{
            company_id: currentStaff.company_id,
            vendor_id: selectedVendorId,
            donor_vehicle_id: data.id,
            amount: Number(form.purchase_price),
            currency: form.purchase_currency || 'AED',
          }])
          if (payableError) {
            console.error('Failed to create payable:', payableError)
            setErrorMessage(t('donorVehicles.vehicleSavedPayableFailed', { error: payableError.message }))
            payableFailed = true
          }
        }
        setVehicles((prev) => [data, ...prev])
        setForm({ make: '', model: '', year: '', vin: '', notes: '' })
        resetVendorState()
        setShowAddModal(false)
        if (!payableFailed) {
          setSuccessMessage(t('donorVehicles.vehicleAdded'))
        }
        requestAnimationFrame(() => listRef.current?.focus())
        // TEARDOWN TRIGGER
        if (partTemplates.length > 0) {
          const initialTeardownItems = partTemplates.map((t) => ({
            template_id: t.id,
            part_name: t.part_name,
            category: t.category,
            selected: true,
            asking_price: '',
            cost: '',
            condition: 'good',
            photoFile: null,
            photoPreview: null,
          }))
          setTeardownItems(initialTeardownItems)
          setTeardownVehicle(data)
          setTeardownError('')
          setTeardownSuccess('')
          setShowTeardownModal(true)
        }
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
    resetVendorState()
    setShowAddModal(true)
  }

  const handleDeleteVehicle = async (vehicle) => {
    console.log('delete handler start', { vehicle, currentStaff })
    if (!vehicle) return
    setErrorMessage('')
    setSuccessMessage('')
    const ok = window.confirm(t('donorVehicles.confirmDeleteVehicle', { make: vehicle.make, model: vehicle.model }))
    console.log('delete confirm result', ok)
    if (!ok) return
    if (!currentStaff?.company_id) {
      setErrorMessage(t('donorVehicles.noCompanySession'))
      return
    }
    const canManageVehicle = currentStaff?.role === 'company_admin' || String(vehicle.branch_id ?? '') === String(currentStaff?.activeBranchId ?? '')
    if (!canManageVehicle) {
      setErrorMessage(t('donorVehicles.noPermissionDelete'))
      return
    }
    let linkedPartsQuery = supabase
      .from('parts')
      .select('id', { count: 'exact', head: true })
      .eq('donor_vehicle_id', vehicle.id)
      .eq('company_id', currentStaff.company_id)
    if (currentStaff?.role === 'branch_staff') {
      linkedPartsQuery = linkedPartsQuery.eq('branch_id', currentStaff.activeBranchId)
    }
    const { count: linkedPartsCount, error: linkedPartsError } = await linkedPartsQuery
    if (linkedPartsError) {
      setErrorMessage(linkedPartsError.message || t('donorVehicles.unableVerifyLinkedParts'))
      return
    }
    if ((linkedPartsCount ?? 0) > 0) {
      setErrorMessage(
        linkedPartsCount === 1
          ? t('donorVehicles.linkedPartsRemainingSingular', { count: linkedPartsCount })
          : t('donorVehicles.linkedPartsRemainingPlural', { count: linkedPartsCount })
      )
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
      updateQuery = updateQuery.eq('branch_id', currentStaff.activeBranchId)
    }
    const { data, error } = await updateQuery
    if (error) {
      setErrorMessage(error.message || t('donorVehicles.unableDeleteRightNow'))
      return
    }
    if (!data?.length) {
      setErrorMessage(t('donorVehicles.couldNotMarkDeleted'))
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
    setSuccessMessage(t('donorVehicles.vehicleDeleted'))
  }

  // TEARDOWN CHECKLIST FUNCTIONS
  const toggleTeardownItem = (template_id) => {
    setTeardownItems((prev) =>
      prev.map((item) => (item.template_id === template_id ? { ...item, selected: !item.selected } : item))
    )
  }
  const updateTeardownPrice = (template_id, value) => {
    setTeardownItems((prev) =>
      prev.map((item) => (item.template_id === template_id ? { ...item, asking_price: value } : item))
    )
  }
  const updateTeardownCost = (template_id, value) => {
    setTeardownItems((prev) =>
      prev.map((item) => (item.template_id === template_id ? { ...item, cost: value } : item))
    )
  }
  const updateTeardownPhoto = (template_id, file) => {
    setTeardownItems((prev) =>
      prev.map((item) =>
        item.template_id === template_id
          ? { ...item, photoFile: file, photoPreview: file ? URL.createObjectURL(file) : null }
          : item
      )
    )
  }
  const updateTeardownCondition = (template_id, value) => {
    setTeardownItems((prev) =>
      prev.map((item) => (item.template_id === template_id ? { ...item, condition: value } : item))
    )
  }
  const handleSkipTeardown = () => {
    setShowTeardownModal(false)
    setTeardownVehicle(null)
    setTeardownItems([])
    setTeardownError('')
    setTeardownSuccess('')
  }

  const handleSaveTeardown = async () => {
    const selectedItems = teardownItems.filter((i) => i.selected)
    if (selectedItems.length === 0) {
      handleSkipTeardown()
      return
    }
    setSavingTeardown(true)
    setTeardownError('')
    setTeardownSuccess('')
    let successCount = 0
    let photoUploadErrors = 0
    for (const item of selectedItems) {
      const payload = {
        company_id: currentStaff.company_id,
        branch_id: teardownVehicle.branch_id,
        donor_vehicle_id: teardownVehicle.id,
        part_name: item.part_name,
        category: item.category || null,
        currency: teardownVehicle.purchase_currency || 'AED',
        asking_price: item.asking_price !== '' ? Number(item.asking_price) : null,
        cost: item.cost !== '' ? Number(item.cost) : 0,
        condition: item.condition || null,
        status: 'in_stock',
      }
      const { data: insertedPart, error: insertError } = await supabase
        .from('parts')
        .insert([payload])
        .select('id')
        .single()
      if (insertError) {
        setTeardownError(t('donorVehicles.teardown.failedToSavePart', { partName: item.part_name, error: insertError.message }))
        setSavingTeardown(false)
        return
      }
      successCount++
      if (item.photoFile && insertedPart?.id) {
        try {
          const fileExt = item.photoFile.name.split('.').pop()
          const filePath = `${currentStaff.company_id}/${insertedPart.id}.${fileExt}`
          const { error: uploadError } = await supabase.storage
            .from('part-photos')
            .upload(filePath, item.photoFile, { upsert: true })
          if (uploadError) throw new Error(uploadError.message)
          const { data: urlData } = supabase.storage
            .from('part-photos')
            .getPublicUrl(filePath)
          await supabase
            .from('parts')
            .update({ photo_url: urlData.publicUrl })
            .eq('id', insertedPart.id)
        } catch (err) {
          console.error('Photo upload failed for', item.part_name, err)
          photoUploadErrors++
        }
      }
    }
    if (photoUploadErrors > 0) {
      setTeardownSuccess(
        successCount === 1
          ? t('donorVehicles.teardown.addedWithPhotoErrorsSingular', { count: successCount, photoCount: photoUploadErrors })
          : t('donorVehicles.teardown.addedWithPhotoErrorsPlural', { count: successCount, photoCount: photoUploadErrors })
      )
    } else {
      setTeardownSuccess(
        successCount === 1
          ? t('donorVehicles.teardown.addedSuccessSingular', { count: successCount })
          : t('donorVehicles.teardown.addedSuccessPlural', { count: successCount })
      )
    }
    setSavingTeardown(false)
    setTimeout(() => {
      handleSkipTeardown()
    }, 1500)
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <Sparkles size={16} />
                {t('donorVehicles.badge')}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('donorVehicles.title')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                {t('donorVehicles.subtitle')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <CarFront size={16} className="text-cyan-300" />
                  {t('donorVehicles.vehiclesTracked')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{visibleVehicles.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <BadgeCheck size={16} />
                  {t('donorVehicles.branchAligned')}
                </div>
                <div className="mt-2 text-sm text-slate-300">{t('donorVehicles.branchAlignedDesc')}</div>
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
              <h2 className="text-xl font-semibold text-white">{t('donorVehicles.existingVehicles')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('donorVehicles.existingVehiclesDesc')}</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {canManageBranch ? (
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  <Warehouse size={15} className="text-cyan-300" />
                  <span>{t('donorVehicles.branch')}</span>
                  <select
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                    className="bg-transparent text-white outline-none"
                  >
                    <option value="all">{t('donorVehicles.allBranches')}</option>
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
                  resetVendorState()
                  setShowAddModal(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <Plus size={18} />
                {t('donorVehicles.addVehicle')}
              </button>
            </div>
          </div>
          {loadingVehicles ? (
            <div className="p-8 text-slate-400">{t('donorVehicles.loadingVehicles')}</div>
          ) : visibleVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <CarFront size={28} className="mx-auto text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{t('donorVehicles.noVehiclesYet')}</h3>
                <p className="mt-1 text-sm text-slate-400">{t('donorVehicles.noVehiclesDesc')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colMake')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colModel')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colYear')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colVin')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colPurchasePrice')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colBranch')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colNotes')}</th>
                      <th className="px-6 py-3 font-medium">{t('donorVehicles.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-900/50">
                    {pagedVehicles.map((vehicle) => (
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
                            {(currentStaff.role === 'company_admin' || vehicle.branch_id === currentStaff.activeBranchId) && (
                              <>
                                <button type="button" onClick={() => startEditVehicle(vehicle)} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-950 transition hover:bg-slate-200">
                                  <PencilLine size={15} />
                                  {t('donorVehicles.edit')}
                                </button>
                                <button type="button" onClick={() => handleDeleteVehicle(vehicle)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-500">
                                  <Trash2 size={15} />
                                  {t('donorVehicles.delete')}
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
              {totalPages > 1 ? (
                <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    {t('donorVehicles.showingRange', {
                      start: (currentPage - 1) * itemsPerPage + 1,
                      end: Math.min(currentPage * itemsPerPage, visibleVehicles.length),
                      total: visibleVehicles.length,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('donorVehicles.previous')}
                    </button>
                    <span className="text-sm text-slate-300">{t('donorVehicles.pageOf', { current: currentPage, total: totalPages })}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('donorVehicles.next')}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
            <h3 className="text-xl font-semibold text-white">{editingId ? t('donorVehicles.editVehicleTitle') : t('donorVehicles.addVehicleTitle')}</h3>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">{t('donorVehicles.make')}</span>
                <input
                  type="text"
                  dir="ltr"
                  value={form.make}
                  onChange={(event) => setForm((prev) => ({ ...prev, make: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="Toyota"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">{t('donorVehicles.model')}</span>
                <input
                  type="text"
                  dir="ltr"
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="Corolla"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">{t('donorVehicles.year')}</span>
                <input
                  type="number"
                  value={form.year}
                  onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="2020"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">{t('donorVehicles.vinOptional')}</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    dir="ltr"
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
                    {decodingVin ? t('donorVehicles.decoding') : t('donorVehicles.decodeVin')}
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
                  <span className="mb-1.5 block font-medium">{t('donorVehicles.branch')}</span>
                  <select
                    value={form.branch_id ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                    disabled={loadingBranches}
                    required
                  >
                    <option value="">{t('donorVehicles.selectBranch')}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-sm text-slate-300">
                <span className="mb-1.5 block font-medium">{t('donorVehicles.purchasePrice')}</span>
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
                <span className="mb-1.5 block font-medium">{t('donorVehicles.currency')}</span>
                <select
                  value={form.purchase_currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchase_currency: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              {!editingId && form.purchase_price !== '' && Number(form.purchase_price) > 0 ? (
                <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3 md:col-span-2 xl:col-span-3">
                  <h4 className="font-medium text-slate-200">{t('donorVehicles.selectVendorForPayable')}</h4>
                  <label className="block text-sm text-slate-300">
                    <input
                      type="text"
                      value={selectedVendorId ? selectedVendorName : vendorSearch}
                      onChange={(event) => {
                        setVendorSearch(event.target.value)
                        setSelectedVendorId(null)
                        setSelectedVendorName('')
                        setShowVendorDropdown(true)
                      }}
                      onFocus={() => setShowVendorDropdown(true)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                      placeholder={t('donorVehicles.searchVendorPlaceholder')}
                    />
                  </label>
                  
                  {showVendorDropdown && filteredVendors.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200">
                      {filteredVendors.map((vendor) => (
                        <button
                          key={vendor.id}
                          type="button"
                          onClick={() => {
                            setSelectedVendorId(vendor.id)
                            setSelectedVendorName(vendor.full_name)
                            setVendorSearch('')
                            setShowVendorDropdown(false)
                            setErrorMessage('')
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800"
                        >
                          {vendor.full_name} {vendor.email ? `(${vendor.email})` : ''}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {selectedVendorId ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                      <p className="font-semibold text-white">{selectedVendorName}</p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowNewVendorForm((prev) => !prev)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                  >
                    {showNewVendorForm ? t('donorVehicles.hideVendorForm') : t('donorVehicles.createNewVendor')}
                  </button>
                  {showNewVendorForm ? (
                    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                      <label className="block">
                        {t('donorVehicles.vendorName')}
                        <input
                          value={newVendorForm.full_name}
                          onChange={(event) => setNewVendorForm((prev) => ({ ...prev, full_name: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none"
                          required
                        />
                      </label>
                      <label className="block">
                        {t('donorVehicles.vendorEmail')}
                        <input
                          type="email"
                          dir="ltr"
                          value={newVendorForm.email}
                          onChange={(event) => setNewVendorForm((prev) => ({ ...prev, email: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        {t('donorVehicles.vendorPhone')}
                        <input
                          dir="ltr"
                          value={newVendorForm.phone}
                          onChange={(event) => setNewVendorForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleCreateVendor}
                        disabled={creatingVendor}
                        className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingVendor ? t('donorVehicles.creatingVendor') : t('donorVehicles.addVendor')}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label className="text-sm text-slate-300 md:col-span-2 xl:col-span-1">
                <span className="mb-1.5 block font-medium">{t('donorVehicles.notes')}</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder={t('donorVehicles.placeholderNotes')}
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
                      resetVendorState()
                      setForm({ make: '', model: '', year: '', vin: '', notes: '', purchase_price: '', purchase_currency: 'AED' })
                    }}
                    className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                  >
                    {t('donorVehicles.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? t('donorVehicles.saving') : editingId ? t('donorVehicles.saveChanges') : t('donorVehicles.addVehicle')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {/* TEARDOWN MODAL */}
      {showTeardownModal && teardownVehicle ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[28px] border border-white/10 bg-slate-900 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
            <div className="p-6 pb-4">
              <h3 className="text-xl font-semibold text-white">
                {t('donorVehicles.teardown.title', { make: teardownVehicle.make, model: teardownVehicle.model })}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{t('donorVehicles.teardown.subtitle')}</p>
            </div>
            {teardownError && (
              <div className="mx-6 mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {teardownError}
              </div>
            )}
            {teardownSuccess && (
              <div className="mx-6 mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {teardownSuccess}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6">
              <div className="grid gap-2 sm:grid-cols-2">
                {teardownItems.map((item) => (
                  <div key={item.template_id} className={`flex flex-col gap-3 rounded-xl border p-3 transition ${item.selected ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-800 bg-slate-950'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleTeardownItem(item.template_id)}
                        className="h-5 w-5 rounded border-slate-600 bg-slate-800 accent-cyan-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-200">{item.part_name}</p>
                        {item.category && <p className="text-xs text-slate-500">{item.category}</p>}
                      </div>
                    </div>
                    {item.selected && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex flex-col text-[10px] text-slate-500">
                            {t('donorVehicles.teardown.condition')}
                            <select
                              value={item.condition}
                              onChange={(e) => updateTeardownCondition(item.template_id, e.target.value)}
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-1 py-1 text-sm text-white outline-none focus:border-cyan-400"
                            >
                              <option value="excellent">{t('donorVehicles.teardown.conditionExcellent')}</option>
                              <option value="good">{t('donorVehicles.teardown.conditionGood')}</option>
                              <option value="fair">{t('donorVehicles.teardown.conditionFair')}</option>
                              <option value="poor">{t('donorVehicles.teardown.conditionPoor')}</option>
                            </select>
                          </label>
                          <label className="flex flex-col text-[10px] text-slate-500">
                            {t('donorVehicles.teardown.cost')}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.cost}
                              onChange={(e) => updateTeardownCost(item.template_id, e.target.value)}
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-sm text-white outline-none focus:border-cyan-400"
                            />
                          </label>
                          <label className="flex flex-col text-[10px] text-slate-500">
                            {t('donorVehicles.teardown.price')}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.asking_price}
                              onChange={(e) => updateTeardownPrice(item.template_id, e.target.value)}
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-sm text-white outline-none focus:border-cyan-400"
                            />
                          </label>
                        </div>
                        <label className="flex flex-col gap-1 text-[10px] text-slate-500">
                          {t('donorVehicles.teardown.photoOptional')}
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => updateTeardownPhoto(item.template_id, e.target.files?.[0] || null)}
                              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-white outline-none file:mr-2 file:rounded file:border-0 file:bg-cyan-500 file:px-2 file:py-0.5 file:text-[10px] file:text-slate-950 file:font-semibold"
                            />
                            {item.photoPreview && (
                              <img src={item.photoPreview} alt="" className="h-8 w-8 rounded-md object-cover border border-slate-700" />
                            )}
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/10 mt-4 p-6 pt-4">
              <button
                type="button"
                onClick={handleSkipTeardown}
                disabled={savingTeardown}
                className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
              >
                {t('donorVehicles.teardown.skipForNow')}
              </button>
              <button
                type="button"
                onClick={handleSaveTeardown}
                disabled={savingTeardown || !teardownItems.some((i) => i.selected)}
                className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTeardown ? t('donorVehicles.teardown.saving') : t('donorVehicles.teardown.addSelectedParts')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default DonorVehicles