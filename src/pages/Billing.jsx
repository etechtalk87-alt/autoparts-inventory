import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const statusStyles = {
  trial: 'bg-amber-500/10 text-amber-300 border border-amber-400/20',
  active: 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20',
  past_due: 'bg-amber-500/10 text-amber-300 border border-amber-400/20',
  cancelled: 'bg-rose-500/10 text-rose-300 border border-rose-400/20',
  suspended: 'bg-rose-500/10 text-rose-300 border border-rose-400/20',
  default: 'bg-slate-500/10 text-slate-300 border border-slate-600/20',
}

const statusKeyMap = {
  trial: 'billing.status.trial',
  active: 'billing.status.active',
  past_due: 'billing.status.pastDue',
  cancelled: 'billing.status.cancelled',
  suspended: 'billing.status.suspended',
}

function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export default function Billing() {
  const { t } = useTranslation()
  const { currentStaff, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState(null)
  const [plans, setPlans] = useState([])
  const [subscribing, setSubscribing] = useState(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [usage, setUsage] = useState({ branches: 0, staff: 0 })

  const currentPlan = useMemo(() => {
    if (!subscription) return null
    return (
      plans.find((plan) => plan.id === subscription.plan_id) || {
        id: subscription.plan_id,
        name: subscription.subscription_plan || t('billing.currentPlan'),
        price_aed: null,
        branch_limit: null,
        staff_limit: null,
      }
    )
  }, [plans, subscription, t])

  useEffect(() => {
    if (authLoading) return
    if (currentStaff?.role !== 'company_admin') return
    if (!currentStaff?.company_id) return

    const fetchData = async () => {
      setLoading(true)
      setError('')

      const [
        companyResult,
        plansResult,
        branchesCountResult,
        staffCountResult,
      ] = await Promise.all([
        supabase
          .from('companies')
          .select('subscription_status, subscription_plan, plan_id, trial_ends_at, stripe_customer_id')
          .eq('id', currentStaff.company_id)
          .single(),
        supabase
          .from('subscription_plans')
          .select('id, name, price_aed, branch_limit, staff_limit, sort_order')
          .order('sort_order'),
        supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentStaff.company_id),
        supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentStaff.company_id)
          .eq('role', 'branch_staff'),
      ])

      if (companyResult.error) {
        setError(t('billing.errors.loadStatus'))
      } else {
        setSubscription(companyResult.data)
      }
      if (plansResult.error) {
        setError((prev) => prev || t('billing.errors.loadPlans'))
      } else {
        setPlans(plansResult.data ?? [])
      }

      const branchesCount = branchesCountResult?.count ?? 0
      const staffCount = staffCountResult?.count ?? 0
      setUsage({ branches: branchesCount, staff: staffCount })

      setLoading(false)
    }

    fetchData()
  }, [authLoading, currentStaff?.company_id, currentStaff?.role, t])

  const handleSubscribe = async (planId) => {
    setSubscribing(planId)
    setError('')

    const { data } = await supabase.auth.getSession()
    const session = data?.session

    if (!session?.access_token) {
      setError(t('billing.errors.authSession'))
      setSubscribing(null)
      return
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: planId }),
      }
    )

    const result = await response.json()

    if (result.error) {
      setError(result.error)
      setSubscribing(null)
      return
    }

    window.location.href = result.url
  }

  const handleManageBilling = async () => {
    setOpeningPortal(true)
    setError('')

    const { data } = await supabase.auth.getSession()
    const session = data?.session

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    const result = await response.json()

    if (result.error) {
      setError(result.error)
      setOpeningPortal(false)
      return
    }

    window.location.href = result.url
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-8 py-6 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {t('billing.loading')}
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin') {
    return <Navigate to="/" replace />
  }

  const status = subscription?.subscription_status ?? 'unknown'
  const statusLabel = t(
    statusKeyMap[status] || 'billing.status.unknown',
    { defaultValue: status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) }
  )
  const statusClass = statusStyles[status] ?? statusStyles.default

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
                {t('billing.badge')}
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">{t('billing.title')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {t('billing.subtitle')}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-sm text-slate-300">
              <div className="font-semibold text-white">{t('billing.currentStatus')}</div>
              <div className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                {statusLabel}
              </div>

              {subscription?.stripe_customer_id && (
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={openingPortal}
                  className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {openingPortal ? t('billing.openingPortal') : t('billing.manageBilling')}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-400">{t('billing.currentPlan')}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{currentPlan?.name || t('billing.noActivePlan')}</p>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {subscription?.plan_id ? t('billing.planIdLabel', { id: subscription.plan_id }) : t('billing.noPlan')}
                </span>
              </div>

              <div className="mt-6 grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-slate-400">{t('billing.billingStatus')}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>
                {status === 'trial' && subscription?.trial_ends_at && (
                  <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                    <span className="text-slate-400">{t('billing.trialEnds')}</span>
                    <span className="text-sm text-white">{formatDate(subscription.trial_ends_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <p className="text-sm font-medium text-slate-400">{t('billing.planDetails')}</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('billing.monthlyPrice')}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPrice(currentPlan?.price_aed)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('billing.branches')}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{currentPlan?.branch_limit ?? '—'}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${usage.branches >= (currentPlan?.branch_limit ?? Infinity) ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: currentPlan?.branch_limit ? `${Math.min((usage.branches / currentPlan.branch_limit) * 100, 100)}%` : '100%' }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('billing.usedOf', { count: usage.branches, limit: currentPlan?.branch_limit ?? '∞' })}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('billing.staff')}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{currentPlan?.staff_limit ?? '—'}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${usage.staff >= (currentPlan?.staff_limit ?? Infinity) ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: currentPlan?.staff_limit ? `${Math.min((usage.staff / currentPlan.staff_limit) * 100, 100)}%` : '100%' }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('billing.usedOf', { count: usage.staff, limit: currentPlan?.staff_limit ?? '∞' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>

        <section className="grid gap-5 xl:grid-cols-4 lg:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription?.plan_id
            return (
              <div
                key={plan.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {t('billing.planDescription')}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                      {t('billing.current')}
                    </span>
                  )}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <p className="text-sm text-slate-400">{t('billing.price')}</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{formatPrice(plan.price_aed)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('billing.branches')}</p>
                      <p className="mt-1 text-lg font-semibold text-white">{plan.branch_limit ?? t('billing.unlimited')}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('billing.staff')}</p>
                      <p className="mt-1 text-lg font-semibold text-white">{plan.staff_limit ?? t('billing.unlimited')}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrent || subscribing === plan.id}
                  className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isCurrent
                      ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                      : 'bg-cyan-600 text-white hover:bg-cyan-500'
                  } ${subscribing === plan.id ? 'opacity-70' : ''}`}
                >
                  {isCurrent ? t('billing.currentPlanButton') : subscribing === plan.id ? t('billing.subscribing') : t('billing.subscribe')}
                </button>
              </div>
            )
          })}
        </section>
      </div>
    </main>
  )
}