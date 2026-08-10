import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { generateReportPdf } from '../lib/reportPdf'

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

function VehicleProfit() {
  const { t } = useTranslation()
  const { currentStaff, loading } = useAuth()
  const [vehicleProfit, setVehicleProfit] = useState([])
  const [loadingVehicleProfit, setLoadingVehicleProfit] = useState(true)

  useEffect(() => {
    const fetchVehicleProfit = async () => {
      if (!currentStaff?.company_id) {
        setVehicleProfit([])
        setLoadingVehicleProfit(false)
        return
      }
      setLoadingVehicleProfit(true)
      let query = supabase
        .from('dashboard_vehicle_profit')
        .select('*')
        .eq('company_id', currentStaff.company_id)
      if (currentStaff?.role === 'branch_staff') {
        query = query.eq('branch_id', currentStaff.activeBranchId)
      }
      const { data, error } = await query
      if (!error) {
        setVehicleProfit(data ?? [])
      } else {
        console.error('Error fetching vehicle profit:', error)
        setVehicleProfit([])
      }
      setLoadingVehicleProfit(false)
    }
    fetchVehicleProfit()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role])

  const vehicleProfitSorted = useMemo(() => {
    return (vehicleProfit || [])
      .map((v) => ({
        ...v,
        profit: v.purchase_price != null ? Number(v.revenue) - Number(v.purchase_price) : null,
      }))
      .sort((a, b) => {
        if (a.profit === null) return 1
        if (b.profit === null) return -1
        return b.profit - a.profit
      })
  }, [vehicleProfit])

  // ─────────────────────────────────────────────────────────────
  // PDF EXPORT — DO NOT translate anything in this function.
  // All strings below must stay hardcoded English. The PDF library's
  // font cannot render Arabic glyphs, and this function must never
  // receive live-Arabic-translated strings, regardless of active app language.
  // ─────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const columns = [
      { key: 'vehicle', label: 'Vehicle', width: 1.8 },
      { key: 'year', label: 'Year', width: 0.7 },
      { key: 'purchase', label: 'Purchase', align: 'right', width: 1 },
      { key: 'revenue', label: 'Revenue', align: 'right', width: 1 },
      {
        key: 'profit',
        label: 'Profit',
        align: 'right',
        width: 1,
        render: (value, row) => ({
          text: value,
          color: row._rawProfit === null ? '#64748b' : row._rawProfit >= 0 ? '#059669' : '#dc2626',
        }),
      },
      { key: 'remaining', label: 'Remaining Parts', align: 'right', width: 1 },
    ]
    const rows = vehicleProfitSorted.map((v) => ({
      vehicle: `${v.make} ${v.model}`,
      year: v.year || '—',
      purchase: v.purchase_price != null ? `${v.purchase_currency} ${Number(v.purchase_price).toFixed(2)}` : '—',
      revenue: `${v.purchase_currency} ${Number(v.revenue).toFixed(2)}`,
      profit: v.profit !== null ? `${v.purchase_currency} ${v.profit.toFixed(2)}` : 'Unknown',
      _rawProfit: v.profit,
      remaining: v.remaining_parts ?? 0,
    }))
    generateReportPdf({
      companyName: currentStaff?.companyName || 'Auto Parts Inventory',
      reportTitle: 'Vehicle Profit Report',
      columns,
      rows,
    })
  }
  // ─────────────────────────────────────────────────────────────
  // END PDF EXPORT — resume normal t() translations below.
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {t('vehicleProfit.loading')}
        </div>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight">{t('vehicleProfit.title')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                {t('vehicleProfit.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              {t('vehicleProfit.exportPdf')}
            </button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loadingVehicleProfit ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-slate-400">
              {t('vehicleProfit.loading')}
            </div>
          ) : vehicleProfitSorted.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-slate-400">
              {t('vehicleProfit.noData')}
            </div>
          ) : (
            vehicleProfitSorted.map((v) => (
              <div key={v.donor_vehicle_id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <h3 className="text-lg font-semibold text-white">{v.make} {v.model}</h3>
                <p className="text-xs text-slate-500 mb-4">{v.year}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase">{t('vehicleProfit.purchase')}</p>
                    <p className="text-white font-semibold">
                      {v.purchase_price != null ? `${v.purchase_currency} ${Number(v.purchase_price).toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase">{t('vehicleProfit.revenue')}</p>
                    <p className="text-white font-semibold">{v.purchase_currency} {Number(v.revenue).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase">{t('vehicleProfit.profit')}</p>
                    <p className={`font-semibold ${v.profit === null ? 'text-slate-500' : v.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {v.profit !== null ? `${v.purchase_currency} ${v.profit.toFixed(2)}` : t('vehicleProfit.unknown')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase">{t('vehicleProfit.remainingParts')}</p>
                    <p className="text-white font-semibold">{v.remaining_parts}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

export default VehicleProfit