import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Building2, MapPin, PencilLine, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

function Branches() {
  const { currentStaff, loading } = useAuth()
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [form, setForm] = useState({ name: '', location: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const listRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', location: '' })

  useEffect(() => {
    if (!currentStaff?.company_id) {
      setBranches([])
      setLoadingBranches(false)
      return
    }

    const fetchBranches = async () => {
      setLoadingBranches(true)
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, location, company_id')
        .eq('company_id', currentStaff.company_id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching branches:', error)
        setBranches([])
      } else {
        setBranches(data ?? [])
      }

      setLoadingBranches(false)
    }

    fetchBranches()
  }, [currentStaff?.company_id])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin') {
    return <Navigate to="/" replace />
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!form.name.trim() || !form.location.trim()) {
      setErrorMessage('Please enter both a branch name and location.')
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase
      .from('branches')
      .insert([
        {
          name: form.name.trim(),
          location: form.location.trim(),
          company_id: currentStaff.company_id,
        },
      ])
      .select('id, name, location, company_id')
      .single()

    if (error) {
      setErrorMessage(error.message)
    } else {
      setBranches((prev) => [data, ...prev])
      setForm({ name: '', location: '' })
      setShowAddModal(false)
      setSuccessMessage('Branch added successfully.')
      requestAnimationFrame(() => listRef.current?.focus())
    }

    setSubmitting(false)
  }

  const startEditing = (branch) => {
    setEditingId(branch.id)
    setEditForm({ name: branch.name, location: branch.location })
  }

  const handleDeleteBranch = async (branch) => {
    if (!branch) return

    const ok = window.confirm(`Are you sure you want to delete ${branch.name}? This cannot be undone.`)
    if (!ok) return

    const { data, error } = await supabase.from('branches').delete().eq('id', branch.id).select()
    if (error) {
      setErrorMessage(error.message)
    } else if (!data || data.length === 0) {
      setErrorMessage('Update failed - you may not have permission to modify this record.')
    } else {
      setBranches((prev) => prev.filter((b) => b.id !== branch.id))
      setSuccessMessage('Branch deleted.')
    }
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm({ name: '', location: '' })
  }

  const handleUpdate = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!editForm.name.trim() || !editForm.location.trim()) {
      setErrorMessage('Please enter both a branch name and location.')
      return
    }

    const { data, error } = await supabase
      .from('branches')
      .update({
        name: editForm.name.trim(),
        location: editForm.location.trim(),
      })
      .eq('id', editingId)
      .select('id, name, location, company_id')

    if (error) {
      setErrorMessage(error.message)
    } else if (!data || data.length === 0) {
      setErrorMessage('Update failed - you may not have permission to modify this record.')
    } else {
      setBranches((prev) => prev.map((branch) => (branch.id === data[0].id ? data[0] : branch)))
      setEditingId(null)
      setEditForm({ name: '', location: '' })
      setSuccessMessage('Branch updated successfully.')
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <Sparkles size={16} />
                Premium branch control
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Branch Management</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Create, update, and organize every branch in your company workspace with a polished experience that feels as refined as your operations.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="text-2xl font-semibold text-white">{branches.length}</div>
                <div className="mt-1 text-sm text-slate-400">Configured branches</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <BadgeCheck size={16} />
                  Company-ready
                </div>
                <div className="mt-1 text-sm text-slate-300">Each branch stays scoped to your workspace.</div>
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

        <div ref={listRef} tabIndex={-1} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl focus:outline-none">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Existing Branches</h2>
              <p className="mt-1 text-sm text-slate-400">Review and refine your branch network with confidence.</p>
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
              Add Branch
            </button>
          </div>

          {loadingBranches ? (
            <div className="flex items-center justify-center gap-3 p-10 text-slate-400">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" />
              Loading branches...
            </div>
          ) : branches.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
                <Building2 size={28} className="mx-auto text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No branches yet</h3>
                <p className="mt-1 text-sm text-slate-400">Add your first branch to start organizing operations across locations.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('')
                  setSuccessMessage('')
                  setShowAddModal(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <Plus size={18} />
                Create branch
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Branch</th>
                    <th className="px-6 py-3 font-medium">Location</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/50">
                  {branches.map((branch) => (
                    <tr key={branch.id} className="align-middle transition hover:bg-slate-800/60">
                      <td className="px-6 py-4">
                        {editingId === branch.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                              <Building2 size={18} />
                            </div>
                            <div>
                              <div className="font-semibold text-white">{branch.name}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Branch</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === branch.id ? (
                          <input
                            type="text"
                            value={editForm.location}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-slate-300">
                            <MapPin size={16} className="text-slate-500" />
                            {branch.location}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === branch.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleUpdate}
                              className="rounded-xl bg-emerald-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-xl bg-slate-700 px-3 py-2 font-semibold text-white transition hover:bg-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(branch)}
                              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-950 transition hover:bg-slate-200"
                            >
                              <PencilLine size={15} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBranch(branch)}
                              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-500"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </div>
                        )}
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
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Add Branch</h3>
                <p className="mt-1 text-sm text-slate-400">Fill in the branch details and save it instantly.</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                <Building2 size={20} />
              </div>
            </div>

            <form onSubmit={handleCreate} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300 md:col-span-2">
                <span className="mb-1.5 block font-medium">Branch Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="North Branch"
                />
              </label>
              <label className="text-sm text-slate-300 md:col-span-2">
                <span className="mb-1.5 block font-medium">Location</span>
                <input
                  type="text"
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
                  placeholder="Nairobi"
                />
              </label>
              {errorMessage ? <p className="text-sm text-rose-400 md:col-span-2">{errorMessage}</p> : null}
              {successMessage ? <p className="text-sm text-emerald-400 md:col-span-2">{successMessage}</p> : null}
              <div className="mt-2 flex justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setErrorMessage('')
                    setSuccessMessage('')
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
                  {submitting ? 'Saving...' : 'Add Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default Branches
