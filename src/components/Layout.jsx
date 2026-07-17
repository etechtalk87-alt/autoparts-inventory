import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

function Layout({ children }) {
  const { signOut, user, currentStaff } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [companyName, setCompanyName] = useState('AutoParts Inventory')

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    ...(currentStaff?.role === 'company_admin' ? [{ to: '/branches', label: 'Branches' }] : []),
    { to: '/donor-vehicles', label: 'Donor Vehicles' },
    { to: '/parts', label: 'Parts' },
    { to: '/parts/import', label: 'Import Parts' },
    { to: '/transfers', label: 'Transfers' },
    { to: '/sales', label: 'Sales' },
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
