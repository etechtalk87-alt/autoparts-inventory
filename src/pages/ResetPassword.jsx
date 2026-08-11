import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import LanguageToggle from '../components/LanguageToggle'

function ResetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [tokenValid, setTokenValid] = useState(true)

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    if (!accessToken) {
      setTokenValid(false)
    }
  }, [searchParams])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (!password.trim()) {
      setErrorMessage(t('resetPassword.errorEnterPassword'))
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: password.trim() })
    if (error) {
      setErrorMessage(error.message || t('resetPassword.errorGeneric'))
      setLoading(false)
      return
    }
    setSuccessMessage(t('resetPassword.successMessage'))
    setLoading(false)
    setTimeout(() => navigate('/login'), 1500)
  }

  if (!tokenValid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="w-full max-w-md">
          <div className="mb-4 flex justify-end">
            <LanguageToggle />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
            <h1 className="mb-2 text-3xl font-semibold">{t('resetPassword.invalidLinkTitle')}</h1>
            <p className="mb-6 text-sm text-slate-400">{t('resetPassword.invalidLinkSubtitle')}</p>
            <Link to="/forgot-password" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
              {t('resetPassword.sendAnotherLink')}
            </Link>
          </div>
        </div>
      </main>
    )
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
          <h1 className="mb-2 text-3xl font-semibold">{t('resetPassword.title')}</h1>
          <p className="mb-6 text-sm text-slate-400">{t('resetPassword.subtitle')}</p>
          <label className="mb-6 block text-start text-sm text-slate-300" htmlFor="reset-password">
            {t('resetPassword.newPassword')}
            <input
              id="reset-password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              required
              minLength="6"
            />
          </label>
          {errorMessage ? <p className="mb-4 text-sm text-red-400">{errorMessage}</p> : null}
          {successMessage ? <p className="mb-4 text-sm text-emerald-400">{successMessage}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t('resetPassword.saving') : t('resetPassword.updatePassword')}
          </button>
          <p className="mt-4 text-center text-sm text-slate-400">
            <Link to="/login" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
              {t('resetPassword.backToSignIn')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}

export default ResetPassword