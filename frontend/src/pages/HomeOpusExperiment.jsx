import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Coins,
  Image,
  PlayCircle,
  Sparkles,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'

const productStories = [
  {
    eyebrow: 'Hero IA',
    icon: Wand2,
    title: 'Uma imagem comum vira uma chamada visual de impacto.',
    description: 'Use fotos reais, referências ou apenas uma ideia. A IA transforma intenção em uma imagem principal para divulgação.',
    before: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    afterLabel: 'imagem principal',
  },
  {
    eyebrow: 'Studio Hero',
    icon: Video,
    title: 'Fotos paradas ganham movimento, ritmo e presença.',
    description: 'Crie um vídeo profissional do imóvel para redes sociais, WhatsApp e atendimento.',
    before: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    afterLabel: 'vídeo do imóvel',
  },
  {
    eyebrow: 'Banners Rápidos',
    icon: Image,
    title: 'Uma foto se desdobra em campanha pronta para publicar.',
    description: 'Materiais consistentes para divulgar com velocidade, sem começar do zero.',
    before: '/previews/produto3/story-premium-preview-1x1.mp4',
    afterLabel: 'campanha pronta',
  },
]

const outcomes = [
  ['Mais visitas', 'Crie materiais que fazem o imóvel parecer mais desejável.'],
  ['Mais locações', 'Transforme detalhes do imóvel em uma divulgação clara e atraente.'],
  ['Mais captação', 'Mostre autoridade para proprietários e ganhe novas oportunidades.'],
  ['Mais presença', 'Publique com aparência profissional em todos os canais do corretor.'],
]

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary-900 shadow-lg shadow-cyan-950/10">
        <Zap className="h-5 w-5" />
      </div>
      <span className="text-sm font-black tracking-tight text-white">SmartCorretorAI</span>
    </div>
  )
}

function VisualPhone({ compact = false }) {
  return (
    <div className={`relative mx-auto ${compact ? 'max-w-[290px]' : 'max-w-[360px]'}`}>
      <div className="absolute -inset-5 rounded-[2.25rem] bg-cyan-300/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-slate-950 p-2 shadow-2xl shadow-black/30">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] bg-slate-900">
          <img
            src="/previews/produto3/anuncio-premium-preview-1x1.jpg"
            alt="Campanha imobiliária em destaque"
            className="h-full w-full scale-105 object-cover opacity-90 transition-transform duration-700 hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/70" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-slate-950">
              imagem
            </span>
            <span className="rounded-full bg-cyan-300 px-3 py-1 text-[11px] font-black text-primary-950">
              vídeo
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-3xl bg-white/95 p-4 text-slate-950 shadow-xl">
            <p className="text-[11px] font-black uppercase tracking-wide text-primary-700">Transformação pronta</p>
            <h3 className="mt-1 text-xl font-black leading-tight">
              De imóvel parado para campanha em movimento.
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductStory({ item, index }) {
  const Icon = item.icon
  const reverse = index % 2 === 1

  return (
    <section className="border-t border-white/10 bg-primary-950 text-white">
      <div className={`mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-100">
            <Icon className="h-4 w-4" />
            {item.eyebrow}
          </div>
          <h2 className="mt-5 max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {item.title}
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-cyan-50/70">
            {item.description}
          </p>
          <Link to="/cadastro" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-primary-950 hover:bg-cyan-50">
            Testar essa criação
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-[2.5rem] bg-cyan-300/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-3 shadow-2xl shadow-black/20">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-slate-900">
              {item.before?.endsWith('.mp4') ? (
                <img
                  src="/previews/produto3/anuncio-premium-preview-1x1.jpg"
                  alt={item.eyebrow}
                  className="h-full w-full scale-105 object-cover transition-transform duration-700 hover:scale-110"
                />
              ) : (
                <img src={item.before} alt={item.eyebrow} className="h-full w-full scale-105 object-cover transition-transform duration-700 hover:scale-110" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75" />
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-primary-950">
                antes
              </div>
              <div className="absolute bottom-4 left-4 right-4 rounded-3xl bg-white/95 p-4 text-slate-950">
                <p className="text-xs font-black uppercase tracking-wide text-primary-700">depois</p>
                <p className="mt-1 text-2xl font-black leading-tight">{item.afterLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomeOpusExperiment() {
  return (
    <div className="min-h-screen bg-primary-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-primary-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-black text-cyan-50/80 hover:bg-white/10">
              Entrar
            </Link>
            <Link to="/cadastro" className="rounded-xl bg-white px-4 py-2 text-sm font-black text-primary-950 hover:bg-cyan-50">
              Testar grátis
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(34,211,238,0.20),transparent_32%),linear-gradient(180deg,#082f49_0%,#06172f_58%,#031020_100%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,0.78fr)] lg:items-center lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-100">
                <Sparkles className="h-4 w-4" />
                experimento visual
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
                O imóvel ganha presença.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-cyan-50/75">
                Transforme uma ideia, uma foto ou um anúncio simples em materiais que parecem prontos para uma grande campanha.
              </p>
              <p className="mt-4 max-w-lg text-sm font-bold leading-6 text-cyan-50/60">
                Use imagens próprias ou comece só com uma ideia. A IA monta o visual, o vídeo e os materiais para divulgação.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/cadastro" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-primary-950 hover:bg-cyan-50">
                  Testar grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#demo" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 text-sm font-black text-white hover:bg-white/10">
                  Ver demonstrações
                  <PlayCircle className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-2 text-center">
                {['vender', 'alugar', 'captar'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/8 px-3 py-4">
                    <p className="text-sm font-black uppercase tracking-wide text-cyan-100">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <VisualPhone />
          </div>
        </section>

        <section id="demo" className="bg-white px-5 py-14 text-slate-950 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Demonstração</p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Não explique. Mostre a transformação.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {productStories.map(({ eyebrow, icon: Icon, title }) => (
                <div key={eyebrow} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-900 text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-wide text-primary-700">{eyebrow}</p>
                  <h3 className="mt-2 text-xl font-black leading-tight">{title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {productStories.map((item, index) => (
          <ProductStory key={item.eyebrow} item={item} index={index} />
        ))}

        <section className="bg-slate-50 px-5 py-16 text-slate-950 sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Resultado</p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Mais do que bonito. Útil para vender.
              </h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-slate-600">
                A experiência foi desenhada para fazer o corretor sair da tela com algo que pode usar na divulgação.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {outcomes.map(([title, description]) => (
                <article key={title} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <BadgeCheck className="h-6 w-6 text-primary-700" />
                  <h3 className="mt-4 text-xl font-black">{title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary-950 px-5 py-16 text-white sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_340px] lg:items-center">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-950">
                <Coins className="h-6 w-6" />
              </div>
              <h2 className="mt-5 max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Teste, veja o valor e avance no seu ritmo.
              </h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-cyan-50/70">
                Smart Tokens mantêm a experiência simples: uma capacidade única para criar imagens, vídeos, anúncios e materiais.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5">
              <p className="text-sm font-black text-cyan-100">Comece sem compromisso.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-cyan-50/70">
                Depois, adicione Smart Tokens ou escolha um plano para receber capacidade todo mês.
              </p>
              <Link to="/cadastro" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-primary-950 hover:bg-cyan-50">
                Testar grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
