import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Storefront() {
  const { slug } = useParams()
  const [company, setCompany] = useState(null)
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadStorefront = async () => {
      setLoading(true)
      setError('')
      setCompany(null)
      setParts([])

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo_url, contact_phone, storefront_enabled')
        .eq('storefront_slug', slug)
        .eq('storefront_enabled', true)
        .maybeSingle()

      if (companyError || !companyData) {
        setError('Store not found')
        setLoading(false)
        return
      }

      setCompany(companyData)

      const { data: partsData, error: partsError } = await supabase
        .from('parts')
        .select('id, part_name, oem_number, condition, asking_price, currency, photo_url, donor_vehicles(make, model, year)')
        .eq('company_id', companyData.id)
        .eq('status', 'in_stock')
        .order('created_at', { ascending: false })

      if (partsError) {
        setError('Unable to load parts right now.')
        setLoading(false)
        return
      }

      setParts(partsData || [])
      setLoading(false)
    }

    if (slug) {
      loadStorefront()
    } else {
      setError('Store not found')
      setLoading(false)
    }
  }, [slug])

  const filteredParts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (!query) return parts

    return parts.filter((part) => {
      const donorVehicle = part.donor_vehicles || {}
      const haystack = [
        part.part_name,
        part.oem_number,
        donorVehicle.make,
        donorVehicle.model,
        `${donorVehicle.make} ${donorVehicle.model}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [parts, searchTerm])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 p-12">
          <p className="text-lg text-slate-300">Loading storefront...</p>
        </div>
      </main>
    )
  }

  if (error || !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5V6a2 2 0 012-2h14a2 2 0 012 2v1.5M3 7.5h18M5 7.5v9A2 2 0 007 18.5h10a2 2 0 002-2v-9" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Store not found</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This storefront doesn't exist or is no longer available.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="h-16 w-16 rounded-xl border border-slate-700 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-cyan-400">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2m-10 0v10a2 2 0 002 2h8a2 2 0 002-2V8" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold text-white">{company.name}</h1>
                <p className="mt-1 text-sm text-slate-400">Browse available parts from this storefront.</p>
              </div>
            </div>

            <div className="w-full max-w-md">
              <label htmlFor="storefront-search" className="mb-2 block text-sm font-medium text-slate-300">
                Search parts
              </label>
              <input
                id="storefront-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by part, OEM, or vehicle"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </header>

        {filteredParts.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center">
            <p className="text-lg text-slate-300">No parts available right now — check back soon.</p>
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredParts.map((part) => {
              const donorVehicle = part.donor_vehicles || {}
              const vehicleText = donorVehicle.make || donorVehicle.model || donorVehicle.year
                ? `${donorVehicle.make || ''} ${donorVehicle.model || ''} (${donorVehicle.year || ''})`.replace(/\s+/g, ' ').trim()
                : ''

              const cleanPhone = (company.contact_phone || '').replace(/\D/g, '')
              const whatsappHref = cleanPhone
                ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                    `Hi, I'm interested in the ${part.part_name} (${part.currency || ''} ${part.asking_price}) listed on your storefront.`
                  )}`
                : null

              return (
                <article key={part.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20">
                  <div className="flex h-48 items-center justify-center bg-slate-800/80">
                    {part.photo_url ? (
                      <img src={part.photo_url} alt={part.part_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L13 13m-1-1l2.586-2.586a2 2 0 012.828 0L20 13m-1-1v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4" />
                        </svg>
                        <p className="mt-2 text-sm">No photo available</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-white">{part.part_name}</h2>
                        {part.oem_number && (
                          <p className="mt-1 text-sm text-slate-400">OEM: {part.oem_number}</p>
                        )}
                      </div>
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-cyan-300">
                        {part.condition}
                      </span>
                    </div>

                    {vehicleText && (
                      <p className="mt-3 text-sm text-slate-400">Vehicle: {vehicleText}</p>
                    )}

                    <div className="mt-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
                        <p className="text-lg font-semibold text-cyan-400">
                          {part.currency || 'AED'} {part.asking_price}
                        </p>
                      </div>

                      {whatsappHref ? (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                        >
                          Inquire on WhatsApp
                        </a>
                      ) : (
                        <span className="text-sm text-slate-500">Contact unavailable</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
