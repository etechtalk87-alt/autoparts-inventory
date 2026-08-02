import { Link } from 'react-router-dom'
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

function LandingPage() {
  const features = [
    {
      icon: Building2,
      title: 'Multi-Branch Management',
      description:
        'Switch between branches effortlessly, assign staff by location, and keep every outlet aligned with one shared system.',
    },
    {
      icon: FileText,
      title: 'Smart Invoicing',
      description:
        'Create VAT-compliant invoices, handle multi-item sales, and generate polished PDFs without leaving the workflow.',
    },
    {
      icon: CarFront,
      title: 'Donor Vehicle Teardown',
      description:
        'Log donor vehicles, follow teardown checklists, and build inventory in bulk with a structured process.',
    },
    {
      icon: HandCoins,
      title: 'Outstanding Payables & Receivables',
      description:
        'Track vendor obligations and customer balances so cash flow stays clear and predictable.',
    },
    {
      icon: Users,
      title: 'Staff Management',
      description:
        'Invite team members with secure email access and control permissions around the areas they need.',
    },
    {
      icon: BarChart3,
      title: 'Real-Time Dashboard',
      description:
        'Watch sales trends, inventory alerts, and branch performance from one live view that supports quick decisions.',
    },
  ]

  const steps = [
    {
      title: 'Add your branches and invite staff',
      description:
        'Set up each location, assign your team, and make sure everyone has the access they need from day one.',
    },
    {
      title: 'Log donor vehicles and build your inventory',
      description:
        'Capture teardown details, create parts quickly, and grow your catalog with a consistent process.',
    },
    {
      title: 'Sell, invoice, and track everything in one place',
      description:
        'Turn inventory into completed sales, issue invoices, and keep payments and balances under control.',
    },
  ]

  const pricingTiers = [
    {
      name: 'Starter',
      price: 'AED 299',
      period: '/month',
      description: 'For single-branch shops getting organized.',
      features: ['1 branch', 'Up to 3 staff accounts', 'Unlimited parts & invoices', 'Email support'],
      highlighted: false,
    },
    {
      name: 'Professional',
      price: 'AED 599',
      period: '/month',
      description: 'For growing operations with multiple branches.',
      features: ['Up to 5 branches', 'Unlimited staff accounts', 'VAT-compliant invoicing', 'Outstanding payables tracking', 'Priority support'],
      highlighted: true,
    },
    {
      name: 'Business',
      price: 'Custom',
      period: '',
      description: 'For established dealers with custom needs.',
      features: ['Unlimited branches', 'Unlimited staff accounts', 'Dedicated onboarding', 'Custom integrations', 'Phone & WhatsApp support'],
      highlighted: false,
    },
  ]

  const testimonials = [
    {
      quote: 'The whole process feels faster now — from teardown to invoicing, everything stays in one place.',
      name: 'Mansour Al Qaydi',
      role: 'Owner, Al Qaydi Auto Parts',
    },
    {
      quote: 'We finally have one source of truth for branches, staff, and payments without jumping between tools.',
      name: 'Rita Haddad',
      role: 'Operations Lead, Gulf Salvage',
    },
    {
      quote: 'The invoicing flow alone saved us hours every week and made our reporting much cleaner.',
      name: 'Khaled Nasser',
      role: 'Finance Manager, Nasser Trading',
    },
  ]

  const faqs = [
    {
      question: 'Is this built for multi-branch dealers?',
      answer: 'Yes. The platform is designed for teams that need branch-aware inventory, shared staff access, and clear reporting across locations.',
    },
    {
      question: 'Can I start with one branch and grow later?',
      answer: 'Absolutely. You can begin with a single branch and upgrade as your team and inventory expand.',
    },
    {
      question: 'Does it support VAT-compliant invoices?',
      answer: 'Yes. The invoicing flow supports VAT-ready documentation, multi-item sales, and downloadable invoice records.',
    },
  ]

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <section className="mx-auto flex max-w-7xl flex-col px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="rounded-[32px] border border-slate-800/80 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-12 lg:p-16">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
                <ShieldCheck size={16} />
                Built for modern used parts dealers
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Run Your Auto Parts Business Like a Pro
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-400 sm:text-xl">
                Multi-branch inventory, VAT-compliant invoicing, and staff management — built specifically for used auto parts dealers.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Get Started
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
                >
                  Login
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-400">
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">Branch-aware inventory</span>
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">Invoice-ready workflows</span>
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">Team collaboration</span>
              </div>
            </div>

            <div className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30 p-6 shadow-[0_20px_80px_-40px_rgba(34,211,238,0.55)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Operations pulse</p>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Live
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Stock alerts</span>
                    <span className="font-semibold text-cyan-300">6 pending</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div className="h-2 w-3/4 rounded-full bg-cyan-500" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Open invoices</p>
                    <p className="mt-2 text-xl font-semibold text-white">18</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Active branches</p>
                    <p className="mt-2 text-xl font-semibold text-white">4</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Daily sales trend</span>
                    <span className="font-semibold text-emerald-300">+12.4%</span>
                  </div>
                  <p className="mt-2 text-slate-400">A healthier pace across your active locations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Features</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Everything you need to run a sharper operation</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-400">
            From branch coordination to invoicing and reporting, the platform is designed to support every part of the used auto parts business.
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">From setup to daily selling in just three steps</h2>
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Trusted by modern dealers</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Operations that feel more controlled and less chaotic</h2>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="rounded-[22px] border border-slate-800 bg-slate-950/60 p-6">
                <p className="text-sm leading-7 text-slate-300">“{testimonial.quote}”</p>
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
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">See the workflow</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">A cleaner way to move from stock to sale</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                The dashboard keeps your team aligned with a simple path: log parts, manage branches, create invoices, and keep payments visible in one place.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-5 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Branch overview</p>
                  <p className="text-xs text-slate-400">Updated 2 mins ago</p>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Live
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Weekly sales</span>
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
                      <span className="font-semibold text-cyan-300">12 parts</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-4/5 rounded-full bg-cyan-500" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Sharjah West</span>
                      <span className="font-semibold text-cyan-300">8 invoices</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className="h-2 w-2/3 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Abu Dhabi</span>
                      <span className="font-semibold text-cyan-300">4 alerts</span>
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Frequently asked questions</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Questions that usually come up first</h2>
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Simple, transparent pricing</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Choose the plan that fits your business. All plans include core inventory and sales features.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-[24px] border p-6 ${tier.highlighted
                  ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_20px_80px_-40px_rgba(34,211,238,0.7)]'
                  : 'border-slate-800 bg-slate-950/60'}`}
              >
                {tier.highlighted ? (
                  <div className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Most Popular
                  </div>
                ) : null}

                <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{tier.description}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-3xl font-semibold text-white">{tier.price}</span>
                  {tier.period ? <span className="pb-1 text-sm text-slate-400">{tier.period}</span> : null}
                </div>

                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
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
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h3 className="text-lg font-semibold text-white">Ready to get started?</h3>
            <p className="mt-1 text-sm text-slate-400">Bring your branches, inventory, and team into one streamlined system with a calmer, more profitable workflow.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Get Started
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Login
            </Link>
          </div>
        </div>

        <div className="border-t border-slate-800/80 px-4 py-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <span>AutoParts Inventory</span> • <span>© 2026 AutoParts Inventory</span>
        </div>
      </footer>
    </main>
  )
}

export default LandingPage
