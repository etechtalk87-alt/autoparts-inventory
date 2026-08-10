import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import LanguageToggle from '../components/LanguageToggle'

function Signup() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [signupComplete, setSignupComplete] = useState(false)

  const formatError = (error) => {
    const message = error?.message || ''
    if (message.toLowerCase().includes('already registered')) {
      return t('signup.errorAlreadyRegistered')
    }
    if (message.toLowerCase().includes('password')) {
      return t('signup.errorWeakPassword')
    }
    if (message.toLowerCase().includes('rpc')) {
      return t('signup.errorCompanyProfile')
    }
    return message || t('signup.errorGeneric')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!companyName.trim() || !fullName.trim()) {
      setErrorMessage(t('signup.errorMissingFields'))
      return
    }

    setLoading(true)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (signUpError) {
      setErrorMessage(formatError(signUpError))
      setLoading(false)
      return
    }

    if (!signUpData?.user) {
      setErrorMessage(t('signup.errorAccountNotCreated'))
      setLoading(false)
      return
    }

    setSuccessMessage(t('signup.successMessage', { email: email.trim() }))
    setSignupComplete(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
          <h1 className="mb-2 text-3xl font-semibold">{t('signup.title')}</h1>
          <p className="mb-6 text-sm text-slate-400">{t('signup.subtitle')}</p>

          {signupComplete ? (
            <div>
              <p className="mb-6 text-sm text-emerald-400">{successMessage}</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                {t('signup.goToLogin')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="mb-4 block text-start text-sm text-slate-300" htmlFor="company-name">
                {t('signup.companyName')}
                <input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  required
                />
              </label>
              <label className="mb-4 block text-start text-sm text-slate-300" htmlFor="full-name">
                {t('signup.fullName')}
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  required
                />
              </label>
              <label className="mb-4 block text-start text-sm text-slate-300" htmlFor="signup-email">
                {t('signup.email')}
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  required
                />
              </label>
              <label className="mb-6 block text-start text-sm text-slate-300" htmlFor="signup-password">
                {t('signup.password')}
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  required
                  minLength="6"
                />
              </label>
              {errorMessage ? <p className="mb-4 text-sm text-red-400">{errorMessage}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t('signup.creatingAccount') : t('signup.createAccount')}
              </button>
              <p className="mt-4 text-center text-sm text-slate-400">
                {t('signup.alreadyHaveAccount')}{' '}
                <Link to="/login" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
                  {t('signup.logIn')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default Signup