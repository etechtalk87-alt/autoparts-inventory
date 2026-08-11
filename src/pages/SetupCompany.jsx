import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import LanguageToggle from '../components/LanguageToggle'

function SetupCompany() {
  const { t } = useTranslation()
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
      setErrorMessage(t('setupCompany.errorMissingFields'))
      return
    }
    setLoading(true)
    const { error } = await supabase.rpc('create_company_and_admin', {
      company_name: companyName.trim(),
      admin_full_name: fullName.trim(),
    })
    if (error) {
      setErrorMessage(error.message || t('setupCompany.errorGeneric'))
      setLoading(false)
      return
    }
    await refreshStaff()
    setLoading(false)
    navigate('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30"
        >
          <h1 className="mb-2 text-3xl font-semibold">{t('setupCompany.title')}</h1>
          <p className="mb-6 text-sm text-slate-400">{t('setupCompany.subtitle')}</p>
          <label className="mb-4 block text-start text-sm text-slate-300" htmlFor="company-name">
            {t('setupCompany.companyName')}
            <input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              required
            />
          </label>
          <label className="mb-6 block text-start text-sm text-slate-300" htmlFor="full-name">
            {t('setupCompany.fullName')}
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
            {loading ? t('setupCompany.saving') : t('setupCompany.createCompany')}
          </button>
        </form>
      </div>
    </main>
  )
}

export default SetupCompany