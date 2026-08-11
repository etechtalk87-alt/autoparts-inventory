import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import LanguageToggle from '../components/LanguageToggle'

function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setMessage('')
    if (!email.trim()) {
      setErrorMessage(t('forgotPassword.errorEnterEmail'))
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setErrorMessage(error.message || t('forgotPassword.errorGeneric'))
    } else {
      setMessage(t('forgotPassword.successMessage'))
    }
    setLoading(false)
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
          <h1 className="mb-2 text-3xl font-semibold">{t('forgotPassword.title')}</h1>
          <p className="mb-6 text-sm text-slate-400">{t('forgotPassword.subtitle')}</p>
          <label className="mb-6 block text-start text-sm text-slate-300" htmlFor="forgot-email">
            {t('forgotPassword.email')}
            <input
              id="forgot-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              required
            />
          </label>
          {errorMessage ? <p className="mb-4 text-sm text-red-400">{errorMessage}</p> : null}
          {message ? <p className="mb-4 text-sm text-emerald-400">{message}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t('forgotPassword.sending') : t('forgotPassword.sendResetLink')}
          </button>
          <p className="mt-4 text-center text-sm text-slate-400">
            {t('forgotPassword.rememberedPassword')}{' '}
            <Link to="/login" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
              {t('forgotPassword.signIn')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}

export default ForgotPassword