import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

function SetupCompany() {
  const navigate = useNavigate()
  const { user, needsCompanySetup, refreshStaff } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (!user || !needsCompanySetup) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!companyName.trim() || !fullName.trim()) {
      setErrorMessage('Please enter a company name and your full name.')
      return
    }

    setLoading(true)

    const { error } = await supabase.rpc('create_company_and_admin', {
      company_name: companyName.trim(),
      admin_full_name: fullName.trim(),
    })

    if (error) {
      setErrorMessage(error.message || 'Unable to set up your company right now.')
      setLoading(false)
      return
    }

    await refreshStaff()
    setLoading(false)
    navigate('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30"
      >
        <h1 className="mb-2 text-3xl font-semibold">Set up your company</h1>
        <p className="mb-6 text-sm text-slate-400">Finish account setup by creating your company profile.</p>

        <label className="mb-4 block text-left text-sm text-slate-300" htmlFor="company-name">
          Company Name
          <input
            id="company-name"
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            required
          />
        </label>

        <label className="mb-6 block text-left text-sm text-slate-300" htmlFor="full-name">
          Full Name
          <input
            id="full-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            required
          />
        </label>

        {errorMessage ? <p className="mb-4 text-sm text-red-400">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Create company'}
        </button>
      </form>
    </main>
  )
}

export default SetupCompany
