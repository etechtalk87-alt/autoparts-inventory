import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { DollarSign, TrendingUp, Car, Package, Receipt, Users, AlertCircle, Wallet } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

function formatCurrency(value, currency = 'AED') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatTrendLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short' })
}

const categoryColors = ['#0ea5e9', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6', '#fb7185']
const trendColors = ['#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#f472b6', '#fb7185', '#fb923c', '#fbbf24', '#22c55e', '#14b8a6', '#0ea5e9', '#8b5cf6']

function Dashboard() {
  const { user, currentStaff } = useAuth()
  const { t } = useTranslation()
  const [branches, setBranches] = useState([])
  const [companyName, setCompanyName] = useState('AutoParts Inventory')
  const [loading, setLoading] = useState(true)

  // Dashboard Data from views
  const [dashboardData, setDashboardData] = useState({
    todaySales: [],
    monthlySales: [],
    agingStock: [],
    receivables: [],
    stockSummary: [],
    activeCustomers: [],
    avgDaysInStock: [],
    totalInvoices: [],
    donorVehicles: [],
    partsByBranch: [],
    branchBreakdown: [],
    payables: [],
    unlinkedPayments: [],
    vehicleProfit: []
  })
  const [vehicleProfitPeriod, setVehicleProfitPeriod] = useState('all')
  const [salesTrendPeriod, setSalesTrendPeriod] = useState('12months')

  // Trend data from views
  const [salesByCategory, setSalesByCategory] = useState([])
  const [salesDaily, setSalesDaily] = useState([])

  useEffect(() => {
    const fetchCoreDashboardData = async () => {
      if (!currentStaff?.company_id) {
        setLoading(false)
        return
      }

      setLoading(true)

      const companyFilter = currentStaff.company_id
      const branchFilter = currentStaff.role === 'branch_staff' ? currentStaff.activeBranchId : null

      const buildQuery = (view) => {
        let q = supabase.from(view).select('*').eq('company_id', companyFilter)
        if (branchFilter) q = q.eq('branch_id', branchFilter)
        return q
      }

      const branchesPromise = supabase
        .from('branches')
        .select('id, name')
        .eq('company_id', companyFilter)
        .order('name', { ascending: true })

      const activeCustomersPromise = supabase
        .from('dashboard_active_customers')
        .select('*')
        .eq('company_id', companyFilter)

      const payablesPromise = currentStaff.role === 'company_admin'
        ? supabase.from('payables').select('amount, amount_paid, currency, status').eq('company_id', companyFilter)
        : Promise.resolve({ data: [] })

      const unlinkedPaymentsPromise = supabase
        .from('payments')
        .select('amount, currency')
        .eq('company_id', companyFilter)
        .is('sale_id', null)
        .is('invoice_id', null)

      const [
        branchesRes,
        todayRes,
        monthlyRes,
        agingRes,
        receivablesRes,
        stockRes,
        avgDaysRes,
        invoicesRes,
        donorRes,
        partsByBranchRes,
        branchBreakdownRes,
        customersRes,
        payablesRes,
        unlinkedPaymentsRes,
        vehicleProfitRes
      ] = await Promise.all([
        branchesPromise,
        buildQuery('dashboard_sales_today'),
        buildQuery('dashboard_sales_this_month'),
        buildQuery('dashboard_aging_stock'),
        buildQuery('dashboard_outstanding_receivables'),
        buildQuery('dashboard_stock_summary'),
        buildQuery('dashboard_avg_days_in_stock'),
        buildQuery('dashboard_total_invoices'),
        buildQuery('dashboard_donor_vehicles_this_month'),
        buildQuery('dashboard_parts_by_branch'),
        buildQuery('dashboard_branch_breakdown'),
        activeCustomersPromise,
        payablesPromise,
        unlinkedPaymentsPromise,
        buildQuery('dashboard_vehicle_profit')
      ])

      setBranches(branchesRes.data || [])
      
      setDashboardData({
        todaySales: todayRes.data || [],
        monthlySales: monthlyRes.data || [],
        agingStock: agingRes.data || [],
        receivables: receivablesRes.data || [],
        stockSummary: stockRes.data || [],
        avgDaysInStock: avgDaysRes.data || [],
        totalInvoices: invoicesRes.data || [],
        donorVehicles: donorRes.data || [],
        partsByBranch: partsByBranchRes.data || [],
        branchBreakdown: branchBreakdownRes.data || [],
        activeCustomers: customersRes.data || [],
        payables: payablesRes.data || [],
        unlinkedPayments: unlinkedPaymentsRes.data || [],
        vehicleProfit: vehicleProfitRes.data || []
      })

      setLoading(false)
    }

    fetchCoreDashboardData()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role])

  useEffect(() => {
    const fetchTrendData = async () => {
      if (!currentStaff?.company_id) return
      
      const now = new Date()
      let startDate
      if (salesTrendPeriod === '3months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      } else if (salesTrendPeriod === '6months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      } else if (salesTrendPeriod === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1)
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      }
      startDate.setHours(0, 0, 0, 0)

      const companyFilter = currentStaff.company_id
      const branchFilter = currentStaff.role === 'branch_staff' ? currentStaff.activeBranchId : null

      let categoryQ = supabase.from('dashboard_sales_by_category').select('*').eq('company_id', companyFilter)
      let dailyQ = supabase.from('dashboard_sales_daily').select('*').eq('company_id', companyFilter)
      
      if (branchFilter) {
        categoryQ = categoryQ.eq('branch_id', branchFilter)
        dailyQ = dailyQ.eq('branch_id', branchFilter)
      }

      const dateStr = startDate.toISOString().slice(0, 10)
      categoryQ = categoryQ.gte('sale_date', dateStr)
      dailyQ = dailyQ.gte('sale_date', dateStr)

      const [catRes, dailyRes] = await Promise.all([categoryQ, dailyQ])
      
      if (!catRes.error) setSalesByCategory(catRes.data || [])
      if (!dailyRes.error) setSalesDaily(dailyRes.data || [])
    }

    fetchTrendData()
  }, [currentStaff?.company_id, currentStaff?.activeBranchId, currentStaff?.role, salesTrendPeriod])

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!currentStaff?.company_id) {
        setCompanyName('AutoParts Inventory')
        return
      }

      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('id', currentStaff.company_id)
        .maybeSingle()

      if (!error && data?.name) {
        setCompanyName(data.name)
      } else {
        setCompanyName('AutoParts Inventory')
      }
    }

    fetchCompanyName()
  }, [currentStaff?.company_id])

  // Process view data into the exact shapes needed by the UI
  
  const todaySalesByCurrency = useMemo(() => {
    const totals = dashboardData.todaySales.reduce((acc, row) => {
      const c = row.currency || 'AED'
      acc[c] = (acc[c] || 0) + Number(row.total_revenue || 0)
      return acc
    }, {})
    return Object.entries(totals).map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency))
  }, [dashboardData.todaySales])

  const monthlySalesByCurrency = useMemo(() => {
    const totals = dashboardData.monthlySales.reduce((acc, row) => {
      const c = row.currency || 'AED'
      acc[c] = (acc[c] || 0) + Number(row.total_revenue || 0)
      return acc
    }, {})
    return Object.entries(totals).map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency))
  }, [dashboardData.monthlySales])

  const totalSalesCountThisMonth = useMemo(() => {
    return dashboardData.monthlySales.reduce((sum, row) => sum + Number(row.sale_count || 0), 0)
  }, [dashboardData.monthlySales])

  const donorVehiclesAddedThisMonth = useMemo(() => {
    return dashboardData.donorVehicles.reduce((sum, row) => sum + Number(row.vehicles_this_month || 0), 0)
  }, [dashboardData.donorVehicles])

  const totalPartsInStock = useMemo(() => {
    return dashboardData.stockSummary.reduce((sum, row) => sum + Number(row.parts_count || 0), 0)
  }, [dashboardData.stockSummary])

  const totalInvoices = useMemo(() => {
    return dashboardData.totalInvoices.reduce((sum, row) => sum + Number(row.invoice_count || 0), 0)
  }, [dashboardData.totalInvoices])

  const activeCustomersCount = useMemo(() => {
    return dashboardData.activeCustomers.reduce((sum, row) => sum + Number(row.active_customer_count || 0), 0)
  }, [dashboardData.activeCustomers])

  const agingPartsCount = useMemo(() => {
    return dashboardData.agingStock.reduce((sum, row) => sum + Number(row.aging_count || 0), 0)
  }, [dashboardData.agingStock])

  const outstandingReceivablesByCurrency = useMemo(() => {
    const totals = dashboardData.receivables.reduce((acc, row) => {
      const c = row.currency || 'AED'
      const val = Number(row.outstanding_balance || 0)
      acc[c] = (acc[c] || 0) + val
      return acc
    }, {})

    // Subtract unlinked payments (advance payments not yet applied to an invoice)
    ;(dashboardData.unlinkedPayments || []).forEach((p) => {
      const c = p.currency || 'AED'
      totals[c] = (totals[c] || 0) - Number(p.amount || 0)
    })

    // Floor at zero — matches Customers.jsx convention
    Object.keys(totals).forEach((c) => {
      if (totals[c] < 0) totals[c] = 0
    })

    return Object.entries(totals)
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => a.currency.localeCompare(b.currency))
  }, [dashboardData.receivables, dashboardData.unlinkedPayments])

  const outstandingReceivablesHeadline = useMemo(() => {
    if (outstandingReceivablesByCurrency.length === 0) {
      return '0.00'
    }

    if (outstandingReceivablesByCurrency.length === 1) {
      const [entry] = outstandingReceivablesByCurrency
      return formatCurrency(entry.amount, entry.currency)
    }

    return 'Mixed currencies'
  }, [outstandingReceivablesByCurrency])

  const outstandingPayablesByCurrency = useMemo(() => {
    const totals = dashboardData.payables.reduce((acc, row) => {
      if (row.status === 'paid') return acc
      const c = row.currency || 'AED'
      const val = Number(row.amount || 0) - Number(row.amount_paid || 0)
      acc[c] = (acc[c] || 0) + val
      return acc
    }, {})
    return Object.entries(totals).map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency))
  }, [dashboardData.payables])

  const outstandingPayablesHeadline = useMemo(() => {
    if (outstandingPayablesByCurrency.length === 0) {
      return '0.00'
    }

    if (outstandingPayablesByCurrency.length === 1) {
      const [entry] = outstandingPayablesByCurrency
      return formatCurrency(entry.amount, entry.currency)
    }

    return 'Mixed currencies'
  }, [outstandingPayablesByCurrency])

  // Admin specific charts processing
  const partsPerBranch = useMemo(() => {
    return branches.map((branch) => {
      const bData = dashboardData.partsByBranch.filter(row => row.branch_id === branch.id)
      const count = bData.reduce((sum, row) => sum + Number(row.parts_count || 0), 0)
      return { name: branch.name, parts: count }
    })
  }, [branches, dashboardData.partsByBranch])

  const salesRevenuePerBranch = useMemo(() => {
    return branches.map((branch) => {
      const bData = dashboardData.monthlySales.filter(row => row.branch_id === branch.id)
      const totals = bData.reduce((acc, row) => {
        const c = row.currency || 'AED'
        acc[c] = (acc[c] || 0) + Number(row.total_revenue || 0)
        return acc
      }, {})
      return {
        name: branch.name,
        AED: totals.AED || 0,
        USD: totals.USD || 0,
      }
    })
  }, [branches, dashboardData.monthlySales])

  const averageDaysInStockPerBranch = useMemo(() => {
    return branches.map((branch) => {
      const bData = dashboardData.avgDaysInStock.filter(row => row.branch_id === branch.id)
      let sumDays = 0
      let count = 0
      bData.forEach(row => {
        sumDays += Number(row.avg_days_in_stock || 0)
        count += 1
      })
      const average = count > 0 ? Math.round(sumDays / count) : 0
      return { name: branch.name, days: average }
    })
  }, [branches, dashboardData.avgDaysInStock])

  const branchBreakdown = useMemo(() => {
    return branches.map((branch) => {
      const bData = dashboardData.branchBreakdown.filter(row => row.branch_id === branch.id)
      let inStock = 0
      let sold = 0
      bData.forEach(row => {
        inStock += Number(row.in_stock_count || 0)
        sold += Number(row.sold_count || 0)
      })
      return { name: branch.name, inStockCount: inStock, soldCount: sold }
    })
  }, [branches, dashboardData.branchBreakdown])

  // Analytics Trends
  const analyticsTrendData = useMemo(() => {
    const now = new Date()
    const periods = []
    const base = new Date(now.getFullYear(), now.getMonth(), 1)

    let monthCount
    if (salesTrendPeriod === '3months') {
      monthCount = 3
    } else if (salesTrendPeriod === '6months') {
      monthCount = 6
    } else if (salesTrendPeriod === 'year') {
      monthCount = base.getMonth() + 1
    } else {
      monthCount = 12
    }

    for (let i = monthCount - 1; i >= 0; i -= 1) {
      const start = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      periods.push({ key: `${start.getFullYear()}-${start.getMonth() + 1}`, label: formatTrendLabel(start), start, end })
    }

    const totals = periods.reduce((accumulator, period) => {
      accumulator[period.key] = { label: period.label, AED: 0, USD: 0 }
      return accumulator
    }, {})

    salesDaily.forEach((sale) => {
      const saleDate = new Date(sale.sale_date)
      const currency = sale.currency || 'AED'
      const revenue = Number(sale.total_revenue || 0)
      const period = periods.find((entry) => saleDate >= entry.start && saleDate < entry.end)
      if (period) {
        totals[period.key][currency] = (totals[period.key][currency] || 0) + revenue
      }
    })

    return Object.values(totals)
  }, [salesDaily, salesTrendPeriod])

  const analyticsTrendBars = useMemo(() => {
    const values = analyticsTrendData.map((entry) => ({
      label: entry.label,
      value: (entry.AED || 0) + (entry.USD || 0)
    }))
    const maxValue = values.reduce((max, item) => Math.max(max, item.value), 0) || 1
    return values.map((item) => ({
      ...item,
      percentage: Math.max(2, (item.value / maxValue) * 100),
    }))
  }, [analyticsTrendData])

  const analyticsCategoryData = useMemo(() => {
    const totals = {}
    const currencySet = new Set()

    salesByCategory.forEach((sale) => {
      const category = sale.category || 'Uncategorized'
      const value = Number(sale.total_revenue || 0)
      totals[category] = (totals[category] || 0) + value
      currencySet.add(sale.currency || 'AED')
    })

    const currency = currencySet.size === 1 ? currencySet.values().next().value : null
    const data = Object.entries(totals).map(([name, value], index) => ({
      name,
      value,
      color: categoryColors[index % categoryColors.length],
    }))

    const totalValue = data.reduce((sum, entry) => sum + entry.value, 0)

    return { data, currency, totalValue }
  }, [salesByCategory, salesTrendPeriod])

  const vehicleProfitFiltered = useMemo(() => {
    const now = new Date()
    const vehicles = (dashboardData.vehicleProfit || []).filter((v) => v.purchase_price != null)

    const filtered = vehicles.filter((v) => {
      if (vehicleProfitPeriod === 'all') return true
      const purchaseDate = new Date(v.purchase_date)
      if (vehicleProfitPeriod === 'month') {
        return purchaseDate.getMonth() === now.getMonth() && purchaseDate.getFullYear() === now.getFullYear()
      }
      if (vehicleProfitPeriod === '3months') {
        const cutoff = new Date(now)
        cutoff.setMonth(cutoff.getMonth() - 3)
        return purchaseDate >= cutoff
      }
      if (vehicleProfitPeriod === 'year') {
        return purchaseDate.getFullYear() === now.getFullYear()
      }
      return true
    })

    const totalPurchase = filtered.reduce((sum, v) => sum + Number(v.purchase_price), 0)
    const totalRevenue = filtered.reduce((sum, v) => sum + Number(v.revenue), 0)
    const totalProfit = totalRevenue - totalPurchase
    const currency = filtered[0]?.purchase_currency || 'AED'

    const chartData = [
      { name: 'Purchase', value: totalPurchase },
      { name: 'Revenue', value: totalRevenue },
      { name: 'Profit', value: totalProfit },
    ]

    return { totalPurchase, totalRevenue, totalProfit, currency, vehicleCount: filtered.length, chartData }
  }, [dashboardData.vehicleProfit, vehicleProfitPeriod])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-slate-300 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          Loading dashboard...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <TrendingUp className="h-4 w-4" />
                {t('dashboard.operationsOverview')}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{companyName}</h1>
              <p className="mt-2 text-sm text-slate-400">
                {t('dashboard.loggedInAs')} <span className="font-medium text-white">{user?.email}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {t('dashboard.livePerformanceSnapshot')}
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/sales" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.todaysSales')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{todaySalesByCurrency.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</p>
              </div>
              <DollarSign className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {todaySalesByCurrency.length > 0 ? todaySalesByCurrency.map((entry) => (
                <span key={entry.currency} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {formatCurrency(entry.amount, entry.currency)}
                </span>
              )) : (
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">{t('dashboard.noSalesToday')}</span>
              )}
            </div>
          </Link>

          <Link to="/sales" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.thisMonthsSales')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {monthlySalesByCurrency.length === 1
                    ? formatCurrency(monthlySalesByCurrency[0].amount, monthlySalesByCurrency[0].currency)
                    : monthlySalesByCurrency.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-slate-400">{totalSalesCountThisMonth} {totalSalesCountThisMonth === 1 ? t('dashboard.saleSingular') : t('dashboard.salePlural')} {t('dashboard.thisMonth')}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
          </Link>

          <Link to="/donor-vehicles" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.donorVehiclesPurchased')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{donorVehiclesAddedThisMonth}</p>
              </div>
              <Car className="h-6 w-6 text-sky-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">{t('dashboard.addedThisMonth')}</p>
          </Link>

          <Link to="/parts" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.availableParts')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{totalPartsInStock}</p>
              </div>
              <Package className="h-6 w-6 text-violet-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">{t('dashboard.currentlyInStock')}</p>
          </Link>

          <Link to="/parts?aging=true" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-orange-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.agingStock')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{agingPartsCount}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-orange-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">{t('dashboard.inStockOver60Days')}</p>
          </Link>

          <Link to="/sales" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.totalInvoices')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{totalInvoices}</p>
              </div>
              <Receipt className="h-6 w-6 text-amber-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">{t('dashboard.allTimeSalesInvoices')}</p>
          </Link>

          {currentStaff?.role === 'company_admin' ? (
            <Link to="/customers" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">{t('dashboard.activeCustomers')}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{activeCustomersCount}</p>
                </div>
                <Users className="h-6 w-6 text-cyan-300" />
              </div>
              <p className="mt-3 text-sm text-slate-400">{t('dashboard.withSalesLast90Days')}</p>
            </Link>
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">{t('dashboard.activeCustomers')}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{activeCustomersCount}</p>
                </div>
                <Users className="h-6 w-6 text-cyan-300" />
              </div>
              <p className="mt-3 text-sm text-slate-400">{t('dashboard.withSalesLast90Days')}</p>
            </div>
          )}

          <Link to="/receivables" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-rose-500/50 hover:bg-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{t('dashboard.outstandingReceivables')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{outstandingReceivablesHeadline}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-rose-400" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {outstandingReceivablesByCurrency.length > 0 ? outstandingReceivablesByCurrency.map((entry) => (
                <span key={entry.currency} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {formatCurrency(entry.amount, entry.currency)}
                </span>
              )) : (
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">{t('dashboard.noOutstandingBalance')}</span>
              )}
            </div>
          </Link>

          {currentStaff?.role === 'company_admin' ? (
            <Link to="/payables" className="block rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-800/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">{t('dashboard.accountsPayable')}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{outstandingPayablesHeadline}</p>
                </div>
                <Wallet className="h-6 w-6 text-cyan-400" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {outstandingPayablesByCurrency.length > 0 ? outstandingPayablesByCurrency.map((entry) => (
                    <span key={entry.currency} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                    {formatCurrency(entry.amount, entry.currency)}
                    </span>
                )) : (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">{t('dashboard.noOutstandingPayables')}</span>
                )}
              </div>
            </Link>
          ) : null}
        </div>

        {currentStaff?.role === 'company_admin' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <h2 className="text-xl font-semibold">{t('dashboard.partsByBranch')}</h2>
              <div className="mt-4 h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partsPerBranch} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', angle: -45, textAnchor: 'end', fontSize: 11 }}
                      interval={0}
                      minTickGap={8}
                      height={80}
                    />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <Tooltip />
                    <Bar dataKey="parts" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <h2 className="text-xl font-semibold">{t('dashboard.salesRevenueByBranch')}</h2>
              <div className="mt-4 h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesRevenuePerBranch} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', angle: -45, textAnchor: 'end', fontSize: 11 }}
                      interval={0}
                      minTickGap={8}
                      height={80}
                    />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend verticalAlign="top" align="right" />
                    <Bar dataKey="AED" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="USD" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <h2 className="text-xl font-semibold">{t('dashboard.avgDaysInStockByBranch')}</h2>
              <div className="mt-4 h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={averageDaysInStockPerBranch} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', angle: -45, textAnchor: 'end', fontSize: 11 }}
                      interval={0}
                      minTickGap={8}
                      height={80}
                    />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <Tooltip formatter={(value) => `${value} days`} />
                    <Bar dataKey="days" fill="#10b981" radius={[6, 6, 0, 0]} /> 
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t('dashboard.salesAnalytics')}</h2>
              <p className="mt-2 text-sm text-slate-400">{t('dashboard.monthlySalesTrend')}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{t('dashboard.salesAnalytics')}</p>
                <select
                  value={salesTrendPeriod}
                  onChange={(e) => setSalesTrendPeriod(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none"
                >
                  <option value="3months">{t('dashboard.last3Months')}</option>
                  <option value="6months">{t('dashboard.last6Months')}</option>
                  <option value="year">{t('dashboard.thisYear')}</option>
                  <option value="12months">{t('dashboard.last12Months')}</option>
                </select>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">{t('dashboard.monthlySales')}</p>
              </div>
              <div className="mt-6 h-[360px]">
                {analyticsTrendBars.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('dashboard.noSalesDataLast12Months')}</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsTrendBars} margin={{ top: 24, right: 0, left: 0, bottom: 36 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        interval={0}
                        minTickGap={8}
                        height={32}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {analyticsTrendBars.map((entry, index) => (
                          <Cell key={entry.label} fill={trendColors[index % trendColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <p className="text-sm text-slate-400">{t('dashboard.revenueByCategory')}</p>
              <div className="mt-4 flex h-80 flex-col items-center justify-center gap-4">
                {analyticsCategoryData.data.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={analyticsCategoryData.data}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                        >
                          {analyticsCategoryData.data.map((entry, index) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${formatCurrency(value, analyticsCategoryData.currency || 'AED')}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid gap-2">
                      {analyticsCategoryData.data.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2 text-sm text-slate-300">
                          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="font-medium text-white">{entry.name}</span>
                          <span className="text-slate-400">{((entry.value / analyticsCategoryData.totalValue) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">{t('dashboard.noSalesDataThisPeriod')}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{t('dashboard.vehicleProfit')}</h3>
              <p className="text-sm text-slate-400">
                {vehicleProfitFiltered.vehicleCount} {t('dashboard.vehiclesWithKnownCost')}
              </p>
            </div>
            <select
              value={vehicleProfitPeriod}
              onChange={(e) => setVehicleProfitPeriod(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none"
            >
              <option value="month">{t('dashboard.thisMonth')}</option>
              <option value="3months">{t('dashboard.last3Months')}</option>
              <option value="year">{t('dashboard.thisYear')}</option>
              <option value="all">{t('dashboard.allTime')}</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={vehicleProfitFiltered.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" tickFormatter={(value) => value === 'Purchase' ? t('dashboard.purchase') : value === 'Revenue' ? t('dashboard.revenue') : value === 'Profit' ? t('dashboard.profit') : value} />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                formatter={(value) => `${vehicleProfitFiltered.currency} ${Number(value).toFixed(2)}`}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {vehicleProfitFiltered.chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.name === 'Profit' ? (entry.value >= 0 ? '#34d399' : '#f87171') : index === 0 ? '#f59e0b' : '#22d3ee'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{t('dashboard.branchBreakdown')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('dashboard.branchBreakdownDesc')}</p>
            </div>
            <div className="rounded-full border border-slate-800/80 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {t('dashboard.updatedRealTime')}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/90 bg-slate-900/90 text-slate-400">
                  <th className="px-4 py-3 text-left font-medium">{t('dashboard.branch')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('dashboard.inStock')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('dashboard.sold')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('dashboard.activity')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {branchBreakdown.map((branch, index) => {
                  const total = branch.inStockCount + branch.soldCount
                  const soldRatio = total > 0 ? Math.round((branch.soldCount / total) * 100) : 0
                  return (
                    <tr key={branch.name} className={`transition duration-200 ${index % 2 === 0 ? 'bg-slate-950/70' : 'bg-slate-900/70'} hover:bg-slate-900/90`}>
                      <td className="px-4 py-4 font-medium text-white">{branch.name}</td>
                      <td className="px-4 py-4 text-right text-slate-200">{branch.inStockCount}</td>
                      <td className="px-4 py-4 text-right text-slate-200">{branch.soldCount}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{soldRatio}% {t('dashboard.percentSold')}</div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-300" style={{ width: `${soldRatio}%` }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  )
}

export default Dashboard
