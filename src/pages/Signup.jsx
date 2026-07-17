import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function Signup() {
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const formatError = (error) => {
    const message = error?.message || ''

    if (message.toLowerCase().includes('already registered')) {
      return 'An account with this email already exists. Please log in instead.'
    }

    if (message.toLowerCase().includes('password')) {
      return 'Please choose a stronger password with at least 6 characters.'
    }

    if (message.toLowerCase().includes('rpc')) {
      return 'Your company profile could not be created. Please try again.'
    }

    return message || 'Unable to create your account right now.'
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!companyName.trim() || !fullName.trim()) {
      setErrorMessage('Please provide your company name and your full name.')
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
      setErrorMessage('Your account could not be created. Please try again.')
      setLoading(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('create_company_and_admin', {
      company_name: companyName.trim(),
      admin_full_name: fullName.trim(),
    })

    if (rpcError) {
      setErrorMessage(formatError(rpcError))
      setLoading(false)
      return
    }

    setSuccessMessage('Account created successfully. You are being redirected to the dashboard.')

    if (signUpData.session) {
      navigate('/')
      setLoading(false)
      return
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (!signInError && signInData?.session) {
      navigate('/')
    } else {
      setSuccessMessage('Account created successfully. Please sign in after confirming your email if required.')
    }

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30"
      >
        <h1 className="mb-2 text-3xl font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-slate-400">Start a new company and become its company admin.</p>

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

        <label className="mb-4 block text-left text-sm text-slate-300" htmlFor="full-name">
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

        <label className="mb-4 block text-left text-sm text-slate-300" htmlFor="signup-email">
          Email
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            required
          />
        </label>

        <label className="mb-6 block text-left text-sm text-slate-300" htmlFor="signup-password">
          Password
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
        {successMessage ? <p className="mb-4 text-sm text-emerald-400">{successMessage}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
            Log in
          </Link>
        </p>
      </form>
    </main>
  )
}

export default Signup
