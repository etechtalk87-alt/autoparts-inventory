import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

function Layout({ children }) {
  const { signOut, user, currentStaff, activeBranchId, setActiveBranchId } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [companyName, setCompanyName] = useState('AutoParts Inventory')
  const [switcherBranches, setSwitcherBranches] = useState([])

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    ...(currentStaff?.role === 'company_admin' ? [{ to: '/branches', label: 'Branches' }] : []),
    ...(currentStaff?.role === 'company_admin' ? [{ to: '/customers', label: 'Customers' }] : []),
    ...(currentStaff?.role === 'company_admin' ? [{ to: '/manage-staff', label: 'Manage Staff' }] : []),
    { to: '/donor-vehicles', label: 'Donor Vehicles' },
    { to: '/parts', label: 'Spare Parts' },
    { to: '/parts/import', label: 'Import Parts' },
    { to: '/transfers', label: 'Transfers' },
    { to: '/sales', label: 'Sales' },
    ...(currentStaff?.role === 'company_admin' ? [{ to: '/payables', label: 'Payables' }] : []),
  ]

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

  // Fetch branch names for the switcher — only when branch_staff has multiple branches
  useEffect(() => {
    const branchIds = currentStaff?.branchIds ?? []
    if (currentStaff?.role !== 'branch_staff' || branchIds.length <= 1) {
      setSwitcherBranches([])
      return
    }
    const fetchSwitcherBranches = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .in('id', branchIds)
        .order('name')
      if (!error) setSwitcherBranches(data ?? [])
    }
    fetchSwitcherBranches()
  }, [currentStaff?.role, currentStaff?.branchIds])

  const showSwitcher =
    currentStaff?.role === 'branch_staff' && switcherBranches.length > 1

  const isActive = (to) => location.pathname === to

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-lg font-semibold text-cyan-400">
              AP
            </div>
            <div>
              <p className="text-lg font-semibold">{companyName}</p>
              <p className="text-xs text-slate-400">{user?.email ? `Logged in as ${user.email}` : 'Operations Hub'}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive: active }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${active || isActive(link.to) ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="ml-2 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              {showSwitcher && (
                <select
                  value={activeBranchId ?? ''}
                  onChange={(e) => setActiveBranchId(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-cyan-300 outline-none transition hover:border-slate-500 focus:border-cyan-500"
                  aria-label="Switch active branch"
                >
                  {switcherBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <span className="max-w-[140px] truncate text-sm text-slate-300">{user?.email}</span>
              <button type="button" onClick={() => signOut()} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">
                Logout
              </button>
            </div>
          </div>

          <button type="button" className="rounded-lg border border-slate-700 p-2 text-slate-200 md:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive: active }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${active || isActive(link.to) ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
                <p className="truncate text-sm text-slate-300">{user?.email}</p>
                {showSwitcher && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-slate-500">Active branch</p>
                    <select
                      value={activeBranchId ?? ''}
                      onChange={(e) => setActiveBranchId(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-medium text-cyan-300 outline-none"
                      aria-label="Switch active branch"
                    >
                      {switcherBranches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="button" onClick={() => signOut()} className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">
                  Logout
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </nav>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  )
}

export default Layout
