import { Link } from 'react-router-dom'
import { Check, Zap, ArrowLeft, Sparkles, Info } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useState } from 'react'

const RECURSOS = [
  'Textos prontos para Instagram, WhatsApp e Facebook',
  'Hashtags geradas automaticamente',
  'Roteiro para vídeos e Reels',
  'Texto para LinkedIn e YouTube',
  'Postar no Instagram com 1 clique',
  'Suporte por WhatsApp',
]

const REGRAS = [
  { icon: '🔄', texto: 'Anúncios mensais não acumulam — resetam no dia 1° de cada mês' },
  { icon: '🔒', texto: 'Planos intransferíveis — vinculados ao e-mail do titular' },
  { icon: '👥', texto: 'Múltiplos logins apenas no plano Imobiliária' },
  { icon: '♾️', texto: 'Anúncios avulsos não expiram — ficam disponíveis até serem usados' },
]

const allPlans = [
  {
    id: 'free',
    tipo: 'plano',
    nome: 'Teste Grátis',
    preco: null,
    periodo: null,
    anuncios: 1,
    logins: 1,
    desc: 'Experimente sem pagar nada',
    destaque: false,
    cta: 'Criar conta grátis',
    link: '/cadastro',
  },
  {
    id: 'avulso5',
    tipo: 'avulso',
    nome: 'Avulso · 5 anúncios',
    preco: '59',
    precoCheio: '79',
    periodo: null,
    anuncios: 5,
    desc: 'Sem mensalidade · não expiram',
    destaque: false,
    cta: 'Comprar',
  },
  {
    id: 'avulso10',
    tipo: 'avulso',
    nome: 'Avulso · 10 anúncios',
    preco: '87',
    precoCheio: '127',
    periodo: null,
    anuncios: 10,
    desc: 'Sem mensalidade · não expiram',
    destaque: false,
    cta: 'Comprar',
  },
  {
    id: 'start',
    tipo: 'plano',
    nome: 'Start',
    preco: '97',
    precoCheio: '147',
    periodo: '/mês',
    anuncios: 15,
    logins: 1,
    desc: 'Para corretores que estão começando',
    destaque: false,
    cta: 'Assinar Start',
  },
  {
    id: 'pro',
    tipo: 'plano',
    nome: 'Pro',
    preco: '197',
    precoCheio: '247',
    periodo: '/mês',
    anuncios: 35,
    logins: 1,
    desc: 'O favorito dos corretores ativos',
    destaque: true,
    cta: 'Assinar Pro',
  },
  {
    id: 'imobiliaria',
    tipo: 'plano',
    nome: 'Imobiliária',
    preco: '397',
    precoCheio: '547',
    periodo: '/mês',
    anuncios: 80,
    logins: null,
    desc: 'Para imobiliárias e equipes',
    destaque: false,
    cta: 'Assinar Imobiliária',
  },
]

export default function Planos() {
  const { user, isAuthenticated } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState(null)

  const assinar = async (planId) => {
    if (!isAuthenticated) return
    setLoadingPlan(planId)
    try {
      const res = await api.post('/subscriptions/checkout', { plan_id: planId })
      window.location.href = res.checkout_url
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingPlan(null)
    }
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
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Escolha seu plano</h1>
          <p className="mt-4 text-gray-500 text-lg">Comece grátis. Sem cartão de crédito. Cancele quando quiser.</p>
          <p className="mt-2 text-sm text-primary-600 font-medium">Todos os recursos disponíveis em todos os planos ✓</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {allPlans.map((plan) => {
            const atual = user?.plano === plan.id
            const isAvulso = plan.tipo === 'avulso'
            return (
              <div
                key={plan.id}
                className={`card p-6 relative flex flex-col ${
                  plan.destaque
                    ? 'border-primary-400 ring-2 ring-primary-400 shadow-xl shadow-primary-100'
                    : isAvulso
                    ? 'border-dashed border-amber-300'
                    : ''
                }`}
              >
                {plan.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 gradient-primary text-white text-xs font-bold rounded-full shadow-md whitespace-nowrap">
                    ⭐ MAIS POPULAR
                  </div>
                )}
                {atual && (
                  <div className="absolute -top-3.5 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                    SEU PLANO
                  </div>
                )}

                {isAvulso && (
                  <div className="inline-flex items-center gap-1 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Avulso</span>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{plan.desc}</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">{plan.nome}</h2>
                </div>

                <div className="mb-5">
                  {plan.preco ? (
                    <div className="flex items-end gap-1">
                      <span className="text-gray-400 text-sm mb-1">R$</span>
                      <span className="text-4xl font-extrabold text-gray-900">{plan.preco}</span>
                      {plan.periodo && <span className="text-gray-400 mb-1">{plan.periodo}</span>}
                      {isAvulso && <span className="text-gray-400 mb-1 text-sm"> único</span>}
                    </div>
                  ) : (
                    <span className="text-3xl font-extrabold text-gray-900">Grátis</span>
                  )}
                  {plan.precoCheio && (
                    <p className="text-xs text-amber-700 font-semibold mt-1">
                      {isAvulso
                        ? `Preço de lançamento · de R$ ${plan.precoCheio} por R$ ${plan.preco}`
                        : `Primeiros 3 meses · depois R$ ${plan.precoCheio}/mês`}
                    </p>
                  )}
                  <p className="text-sm text-primary-700 font-semibold mt-2">
                    {plan.anuncios} anúncio{plan.anuncios > 1 ? 's' : ''}
                    {isAvulso ? ' · não expiram' : ' por mês'}
                  </p>
                  {!isAvulso && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {plan.logins ? `${plan.logins} login · intransferível` : 'Múltiplos usuários · login compartilhado'}
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {RECURSOS.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isAvulso ? 'text-amber-500' : 'text-green-500'}`} />
                      {r}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {plan.link ? (
                    <a href={plan.link} className="w-full flex items-center justify-center py-3 rounded-lg font-semibold text-sm btn-secondary">
                      {plan.cta}
                    </a>
                  ) : isAuthenticated ? (
                    <button
                      disabled={atual || loadingPlan === plan.id}
                      onClick={() => assinar(plan.id)}
                      className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                        plan.destaque
                          ? 'gradient-primary text-white shadow-md hover:opacity-90'
                          : isAvulso
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'btn-secondary'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loadingPlan === plan.id ? 'Aguarde...' : atual ? 'Plano atual' : plan.cta}
                    </button>
                  ) : (
                    <Link
                      to="/cadastro"
                      className={`w-full flex items-center justify-center py-3 rounded-lg font-semibold text-sm ${
                        plan.destaque
                          ? 'gradient-primary text-white shadow-md'
                          : isAvulso
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'btn-secondary'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="card p-5 bg-gray-50 border-gray-200 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-600">Regras importantes</p>
          </div>
          <ul className="space-y-2">
            {REGRAS.map(({ icon, texto }) => (
              <li key={texto} className="flex items-start gap-2.5 text-xs text-gray-500">
                <span className="text-base leading-none mt-0.5">{icon}</span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-sm text-gray-400">
          Dúvidas?{' '}
          <a href="mailto:contato@smartcorretorai.com.br" className="text-primary-600 hover:underline">
            Fale com a gente
          </a>
        </p>
      </div>
    </div>
  )
}