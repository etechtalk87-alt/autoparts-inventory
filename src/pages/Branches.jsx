import { useEffect, useRef, useState } from 'react'
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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h1 className="text-3xl font-semibold">Branch Management</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage branches for your company and keep them scoped to your company workspace.
          </p>
        </div>

        <div ref={listRef} tabIndex={-1} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30 focus:outline-none">
          <div className="flex flex-col gap-4 border-b border-slate-800 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">Existing Branches</h2>
            <button
              type="button"
              onClick={() => {
                setErrorMessage('')
                setSuccessMessage('')
                setShowAddModal(true)
              }}
              className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              + Add Branch
            </button>
          </div>

          {loadingBranches ? (
            <div className="p-6 text-slate-400">Loading branches...</div>
          ) : branches.length === 0 ? (
            <div className="p-6 text-slate-400">No branches found for this company yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Location</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/70">
                  {branches.map((branch) => (
                    <tr key={branch.id} className="align-middle">
                      <td className="px-6 py-4">
                        {editingId === branch.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                          />
                        ) : (
                          branch.name
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === branch.id ? (
                          <input
                            type="text"
                            value={editForm.location}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                          />
                        ) : (
                          branch.location
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === branch.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleUpdate}
                              className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-lg bg-slate-700 px-3 py-2 font-semibold text-white transition hover:bg-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(branch)}
                              className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-950 transition hover:bg-slate-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBranch(branch)}
                              className="rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-500"
                            >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
            <h3 className="text-xl font-semibold">Add Branch</h3>
            <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300 md:col-span-2">
                Branch Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  placeholder="North Branch"
                />
              </label>
              <label className="text-sm text-slate-300 md:col-span-2">
                Location
                <input
                  type="text"
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  placeholder="Nairobi"
                />
              </label>
              {errorMessage ? <p className="mt-2 text-sm text-red-400 md:col-span-2">{errorMessage}</p> : null}
              {successMessage ? <p className="mt-2 text-sm text-emerald-400 md:col-span-2">{successMessage}</p> : null}
              <div className="mt-2 flex justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setErrorMessage('')
                    setSuccessMessage('')
                  }}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
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
