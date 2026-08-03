import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const statusStyles = {
  trial: 'bg-amber-500/10 text-amber-300',
  active: 'bg-emerald-500/10 text-emerald-300',
  past_due: 'bg-orange-500/10 text-orange-300',
  cancelled: 'bg-slate-500/10 text-slate-300',
  suspended: 'bg-rose-500/10 text-rose-300',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

function PlatformAdmin() {
  const { user, currentStaff, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [authorized, setAuthorized] = useState(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [usageMap, setUsageMap] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const authId = user?.id || currentStaff?.id

  useEffect(() => {
    if (authLoading) return
    if (!authId) {
      navigate('/', { replace: true })
      return
    }

    const loadPlatformData = async () => {
      setLoading(true)
      setErrorMessage('')

      const { data: adminRow, error: adminError } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('id', authId)
        .maybeSingle()

      if (adminError) {
        console.error('Platform admin check failed:', adminError)
        setErrorMessage('Unable to verify platform access.')
        setAuthorized(false)
        setLoading(false)
        return
      }

      if (!adminRow) {
        setAuthorized(false)
        setLoading(false)
        return
      }

      setAuthorized(true)

      const { data: companyRows, error: companyError } = await supabase
        .from('companies')
        .select('id, name, subscription_status, plan_id, subscription_plans(name), created_at')
        .order('created_at', { ascending: false })

      if (companyError) {
        console.error('Failed to load companies:', companyError)
        setErrorMessage('Failed to load platform companies.')
        setLoading(false)
        return
      }

      const companiesList = companyRows ?? []
      setCompanies(companiesList)

      const usageResults = await Promise.all(
        companiesList.map(async (company) => {
          const [{ count: staffCount }, { count: branchCount }] = await Promise.all([
            supabase
              .from('staff')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', company.id),
            supabase
              .from('branches')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', company.id),
          ])

          return {
            companyId: company.id,
            staffCount: staffCount ?? 0,
            branchCount: branchCount ?? 0,
          }
        })
      )

      const usageMapByCompany = usageResults.reduce((acc, result) => {
        acc[result.companyId] = {
          staffCount: result.staffCount,
          branchCount: result.branchCount,
        }
        return acc
      }, {})

      setUsageMap(usageMapByCompany)
      setLoading(false)
    }

    loadPlatformData()
  }, [authLoading, authId, navigate])

  const handleToggleStatus = async (company) => {
    const nextStatus = company.subscription_status === 'suspended' ? 'active' : 'suspended'

    if (nextStatus === 'suspended') {
      const confirmSuspend = window.confirm(
        'Suspend this company account? This will prevent the company from accessing the platform.'
      )
      if (!confirmSuspend) return
    }

    setUpdatingId(company.id)
    const { data, error } = await supabase
      .from('companies')
      .update({ subscription_status: nextStatus })
      .eq('id', company.id)
      .select('id, subscription_status')
      .maybeSingle()

    setUpdatingId(null)

    if (error) {
      console.error('Failed to update company status:', error)
      setErrorMessage('Unable to update company status.')
      return
    }

    setCompanies((prev) =>
      prev.map((item) =>
        item.id === company.id
          ? { ...item, subscription_status: data?.subscription_status ?? nextStatus }
          : item
      )
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading platform administration...
        </div>
      </main>
    )
  }

  if (authorized === false) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                Platform Admin
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Platform Administration</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Review company subscriptions, usage, and status across the entire platform.
              </p>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Company Name</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Staff Count</th>
                  <th className="px-6 py-4 font-medium">Branch Count</th>
                  <th className="px-6 py-4 font-medium">Created Date</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-900/60">
                {companies.map((company) => (
                  <tr key={company.id} className="transition hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-6 py-4 font-semibold text-white">{company.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[company.subscription_status] || 'bg-slate-500/10 text-slate-300'}`}>
                        {company.subscription_status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{company.subscription_plans?.name || '—'}</td>
                    <td className="px-6 py-4 text-slate-300">{usageMap[company.id]?.staffCount ?? 0}</td>
                    <td className="px-6 py-4 text-slate-300">{usageMap[company.id]?.branchCount ?? 0}</td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(company.created_at)}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(company)}
                        disabled={updatingId === company.id}
                        className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                          company.subscription_status === 'suspended'
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'bg-rose-500 text-white hover:bg-rose-400'
                        } ${updatingId === company.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {company.subscription_status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

export default PlatformAdmin
