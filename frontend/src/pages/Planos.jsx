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

const plans = [
  {
    id: 'free',
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
    id: 'start',
    nome: 'Start',
    preco: '97',
    periodo: '/mês',
    anuncios: 15,
    logins: 1,
    desc: 'Para corretores que estão começando',
    destaque: false,
    cta: 'Assinar Start',
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: '187',
    periodo: '/mês',
    anuncios: 35,
    logins: 1,
    desc: 'O favorito dos corretores ativos',
    destaque: true,
    cta: 'Assinar Pro',
  },
  {
    id: 'enterprise',
    nome: 'Imobiliária',
    preco: '417',
    periodo: '/mês',
    anuncios: 80,
    logins: null, // múltiplos — definido por contato
    desc: 'Para imobiliárias e equipes',
    destaque: false,
    cta: 'Falar com a equipe',
    link: 'mailto:contato@smartcorretorai.com.br',
  },
]

const avulsos = [
  {
    id: 'avulso1',
    nome: 'Avulso · 5 anúncios',
    preco: '38,97',
    creditos: 5,
    desc: 'Ideal para quem gera pouco ou quer complementar o plano',
    por_credito: '7,79',
  },
  {
    id: 'avulso2',
    nome: 'Avulso · 10 anúncios',
    preco: '57,97',
    creditos: 10,
    desc: 'Melhor custo por anúncio · economize 25% em relação ao pack menor',
    por_credito: '5,80',
    destaque: true,
  },
]

const REGRAS = [
  { icon: '🔄', texto: 'Anúncios mensais não acumulam — resetam no dia 1° de cada mês' },
  { icon: '🔒', texto: 'Planos intransferíveis — vinculados ao e-mail do titular' },
  { icon: '👥', texto: 'Múltiplos logins apenas no plano Imobiliária' },
  { icon: '♾️', texto: 'Anúncios avulsos não expiram — ficam disponíveis até serem usados' },
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

        {/* Header nav */}
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

        {/* Título */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Escolha seu plano</h1>
          <p className="mt-4 text-gray-500 text-lg">Comece grátis. Sem cartão de crédito. Cancele quando quiser.</p>
          <p className="mt-2 text-sm text-primary-600 font-medium">Todos os recursos disponíveis em todos os planos ✓</p>
        </div>

        {/* Planos principais */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {plans.map((plan) => {
            const atual = user?.plano === plan.id
            return (
              <div
                key={plan.id}
                className={`card p-6 relative flex flex-col ${plan.destaque ? 'border-primary-400 ring-2 ring-primary-400 shadow-xl shadow-primary-100' : ''}`}
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

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{plan.desc}</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">{plan.nome}</h2>
                </div>

                <div className="mb-5">
                  {plan.preco ? (
                    <div className="flex items-end gap-1">
                      <span className="text-gray-400 text-sm mb-1">R$</span>
                      <span className="text-4xl font-extrabold text-gray-900">{plan.preco}</span>
                      <span className="text-gray-400 mb-1">{plan.periodo}</span>
                    </div>
                  ) : (
                    <span className="text-3xl font-extrabold text-gray-900">Grátis</span>
                  )}
                  <p className="text-sm text-primary-700 font-semibold mt-2">
                    {plan.anuncios} anúncio{plan.anuncios > 1 ? 's' : ''} por mês
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {plan.logins ? `${plan.logins} login · intransferível` : 'Múltiplos usuários · contato comercial'}
                  </p>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {RECURSOS.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {plan.link ? (
                    <a
                      href={plan.link}
                      className="w-full flex items-center justify-center py-3 rounded-lg font-semibold text-sm btn-secondary"
                    >
                      {plan.cta}
                    </a>
                  ) : isAuthenticated ? (
                    <button
                      disabled={atual || loadingPlan === plan.id}
                      onClick={() => assinar(plan.id)}
                      className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                        plan.destaque
                          ? 'gradient-primary text-white shadow-md hover:opacity-90'
                          : 'btn-secondary'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loadingPlan === plan.id ? 'Aguarde...' : atual ? 'Plano atual' : plan.cta}
                    </button>
                  ) : (
                    <Link
                      to="/cadastro"
                      className={`w-full flex items-center justify-center py-3 rounded-lg font-semibold text-sm ${
                        plan.destaque ? 'gradient-primary text-white shadow-md' : 'btn-secondary'
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

        {/* Pacotes Avulsos */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Anúncios Avulsos</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">SEM MENSALIDADE · NÃO EXPIRAM</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {avulsos.map((pack) => (
              <div
                key={pack.id}
                className={`card p-5 relative ${pack.destaque ? 'border-amber-300 ring-2 ring-amber-300 shadow-md shadow-amber-50' : 'border-dashed border-gray-200'}`}
              >
                {pack.destaque && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                    MELHOR VALOR
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className="font-bold text-gray-900">{pack.nome}</h3>
                    <p className="text-xs text-gray-500 mt-1">{pack.desc}</p>
                    <p className="text-xs text-amber-700 font-semibold mt-2">
                      R$ {pack.por_credito} por anúncio · {pack.creditos} anúncios
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-extrabold text-gray-900">R$ {pack.preco}</p>
                    <p className="text-xs text-gray-400 mb-3">pagamento único</p>
                    {isAuthenticated ? (
                      <button
                        onClick={() => assinar(pack.id)}
                        disabled={loadingPlan === pack.id}
                        className="px-4 py-2.5 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {loadingPlan === pack.id ? 'Aguarde...' : 'Comprar'}
                      </button>
                    ) : (
                      <Link to="/cadastro" className="px-4 py-2.5 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors">
                        Comprar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Regras */}
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
