import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export default function ManageStaff() {
  const { currentStaff, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [staffList, setStaffList] = useState([])
  const [branches, setBranches] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Edit panel state
  const [editingMember, setEditingMember] = useState(null)
  const [checkedBranches, setCheckedBranches] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (currentStaff?.role !== 'company_admin') {
      navigate('/', { replace: true })
      return
    }

    const fetchAll = async () => {
      setLoading(true)
      setErrorMessage('')

      // 1. Fetch all staff in this company
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, full_name, role')
        .eq('company_id', currentStaff.company_id)
        .order('full_name')

      if (staffError) {
        setErrorMessage('Failed to load staff list.')
        setLoading(false)
        return
      }

      const staffRows = staffData ?? []
      setStaffList(staffRows)

      // 2. Fetch all branches in this company
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('company_id', currentStaff.company_id)
        .order('name')

      if (branchError) {
        setErrorMessage('Failed to load branches.')
        setLoading(false)
        return
      }

      setBranches(branchData ?? [])

      // 3. Fetch all staff_branches assignments for these staff members
      if (staffRows.length > 0) {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('staff_branches')
          .select('staff_id, branch_id')
          .in('staff_id', staffRows.map((s) => s.id))

        if (assignmentError) {
          setErrorMessage('Failed to load branch assignments.')
          setLoading(false)
          return
        }

        setAssignments(assignmentData ?? [])
      }

      setLoading(false)
    }

    fetchAll()
  }, [authLoading, currentStaff?.company_id, currentStaff?.role])

  const refetchAssignments = async (overrideStaffList) => {
    const ids = (overrideStaffList ?? staffList).map((s) => s.id)
    if (ids.length === 0) {
      setAssignments([])
      return
    }
    const { data, error } = await supabase
      .from('staff_branches')
      .select('staff_id, branch_id')
      .in('staff_id', ids)
    if (!error) setAssignments(data ?? [])
  }

  const openEdit = (member) => {
    const currentBranchIds = assignments
      .filter((a) => a.staff_id === member.id)
      .map((a) => a.branch_id)
    setEditingMember(member)
    setCheckedBranches(currentBranchIds)
    setSaveError('')
    setSaveSuccess('')
    setValidationError('')
  }

  const closeEdit = () => {
    setEditingMember(null)
    setCheckedBranches([])
    setSaveError('')
    setSaveSuccess('')
    setValidationError('')
  }

  const toggleBranch = (branchId) => {
    setValidationError('')
    setCheckedBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    )
  }

  const handleSave = async () => {
    if (checkedBranches.length === 0) {
      setValidationError('A branch staff member must have at least one branch assigned.')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const originalBranchIds = assignments
      .filter((a) => a.staff_id === editingMember.id)
      .map((a) => a.branch_id)

    const toAdd = checkedBranches.filter((id) => !originalBranchIds.includes(id))
    const toRemove = originalBranchIds.filter((id) => !checkedBranches.includes(id))

    // Insert new assignments
    if (toAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('staff_branches')
        .insert(toAdd.map((branch_id) => ({ staff_id: editingMember.id, branch_id })))
      if (insertError) {
        setSaveError(`Failed to add branch assignments: ${insertError.message}`)
        setSaving(false)
        return
      }
    }

    // Delete removed assignments one by one for precise error reporting
    for (const branch_id of toRemove) {
      const { error: deleteError } = await supabase
        .from('staff_branches')
        .delete()
        .eq('staff_id', editingMember.id)
        .eq('branch_id', branch_id)
      if (deleteError) {
        setSaveError(`Failed to remove branch assignment: ${deleteError.message}`)
        setSaving(false)
        return
      }
    }

    await refetchAssignments()
    setSaveSuccess('Branch assignments saved successfully.')
    setSaving(false)
    // Brief delay so user sees the success message before the panel closes
    setTimeout(() => closeEdit(), 1200)
  }

  const getBranchNamesForStaff = (staffId) => {
    const staffAssignments = assignments.filter((a) => a.staff_id === staffId)
    if (staffAssignments.length === 0) return '—'
    return staffAssignments
      .map((a) => {
        const branch = branches.find((b) => b.id === a.branch_id)
        return branch?.name ?? 'Unknown branch'
      })
      .join(', ')
  }

  const formatRole = (role) => {
    if (role === 'company_admin') return 'Company Admin'
    if (role === 'branch_staff') return 'Branch Staff'
    return role
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Loading staff...</p>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Manage Staff</h1>
        <p className="mt-1 text-sm text-slate-400">
          View all staff members and their branch assignments. Click <strong>Edit Branches</strong> on any branch staff member to update their access.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-rose-900/40 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Name</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Role</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Assigned Branches</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {staffList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No staff found.
                </td>
              </tr>
            ) : (
              staffList.map((member) => (
                <tr
                  key={member.id}
                  className="transition hover:bg-slate-900/50"
                >
                  <td className="px-6 py-4 font-medium text-white">
                    {member.full_name ?? '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        member.role === 'company_admin'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {formatRole(member.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {member.role === 'company_admin'
                      ? <span className="italic text-cyan-400/80">All branches</span>
                      : getBranchNamesForStaff(member.id)}
                  </td>
                  <td className="px-6 py-4">
                    {member.role === 'branch_staff' && (
                      <button
                        type="button"
                        onClick={() => openEdit(member)}
                        className="inline-flex items-center rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-600"
                      >
                        Edit Branches
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Edit Branch Assignments</h2>
            <p className="mt-1 text-sm text-slate-400">
              <span className="font-medium text-slate-200">{editingMember.full_name}</span>
              {' '}— select the branches this staff member can access.
            </p>

            <div className="mt-5 space-y-2">
              {branches.length === 0 ? (
                <p className="text-sm text-slate-500">No branches found for this company.</p>
              ) : (
                branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      id={`branch-${branch.id}`}
                      checked={checkedBranches.includes(branch.id)}
                      onChange={() => toggleBranch(branch.id)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
                    />
                    <span className="text-sm text-slate-200">{branch.name}</span>
                  </label>
                ))
              )}
            </div>

            {validationError && (
              <p className="mt-4 rounded-lg bg-amber-900/30 px-3 py-2 text-sm text-amber-300">
                {validationError}
              </p>
            )}

            {saveError && (
              <p className="mt-4 rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </p>
            )}

            {saveSuccess && (
              <p className="mt-4 rounded-lg bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
                {saveSuccess}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
