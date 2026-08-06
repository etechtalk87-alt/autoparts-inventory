import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '../locales/en.json'
import ar from '../locales/ar.json'

const savedLanguage = localStorage.getItem('language') || 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export function setLanguage(lang) {
  i18n.changeLanguage(lang)
  localStorage.setItem('language', lang)
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

// Apply saved language's direction on initial load
document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr'
document.documentElement.lang = savedLanguage

export default i18n