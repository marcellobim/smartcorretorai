import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../config/brand'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Coins, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { smartTokenRechargePackagesForMarket } from '../data/creditCosts'
import BrandMark from '../components/brand/BrandMark'
import { useAnalytics } from '../components/analytics/AnalyticsProvider'
import { useLocale } from '../i18n/useLocale'
import { getMarketConfig } from '../i18n/locale-config'

const PLANOS_BR = [
  {
    id: 'start',
    nome: 'START',
    preco: '127',
    description: 'Acesso completo à plataforma.',
    capacityLabel: 'Capacidade inicial de criação',
    capacityDetail: '6.350 Smart Tokens por mês',
    featured: false,
    cta: 'Assinar Start',
    bullets: [
      'Acesso completo à plataforma',
      'Ideal para começar a criar materiais profissionais',
      'Capacidade inicial de criação',
    ],
  },
  {
    id: 'pro',
    nome: 'PRO',
    preco: '217',
    description: 'Mais recomendado.',
    capacityLabel: 'Mais liberdade para criar com frequência',
    capacityDetail: '10.850 Smart Tokens por mês',
    featured: true,
    badge: 'Mais recomendado',
    cta: 'Assinar Pro',
    bullets: [
      'Acesso completo à plataforma',
      'Mais liberdade para campanhas recorrentes',
      'Ideal para corretores ativos',
    ],
  },
  {
    id: 'elite',
    nome: 'ELITE',
    preco: '547',
    description: 'Maior capacidade para profissionais e equipes.',
    capacityLabel: 'Volume ampliado de criação',
    capacityDetail: '26.350 Smart Tokens por mês',
    featured: false,
    cta: 'Assinar Elite',
    bullets: [
      'Acesso completo à plataforma',
      'Maior capacidade para profissionais e equipes',
      'Mais fôlego para campanhas, imagens e vídeos',
    ],
  },
]

const PLANOS_US = [
  { id: 'usd_start', nome: 'START', preco: '24.90', description: 'Full platform access.', capacityLabel: 'Starting creation capacity', capacityDetail: '6,350 Smart Tokens per month', featured: false, cta: 'Subscribe to Start', bullets: ['Full platform access', 'Ideal for getting started with professional content', 'Starting creation capacity'] },
  { id: 'usd_pro', nome: 'PRO', preco: '39.90', description: 'Most recommended.', capacityLabel: 'More freedom to create regularly', capacityDetail: '10,850 Smart Tokens per month', featured: true, badge: 'Most recommended', cta: 'Subscribe to Pro', bullets: ['Full platform access', 'More freedom for recurring campaigns', 'Ideal for active real estate professionals'] },
  { id: 'usd_elite', nome: 'ELITE', preco: '99.90', description: 'More capacity for professionals and teams.', capacityLabel: 'Expanded creation volume', capacityDetail: '26,350 Smart Tokens per month', featured: false, cta: 'Subscribe to Elite', bullets: ['Full platform access', 'More capacity for professionals and teams', 'More room for campaigns, images and videos'] },
]

const RULES = [
  'Todos os planos dão acesso à plataforma completa.',
  'Smart Tokens representam sua capacidade de criação.',
  'Antes de cada criação, o sistema verifica seu saldo disponível.',
  'Use Smart Tokens extras para começar a criar sem assinatura ou complementar seu plano.',
  'Smart Tokens de recargas têm validade de 30 dias.',
  'Cancelamento pode ser feito pela conta.',
]

const formatTokens = (value) => new Intl.NumberFormat('pt-BR').format(value)

export default function Planos() {
  const { user, isAuthenticated, loading, reloadProfile } = useAuth()
  const { locale, market, setLocale, setMarket } = useLocale()
  const isUS = market === 'US'
  const planos = isUS ? PLANOS_US : PLANOS_BR
  const rechargePackages = smartTokenRechargePackagesForMarket(market)
  const copy = isUS ? {
    back: 'Back', heading: 'Choose your plan', hero: 'Every plan includes full platform access. Choose the creation capacity that fits your pace.', monthly: 'Monthly',
    rechargeEyebrow: 'Add Smart Tokens', rechargeTitle: 'Keep creating', rechargeDescription: 'Use recharges when you need more capacity before your plan renews.',
    chooseRecharge: 'Choose your recharge', rechargeIntro: 'Start without a subscription or add capacity whenever you need it.', extra: 'Extra capacity', extraTitle: 'Extra Smart Tokens',
    included: 'Every plan includes full platform access. The only difference is the creation capacity available in each cycle.', capacity: 'Cycle capacity', details: 'View capacity details', currentPlan: 'Current plan',
  } : {
    back: 'Voltar', heading: 'Escolha seu plano', hero: 'Todos os planos dão acesso à plataforma completa. Escolha a capacidade ideal para o seu ritmo de criação.', monthly: 'Mensal',
    rechargeEyebrow: 'Adicionar Smart Tokens', rechargeTitle: 'Continue ou comece a criar', rechargeDescription: 'Use recargas para continuar criando quando precisar de mais capacidade antes da renovação do plano.',
    chooseRecharge: 'Escolha sua recarga', rechargeIntro: 'Comece sem assinatura ou complemente seu plano sempre que precisar de mais capacidade para criar.', extra: 'Capacidade extra', extraTitle: 'Smart Tokens extras',
    included: 'Todos os planos incluem acesso completo à plataforma. A diferença está apenas na capacidade de criação disponível em cada ciclo.', capacity: 'Capacidade do ciclo', details: 'Ver detalhes da capacidade', currentPlan: 'Seu plano',
  }
  const [searchParams] = useSearchParams()
  const [loadingItem, setLoadingItem] = useState(null)
  const [selectedRechargeKey, setSelectedRechargeKey] = useState(rechargePackages[0].id)
  const checkoutRefreshHandledRef = useRef(false)
  const plansViewTrackedRef = useRef(false)
  const { trackEvent } = useAnalytics()
  const selectedRecharge = rechargePackages.find(item => item.id === selectedRechargeKey) ?? rechargePackages[0]

  const selectMarket = (nextMarket) => {
    const next = getMarketConfig(nextMarket)
    setMarket(nextMarket)
    setLocale(next.locale)
  }

  useEffect(() => {
    setSelectedRechargeKey(rechargePackages[0].id)
  }, [market, rechargePackages])

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
      toast.error('Não foi possível iniciar o checkout. Tente novamente.')
      setLoadingItem(null)
    }
  }

  const renderAction = (item, featured = false, recharge = false) => {
    const atual = user?.plano === item.id
    const label = loadingItem === item.id
      ? 'Aguarde...'
      : atual
        ? 'Plano atual'
        : recharge
          ? 'Adicionar Smart Tokens'
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
          {recharge ? 'Adicionar Smart Tokens' : item.cta}
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

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-7 text-white shadow-xl shadow-primary-900/10 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center rounded-full border border-cyan-100/20 bg-cyan-100/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-50">
              Planos / Smart Tokens
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              {copy.heading}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
              {copy.hero}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              {copy.included}
            </p>
            <div className="lg:min-w-[180px]">
              <div className="rounded-2xl border border-primary-100 bg-primary-50 p-2" aria-label="Market and language">
                <p className="px-2 pb-1 text-xs font-black uppercase tracking-wide text-primary-800">Market and language</p>
                <div className="grid grid-cols-2 gap-1" role="group" aria-label="Choose market and language">
                  <button
                    type="button"
                    aria-pressed={market === 'BR'}
                    onClick={() => selectMarket('BR')}
                    className={`rounded-xl px-3 py-2 text-sm font-black transition ${market === 'BR' ? 'bg-primary-800 text-white' : 'bg-white text-primary-800 hover:bg-primary-100'}`}
                  >
                    Brasil / BR
                  </button>
                  <button
                    type="button"
                    aria-pressed={market === 'US'}
                    onClick={() => selectMarket('US')}
                    className={`rounded-xl px-3 py-2 text-sm font-black transition ${market === 'US' ? 'bg-primary-800 text-white' : 'bg-white text-primary-800 hover:bg-primary-100'}`}
                  >
                    United States / US
                  </button>
                </div>
                <p className="px-2 pt-2 text-center text-xs font-bold text-primary-800">{locale} · {isUS ? 'USD' : 'BRL'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-primary-100 bg-gradient-to-r from-white via-primary-50 to-cyan-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-700">
                Oferta de lançamento
              </p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700 sm:text-base">
                Use o código{' '}
                <span className="inline-flex rounded-lg border border-primary-200 bg-white px-2.5 py-1 font-black tracking-[0.12em] text-primary-900 shadow-sm">
                  SMART15
                </span>{' '}
                no checkout e ganhe 15% de desconto nos 3 primeiros meses.
              </p>
            </div>
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
                    <p className="text-xs font-black uppercase tracking-wide text-primary-700">{plano.description}</p>
                    <h2 className="mt-2 text-3xl font-black text-gray-950">{plano.nome}</h2>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="mb-1 text-sm font-bold text-gray-400">{isUS ? '$' : 'R$'}</span>
                      <span className="text-5xl font-black text-gray-950">{plano.preco}</span>
                      <span className="mb-2 text-sm font-semibold text-gray-500">{isUS ? '/month' : '/mês'}</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400">{copy.capacity}</p>
                    <p className="mt-1 text-sm font-black text-gray-950">
                      {plano.capacityLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {plano.capacityDetail}
                    </p>
                    <p className="mt-3 text-xs font-black text-gray-500">
                      {copy.details}
                    </p>
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {plano.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-gray-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {renderAction(plano, plano.featured)}
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">{copy.rechargeEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black text-gray-950">{copy.rechargeTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                {copy.rechargeDescription}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-blue-100 bg-primary-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-sm">
                  <Coins className="h-5 w-5" />
                </div>
              </div>

              <h3 className="mt-5 text-xl font-black text-gray-950">
                {copy.chooseRecharge}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
                {copy.rechargeIntro}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rechargePackages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedRechargeKey(item.id)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selectedRechargeKey === item.id
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-white bg-white text-primary-800 hover:border-primary-200'
                    }`}
                  >
                    <span className="block text-lg font-black">{formatTokens(item.credits)} Smart Tokens</span>
                    <span className={`mt-1 block text-sm font-bold ${selectedRechargeKey === item.id ? 'text-blue-100' : 'text-gray-500'}`}>
                      {isUS ? '$' : 'R$'} {item.priceLabel}
                    </span>
                    <span className={`mt-2 block text-xs font-bold ${selectedRechargeKey === item.id ? 'text-blue-100' : 'text-gray-500'}`}>
                      {isUS ? 'Valid for 30 days' : 'Validade: 30 dias'}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-600">
                {isUS ? 'Selected recharge:' : 'Recarga selecionada:'} <span className="font-black text-primary-800">{formatTokens(selectedRecharge.credits)} Smart Tokens {isUS ? `for $ ${selectedRecharge.priceLabel}` : `por R$ ${selectedRecharge.priceLabel}`}</span>
              </p>
            </div>

            <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">{copy.extra}</p>
              <h3 className="mt-2 text-xl font-black text-gray-950">{copy.extraTitle}</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">
                Use Smart Tokens extras para começar a criar sem assinatura ou complementar seu plano.
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">
                Cada recarga tem validade de 30 dias a partir da compra.
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">
                Recursos premium ficam disponíveis para assinantes ou usuários com Smart Tokens suficientes.
              </p>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-primary-700">
                Precisa de Smart Tokens com frequência? Fazer upgrade do plano pode oferecer melhor custo-benefício.
              </p>
              <div className="mt-5">
                {renderAction({ id: `recarga_${selectedRecharge.id}`, cta: 'Adicionar Smart Tokens' }, false, true)}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">FAQ / Regras</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Como funciona</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {RULES.map((rule) => (
                <li key={rule} className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-sm font-semibold leading-relaxed text-gray-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-primary-700 bg-gradient-to-br from-primary-900 to-primary-700 p-6 text-white shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
              <Mail className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-xl font-black">Contato</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Dúvidas ou sugestões? Fale com a gente.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Use este canal para suporte, sugestões ou qualquer assunto relacionado ao {BRAND.name}.
            </p>
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="mt-5 inline-flex rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-black text-primary-900 hover:bg-white"
            >
              {BRAND.supportEmail}
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}
