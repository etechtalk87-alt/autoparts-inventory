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

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('branch_staff')
  const [inviteBranchIds, setInviteBranchIds] = useState([])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteValidation, setInviteValidation] = useState('')
  const [invitePlanInfo, setInvitePlanInfo] = useState(null)

  // Pending invites state
  const [pendingInvites, setPendingInvites] = useState([])
  const [cancellingId, setCancellingId] = useState(null)

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

    const fetchPendingInvites = async () => {
      const { data } = await supabase
        .from('staff_invites')
        .select('id, email, role, branch_ids, created_at')
        .eq('company_id', currentStaff.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      setPendingInvites(data ?? [])
    }

    fetchAll()
    fetchPendingInvites()
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

  const refetchPendingInvites = async () => {
    const { data } = await supabase
      .from('staff_invites')
      .select('id, email, role, branch_ids, created_at')
      .eq('company_id', currentStaff.company_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingInvites(data ?? [])
  }

  // ── Edit panel helpers ──────────────────────────────────────

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

  // ── Invite modal helpers ────────────────────────────────────

  const openInvite = async () => {
    setInviteEmail('')
    setInviteRole('branch_staff')
    setInviteBranchIds([])
    setInviteError('')
    setInviteSuccess('')
    setInviteValidation('')

    // Attempt to fetch plan info via FK nested select; fallback to separate lookups if necessary
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('plan_id, subscription_plans(staff_limit, name)')
        .eq('id', currentStaff.company_id)
        .maybeSingle()

      if (!companyError && companyData?.subscription_plans) {
        setInvitePlanInfo(companyData.subscription_plans)
      } else if (!companyError && companyData?.plan_id) {
        const { data: planRow } = await supabase
          .from('subscription_plans')
          .select('staff_limit, name')
          .eq('id', companyData.plan_id)
          .maybeSingle()
        setInvitePlanInfo(planRow ?? null)
      } else {
        setInvitePlanInfo(null)
      }
    } catch (err) {
      setInvitePlanInfo(null)
    }

    setInviteOpen(true)
  }

  const closeInvite = () => {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteRole('branch_staff')
    setInviteBranchIds([])
    setInviteError('')
    setInviteSuccess('')
    setInviteValidation('')
    setInvitePlanInfo(null)
  }

  const toggleInviteBranch = (branchId) => {
    setInviteValidation('')
    setInviteBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    )
  }

  const handleInvite = async () => {
    // Validate email
    if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteValidation('Please enter a valid email address.')
      return
    }
    // Validate branch selection for branch_staff
    if (inviteRole === 'branch_staff' && inviteBranchIds.length === 0) {
      setInviteValidation('Please select at least one branch for a Branch Staff invite.')
      return
    }

    // Check plan-based staff limit (only applies to branch_staff invites)
    if (inviteRole === 'branch_staff') {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('plan_id, subscription_plans(staff_limit, name)')
        .eq('id', currentStaff.company_id)
        .maybeSingle()

      if (!companyError && companyData?.subscription_plans?.staff_limit !== null && companyData?.subscription_plans?.staff_limit !== undefined) {
        const { count: existingStaffCount } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentStaff.company_id)
          .eq('role', 'branch_staff')

        const { count: pendingInviteCount } = await supabase
          .from('staff_invites')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentStaff.company_id)
          .eq('role', 'branch_staff')
          .eq('status', 'pending')

        const totalCount = (existingStaffCount ?? 0) + (pendingInviteCount ?? 0)

        if (totalCount >= companyData.subscription_plans.staff_limit) {
          setInviteValidation(
            `Your ${companyData.subscription_plans.name} plan allows up to ${companyData.subscription_plans.staff_limit} staff account(s). Please upgrade your plan to invite more staff.`
          )
          return
        }
      }
    }

    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-staff`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
            branch_ids: inviteRole === 'branch_staff' ? inviteBranchIds : [],
          }),
        }
      )
      const result = await response.json()
      if (result.error) {
        setInviteError(result.error)
        setInviting(false)
        return
      }
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}.`)
      setInviting(false)
      await refetchPendingInvites()
      setTimeout(() => closeInvite(), 1500)
    } catch (err) {
      setInviteError(`Unexpected error: ${err.message}`)
      setInviting(false)
    }
  }

  // ── Pending invite helpers ──────────────────────────────────

  const handleCancelInvite = async (inviteId) => {
    setCancellingId(inviteId)
    const { error } = await supabase
      .from('staff_invites')
      .delete()
      .eq('id', inviteId)
    if (!error) {
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
    }
    setCancellingId(null)
  }

  // ── Display helpers ─────────────────────────────────────────

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

  const getBranchNameById = (id) => branches.find((b) => b.id === id)?.name ?? 'Unknown'

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
    <main className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Staff</h1>
          <p className="mt-1 text-sm text-slate-400">
            View all staff members and their branch assignments. Click <strong>Edit Branches</strong> on any branch staff member to update their access.
          </p>
        </div>
        <button
          type="button"
          onClick={openInvite}
          className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          + Invite Staff
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-rose-900/40 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Staff table */}
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

      {/* Pending Invites */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Pending Invites</h2>
        {pendingInvites.length === 0 ? (
          <p className="text-sm text-slate-500">No pending invites.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Email</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Role</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Branches</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Invited</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950">
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="transition hover:bg-slate-900/50">
                    <td className="px-6 py-4 text-slate-200">{invite.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          invite.role === 'company_admin'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {formatRole(invite.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {invite.role === 'company_admin'
                        ? <span className="italic text-cyan-400/80">All branches</span>
                        : (invite.branch_ids?.length > 0
                            ? invite.branch_ids.map(getBranchNameById).join(', ')
                            : '—')}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(invite.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        disabled={cancellingId === invite.id}
                        onClick={() => handleCancelInvite(invite.id)}
                        className="rounded-lg bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/70 disabled:opacity-50"
                      >
                        {cancellingId === invite.id ? 'Cancelling…' : 'Cancel Invite'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit branch assignment modal */}
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

      {/* Invite staff modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Invite Staff Member</h2>
            <p className="mt-1 text-sm text-slate-400">
              They'll receive an email to set up their account and join your company.
            </p>

            <div className="mt-5 space-y-4">
              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Email address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteValidation('') }}
                  placeholder="staff@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => {
                    setInviteRole(e.target.value)
                    setInviteValidation('')
                    setInviteBranchIds([])
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                >
                  <option value="branch_staff">Branch Staff</option>
                  <option value="company_admin">Company Admin</option>
                </select>
              </div>

              {/* Branch checkboxes — only for branch_staff */}
              {inviteRole === 'branch_staff' && (
                <div>
                  {/* Plan info (staff limit) */}
                  {invitePlanInfo ? (
                    <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                      <div className="font-medium text-slate-200">{invitePlanInfo.name || 'Plan'}</div>
                      <div className="mt-1 text-xs text-slate-400">Staff limit: {invitePlanInfo.staff_limit === null ? 'Unlimited' : invitePlanInfo.staff_limit}</div>
                    </div>
                  ) : (
                    <div className="mb-3 text-sm text-slate-500">Plan info unavailable</div>
                  )}

                  <label className="mb-2 block text-xs font-medium text-slate-400">Assign to branches</label>
                  <div className="space-y-1">
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={inviteBranchIds.includes(branch.id)}
                          onChange={() => toggleInviteBranch(branch.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
                        />
                        <span className="text-sm text-slate-200">{branch.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {inviteValidation && (
              <p className="mt-4 rounded-lg bg-amber-900/30 px-3 py-2 text-sm text-amber-300">
                {inviteValidation}
              </p>
            )}
            {inviteError && (
              <p className="mt-4 rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-300">
                {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p className="mt-4 rounded-lg bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
                {inviteSuccess}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting}
                className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={closeInvite}
                disabled={inviting}
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
