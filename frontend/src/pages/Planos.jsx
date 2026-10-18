import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../config/brand'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { smartTokenRechargePackagesForMarket } from '../data/creditCosts'
import BrandMark from '../components/brand/BrandMark'
import { useAnalytics } from '../components/analytics/AnalyticsProvider'
import { useLocale } from '../i18n/useLocale'

const PLANOS_BR = [
  {
    id: 'start',
    nome: 'START',
    preco: '127',
    description: 'Ideal para começar a criar materiais profissionais.',
    capacityDetail: '6.350 Smart Tokens por mês',
    capacity: { videos: 19, banners: 84 },
    featured: false,
    cta: 'Assinar Start',
  },
  {
    id: 'pro',
    nome: 'PRO',
    preco: '217',
    description: 'Para quem cria campanhas com frequência.',
    capacityDetail: '10.850 Smart Tokens por mês',
    capacity: { videos: 33, banners: 144 },
    featured: true,
    badge: 'Mais recomendado',
    cta: 'Assinar Pro',
  },
  {
    id: 'elite',
    nome: 'ELITE',
    preco: '547',
    description: 'Para profissionais e equipes com maior volume.',
    capacityDetail: '26.350 Smart Tokens por mês',
    capacity: { videos: 81, banners: 351 },
    featured: false,
    cta: 'Assinar Elite',
  },
]

const PLANOS_US = [
  { id: 'usd_start', nome: 'START', preco: '24.90', description: 'Ideal for getting started with professional content.', capacityDetail: '6,350 Smart Tokens per month', capacity: { videos: 19, banners: 84 }, featured: false, cta: 'Subscribe to Start' },
  { id: 'usd_pro', nome: 'PRO', preco: '39.90', description: 'For professionals who create campaigns regularly.', capacityDetail: '10,850 Smart Tokens per month', capacity: { videos: 33, banners: 144 }, featured: true, badge: 'Most recommended', cta: 'Subscribe to Pro' },
  { id: 'usd_elite', nome: 'ELITE', preco: '99.90', description: 'For professionals and teams with a higher volume of work.', capacityDetail: '26,350 Smart Tokens per month', capacity: { videos: 81, banners: 351 }, featured: false, cta: 'Subscribe to Elite' },
]

const RULES = [
  'Todos os planos dão acesso à plataforma completa.',
  'Smart Tokens representam sua capacidade de criação.',
  'Smart Tokens de recargas têm validade de 30 dias.',
  'Cancelamento pode ser feito pela conta.',
]

const RULES_US = [
  'Every plan includes full platform access.',
  'Smart Tokens represent your creation capacity.',
  'Top-up Smart Tokens are valid for 30 days.',
  'Cancel anytime from your account.',
]

const formatTokens = (value, locale) => new Intl.NumberFormat(locale).format(value)

export default function Planos() {
  const { user, isAuthenticated, loading, reloadProfile } = useAuth()
  const { locale, market } = useLocale()
  const isUS = market === 'US'
  const planos = isUS ? PLANOS_US : PLANOS_BR
  const rechargePackages = smartTokenRechargePackagesForMarket(market)
  const copy = isUS ? {
    back: 'Back', heading: 'Choose your plan', hero: 'All plans include full platform access. Choose the creation capacity that fits your business.', monthly: 'Monthly',
    capacity: 'Approximate monthly capacity:', videos: 'Real Estate Videos', or: 'OR', banners: 'Real Estate Banners', mix: 'Mix products however you want.', examples: 'Examples only — use your Smart Tokens across SNETIA.', currentPlan: 'Current plan',
    pageEyebrow: 'Plans / Smart Tokens', perMonth: '/month', launchOffer: 'Launch offer', couponPrefix: 'Use the code', couponSuffix: 'at checkout and get 15% off your first 3 months.', validFor: 'Valid for 30 days',
    rechargeTitle: 'Need more capacity?', rechargeDescription: 'Add Smart Tokens anytime without changing your plan.', addTokens: 'Add Smart Tokens', faqRules: 'FAQ / Rules', contact: 'Questions?', wait: 'Please wait…', checkoutError: 'We could not start checkout. Please try again.',
  } : {
    back: 'Voltar', heading: 'Escolha seu plano', hero: 'Todos os planos incluem acesso completo à plataforma. Escolha a capacidade de criação ideal para o seu negócio.', monthly: 'Mensal',
    capacity: 'Capacidade mensal aproximada:', videos: 'Vídeos Imobiliários', or: 'OU', banners: 'Banners Imobiliários', mix: 'Combine os produtos como quiser.', examples: 'Apenas exemplos — use seus Smart Tokens em toda a SNETIA.', currentPlan: 'Plano atual',
    pageEyebrow: 'Planos / Smart Tokens', perMonth: '/mês', launchOffer: 'Oferta de lançamento', couponPrefix: 'Use o código', couponSuffix: 'no checkout e ganhe 15% de desconto nos 3 primeiros meses.', validFor: 'Validade: 30 dias',
    rechargeTitle: 'Precisa de mais capacidade?', rechargeDescription: 'Adicione Smart Tokens quando quiser sem mudar seu plano.', addTokens: 'Adicionar Smart Tokens', faqRules: 'FAQ / Regras', contact: 'Dúvidas?', wait: 'Aguarde...', checkoutError: 'Não foi possível iniciar o checkout. Tente novamente.',
  }
  const [searchParams] = useSearchParams()
  const [loadingItem, setLoadingItem] = useState(null)
  const checkoutRefreshHandledRef = useRef(false)
  const plansViewTrackedRef = useRef(false)
  const { trackEvent } = useAnalytics()

  useEffect(() => {
    if (!isAuthenticated || loading || searchParams.get('checkout') !== 'success' || checkoutRefreshHandledRef.current) return
    checkoutRefreshHandledRef.current = true
    void reloadProfile()
  }, [isAuthenticated, loading, reloadProfile, searchParams])

  useEffect(() => {
    if (plansViewTrackedRef.current) return
    plansViewTrackedRef.current = trackEvent('view_plans')
  }, [trackEvent])

  const iniciarCheckout = async (itemId) => {
    if (!isAuthenticated) return
    setLoadingItem(itemId)
    try {
      const economicKey = itemId.startsWith('recarga_')
        ? itemId.slice('recarga_'.length)
        : itemId
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { economicKey },
      })
      if (error || !data?.url) throw new Error('checkout_unavailable')
      const checkoutUrl = new URL(data.url)
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
        throw new Error('invalid_checkout_url')
      }
      trackEvent('checkout_started')
      window.location.assign(checkoutUrl.toString())
    } catch {
      toast.error(copy.checkoutError)
      setLoadingItem(null)
    }
  }

  const renderAction = (item, featured = false, recharge = false) => {
    const atual = !recharge && user?.plano === item.id.replace('usd_', '')
    const label = loadingItem === item.id
      ? copy.wait
      : atual
        ? copy.currentPlan
        : recharge
          ? copy.addTokens
          : item.cta

    const className = `inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-black transition ${
      featured
        ? 'bg-primary-800 text-white hover:bg-primary-700'
        : recharge
          ? 'bg-primary-600 text-white hover:bg-primary-500'
          : 'border border-blue-100 bg-white text-primary-800 hover:bg-primary-50'
    } disabled:cursor-not-allowed disabled:opacity-50`

    if (!isAuthenticated) {
      return (
        <Link to="/cadastro" className={className}>
          {recharge ? copy.addTokens : item.cta}
        </Link>
      )
    }

    return (
      <button
        type="button"
        disabled={atual || loadingItem === item.id}
        onClick={() => iniciarCheckout(item.id)}
        className={className}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            to={isAuthenticated ? '/dashboard' : '/'}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </Link>
          <div className="flex items-center gap-2">
            <BrandMark size={32} decorative />
            <span className="font-black text-gray-950">{BRAND.name}</span>
          </div>
        </div>

        <section className="rounded-3xl border border-primary-100 bg-white p-7 text-center shadow-sm sm:p-10">
          <div className="mx-auto max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-700">
              {copy.pageEyebrow}
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-gray-950 sm:text-5xl">
              {copy.heading}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
              {copy.hero}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 rounded-2xl bg-primary-50 px-4 py-3 text-left sm:flex-row sm:items-center sm:gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-primary-700">{copy.launchOffer}</p>
            <p className="text-sm font-semibold text-gray-700">
              {copy.couponPrefix}{' '}
              <span className="rounded-md bg-white px-2 py-1 font-black tracking-[0.12em] text-primary-900">SMART15</span>{' '}
              {copy.couponSuffix}
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {planos.map((plano) => {
            const atual = user?.plano === plano.id.replace('usd_', '')
            return (
              <article
                key={plano.id}
                className={`relative flex rounded-3xl border bg-white p-6 shadow-sm ${
                  plano.featured ? 'border-primary-700 shadow-xl shadow-primary-900/10 ring-2 ring-primary-700' : 'border-gray-200'
                }`}
              >
                {plano.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-100 px-4 py-1 text-xs font-black uppercase text-primary-900 shadow-sm">
                    {plano.badge}
                  </div>
                )}
                {atual && (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {copy.currentPlan}
                  </div>
                )}

                <div className="flex w-full flex-col">
                  <div>
                    <h2 className="text-3xl font-black text-gray-950">{plano.nome}</h2>
                    <p className="mt-2 min-h-11 text-sm font-semibold leading-relaxed text-gray-600">{plano.description}</p>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="mb-1 text-sm font-bold text-gray-400">{isUS ? '$' : 'R$'}</span>
                      <span className="text-5xl font-black text-gray-950">{plano.preco}</span>
                      <span className="mb-2 text-sm font-semibold text-gray-500">{copy.perMonth}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex-1 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-black text-gray-950">{plano.capacityDetail}</p>
                    <p className="mt-4 text-xs font-black uppercase tracking-wide text-gray-500">{copy.capacity}</p>
                    <ul className="mt-3 space-y-2 text-sm font-semibold text-gray-600">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" />~{plano.capacity.videos} {copy.videos}</li>
                      <li aria-hidden="true" className="flex items-center gap-2 py-0.5"><span className="h-px flex-1 bg-gray-200" /><span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-black tracking-[0.14em] text-gray-500">{copy.or}</span><span className="h-px flex-1 bg-gray-200" /></li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" />~{plano.capacity.banners} {copy.banners}</li>
                    </ul>
                    <p className="mt-4 text-xs font-bold text-gray-600">{copy.mix}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{copy.examples}</p>
                  </div>

                  <div className="mt-6">
                    {renderAction(plano, plano.featured)}
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
          <h2 className="text-2xl font-black text-gray-950">{copy.rechargeTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{copy.rechargeDescription}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {rechargePackages.map((item) => (
              <article key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-lg font-black text-gray-950">{formatTokens(item.credits, locale)} Smart Tokens</p>
                <p className="mt-1 text-sm font-bold text-gray-700">{isUS ? '$' : 'R$'} {item.priceLabel}</p>
                <p className="mt-2 text-xs font-semibold text-gray-500">{copy.validFor}</p>
                <div className="mt-5">{renderAction({ id: `recarga_${item.id}`, cta: copy.addTokens }, false, true)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">{copy.faqRules}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {(isUS ? RULES_US : RULES).map((rule) => (
              <li key={rule} className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-sm font-semibold leading-relaxed text-gray-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 pb-4 text-center text-sm font-semibold text-gray-600">
          {copy.contact}{' '}<a href={`mailto:${BRAND.supportEmail}`} className="font-black text-primary-800 hover:text-primary-600">{BRAND.supportEmail}</a>
        </section>
      </main>
    </div>
  )
}
