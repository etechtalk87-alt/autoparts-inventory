import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/AuthContext'
import LanguageToggle from '../components/LanguageToggle'

function AccountSuspended() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
          <h1 className="text-3xl font-semibold">{t('accountSuspended.title')}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            {t('accountSuspended.message')}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            {t('accountSuspended.signOut')}
          </button>
        </div>
      </div>
    </main>
  )
}

export default AccountSuspended