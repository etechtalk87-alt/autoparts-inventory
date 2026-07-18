import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setMessage('')

    if (!email.trim()) {
      setErrorMessage('Please enter your email.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setErrorMessage(error.message || 'Unable to send password reset email.')
    } else {
      setMessage('Check your email for a reset link.')
    }

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30"
      >
        <h1 className="mb-2 text-3xl font-semibold">Forgot your password?</h1>
        <p className="mb-6 text-sm text-slate-400">Enter your email and we’ll send a reset link.</p>

        <label className="mb-6 block text-left text-sm text-slate-300" htmlFor="forgot-email">
          Email
          <input
            id="forgot-email"
            type="email"
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
          {loading ? 'Sending...' : 'Send reset link'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-400">
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  )
}

export default ForgotPassword
