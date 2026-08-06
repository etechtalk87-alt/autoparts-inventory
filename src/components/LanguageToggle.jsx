import { useTranslation } from 'react-i18next'
import { setLanguage } from '../lib/i18n'

export default function LanguageToggle({ className = '' }) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'

  return (
    <button
      type="button"
      onClick={() => setLanguage(isArabic ? 'en' : 'ar')}
      className={`rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 ${className}`}
    >
      {isArabic ? 'English' : 'العربية'}
    </button>
  )
}