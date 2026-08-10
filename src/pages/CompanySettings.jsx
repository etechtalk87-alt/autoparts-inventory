import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export default function CompanySettings() {
  const { t } = useTranslation()
  const { currentStaff, loading: authLoading, refreshStaff } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [trnNumber, setTrnNumber] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [storefrontEnabled, setStorefrontEnabled] = useState(false)
  const [storefrontSlug, setStorefrontSlug] = useState('')
  const [slugError, setSlugError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (currentStaff?.role !== 'company_admin') {
      navigate('/', { replace: true })
      return
    }

    const fetchSettings = async () => {
      setLoading(true)
      setFetchError('')
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, vat_enabled, trn_number, contact_phone, contact_email, logo_url, storefront_enabled, storefront_slug')
        .eq('id', currentStaff.company_id)
        .single()

      if (error) {
        setFetchError(t('settings.errors.loadFailed'))
        setLoading(false)
        return
      }

      setVatEnabled(data.vat_enabled ?? false)
      setTrnNumber(data.trn_number ?? '')
      setContactPhone(data.contact_phone ?? '')
      setContactEmail(data.contact_email ?? '')
      setLogoUrl(data.logo_url ?? '')
      setStorefrontEnabled(data.storefront_enabled ?? false)
      setStorefrontSlug(data.storefront_slug ?? '')
      setLoading(false)
    }

    fetchSettings()
  }, [authLoading, currentStaff?.company_id, currentStaff?.role, t])

  const uploadLogo = async () => {
    const fileExt = logoFile.name.split('.').pop()
    const filePath = `${currentStaff.company_id}/logo.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(filePath, logoFile, { upsert: true })
    if (uploadError) throw new Error(uploadError.message)
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(filePath)
    return urlData.publicUrl
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    if (storefrontEnabled && !storefrontSlug.trim()) {
      setSlugError(t('settings.errors.urlRequired'))
      setSaving(false)
      return
    }

    let finalLogoUrl = logoUrl
    if (logoFile) {
      try {
        setUploadingLogo(true)
        finalLogoUrl = await uploadLogo()
      } catch (err) {
        setSaveError(t('settings.errors.logoUploadFailed', { error: err.message }))
        setSaving(false)
        setUploadingLogo(false)
        return
      }
      setUploadingLogo(false)
    }

    const { data, error } = await supabase
      .from('companies')
      .update({
        vat_enabled: vatEnabled,
        trn_number: trnNumber.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        logo_url: finalLogoUrl || null,
        storefront_enabled: storefrontEnabled,
        storefront_slug: storefrontEnabled ? storefrontSlug.trim() : null,
      })
      .eq('id', currentStaff.company_id)
      .select('id')

    if (error) {
      if (error.code === '23505' || /unique/i.test(error.message || '')) {
        setSlugError(t('settings.errors.urlTaken'))
        setSaveError('')
        setSaveSuccess('')
        setSaving(false)
        return
      }
      setSaveError(t('settings.errors.saveFailed', { error: error.message }))
      setSaving(false)
      return
    }

    if (!data || data.length === 0) {
      setSaveError(t('settings.errors.permissionDenied'))
      setSaving(false)
      return
    }

    setLogoUrl(finalLogoUrl)
    setLogoFile(null)
    setLogoPreview(null)
    await refreshStaff()
    setSaveSuccess(t('settings.success.saved'))
    setSaving(false)
  }

  const showTrnWarning = vatEnabled && !trnNumber.trim()

  if (authLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">{t('settings.loading')}</p>
      </main>
    )
  }

  return (
    <main className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('settings.subtitle')}
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg bg-rose-900/40 px-4 py-3 text-sm text-rose-300">
          {fetchError}
        </div>
      )}

      <div className="space-y-6">
        {/* Company Logo card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-1 text-base font-semibold text-white">{t('settings.logo.title')}</h2>
          <p className="mb-5 text-xs text-slate-500">
            {t('settings.logo.description')}
          </p>
          <div className="flex items-center gap-4">
            {(logoPreview || logoUrl) && (
              <img
                src={logoPreview || logoUrl}
                alt={t('settings.logo.alt')}
                className="h-16 w-16 rounded-lg border border-slate-700 object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setLogoFile(file)
                  setLogoPreview(URL.createObjectURL(file))
                }
              }}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-slate-950 file:font-semibold"
            />
          </div>
        </div>

        {/* Invoice Settings card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-5 text-base font-semibold text-white">{t('settings.invoice.title')}</h2>
          <div className="space-y-6">
            {/* VAT toggle */}
            <label className="flex cursor-pointer items-center gap-4">
              <input
                type="checkbox"
                id="vat-enabled"
                checked={vatEnabled}
                onChange={(e) => {
                  setVatEnabled(e.target.checked)
                  setSaveError('')
                  setSaveSuccess('')
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">
                  {t('settings.invoice.vatLabel')}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t('settings.invoice.vatDesc')}
                </p>
              </div>
            </label>

            {/* TRN input — only shown when VAT is on */}
            {vatEnabled && (
              <div>
                <label
                  htmlFor="trn-number"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  {t('settings.invoice.trnLabel')}
                </label>
                <input
                  type="text"
                  id="trn-number"
                  dir="ltr"
                  value={trnNumber}
                  onChange={(e) => {
                    setTrnNumber(e.target.value)
                    setSaveError('')
                    setSaveSuccess('')
                  }}
                  placeholder={t('settings.invoice.trnPlaceholder')}
                  className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
                {/* Soft warning — no hard block */}
                {showTrnWarning && (
                  <p className="mt-2 rounded-lg bg-amber-900/30 px-3 py-2 text-xs text-amber-300">
                    {t('settings.invoice.trnWarning')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contact Information card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-1 text-base font-semibold text-white">{t('settings.contact.title')}</h2>
          <p className="mb-5 text-xs text-slate-500">
            {t('settings.contact.description')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-phone" className="mb-1.5 block text-xs font-medium text-slate-400">
                {t('settings.contact.phoneLabel')}
              </label>
              <input
                type="tel"
                id="contact-phone"
                dir="ltr"
                value={contactPhone}
                onChange={(e) => {
                  setContactPhone(e.target.value)
                  setSaveError('')
                  setSaveSuccess('')
                }}
                placeholder={t('settings.contact.phonePlaceholder')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                {t('settings.contact.phoneHint')}
              </p>
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1.5 block text-xs font-medium text-slate-400">
                {t('settings.contact.emailLabel')}
              </label>
              <input
                type="email"
                id="contact-email"
                dir="ltr"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value)
                  setSaveError('')
                  setSaveSuccess('')
                }}
                placeholder={t('settings.contact.emailPlaceholder')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-1 text-base font-semibold text-white">{t('settings.storefront.title')}</h2>
          <p className="mb-5 text-xs text-slate-500">
            {t('settings.storefront.description')}
          </p>
          <label className="flex cursor-pointer items-center gap-4">
            <input
              type="checkbox"
              checked={storefrontEnabled}
              onChange={(e) => {
                setStorefrontEnabled(e.target.checked)
                setSaveError('')
                setSaveSuccess('')
              }}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-200">{t('settings.storefront.enableLabel')}</span>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('settings.storefront.enableDesc')}
              </p>
            </div>
          </label>
          {storefrontEnabled && (
            <div className="mt-4">
              <label htmlFor="storefront-slug" className="mb-1.5 block text-xs font-medium text-slate-400">
                {t('settings.storefront.urlLabel')}
              </label>
              <div className="flex items-center gap-2" dir="ltr">
                <span className="text-sm text-slate-500">yourapp.com/store/</span>
                <input
                  type="text"
                  id="storefront-slug"
                  dir="ltr"
                  value={storefrontSlug}
                  onChange={(e) => {
                    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                    setStorefrontSlug(cleaned)
                    setSlugError('')
                    setSaveError('')
                    setSaveSuccess('')
                  }}
                  placeholder={t('settings.storefront.urlPlaceholder')}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
              {slugError && <p className="mt-2 text-xs text-rose-400">{slugError}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Feedback messages */}
      {saveError && (
        <div className="mt-5 rounded-lg bg-rose-900/40 px-4 py-3 text-sm text-rose-300">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mt-5 rounded-lg bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          {saveSuccess}
        </div>
      )}

      {/* Save button */}
      <div className="mt-6 flex">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploadingLogo}
          className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('settings.saving') : uploadingLogo ? t('settings.uploadingLogo') : t('settings.save')}
        </button>
      </div>
    </main>
  )
}