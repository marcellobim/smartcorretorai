import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clapperboard,
  Image,
  Play,
  Sparkles,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'

const demoCards = [
  {
    label: 'Hero IA',
    title: 'Imagem -> Hero IA',
    asset: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    badge: 'imagem principal',
  },
  {
    label: 'Studio Hero',
    title: 'Imagem -> Video',
    asset: '/previews/studio-hero/moema-demo.mp4',
    badge: 'video do imovel',
  },
  {
    label: 'Banners Rapidos',
    title: 'Imagem -> Campanha',
    asset: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    badge: 'campanha pronta',
  },
  {
    label: 'Divulgacao',
    title: 'Ideia -> Material',
    asset: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    badge: 'conteudo pronto',
  },
]

const featureCards = [
  {
    icon: Wand2,
    title: 'Hero IA',
    copy: 'Crie uma imagem principal de alto impacto para destacar o imovel em anuncios e redes sociais.',
    cta: 'Criar imagem',
    gradient: 'from-fuchsia-500 via-violet-600 to-blue-600',
    asset: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
  },
  {
    icon: Video,
    title: 'Studio Hero',
    copy: 'Transforme fotos do imovel em um video cinematografico pronto para divulgar.',
    cta: 'Criar video',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    asset: '/previews/studio-hero/moema-demo.mp4',
  },
  {
    icon: Image,
    title: 'Banners Rapidos',
    copy: 'Gere anuncios e campanhas visuais para publicar sem comecar do zero.',
    cta: 'Criar campanha',
    gradient: 'from-orange-500 via-rose-500 to-violet-600',
    asset: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
  },
]

const stats = [
  ['1 ideia', 'pode virar campanha visual completa'],
  ['3 produtos', 'para imagem, video e anuncios'],
  ['minutos', 'para sair de foto parada para divulgacao'],
  ['tokens', 'uma unica capacidade para criar'],
]

const steps = [
  'Envie uma foto ou descreva o imovel.',
  'A IA entende o objetivo da divulgacao.',
  'Voce recebe materiais prontos para publicar.',
]

const faqs = [
  'Preciso saber escrever prompts?',
  'Posso usar fotos reais do imovel?',
  'O Studio Hero gera sempre o mesmo video?',
  'Como funcionam os Smart Tokens?',
]

function BrandHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050812]/88 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#05101d] shadow-[0_0_35px_rgba(125,211,252,0.38)]">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">SmartCorretorAI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-full px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/10">
            Entrar
          </Link>
          <Link to="/cadastro" className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#06101d] shadow-lg shadow-cyan-500/15">
            Testar gratis
          </Link>
        </div>
      </div>
    </header>
  )
}

function MediaFrame({ src, alt, className = '', contain = false }) {
  const isVideo = src.endsWith('.mp4')

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-black ${className}`}>
      {isVideo ? (
        <video
          src={src}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/35" />
    </div>
  )
}

function DemoRail() {
  return (
    <div className="relative overflow-hidden py-8">
      <div className="flex w-max animate-[frankensteinRail_28s_linear_infinite] gap-5 px-5">
        {[...demoCards, ...demoCards].map((card, index) => (
          <article
            key={`${card.label}-${index}`}
            className="w-[210px] shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-3 shadow-2xl shadow-black/30 sm:w-[250px]"
          >
            <MediaFrame src={card.asset} alt={card.label} className="aspect-[9/14]" contain={card.asset.includes('moema-demo')} />
            <div className="px-2 pb-2 pt-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">{card.label}</p>
              <h3 className="mt-2 text-xl font-black leading-tight text-white">{card.title}</h3>
              <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase text-[#06101d]">
                {card.badge}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function FeatureCard({ feature }) {
  const Icon = feature.icon

  return (
    <article className={`overflow-hidden rounded-[2.25rem] bg-gradient-to-br ${feature.gradient} p-[1px] shadow-2xl shadow-black/30`}>
      <div className="overflow-hidden rounded-[2.2rem] bg-[#080b17]">
        <div className={`bg-gradient-to-br ${feature.gradient} px-6 pb-8 pt-7 text-white`}>
          <div className="mb-8 flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/18 backdrop-blur-xl">
              <Icon className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5" />
          </div>
          <h3 className="text-3xl font-black tracking-tight">{feature.title}</h3>
          <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-white/78">{feature.copy}</p>
          <Link to="/cadastro" className="mt-6 inline-flex rounded-full bg-black/20 px-5 py-3 text-sm font-black backdrop-blur-xl hover:bg-black/30">
            {feature.cta}
          </Link>
        </div>
        <div className="p-4">
          <MediaFrame src={feature.asset} alt={feature.title} className="aspect-[4/3]" contain={feature.asset.includes('moema-demo')} />
        </div>
      </div>
    </article>
  )
}

export default function HomeFrankenstein() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050812] text-white">
      <style>{`
        @keyframes frankensteinRail {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes frankensteinFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-14px) rotate(1deg); }
        }
        @keyframes frankensteinPulse {
          0%, 100% { opacity: .35; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.08); }
        }
      `}</style>

      <BrandHeader />

      <main>
        <section className="relative isolate overflow-hidden px-4 pb-12 pt-10 sm:px-6 lg:pb-24">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#071426_0%,#050812_42%,#050812_100%)]" />
          <div className="absolute left-1/2 top-0 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-[90px] animate-[frankensteinPulse_4s_ease-in-out_infinite]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px]" />

          <div className="mx-auto max-w-6xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
              <Sparkles className="h-4 w-4" />
              experimento frankenstein
            </div>

            <h1 className="mx-auto max-w-5xl text-[4.25rem] font-black leading-[0.82] tracking-[-0.07em] sm:text-[7rem] lg:text-[9.5rem]">
              Marketing
              <span className="block bg-gradient-to-b from-white via-cyan-100 to-blue-500 bg-clip-text text-transparent">
                imobiliario
              </span>
              <span className="block text-white">que se move</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-lg font-semibold leading-8 text-slate-300">
              Transforme fotos, ideias e imoveis em imagens, videos e campanhas com aparencia de producao profissional.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/cadastro" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-black text-[#06101d] shadow-2xl shadow-cyan-500/20 sm:w-auto">
                Testar gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#transformacoes" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-7 py-4 text-sm font-black text-white backdrop-blur-xl sm:w-auto">
                Ver transformacoes
                <Play className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div className="rounded-[2.3rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 lg:mb-10">
              <p className="text-sm font-black uppercase tracking-[0.26em] text-cyan-200">de foto parada</p>
              <h2 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">
                para uma campanha que parece viva.
              </h2>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {['Hero IA', 'Studio Hero', 'Banners'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/8 px-3 py-4 text-center text-xs font-black uppercase text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px] animate-[frankensteinFloat_6s_ease-in-out_infinite]">
              <div className="absolute -inset-6 rounded-[3rem] bg-cyan-400/10 blur-3xl" />
              <div className="relative grid grid-cols-[0.72fr_1fr] gap-3 rounded-[2.5rem] border border-white/12 bg-white/[0.07] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <MediaFrame src="/previews/produto3/anuncio-premium-preview-1x1.jpg" alt="Hero IA" className="aspect-[9/16]" />
                <div className="grid gap-3">
                  <MediaFrame src="/previews/studio-hero/moema-demo.mp4" alt="Studio Hero" className="aspect-video" contain />
                  <div className="rounded-[1.5rem] bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-white/80">Imagem {'->'} Campanha</p>
                    <h3 className="mt-3 text-3xl font-black leading-none">pronto para publicar</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="transformacoes" className="border-y border-white/10 bg-[#070b18] py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-xs font-black uppercase tracking-[0.32em] text-cyan-200">transformacoes em loop</p>
          </div>
          <DemoRail />
        </section>

        <section className="px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">recursos principais</p>
              <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                tres formas de fazer o imovel parecer maior que o anuncio.
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {featureCards.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#070b18] px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(([number, copy]) => (
                <article key={number} className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 text-center shadow-xl shadow-black/20">
                  <h3 className="text-5xl font-black tracking-tight text-white">{number}</h3>
                  <p className="mx-auto mt-4 max-w-[180px] text-base font-semibold leading-7 text-slate-400">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">como acontece</p>
              <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                simples por fora. poderoso por dentro.
              </h2>
              <p className="mt-6 text-lg font-semibold leading-8 text-slate-400">
                O corretor nao precisa aprender tecnologia. Ele escolhe o objetivo, mostra o imovel e recebe material de divulgacao.
              </p>
            </div>

            <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30">
              <div className="rounded-[2rem] bg-slate-950 p-4">
                <div className="mb-4 flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-300" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 rounded-full bg-white/8 px-4 py-1 text-xs font-bold text-slate-400">app.smartcorretor.ai</span>
                </div>
                <div className="grid gap-3">
                  {steps.map((step, index) => (
                    <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300 text-sm font-black text-[#06101d]">
                        {index + 1}
                      </span>
                      <p className="text-sm font-bold leading-6 text-slate-200">{step}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 p-4 text-[#06101d]">
                  <p className="text-xs font-black uppercase tracking-[0.22em]">resultado</p>
                  <p className="mt-2 text-2xl font-black leading-none">campanha pronta para sair da tela</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 text-[#06101d] sm:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="mx-auto max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.055em] sm:text-7xl">
              Uma carteira. Todos os formatos.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-600">
              Smart Tokens servem para criar imagens, videos, anuncios e materiais. Teste gratis e avance quando enxergar valor.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {['Hero IA', 'Studio Hero', 'Banners Rapidos', 'Textos', 'Campanhas'].map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">perguntas frequentes</p>
              <h2 className="mt-4 text-5xl font-black leading-[0.92] tracking-[-0.055em] sm:text-7xl">
                antes de testar
              </h2>
            </div>
            <div className="grid gap-4">
              {faqs.map((faq) => (
                <button key={faq} className="flex items-center justify-between rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-6 text-left text-xl font-black text-white">
                  {faq}
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-700 p-8 text-[#06101d] shadow-2xl shadow-cyan-950/30 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <Clapperboard className="h-10 w-10" />
                <h2 className="mt-5 max-w-3xl text-5xl font-black leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                  veja seu imovel com outra presenca.
                </h2>
              </div>
              <Link to="/cadastro" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#06101d] px-7 py-4 text-sm font-black text-white">
                Testar gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
