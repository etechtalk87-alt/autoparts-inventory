import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { DollarSign, TrendingUp, Car, Package, Receipt, Users, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { isAgingStock } from '../lib/aging'
import { supabase } from '../lib/supabaseClient'

function formatCurrency(value, currency = 'AED') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function getWeekStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function formatTrendLabel(period, date) {
  if (period === 'daily') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (period === 'weekly') {
    return `Wk ${getWeekNumber(date)}`
  }

  if (period === 'monthly') {
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  return String(date.getFullYear())
}

const categoryColors = ['#0ea5e9', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6', '#fb7185']

function Dashboard() {
  const { signOut, user, currentStaff } = useAuth()
  const [parts, setParts] = useState([])
  const [sales, setSales] = useState([])
  const [branches, setBranches] = useState([])
  const [donorVehicles, setDonorVehicles] = useState([])
  const [trendPeriod, setTrendPeriod] = useState('daily')
  const [companyName, setCompanyName] = useState('AutoParts Inventory')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentStaff?.company_id) {
        setParts([])
        setSales([])
        setBranches([])
        setLoading(false)
        return
      }

      setLoading(true)

      const [partsResult, salesResult, branchesResult, donorVehiclesResult] = await Promise.all([
        supabase
          .from('parts')
          .select('id, branch_id, currency, cost, status, date_added, created_at')
          .eq('company_id', currentStaff.company_id)
          .order('part_name', { ascending: true }),
        supabase
          .from('sales')
          .select('id, branch_id, sale_price, created_at, part_id, customer_id, amount_paid, payment_status, parts:part_id ( currency, category )')
          .eq('company_id', currentStaff.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('branches')
          .select('id, name')
          .eq('company_id', currentStaff.company_id)
          .order('name', { ascending: true }),
        supabase
          .from('donor_vehicles')
          .select('id, branch_id, created_at')
          .eq('company_id', currentStaff.company_id)
          .order('created_at', { ascending: false }),
      ])

      if (!partsResult.error) {
        setParts(partsResult.data ?? [])
      } else {
        setParts([])
      }

      if (!salesResult.error) {
        setSales(salesResult.data ?? [])
      } else {
        setSales([])
      }

      if (!branchesResult.error) {
        setBranches(branchesResult.data ?? [])
      } else {
        setBranches([])
      }

      if (!donorVehiclesResult.error) {
        setDonorVehicles(donorVehiclesResult.data ?? [])
      } else {
        setDonorVehicles([])
      }

      setLoading(false)
    }

    fetchDashboardData()
  }, [currentStaff?.company_id])

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

  const scopedParts = useMemo(() => {
    if (!currentStaff) {
      return []
    }

    if (currentStaff.role === 'branch_staff') {
      return parts.filter((part) => String(part.branch_id) === String(currentStaff.branch_id))
    }

    return parts
  }, [currentStaff, parts])

  const scopedSales = useMemo(() => {
    if (!currentStaff) {
      return []
    }

    if (currentStaff.role === 'branch_staff') {
      return sales.filter((sale) => String(sale.branch_id) === String(currentStaff.branch_id))
    }

    return sales
  }, [currentStaff, sales])

  const inStockParts = useMemo(() => scopedParts.filter((part) => part.status === 'in_stock'), [scopedParts])
  const soldParts = useMemo(() => scopedParts.filter((part) => part.status === 'sold'), [scopedParts])

  const inventoryByCurrency = useMemo(() => {
    const totals = inStockParts.reduce((accumulator, part) => {
      const currency = part.currency || 'AED'
      accumulator[currency] = accumulator[currency] || { currency, count: 0, value: 0 }
      accumulator[currency].count += 1
      accumulator[currency].value += Number(part.cost || 0)
      return accumulator
    }, {})

    return Object.values(totals).sort((left, right) => left.currency.localeCompare(right.currency))
  }, [inStockParts])

  const monthlySales = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    return scopedSales.filter((sale) => {
      const saleDate = new Date(sale.created_at)
      return saleDate >= start && saleDate < end
    })
  }, [scopedSales])

  const salesByCurrency = useMemo(() => {
    const totals = monthlySales.reduce((accumulator, sale) => {
      const currency = sale.parts?.currency || 'AED'
      accumulator[currency] = accumulator[currency] || { currency, count: 0, revenue: 0 }
      accumulator[currency].count += 1
      accumulator[currency].revenue += Number(sale.sale_price || 0)
      return accumulator
    }, {})

    return Object.values(totals).sort((left, right) => left.currency.localeCompare(right.currency))
  }, [monthlySales])

  const partsPerBranch = useMemo(() => {
    return branches.map((branch) => ({
      name: branch.name,
      parts: scopedParts.filter((part) => String(part.branch_id) === String(branch.id)).length,
    }))
  }, [branches, scopedParts])

  const salesRevenuePerBranch = useMemo(() => {
    return branches.map((branch) => {
      const branchSales = monthlySales.filter((sale) => String(sale.branch_id) === String(branch.id))
      const totals = branchSales.reduce((accumulator, sale) => {
        const currency = sale.parts?.currency || 'AED'
        accumulator[currency] = (accumulator[currency] || 0) + Number(sale.sale_price || 0)
        return accumulator
      }, {})

      return {
        name: branch.name,
        AED: totals.AED || 0,
        USD: totals.USD || 0,
      }
    })
  }, [branches, monthlySales])

  const averageDaysInStockPerBranch = useMemo(() => {
    const branchStats = {}
    
    // Initialize branch stats
    branches.forEach((branch) => {
      branchStats[branch.id] = { totalDays: 0, count: 0 }
    })
    
    const today = new Date()
    
    // Process in-stock parts
    inStockParts.forEach((part) => {
      if (!part.date_added) return
      
      const dateAdded = new Date(part.date_added)
      const daysInStock = Math.floor((today - dateAdded) / (1000 * 60 * 60 * 24))
      
      if (branchStats[part.branch_id]) {
        branchStats[part.branch_id].totalDays += daysInStock
        branchStats[part.branch_id].count += 1
      }
    })
    
    // Process sold parts
    soldParts.forEach((part) => {
      if (!part.date_added) return
      
      // Find the sale for this part
      const sale = scopedSales.find((s) => s.part_id === part.id)
      
      if (!sale || !sale.created_at) return
      
      const dateAdded = new Date(part.date_added)
      const dateSold = new Date(sale.created_at)
      const daysInStock = Math.floor((dateSold - dateAdded) / (1000 * 60 * 60 * 24))
      
      if (branchStats[part.branch_id]) {
        branchStats[part.branch_id].totalDays += daysInStock
        branchStats[part.branch_id].count += 1
      }
    })
    
    // Calculate averages and format for chart
    return branches.map((branch) => {
      const stats = branchStats[branch.id]
      const average = stats.count > 0 ? Math.round(stats.totalDays / stats.count) : 0
      return {
        name: branch.name,
        days: average,
      }
    })
  }, [branches, inStockParts, soldParts, scopedSales])

  const branchBreakdown = useMemo(() => {
    return branches.map((branch) => {
      const branchParts = scopedParts.filter((part) => String(part.branch_id) === String(branch.id))
      const inStockCount = branchParts.filter((part) => part.status === 'in_stock').length
      const soldCount = branchParts.filter((part) => part.status === 'sold').length
      return {
        name: branch.name,
        inStockCount,
        soldCount,
      }
    })
  }, [branches, scopedParts])

  const totalPartsInStock = inStockParts.length
  const totalPartsSold = soldParts.length
  const agingPartsCount = useMemo(() => scopedParts.filter((part) => isAgingStock(part)).length, [scopedParts])
  const soldToInStockRatio = totalPartsInStock > 0 ? (totalPartsSold / totalPartsInStock).toFixed(2) : '0.00'

  const donorVehiclesAddedThisMonth = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    return donorVehicles.filter((vehicle) => {
      const createdAt = new Date(vehicle.created_at)
      return createdAt >= start && createdAt < end && (currentStaff.role !== 'branch_staff' || String(vehicle.branch_id) === String(currentStaff.branch_id))
    }).length
  }, [donorVehicles, currentStaff])

  const totalInvoices = useMemo(() => scopedSales.length, [scopedSales])

  const activeCustomersCount = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    const recentSales = scopedSales.filter((sale) => {
      const createdAt = new Date(sale.created_at)
      return createdAt >= cutoff
    })

    return new Set(recentSales.map((sale) => sale.customer_id)).size
  }, [scopedSales])

  const todaySalesByCurrency = useMemo(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const totals = scopedSales
      .filter((sale) => {
        const createdAt = new Date(sale.created_at)
        return createdAt >= start && createdAt < end
      })
      .reduce((accumulator, sale) => {
        const currency = sale.parts?.currency || 'AED'
        accumulator[currency] = (accumulator[currency] || 0) + Number(sale.sale_price || 0)
        return accumulator
      }, {})

    return Object.entries(totals).map(([currency, amount]) => ({ currency, amount }))
  }, [scopedSales])

  const monthlySalesByCurrency = useMemo(() => {
    const totals = monthlySales.reduce((accumulator, sale) => {
      const currency = sale.parts?.currency || 'AED'
      accumulator[currency] = (accumulator[currency] || 0) + Number(sale.sale_price || 0)
      return accumulator
    }, {})

    return Object.entries(totals).map(([currency, amount]) => ({ currency, amount }))
  }, [monthlySales])

  const outstandingReceivablesByCurrency = useMemo(() => {
    const totals = scopedSales.reduce((accumulator, sale) => {
      if (sale.payment_status === 'partial' || sale.payment_status === 'credit') {
        const currency = sale.parts?.currency || 'AED'
        const balance = Number(sale.sale_price || 0) - Number(sale.amount_paid || 0)
        accumulator[currency] = (accumulator[currency] || 0) + balance
      }
      return accumulator
    }, {})

    return Object.entries(totals).map(([currency, amount]) => ({ currency, amount }))
  }, [scopedSales])

  const analyticsTrendData = useMemo(() => {
    const now = new Date()
    const periods = []

    if (trendPeriod === 'daily') {
      const base = new Date(now)
      base.setHours(0, 0, 0, 0)
      for (let i = 29; i >= 0; i -= 1) {
        const start = new Date(base)
        start.setDate(base.getDate() - i)
        const end = new Date(start)
        end.setDate(start.getDate() + 1)
        periods.push({ key: start.toISOString().slice(0, 10), label: formatTrendLabel('daily', start), start, end })
      }
    } else if (trendPeriod === 'weekly') {
      const base = new Date(now)
      base.setHours(0, 0, 0, 0)
      const offset = (base.getDay() + 6) % 7
      base.setDate(base.getDate() - offset)
      for (let i = 11; i >= 0; i -= 1) {
        const start = new Date(base)
        start.setDate(base.getDate() - i * 7)
        const end = new Date(start)
        end.setDate(start.getDate() + 7)
        periods.push({ key: `${start.getFullYear()}-${getWeekNumber(start)}`, label: formatTrendLabel('weekly', start), start, end })
      }
    } else if (trendPeriod === 'monthly') {
      const base = new Date(now.getFullYear(), now.getMonth(), 1)
      for (let i = 11; i >= 0; i -= 1) {
        const start = new Date(base.getFullYear(), base.getMonth() - i, 1)
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
        periods.push({ key: `${start.getFullYear()}-${start.getMonth() + 1}`, label: formatTrendLabel('monthly', start), start, end })
      }
    } else {
      const years = Array.from(new Set(scopedSales.map((sale) => new Date(sale.created_at).getFullYear()))).sort()
      years.forEach((year) => {
        const start = new Date(year, 0, 1)
        const end = new Date(year + 1, 0, 1)
        periods.push({ key: String(year), label: formatTrendLabel('yearly', start), start, end })
      })
    }

    const totals = periods.reduce((accumulator, period) => {
      accumulator[period.key] = { label: period.label, AED: 0, USD: 0 }
      return accumulator
    }, {})

    scopedSales.forEach((sale) => {
      const saleDate = new Date(sale.created_at)
      const currency = sale.parts?.currency || 'AED'
      const value = Number(sale.sale_price || 0)
      const period = periods.find((entry) => saleDate >= entry.start && saleDate < entry.end)
      if (period) {
        totals[period.key][currency] = (totals[period.key][currency] || 0) + value
      }
    })

    return Object.values(totals)
  }, [scopedSales, trendPeriod])

  const analyticsCategoryData = useMemo(() => {
    const now = new Date()
    let startDate = new Date(0)
    let endDate = new Date(now)

    if (trendPeriod === 'daily') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 29)
      startDate.setHours(0, 0, 0, 0)
    } else if (trendPeriod === 'weekly') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7 * 11)
      startDate.setHours(0, 0, 0, 0)
    } else if (trendPeriod === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    } else {
      const years = scopedSales.map((sale) => new Date(sale.created_at).getFullYear())
      const minYear = Math.min(...years, now.getFullYear())
      startDate = new Date(minYear, 0, 1)
    }

    const totals = {}
    const currencySet = new Set()

    scopedSales.forEach((sale) => {
      const saleDate = new Date(sale.created_at)
      if (saleDate < startDate || saleDate > endDate) return
      const category = sale.parts?.category || 'Uncategorized'
      const value = Number(sale.sale_price || 0)
      totals[category] = (totals[category] || 0) + value
      currencySet.add(sale.parts?.currency || 'AED')
    })

    const currency = currencySet.size === 1 ? currencySet.values().next().value : null
    const data = Object.entries(totals).map(([name, value], index) => ({
      name,
      value,
      color: categoryColors[index % categoryColors.length],
    }))

    const totalValue = data.reduce((sum, entry) => sum + entry.value, 0)

    return { data, currency, totalValue }
  }, [scopedSales, trendPeriod])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-lg text-slate-300">Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">Operations overview</p>
              <h1 className="mt-2 text-3xl font-semibold">{companyName}</h1>
              <p className="mt-2 text-sm text-slate-400">
                Logged in as <span className="font-medium text-white">{user?.email}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Today's Sales</p>
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
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">No sales today</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">This Month's Sales</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {monthlySalesByCurrency.length === 1
                    ? formatCurrency(monthlySalesByCurrency[0].amount, monthlySalesByCurrency[0].currency)
                    : monthlySalesByCurrency.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-slate-400">{monthlySales.length} {monthlySales.length === 1 ? 'sale' : 'sales'} this month</p>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Donor Vehicles Purchased</p>
                <p className="mt-2 text-3xl font-semibold text-white">{donorVehiclesAddedThisMonth}</p>
              </div>
              <Car className="h-6 w-6 text-sky-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">Added this month</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Available Parts</p>
                <p className="mt-2 text-3xl font-semibold text-white">{totalPartsInStock}</p>
              </div>
              <Package className="h-6 w-6 text-violet-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">Currently in stock</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Total Invoices</p>
                <p className="mt-2 text-3xl font-semibold text-white">{totalInvoices}</p>
              </div>
              <Receipt className="h-6 w-6 text-amber-400" />
            </div>
            <p className="mt-3 text-sm text-slate-400">All-time sales invoices</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Active Customers</p>
                <p className="mt-2 text-3xl font-semibold text-white">{activeCustomersCount}</p>
              </div>
              <Users className="h-6 w-6 text-cyan-300" />
            </div>
            <p className="mt-3 text-sm text-slate-400">With sales in last 90 days</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Outstanding Receivables</p>
                <p className="mt-2 text-3xl font-semibold text-white">{outstandingReceivablesByCurrency.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-rose-400" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {outstandingReceivablesByCurrency.length > 0 ? outstandingReceivablesByCurrency.map((entry) => (
                <span key={entry.currency} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {formatCurrency(entry.amount, entry.currency)}
                </span>
              )) : (
                <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">No outstanding balance</span>
              )}
            </div>
          </div>
        </div>

        {currentStaff?.role === 'company_admin' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-semibold">Parts by branch</h2>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partsPerBranch} margin={{ bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', angle: -35, textAnchor: 'end' }}
                      interval={0}
                      minTickGap={8}
                      height={70}
                    />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <Tooltip />
                    <Bar dataKey="parts" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-semibold">Sales revenue by branch this month</h2>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesRevenuePerBranch} margin={{ bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', angle: -35, textAnchor: 'end' }}
                      interval={0}
                      minTickGap={8}
                      height={70}
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

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-semibold">Average days in stock by branch</h2>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={averageDaysInStockPerBranch} margin={{ bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', angle: -35, textAnchor: 'end' }}
                      interval={0}
                      minTickGap={8}
                      height={70}
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sales Analytics</h2>
              <p className="mt-2 text-sm text-slate-400">Trend and category breakdown for the selected period.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['daily', 'weekly', 'monthly', 'yearly'].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setTrendPeriod(period)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${trendPeriod === period ? 'border-cyan-400 bg-cyan-500 text-slate-950' : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800'}`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
              <p className="text-sm text-slate-400">Revenue trend</p>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsTrendData} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fill: '#94a3b8', angle: -35, textAnchor: 'end' }} interval={0} height={70} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend verticalAlign="top" align="right" />
                    <Bar dataKey="AED" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="USD" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
              <p className="text-sm text-slate-400">Revenue by category</p>
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
                  <p className="text-sm text-slate-400">No sales data available for this period.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h2 className="text-xl font-semibold">Branch breakdown</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">In-stock</th>
                  <th className="px-4 py-3 font-medium">Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/70">
                {branchBreakdown.map((branch) => (
                  <tr key={branch.name}>
                    <td className="px-4 py-3 font-medium text-white">{branch.name}</td>
                    <td className="px-4 py-3">{branch.inStockCount}</td>
                    <td className="px-4 py-3">{branch.soldCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Dashboard
