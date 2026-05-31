import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Info, Sparkles, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'

const PLANOS = [
  {
    id: 'start',
    nome: 'START',
    creditos: 1000,
    precoTrimestral: '97',
    precoMensal: '127',
    desc: 'Para corretores que querem validar o fluxo com consistencia.',
    destaque: false,
    cta: 'Assinar START',
  },
  {
    id: 'pro',
    nome: 'PRO',
    creditos: 2500,
    precoTrimestral: '187',
    precoMensal: '247',
    desc: 'Para corretores ativos que publicam campanhas toda semana.',
    destaque: true,
    cta: 'Assinar PRO',
  },
  {
    id: 'elite',
    nome: 'ELITE',
    creditos: 6000,
    precoTrimestral: '497',
    precoMensal: '597',
    desc: 'Para alto volume, lancamentos e campanhas com mais videos.',
    destaque: false,
    cta: 'Assinar ELITE',
  },
]

const RECARGAS = [
  { id: 'recarga_500', creditos: 500, preco: '59' },
  { id: 'recarga_1000', creditos: 1000, preco: '99' },
  { id: 'recarga_2000', creditos: 2000, preco: '179' },
]

const RECURSOS = [
  'Textos IA gratuitos',
  'Banners consomem menos creditos',
  'Videos consomem mais creditos',
  'Escolha os formatos e use seus creditos de forma inteligente',
  'Campanhas para Instagram, WhatsApp, Facebook, TikTok e portais',
  'Suporte por WhatsApp',
]

const REGRAS = [
  { icon: 'IA', texto: 'Textos IA gratuitos em todos os planos.' },
  { icon: 'AR', texto: 'Banners e artes usam menos creditos que videos.' },
  { icon: 'VD', texto: 'Videos premium consomem mais creditos por exigirem mais processamento.' },
  { icon: 'CI', texto: 'Creditos da assinatura renovam a cada ciclo.' },
  { icon: '180', texto: 'Creditos avulsos expiram em 180 dias apos a compra.' },
]

const formatCredits = (value) => new Intl.NumberFormat('pt-BR').format(value)

export default function Planos() {
  const { user, isAuthenticated } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState(null)

  const iniciarCheckout = async (itemId) => {
    if (!isAuthenticated) return
    setLoadingPlan(itemId)
    toast('Checkout chega em breve. Fale com a gente pelo contato@smartcorretorai.com.br', { icon: '🚧', duration: 5000 })
    setTimeout(() => setLoadingPlan(null), 600)
  }

  const renderAction = (item, featured = false, recharge = false) => {
    const atual = user?.plano === item.id

    if (!isAuthenticated) {
      return (
        <Link
          to="/cadastro"
          className={`w-full flex items-center justify-center py-3 rounded-lg font-semibold text-sm ${
            featured ? 'gradient-primary text-white shadow-md' : recharge ? 'bg-amber-500 text-white hover:bg-amber-600' : 'btn-secondary'
          }`}
        >
          {recharge ? 'Comprar creditos' : item.cta}
        </Link>
      )
    }

    return (
      <button
        disabled={atual || loadingPlan === item.id}
        onClick={() => iniciarCheckout(item.id)}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
          featured
            ? 'gradient-primary text-white shadow-md hover:opacity-90'
            : recharge
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'btn-secondary'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loadingPlan === item.id ? 'Aguarde...' : atual ? 'Plano atual' : recharge ? 'Comprar creditos' : item.cta}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">SmartCorretorAI</span>
          </div>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 mb-4">
            <Sparkles className="w-4 h-4" />
            Creditos de marketing
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Escolha seu plano</h1>
          <p className="mt-4 text-gray-500 text-lg max-w-2xl mx-auto">
            O usuario escolhe os formatos, acompanha o custo estimado e usa os creditos de forma inteligente.
          </p>
          <p className="mt-2 text-sm text-primary-600 font-medium">Textos IA gratuitos em todos os planos.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-12">
          {PLANOS.map((plano) => {
            const atual = user?.plano === plano.id
            return (
              <div
                key={plano.id}
                className={`card p-6 relative flex flex-col ${
                  plano.destaque ? 'border-primary-400 ring-2 ring-primary-400 shadow-xl shadow-primary-100' : ''
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 gradient-primary text-white text-xs font-bold rounded-full shadow-md whitespace-nowrap">
                    MAIS ESCOLHIDO
                  </div>
                )}
                {atual && (
                  <div className="absolute -top-3.5 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                    SEU PLANO
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{plano.desc}</p>
                  <h2 className="mt-2 text-2xl font-black text-gray-900">{plano.nome}</h2>
                </div>

                <div className="mb-5 rounded-2xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-3xl font-black text-gray-900">{formatCredits(plano.creditos)}</p>
                  <p className="text-sm font-semibold text-primary-700">creditos por ciclo</p>
                </div>

                <div className="mb-6 space-y-1">
                  <div className="flex items-end gap-1">
                    <span className="text-gray-400 text-sm mb-1">R$</span>
                    <span className="text-4xl font-extrabold text-gray-900">{plano.precoTrimestral}</span>
                    <span className="text-gray-400 mb-1">/mes no trimestral</span>
                  </div>
                  <p className="text-xs text-gray-500">ou R$ {plano.precoMensal}/mes no plano mensal</p>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {RECURSOS.map((recurso) => (
                    <li key={recurso} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-500" />
                      {recurso}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {renderAction(plano, plano.destaque)}
                </div>
              </div>
            )
          })}
        </div>

        <section className="mb-8">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider">Recargas</p>
              <h2 className="text-2xl font-extrabold text-gray-900">Creditos avulsos</h2>
              <p className="mt-2 text-sm text-gray-500">Use para campanhas extras. Creditos avulsos expiram em 180 dias.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {RECARGAS.map((recarga) => (
              <div key={recarga.id} className="card p-6 border-dashed border-amber-300 flex flex-col">
                <div className="inline-flex items-center gap-1 mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Recarga</span>
                </div>
                <h3 className="text-2xl font-black text-gray-900">{formatCredits(recarga.creditos)}</h3>
                <p className="text-sm font-semibold text-primary-700 mb-5">creditos</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-gray-400 text-sm mb-1">R$</span>
                  <span className="text-4xl font-extrabold text-gray-900">{recarga.preco}</span>
                  <span className="text-gray-400 mb-1 text-sm">unico</span>
                </div>
                <p className="text-xs text-gray-500 mb-6 flex-1">Validade de 180 dias apos a compra.</p>
                {renderAction(recarga, false, true)}
              </div>
            ))}
          </div>
        </section>

        <div className="card p-5 bg-gray-50 border-gray-200 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-600">Regras importantes</p>
          </div>
          <ul className="space-y-2">
            {REGRAS.map(({ icon, texto }) => (
              <li key={texto} className="flex items-start gap-2.5 text-xs text-gray-500">
                <span className="min-w-8 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] font-black text-gray-500 text-center">
                  {icon}
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-sm text-gray-400">
          Duvidas?{' '}
          <a href="mailto:contato@smartcorretorai.com.br" className="text-primary-600 hover:underline">
            Fale com a gente
          </a>
        </p>
      </div>
    </div>
  )
}
