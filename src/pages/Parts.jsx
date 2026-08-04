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
import SaleModal from '../components/SaleModal'

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

      <SaleModal
        part={saleTarget}
        currentStaff={currentStaff}
        onClose={() => setSaleTarget(null)}
        onSaleComplete={(partId) => {
          setParts((prev) =>
            prev.map((part) =>
              part.id === partId ? { ...part, status: 'sold', date_sold: new Date().toISOString() } : part
            )
          )
        }}
      />

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
