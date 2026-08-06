import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/AuthContext'
import LanguageToggle from '../components/LanguageToggle'

function Login() {
  const { t } = useTranslation()
  const { signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    const { error } = await signIn(email, password)

    if (error) {
      setErrorMessage(error.message)
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
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30"
        >
          <h1 className="mb-2 text-3xl font-semibold">{t('login.title')}</h1>
          <p className="mb-6 text-sm text-slate-400">{t('login.subtitle')}</p>

          <label className="mb-4 block text-start text-sm text-slate-300" htmlFor="email">
            {t('login.email')}
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0"
              required
            />
          </label>

          <label className="mb-6 block text-start text-sm text-slate-300" htmlFor="password">
            {t('login.password')}
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0"
              required
            />
          </label>

          {errorMessage ? (
            <p className="mb-4 text-sm text-red-400">{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>

          <p className="mt-4 text-center text-sm text-slate-400">
            {t('login.needAccount')}{' '}
            <Link to="/signup" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
              {t('login.signUp')}
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-400">
            <Link to="/forgot-password" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
              {t('login.forgotPassword')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}

export default Login