import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Coins, Mail, Sparkles, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import { SMART_TOKEN_RECHARGE_CONFIG, estimateSmartTokensFromAmount } from '../data/creditCosts'

const PLANOS = [
  {
    id: 'start',
    nome: 'START',
    preco: '97',
    description: 'Acesso completo à plataforma.',
    capacityLabel: 'Capacidade inicial de criação',
    capacityDetail: 'Smart Tokens inclusos',
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
    preco: '187',
    description: 'Mais recomendado.',
    capacityLabel: 'Mais liberdade para criar com frequência',
    capacityDetail: 'Smart Tokens inclusos',
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
    preco: '497',
    description: 'Maior capacidade para profissionais e equipes.',
    capacityLabel: 'Volume ampliado de criação',
    capacityDetail: 'Smart Tokens inclusos',
    featured: false,
    cta: 'Assinar Elite',
    bullets: [
      'Acesso completo à plataforma',
      'Maior capacidade para profissionais e equipes',
      'Mais fôlego para campanhas, imagens, vídeos e landings',
    ],
  },
]

const RECARGAS = [
  {
    id: 'recarga_500',
    nome: 'Essencial',
    tokens: 500,
    preco: '59',
    description: 'Capacidade extra para continuar criando no ciclo atual.',
  },
  {
    id: 'recarga_1000',
    nome: 'Intermediária',
    tokens: 1000,
    preco: '99',
    description: 'Mais fôlego para uma sequência maior de materiais.',
  },
  {
    id: 'recarga_2000',
    nome: 'Intensiva',
    tokens: 2000,
    preco: '179',
    description: 'Capacidade reforçada para alto volume de criação.',
  },
]

const CICLOS = [
  { id: 'mensal', label: 'Mensal', status: 'ativo' },
  { id: 'trimestral', label: 'Trimestral', status: 'em breve' },
  { id: 'anual', label: 'Anual', status: 'em breve' },
]

const RULES = [
  'Todos os planos dão acesso à plataforma completa.',
  'Smart Tokens representam sua capacidade de criação.',
  'Antes de cada criação, o sistema verifica se há capacidade disponível.',
  'Materiais ficam disponíveis por 7 dias para download.',
  'Landing IA publicada permanece ativa enquanto a assinatura estiver ativa.',
  'Recargas adicionam capacidade extra ao ciclo.',
  'Cancelamento pode ser feito pela conta.',
]

const formatTokens = (value) => new Intl.NumberFormat('pt-BR').format(value)

export default function Planos() {
  const { user, isAuthenticated } = useAuth()
  const [loadingItem, setLoadingItem] = useState(null)
  const [rechargeAmount, setRechargeAmount] = useState(SMART_TOKEN_RECHARGE_CONFIG.quickAmounts[1])
  const estimatedRechargeTokens = estimateSmartTokensFromAmount(rechargeAmount)

  const iniciarCheckout = async (itemId) => {
    if (!isAuthenticated) return
    setLoadingItem(itemId)
    toast('Assinatura em preparação. Fale com suporte@smartcorretorai.com para ativação.', {
      icon: '✨',
      duration: 5000,
    })
    setTimeout(() => setLoadingItem(null), 600)
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
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-800 text-cyan-100">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-black text-gray-950">SmartCorretorAI</span>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-7 text-white shadow-xl shadow-primary-900/10 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/20 bg-cyan-100/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-50">
              <Sparkles className="h-4 w-4 text-cyan-100" />
              Planos / Smart Tokens
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              Escolha seu plano
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
              Todos os planos dão acesso à plataforma completa. Escolha a capacidade ideal para o seu ritmo de criação.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              Todos os planos incluem acesso completo à plataforma. A diferença está apenas na capacidade de criação disponível em cada ciclo.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[380px]">
              {CICLOS.map((ciclo) => (
                <div
                  key={ciclo.id}
                  className={`rounded-2xl border px-4 py-3 text-center ${
                    ciclo.status === 'ativo'
                      ? 'border-primary-800 bg-primary-800 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                >
                  <p className="text-sm font-black">{ciclo.label}</p>
                  <p className={`mt-1 text-[11px] font-black uppercase tracking-wide ${
                    ciclo.status === 'ativo' ? 'text-cyan-100' : 'text-gray-400'
                  }`}>
                    {ciclo.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {PLANOS.map((plano) => {
            const atual = user?.plano === plano.id
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
                    Seu plano
                  </div>
                )}

                <div className="flex w-full flex-col">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-primary-700">{plano.description}</p>
                    <h2 className="mt-2 text-3xl font-black text-gray-950">{plano.nome}</h2>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="mb-1 text-sm font-bold text-gray-400">R$</span>
                      <span className="text-5xl font-black text-gray-950">{plano.preco}</span>
                      <span className="mb-2 text-sm font-semibold text-gray-500">/mês</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400">Capacidade do ciclo</p>
                    <p className="mt-1 text-sm font-black text-gray-950">
                      {plano.capacityLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {plano.capacityDetail}
                    </p>
                    <p className="mt-3 text-xs font-black text-gray-500">
                      Ver detalhes da capacidade
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
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Adicionar Smart Tokens</p>
              <h2 className="mt-1 text-2xl font-black text-gray-950">Continue criando quando precisar</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                Use recargas para continuar criando quando precisar de mais capacidade antes da renovação do plano.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-blue-100 bg-primary-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-sm">
                  <Coins className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-primary-800">
                  Recarga livre
                </span>
              </div>

              <h3 className="mt-5 text-xl font-black text-gray-950">
                Escolha quanto deseja adicionar
              </h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
                Use em Hero IA, Studio Hero, Landing IA, Banners e Textos.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {SMART_TOKEN_RECHARGE_CONFIG.quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setRechargeAmount(amount)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                      Number(rechargeAmount) === amount
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-white bg-white text-primary-800 hover:border-primary-200'
                    }`}
                  >
                    R$ {amount}
                  </button>
                ))}
              </div>

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-wide text-gray-500">Outro valor</span>
                <div className="mt-2 flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary-500">
                  <span className="text-sm font-black text-gray-400">R$</span>
                  <input
                    type="number"
                    min={SMART_TOKEN_RECHARGE_CONFIG.minAmount}
                    step="10"
                    value={rechargeAmount}
                    onChange={(event) => setRechargeAmount(event.target.value)}
                    className="ml-2 w-full bg-transparent text-lg font-black text-gray-950 outline-none"
                    placeholder="Digite o valor"
                  />
                </div>
              </label>

              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-600">
                Estimativa de liberação: <span className="font-black text-primary-800">{formatTokens(estimatedRechargeTokens)} Smart Tokens</span>
              </p>
            </div>

            <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Capacidade extra</p>
              <h3 className="mt-2 text-xl font-black text-gray-950">Recarga para qualquer conta</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">
                Assinantes e usuários em teste podem adicionar Smart Tokens quando quiserem continuar criando.
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">
                Recursos premium ficam disponíveis para assinantes ou usuários com Smart Tokens suficientes.
              </p>
              <div className="mt-5">
                {renderAction({ id: `recarga_${rechargeAmount}`, cta: 'Adicionar Smart Tokens' }, false, true)}
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
            <h2 className="mt-5 text-xl font-black">Suporte</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Precisa de ajuda para escolher o plano ou adicionar capacidade?
            </p>
            <a
              href="mailto:suporte@smartcorretorai.com"
              className="mt-5 inline-flex rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-black text-primary-900 hover:bg-white"
            >
              suporte@smartcorretorai.com
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}
