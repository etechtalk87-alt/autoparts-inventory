import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import LanguageToggle from '../components/LanguageToggle'

function SetPassword() {
  const { t } = useTranslation()
  const { clearPasswordSetupFlag } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (password.length < 8) {
      setErrorMessage(t('setPassword.errorTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('setPassword.errorMismatch'))
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
    } else {
      setSuccessMessage(t('setPassword.successMessage'))
      // Briefly show success before clearing the flag, which will trigger App.jsx routing
      setTimeout(() => {
        clearPasswordSetupFlag()
      }, 1500)
    }
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
          <h1 className="mb-2 text-3xl font-semibold">{t('setPassword.title')}</h1>
          <p className="mb-6 text-sm text-slate-400">
            {t('setPassword.subtitle')}
          </p>
          <label className="mb-4 block text-start text-sm text-slate-300" htmlFor="password">
            {t('setPassword.newPassword')}
            <input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 focus:border-cyan-500"
              required
              minLength={8}
            />
          </label>
          <label className="mb-6 block text-start text-sm text-slate-300" htmlFor="confirmPassword">
            {t('setPassword.confirmPassword')}
            <input
              id="confirmPassword"
              type="password"
              dir="ltr"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 focus:border-cyan-500"
              required
              minLength={8}
            />
          </label>
          {errorMessage ? (
            <p className="mb-4 rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-400">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="mb-4 rounded-lg bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">{successMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !!successMessage}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && !successMessage ? t('setPassword.saving') : t('setPassword.setPasswordButton')}
          </button>
        </form>
      </div>
    </main>
  )
}

export default SetPassword