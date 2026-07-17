import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

function Dashboard() {
  const { signOut, user, currentStaff } = useAuth()
  const [parts, setParts] = useState([])
  const [sales, setSales] = useState([])
  const [branches, setBranches] = useState([])
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

      const [partsResult, salesResult, branchesResult] = await Promise.all([
        supabase
          .from('parts')
          .select('id, branch_id, currency, cost, status, date_added, created_at')
          .eq('company_id', currentStaff.company_id)
          .order('part_name', { ascending: true }),
        supabase
          .from('sales')
          .select('id, branch_id, sale_price, created_at, part_id, parts:part_id ( currency )')
          .eq('company_id', currentStaff.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('branches')
          .select('id, name')
          .eq('company_id', currentStaff.company_id)
          .order('name', { ascending: true }),
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="text-sm text-slate-400">In-stock parts</p>
            <p className="mt-2 text-3xl font-semibold text-white">{totalPartsInStock}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {inventoryByCurrency.map((entry) => (
                <span key={entry.currency} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {entry.count} {entry.count === 1 ? 'item' : 'items'} • {formatCurrency(entry.value, entry.currency)}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="text-sm text-slate-400">Sales this month</p>
            <p className="mt-2 text-3xl font-semibold text-white">{monthlySales.length}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {salesByCurrency.map((entry) => (
                <span key={entry.currency} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                  {entry.count} {entry.count === 1 ? 'sale' : 'sales'} • {formatCurrency(entry.revenue, entry.currency)}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="text-sm text-slate-400">Sold vs in-stock</p>
            <p className="mt-2 text-3xl font-semibold text-white">{totalPartsSold} / {totalPartsInStock}</p>
            <p className="mt-2 text-sm text-slate-400">Sold-to-stock ratio: {soldToInStockRatio}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="text-sm text-slate-400">Aging stock</p>
            <p className="mt-2 text-3xl font-semibold text-white">{agingPartsCount} {agingPartsCount === 1 ? 'part' : 'parts'}</p>
            <p className="mt-2 text-sm text-slate-400">{currentStaff?.role === 'company_admin' ? 'Across all branches' : 'For your current branch'}</p>
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
