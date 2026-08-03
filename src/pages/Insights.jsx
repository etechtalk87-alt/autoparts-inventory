import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { TrendingUp, ShoppingCart, Clock, Repeat } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

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

function Insights() {
  const { currentStaff, loading } = useAuth()
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [insightRows, setInsightRows] = useState({
    sellthrough: [],
    aging: [],
    frequency: [],
  })

  useEffect(() => {
    if (!currentStaff?.company_id) {
      setLoadingInsights(false)
      return
    }

    const fetchInsights = async () => {
      setLoadingInsights(true)
      setErrorMessage('')

      const [sellthroughRes, agingRes, frequencyRes] = await Promise.all([
        supabase
          .from('insight_sellthrough_by_make')
          .select('*')
          .eq('company_id', currentStaff.company_id),

        supabase
          .from('insight_aging_stock_detail')
          .select('*')
          .eq('company_id', currentStaff.company_id),

        supabase
          .from('insight_customer_frequency')
          .select('*')
          .eq('company_id', currentStaff.company_id),
      ])

      if (sellthroughRes.error || agingRes.error || frequencyRes.error) {
        console.error('Failed to load insights:', { sellthroughRes, agingRes, frequencyRes })
        setErrorMessage('Unable to load insights right now.')
        setLoadingInsights(false)
        return
      }

      setInsightRows({
        sellthrough: sellthroughRes.data ?? [],
        aging: agingRes.data ?? [],
        frequency: frequencyRes.data ?? [],
      })
      setLoadingInsights(false)
    }

    fetchInsights()
  }, [currentStaff?.company_id])

  const insightCards = useMemo(() => {
    const sellthroughRows = insightRows.sellthrough || []
    const agingRows = insightRows.aging || []
    const frequencyRows = insightRows.frequency || []

    const sellthroughCard = (() => {
      if (sellthroughRows.length >= 2) {
        const fastest = [...sellthroughRows].sort(
          (a, b) => Number(a.avg_days_to_sell) - Number(b.avg_days_to_sell)
        )[0]

        const slowest = [...sellthroughRows].sort(
          (a, b) => Number(b.avg_days_to_sell) - Number(a.avg_days_to_sell)
        )[0]

        const percentage = Math.round(
          ((Number(slowest.avg_days_to_sell) - Number(fastest.avg_days_to_sell)) /
            Number(slowest.avg_days_to_sell)) *
            100
        )

        return {
          title: 'Sell-through',
          text: `${fastest.make} parts sell ${percentage}% faster than ${slowest.make} parts.`,
          description: 'Based on real sales data',
          icon: TrendingUp,
          accent: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
        }
      }

      return {
        title: 'Sell-through',
        text: 'Not enough sell-through data yet to compare makes.',
        description: 'Based on real sales data',
        icon: TrendingUp,
        accent: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
      }
    })()

    const buyMoreCard = (() => {
      if (sellthroughRows.length >= 2) {
        const fastest = [...sellthroughRows].sort(
          (a, b) => Number(a.avg_days_to_sell) - Number(b.avg_days_to_sell)
        )[0]

        return {
          title: 'Buy more',
          text: `Consider sourcing more ${fastest.make} donor vehicles — they have the fastest sell-through rate in your inventory.`,
          description: 'Based on real sales data',
          icon: ShoppingCart,
          accent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        }
      }

      return {
        title: 'Buy more',
        text: 'Not enough sell-through data yet to recommend sourcing decisions.',
        description: 'Based on real sales data',
        icon: ShoppingCart,
        accent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
      }
    })()

    const agingCard = (() => {
      if (agingRows.length > 0) {
        const totalValue = agingRows.reduce((sum, row) => sum + Number(row.asking_price || 0), 0)
        const maxDays = Math.max(...agingRows.map((row) => Number(row.days_in_stock || 0)))
        const currency = agingRows[0]?.currency || 'AED'

        return {
          title: 'Aging stock',
          text: `Inventory worth ${formatCurrency(totalValue, currency)} has not moved in ${maxDays}+ days.`,
          description: 'Based on real sales data',
          icon: Clock,
          accent: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
        }
      }

      return {
        title: 'Aging stock',
        text: 'No aging stock right now — nice work keeping inventory moving.',
        description: 'Based on real sales data',
        icon: Clock,
        accent: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
      }
    })()

    const frequencyCard = (() => {
      if (frequencyRows.length > 0) {
        const mostLoyal = [...frequencyRows].sort(
          (a, b) => Number(b.purchase_count || 0) - Number(a.purchase_count || 0)
        )[0]

        const avgDays = Math.round(Number(mostLoyal.avg_days_between_purchases || 0))

        return {
          title: 'Customer frequency',
          text: `${mostLoyal.full_name} is your most frequent customer, buying roughly every ${avgDays} days.`,
          description: 'Based on real sales data',
          icon: Repeat,
          accent: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
        }
      }

      return {
        title: 'Customer frequency',
        text: 'Not enough repeat-purchase data yet to identify frequent customers.',
        description: 'Based on real sales data',
        icon: Repeat,
        accent: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
      }
    })()

    return [sellthroughCard, buyMoreCard, agingCard, frequencyCard]
  }, [insightRows])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading insights...
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
              <TrendingUp size={16} />
              AI Insights
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Inventory Insights</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
              Review simple, data-driven recommendations built from your real sales, stock, and customer activity.
            </p>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {loadingInsights ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-slate-400">
            Loading insight cards...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {insightCards.map((card, index) => {
              const Icon = card.icon

              return (
                <div
                  key={`${card.title}-${index}`}
                  className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`rounded-2xl border p-3 ${card.accent}`}>
                      <Icon size={20} />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {card.title}
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-lg leading-7 text-white">{card.text}</p>
                  <p className="mt-3 text-sm text-slate-400">{card.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default Insights
