import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

function Transfers() {
  const { currentStaff, loading } = useAuth()
  const [transfers, setTransfers] = useState([])
  const [branches, setBranches] = useState([])
  const [loadingTransfers, setLoadingTransfers] = useState(true)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchFilter, setBranchFilter] = useState('all')

  const canManageBranches = currentStaff?.role === 'company_admin'

  useEffect(() => {
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

    const fetchTransfers = async () => {
      if (!currentStaff?.company_id) {
        setTransfers([])
        setLoadingTransfers(false)
        return
      }

      setLoadingTransfers(true)
      let query = supabase
        .from('transfers')
        .select(`
          id,
          created_at,
          company_id,
          from_branch_id,
          to_branch_id,
          part_id,
          transferred_by,
          parts:part_id ( part_name ),
          from_branch:from_branch_id ( name ),
          to_branch:to_branch_id ( name ),
          transferred_by_staff:transferred_by ( id, role )
        `)
        .eq('company_id', currentStaff.company_id)
        .order('created_at', { ascending: false })

      if (currentStaff?.role === 'branch_staff') {
        query = query.or(`from_branch_id.eq.${currentStaff.branch_id},to_branch_id.eq.${currentStaff.branch_id}`)
      }

      const { data, error } = await query

      if (!error) {
        setTransfers(data ?? [])
      } else {
        console.error('Error fetching transfers:', error)
        setTransfers([])
      }

      setLoadingTransfers(false)
    }

    fetchBranches()
    fetchTransfers()
  }, [currentStaff?.company_id, currentStaff?.branch_id, currentStaff?.role])

  const filteredTransfers = useMemo(() => {
    if (branchFilter === 'all') return transfers
    return transfers.filter((transfer) => String(transfer.from_branch_id) === branchFilter || String(transfer.to_branch_id) === branchFilter)
  }, [branchFilter, transfers])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h1 className="text-3xl font-semibold">Transfer History</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review part transfers across the company and branches.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 border-b border-slate-800 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">All Transfers</h2>
            {canManageBranches ? (
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                disabled={loadingBranches}
              >
                <option value="all">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            ) : null}
          </div>

          {loadingTransfers ? (
            <div className="p-6 text-slate-400">Loading transfer history...</div>
          ) : filteredTransfers.length === 0 ? (
            <div className="p-6 text-slate-400">No transfers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Part</th>
                    <th className="px-6 py-3 font-medium">From</th>
                    <th className="px-6 py-3 font-medium">To</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Transferred By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/70">
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.id} className="align-middle">
                      <td className="px-6 py-4">{transfer.parts?.part_name ?? '—'}</td>
                      <td className="px-6 py-4">{transfer.from_branch?.name ?? '—'}</td>
                      <td className="px-6 py-4">{transfer.to_branch?.name ?? '—'}</td>
                      <td className="px-6 py-4">{new Date(transfer.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4">{transfer.transferred_by_staff?.id ? transfer.transferred_by_staff.id : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default Transfers
