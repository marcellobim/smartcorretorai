import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Image, Rocket, Video } from 'lucide-react'
import Header from '../components/layout/Header'
import { useAuth } from '../lib/auth-context'

const productCards = [
  {
    id: 'video',
    icon: Video,
    badge: 'Vídeo inteligente',
    title: '🎬 Transformar Meu Vídeo',
    description: 'Envie seu vídeo bruto e receba uma versão profissional para divulgação imobiliária.',
    button: 'Começar',
    to: null,
    status: null,
    accent: 'from-violet-950 via-gray-950 to-gray-900',
    buttonClass: 'bg-violet-300 text-gray-950 hover:bg-violet-200',
    benefits: ['Cortes inteligentes', 'Legendas', 'Reels e TikTok'],
  },
  {
    id: 'campaign',
    icon: Rocket,
    badge: 'Campanha completa',
    title: '🚀 Gerar Campanha Completa',
    description: 'Envie fotos e dados do imóvel e receba uma campanha completa pronta para divulgação.',
    button: 'Começar',
    to: '/nova-campanha',
    status: null,
    accent: 'from-gray-950 via-primary-950 to-gray-900',
    buttonClass: 'bg-amber-300 text-gray-950 hover:bg-amber-200',
    benefits: ['Instagram, WhatsApp e Portais', 'Textos, vídeos e banners', 'Campanha pronta em minutos'],
  },
  {
    id: 'hero',
    icon: Image,
    badge: 'Imagem IA',
    title: '✨ Hero Image IA',
    description: 'Transforme uma foto comum em uma imagem publicitária premium criada por IA.',
    button: 'Fluxo em preparação',
    to: null,
    status: 'Em breve',
    accent: 'from-slate-950 via-indigo-950 to-gray-900',
    buttonClass: 'bg-white/10 text-white border border-white/20 cursor-default',
    benefits: ['Estilos premium', 'Imagem de impacto', 'Fluxo em preparação'],
  },
]

export default function Dashboard() {
  const { user } = useAuth()

  const firstName =
    user?.displayName?.split(' ')[0] ||
    user?.nome?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Corretor'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div>
      <Header title="Dashboard" />

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-4 py-6 sm:px-7 lg:px-8">
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-primary-600">{greeting}, {firstName}</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-gray-950 sm:text-3xl">
            Escolha o produto que deseja criar.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            O SmartCorretorAI organiza seus materiais de marketing em três caminhos simples.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {productCards.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      </main>
    </div>
  )
}

function ProductCard({ product }) {
  const Icon = product.icon
  const content = (
    <article className={`flex min-h-[390px] flex-col overflow-hidden rounded-3xl bg-gradient-to-br ${product.accent} p-6 text-white shadow-xl shadow-gray-950/15 transition-transform hover:-translate-y-1`}>
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-white/80">
          {product.badge}
        </span>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>

      <div className="mt-7 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-black leading-tight">{product.title}</h2>
          {product.status && (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-black text-white">
              {product.status}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">{product.description}</p>

        <div className="mt-6 space-y-2">
          {product.benefits.map(benefit => (
            <div key={benefit} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-100">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-colors ${product.buttonClass}`}>
        {product.button}
        {product.to && <ArrowRight className="h-4 w-4" />}
      </div>
    </article>
  )

  if (!product.to) return content

  return (
    <Link to={product.to} className="block focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 rounded-3xl">
      {content}
    </Link>
  )
}
