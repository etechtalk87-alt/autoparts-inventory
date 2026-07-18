import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function ResetPassword() {
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
      setErrorMessage('Please enter a new password.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: password.trim() })

    if (error) {
      setErrorMessage(error.message || 'Unable to update your password.')
      setLoading(false)
      return
    }

    setSuccessMessage('Your password has been updated. You can now sign in.')
    setLoading(false)
    setTimeout(() => navigate('/login'), 1500)
  }

  if (!tokenValid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
          <h1 className="mb-2 text-3xl font-semibold">Invalid reset link</h1>
          <p className="mb-6 text-sm text-slate-400">Please request a new password reset link.</p>
          <Link to="/forgot-password" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
            Send another reset email
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30"
      >
        <h1 className="mb-2 text-3xl font-semibold">Reset your password</h1>
        <p className="mb-6 text-sm text-slate-400">Enter a new password to complete the reset.</p>

        <label className="mb-6 block text-left text-sm text-slate-300" htmlFor="reset-password">
          New Password
          <input
            id="reset-password"
            type="password"
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
          {loading ? 'Saving...' : 'Update password'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-400">
          <Link to="/login" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  )
}

export default ResetPassword
