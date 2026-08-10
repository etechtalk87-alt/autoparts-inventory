import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CarFront,
  Check,
  FileText,
  HandCoins,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import LanguageToggle from '../components/LanguageToggle'

function LandingPage() {
  const { t } = useTranslation()
  const [pricingTiers, setPricingTiers] = useState([])
  const [loadingPricing, setLoadingPricing] = useState(true)

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('id, name, price_aed, description, features, highlighted, sort_order')
          .order('sort_order')
        if (error) {
          console.error('Error fetching pricing plans:', error)
          setPricingTiers([])
        } else {
          setPricingTiers(data || [])
        }
      } finally {
        setLoadingPricing(false)
      }
    }
    fetchPlans()
  }, [])

  const features = [
    { icon: Building2, title: t('landing.features.multiBranch.title'), description: t('landing.features.multiBranch.description') },
    { icon: FileText, title: t('landing.features.smartInvoicing.title'), description: t('landing.features.smartInvoicing.description') },
    { icon: CarFront, title: t('landing.features.donorTeardown.title'), description: t('landing.features.donorTeardown.description') },
    { icon: HandCoins, title: t('landing.features.payablesReceivables.title'), description: t('landing.features.payablesReceivables.description') },
    { icon: Users, title: t('landing.features.staffManagement.title'), description: t('landing.features.staffManagement.description') },
    { icon: BarChart3, title: t('landing.features.realTimeDashboard.title'), description: t('landing.features.realTimeDashboard.description') },
  ]

  const steps = [
    { title: t('landing.steps.step1.title'), description: t('landing.steps.step1.description') },
    { title: t('landing.steps.step2.title'), description: t('landing.steps.step2.description') },
    { title: t('landing.steps.step3.title'), description: t('landing.steps.step3.description') },
  ]

  const testimonials = [
    { quote: t('landing.testimonials.testimonial1.quote'), name: 'Mansour Al Qaydi', role: 'Owner, Al Qaydi Auto Parts' },
    { quote: t('landing.testimonials.testimonial2.quote'), name: 'Rita Haddad', role: 'Operations Lead, Gulf Salvage' },
    { quote: t('landing.testimonials.testimonial3.quote'), name: 'Khaled Nasser', role: 'Finance Manager, Nasser Trading' },
  ]

  const faqs = [
    { question: t('landing.faqs.faq1.question'), answer: t('landing.faqs.faq1.answer') },
    { question: t('landing.faqs.faq2.question'), answer: t('landing.faqs.faq2.answer') },
    { question: t('landing.faqs.faq3.question'), answer: t('landing.faqs.faq3.answer') },
  ]

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto flex max-w-7xl justify-end px-4 pt-6 sm:px-6 lg:px-8">
        <LanguageToggle />
      </div>

      <section className="mx-auto flex max-w-7xl flex-col px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="rounded-[32px] border border-slate-800/80 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-12 lg:p-16">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
                <ShieldCheck size={16} />
                {t('landing.badge')}
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {t('landing.heroTitle')}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-400 sm:text-xl">
                {t('landing.heroSubtitle')}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  {t('landing.getStarted')}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
                >
                  {t('landing.login')}
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-400">
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">{t('landing.chipBranchAware')}</span>
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">{t('landing.chipInvoiceReady')}</span>
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">{t('landing.chipTeamCollab')}</span>
              </div>
            </div>
            <div className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30 p-6 shadow-[0_20px_80px_-40px_rgba(34,211,238,0.55)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.operationsPulse')}</p>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  {t('landing.live')}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{t('landing.stockAlerts')}</span>
                    <span className="font-semibold text-cyan-300">{t('landing.pending', { count: 6 })}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div className="h-2 w-3/4 rounded-full bg-cyan-500" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('landing.openInvoices')}</p>
                    <p className="mt-2 text-xl font-semibold text-white">18</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('landing.activeBranches')}</p>
                    <p className="mt-2 text-xl font-semibold text-white">4</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>{t('landing.dailySalesTrend')}</span>
                    <span className="font-semibold text-emerald-300">+12.4%</span>
                  </div>
                  <p className="mt-2 text-slate-400">{t('landing.dailySalesTrendDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.featuresLabel')}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{t('landing.featuresTitle')}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-400">
            {t('landing.featuresSubtitle')}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article
                key={feature.title}
                className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{feature.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.howItWorksLabel')}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{t('landing.howItWorksTitle')}</h2>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-[22px] border border-slate-800 bg-slate-950/60 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-semibold text-cyan-300">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.testimonialsLabel')}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{t('landing.testimonialsTitle')}</h2>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="rounded-[22px] border border-slate-800 bg-slate-950/60 p-6">
                <p className="text-sm leading-7 text-slate-300">"{testimonial.quote}"</p>
                <div className="mt-5">
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-slate-400">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950/90 p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.workflowLabel')}</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">{t('landing.workflowTitle')}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {t('landing.workflowDesc')}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-5 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{t('landing.branchOverview')}</p>
                  <p className="text-xs text-slate-400">{t('landing.updatedMinsAgo', { count: 2 })}</p>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  {t('landing.live')}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{t('landing.weeklySales')}</span>
                    <span className="font-semibold text-cyan-300">+18%</span>
                  </div>
                  <div className="mt-4 flex h-20 items-end gap-2">
                    {[28, 40, 36, 52, 62, 58].map((height, index) => (
                      <div
                        key={index}
                        className={`w-full rounded-t-full ${index === 4 ? 'bg-cyan-500' : index === 5 ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Dubai Marina</span>
                      <span className="font-semibold text-cyan-300">{t('landing.partsCount', { count: 12 })}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-4/5 rounded-full bg-cyan-500" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Sharjah West</span>
                      <span className="font-semibold text-cyan-300">{t('landing.invoicesCount', { count: 8 })}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-2/3 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Abu Dhabi</span>
                      <span className="font-semibold text-cyan-300">{t('landing.alertsCount', { count: 4 })}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-1/2 rounded-full bg-amber-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.faqLabel')}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{t('landing.faqTitle')}</h2>
          </div>
          <div className="mt-8 grid gap-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-[22px] border border-slate-800 bg-slate-950/60 p-5">
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.pricingLabel')}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{t('landing.pricingTitle')}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              {t('landing.pricingSubtitle')}
            </p>
          </div>
          <div className="mt-8">
            {loadingPricing ? (
              <p className="text-sm text-slate-400">{t('landing.loadingPlans')}</p>
            ) : pricingTiers.length === 0 ? (
              <p className="text-sm text-slate-400">{t('landing.pricingComingSoon')}</p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                {pricingTiers.map((tier) => {
                  const priceValue = tier.price_aed == null || tier.price_aed === ''
                    ? t('landing.custom')
                    : `AED ${Number(tier.price_aed).toLocaleString('en-AE')}`
                  const hasPrice = tier.price_aed != null && tier.price_aed !== ''
                  return (
                    <div
                      key={tier.id || tier.name}
                      className={`rounded-[24px] border p-6 ${tier.highlighted
                        ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_20px_80px_-40px_rgba(34,211,238,0.7)]'
                        : 'border-slate-800 bg-slate-950/60'}`}
                    >
                      {tier.highlighted ? (
                        <div className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                          {t('landing.mostPopular')}
                        </div>
                      ) : null}
                      <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{tier.description}</p>
                      <div className="mt-6 flex items-end gap-1">
                        <span className="text-3xl font-semibold text-white">{priceValue}</span>
                        {hasPrice ? <span className="pb-1 text-sm text-slate-400">{t('landing.perMonth')}</span> : null}
                      </div>
                      <ul className="mt-6 space-y-3 text-sm text-slate-300">
                        {(Array.isArray(tier.features) ? tier.features : []).map((feature, index) => (
                          <li key={`${tier.id || tier.name}-${index}`} className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
                              <Check size={14} />
                            </span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/signup"
                        className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${tier.highlighted
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                          : 'border border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800'}`}
                      >
                        {t('landing.getStarted')}
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('landing.ctaTitle')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('landing.ctaSubtitle')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              {t('landing.getStarted')}
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              {t('landing.login')}
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-800/80 px-4 py-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <span>AutoParts Inventory</span> • <span>{t('landing.footerCopyright')}</span>
        </div>
      </footer>
    </main>
  )
}

export default LandingPage