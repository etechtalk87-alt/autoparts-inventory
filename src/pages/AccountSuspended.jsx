import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function AccountSuspended() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
        <h1 className="text-3xl font-semibold">Account Suspended</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          Your company's account has been suspended. Please contact support to resolve this issue.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}

export default AccountSuspended
