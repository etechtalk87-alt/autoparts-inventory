import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export default function PartTemplates() {
  const { currentStaff, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Add Part State
  const [newPartName, setNewPartName] = useState('')
  const [newPartCategory, setNewPartCategory] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (currentStaff?.role !== 'company_admin') {
      navigate('/', { replace: true })
      return
    }

    const fetchTemplates = async () => {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('part_templates')
        .select('id, part_name, category, sort_order')
        .eq('company_id', currentStaff.company_id)
        .order('sort_order')
        .order('part_name')

      if (error) {
        setErrorMessage('Failed to load part templates.')
        console.error(error)
      } else {
        setTemplates(data ?? [])
      }

      setLoading(false)
    }

    fetchTemplates()
  }, [authLoading, currentStaff?.company_id, currentStaff?.role, navigate])

  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!newPartName.trim()) return

    setAdding(true)
    setErrorMessage('')

    const nameToInsert = newPartName.trim()
    const categoryToInsert = newPartCategory.trim() || null
    
    // Determine the next sort order
    const maxSortOrder = templates.length > 0 
      ? Math.max(...templates.map(t => t.sort_order || 0)) 
      : 0
    const nextSortOrder = maxSortOrder + 1

    const { data, error } = await supabase
      .from('part_templates')
      .insert({
        company_id: currentStaff.company_id,
        part_name: nameToInsert,
        category: categoryToInsert,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      setErrorMessage(`Failed to add part: ${error.message}`)
    } else if (data) {
      setTemplates((prev) => [...prev, data])
      setNewPartName('')
      setNewPartCategory('')
    }

    setAdding(false)
  }

  const handleDeletePart = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this part template?')
    if (!confirmDelete) return

    setErrorMessage('')

    const { error } = await supabase
      .from('part_templates')
      .delete()
      .eq('id', id)

    if (error) {
      setErrorMessage(`Failed to delete part: ${error.message}`)
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Loading templates...</p>
      </main>
    )
  }

  return (
    <main className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Part Templates</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage the master checklist of parts used for donor vehicle teardowns.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-rose-900/40 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Add Part Form */}
      <form onSubmit={handleAddPart} className="flex items-end gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-400">Part Name *</label>
          <input
            type="text"
            required
            value={newPartName}
            onChange={(e) => setNewPartName(e.target.value)}
            placeholder="e.g. Alternator"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-400">Category (Optional)</label>
          <input
            type="text"
            value={newPartCategory}
            onChange={(e) => setNewPartCategory(e.target.value)}
            placeholder="e.g. Electrical"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newPartName.trim()}
          className="shrink-0 rounded-lg bg-cyan-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add Part'}
        </button>
      </form>

      {/* Templates table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Part Name</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Category</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                  No part templates found. Add one above.
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr
                  key={template.id}
                  className="transition hover:bg-slate-900/50"
                >
                  <td className="px-6 py-4 font-medium text-white">
                    {template.part_name}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {template.category || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleDeletePart(template.id)}
                      className="rounded-lg bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/70"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
