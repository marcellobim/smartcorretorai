import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  Image,
  Layers3,
  MessageSquareText,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'

const visualExamples = [
  {
    title: 'Imagem principal para anúncio',
    label: 'Hero IA',
    type: 'image',
    src: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
  },
  {
    title: 'Vídeo do imóvel',
    label: 'Studio Hero',
    type: 'video',
    src: '/previews/produto3/story-premium-preview-1x1.mp4',
  },
  {
    title: 'Anúncio pronto',
    label: 'Banners Rápidos',
    type: 'video',
    src: '/previews/produto3/imovel-detalhes-preview-1x1.mp4',
  },
  {
    title: 'Vídeo com movimento',
    label: 'Visual de impacto',
    type: 'video',
    src: '/previews/produto3/video-tour-preview-1x1.mp4',
  },
]

const creationPaths = [
  {
    icon: Sparkles,
    title: '✨ Criar imagem principal que chama atenção',
    desc: 'Transforme fotos do imóvel em imagens profissionais para anúncios e redes sociais.',
  },
  {
    icon: Video,
    title: '🎬 Transformar imóvel em vídeo profissional',
    desc: 'Crie vídeos prontos para Instagram, Facebook, TikTok e WhatsApp.',
  },
  {
    icon: Image,
    title: '📢 Criar anúncios prontos para publicar',
    desc: 'Gere campanhas profissionais para divulgar seus imóveis.',
  },
  {
    icon: MessageSquareText,
    title: '📝 Gerar material para divulgação',
    desc: 'Descrições, contatos, hashtags e conteúdos prontos para publicar.',
  },
]

const campaignProfiles = [
  {
    title: '🏠 Venda de imóveis',
    desc: 'Campanhas para atrair compradores, gerar mais visitas e vender mais.',
  },
  {
    title: '🔑 Locação de imóveis',
    desc: 'Divulgação para encontrar locatários e alugar com mais rapidez.',
  },
  {
    title: '📋 Captação de imóveis',
    desc: 'Materiais para conquistar novos proprietários e aumentar sua carteira.',
  },
  {
    title: '🤝 Recrutamento de profissionais',
    desc: 'Atraia corretores, captadores, gerentes e outros talentos para sua equipe.',
  },
]

const steps = [
  {
    icon: MessageSquareText,
    title: 'Conte o que quer divulgar',
    desc: 'Escolha o objetivo, envie as fotos e responda perguntas simples sobre o imóvel.',
  },
  {
    icon: Wand2,
    title: 'A IA prepara o material',
    desc: 'A plataforma organiza imagem, vídeo, anúncios e textos com aparência profissional.',
  },
  {
    icon: BadgeCheck,
    title: 'Publique com confiança',
    desc: 'Use os materiais nas redes sociais, no WhatsApp e nos atendimentos do dia a dia.',
  },
]

const stats = [
  ['Sem designer', 'materiais em minutos'],
  ['Pronto para redes', 'visual moderno'],
  ['Texto pronto', 'menos esforço'],
]

function PreviewCard({ item, className = '' }) {
  return (
    <article className={`overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl shadow-primary-900/5 ${className}`}>
      <div className="aspect-square bg-slate-100">
        {item.type === 'video' ? (
          <video
            src={item.src}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <img src={item.src} alt={item.title} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="border-t border-blue-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-primary-600">{item.label}</p>
        <h3 className="mt-1 text-sm font-black text-slate-950">{item.title}</h3>
      </div>
    </article>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="sticky top-0 z-50 border-b border-blue-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-800 text-cyan-100">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-sm font-black tracking-tight text-gray-950 sm:text-base">SmartCorretorAI</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a href="#como-funciona" className="hover:text-primary-800">Como funciona</a>
            <a href="#exemplos" className="hover:text-primary-800">Exemplos</a>
            <a href="#criar" className="hover:text-primary-800">O que criar</a>
            <Link to="/planos" className="hover:text-primary-800">Smart Tokens</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-primary-50 hover:text-primary-800">
              Entrar
            </Link>
            <Link to="/cadastro" className="rounded-xl bg-primary-800 px-4 py-2 text-sm font-black text-white hover:bg-primary-700">
              Testar grátis
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-50 via-white to-primary-50">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(236,254,255,0.66)),radial-gradient(circle_at_84%_10%,rgba(14,116,144,0.15),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.85fr)] lg:items-center lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-700 shadow-sm">
                <Sparkles className="h-4 w-4 text-primary-600" />
                Marketing imobiliário com IA
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-6xl">
                Transforme qualquer imóvel em uma campanha profissional em minutos.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                Crie imagens, vídeos, anúncios e materiais de divulgação com ajuda da IA.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
                Crie campanhas profissionais sem depender de designers, agências ou cursos complicados. A IA faz o trabalho pesado para você.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  '✨ Criar imagem principal que chama atenção',
                  '🎬 Transformar imóvel em vídeo profissional',
                  '📢 Criar anúncios prontos para publicar',
                  '📝 Gerar material para divulgação',
                ].map(item => (
                  <Link
                    key={item}
                    to="/cadastro"
                    className="group flex items-center justify-between rounded-2xl border border-blue-100 bg-white px-4 py-3 text-left text-sm font-black text-primary-900 shadow-sm transition hover:border-primary-200 hover:bg-primary-50"
                  >
                    <span>{item}</span>
                    <ChevronRight className="h-4 w-4 text-primary-600 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/cadastro" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-800 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-primary-900/10 hover:bg-primary-700">
                  Testar grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#exemplos" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-6 py-3.5 text-sm font-black text-primary-800 hover:bg-primary-50">
                  Ver exemplos
                  <PlayCircle className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                {stats.map(([value, label]) => (
                  <div key={value} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                    <p className="text-sm font-black text-slate-950">{value}</p>
                    <p className="mt-1 text-xs font-semibold leading-snug text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto w-full max-w-[430px] lg:ml-auto">
              <div className="rounded-[2rem] border border-white bg-white p-3 shadow-2xl shadow-primary-900/12">
                <div className="overflow-hidden rounded-[1.55rem] bg-slate-950">
                  <div className="relative aspect-[9/16]">
                    <img
                      src="/previews/produto3/anuncio-premium-preview-1x1.jpg"
                      alt="Exemplo de campanha imobiliária profissional"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                      <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-black text-slate-950">
                        Vídeo do imóvel
                      </span>
                      <span className="rounded-full bg-primary-900/80 px-3 py-1 text-xs font-black text-white">
                        pronto para divulgar
                      </span>
                    </div>
                    <div className="absolute inset-x-4 bottom-4 rounded-3xl bg-white/92 p-4 shadow-xl">
                      <p className="text-xs font-black uppercase tracking-wide text-primary-700">Resultado em minutos</p>
                      <h3 className="mt-1 text-xl font-black leading-tight text-slate-950">Seu imóvel com cara de campanha profissional.</h3>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-primary-900">
                        <span className="rounded-2xl bg-primary-50 px-3 py-2">Imagem</span>
                        <span className="rounded-2xl bg-primary-50 px-3 py-2">Vídeo</span>
                        <span className="rounded-2xl bg-primary-50 px-3 py-2">Anúncios</span>
                        <span className="rounded-2xl bg-primary-50 px-3 py-2">Textos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Como funciona</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                Menos esforço para o corretor. Mais consistência no marketing.
              </h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, desc }, index) => (
                <article key={title} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-black text-gray-300">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-black text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="exemplos" className="bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-primary-700">Exemplos visuais</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Veja o tipo de material que você pode criar.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-500">
                A ideia é simples: você envia informações e imagens do imóvel, e recebe materiais com aparência profissional para divulgar.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <article className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-sm">
                <p className="px-2 pt-2 text-xs font-black uppercase tracking-wide text-primary-700">Hero IA</p>
                <h3 className="px-2 pt-2 text-xl font-black text-slate-950">Antes e depois da imagem principal</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <PreviewCard item={visualExamples[0]} />
                  <div className="flex min-h-[230px] flex-col justify-end rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-900 to-primary-600 p-5 text-white">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Depois</p>
                    <p className="mt-2 text-lg font-black leading-tight">Imagem com presença de anúncio profissional.</p>
                  </div>
                </div>
              </article>

              <article className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-sm">
                <p className="px-2 pt-2 text-xs font-black uppercase tracking-wide text-primary-700">Studio Hero</p>
                <h3 className="px-2 pt-2 text-xl font-black text-slate-950">Vídeos do imóvel para redes sociais</h3>
                <div className="mt-5 overflow-hidden rounded-2xl bg-slate-950">
                  <video
                    src="/previews/studio-hero/moema-demo.mp4"
                    muted
                    playsInline
                    loop
                    autoPlay
                    preload="metadata"
                    className="aspect-video w-full object-cover"
                  />
                </div>
                <p className="mt-4 px-2 text-sm font-semibold leading-6 text-slate-500">
                  Fotos estáticas ganham movimento, ritmo e uma apresentação mais envolvente.
                </p>
              </article>

              <article className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-sm">
                <p className="px-2 pt-2 text-xs font-black uppercase tracking-wide text-primary-700">Banners Rápidos</p>
                <h3 className="px-2 pt-2 text-xl font-black text-slate-950">Campanhas prontas para publicar</h3>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <PreviewCard item={visualExamples[1]} />
                  <PreviewCard item={visualExamples[2]} />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="criar" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">O que você pode criar</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                Uma central de criação para o marketing do imóvel
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                Comece pelo resultado desejado. A plataforma guia o restante.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {creationPaths.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Objetivos</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                Escolha o que você quer conquistar
              </h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {campaignProfiles.map(profile => (
                <article key={profile.title} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-gray-950">{profile.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{profile.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-primary-900/5">
              <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-primary-700">Smart Tokens</p>
                  <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    Crie no seu ritmo, sem escolher produto avulso.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Hero IA, Studio Hero e Banners Rápidos usam a mesma carteira de Smart Tokens. Adicione Smart Tokens quando precisar ou assine um dos nossos planos para receber capacidade todos os meses.
                  </p>
                </div>
                <div className="rounded-3xl border border-primary-100 bg-primary-50 p-5">
                  <p className="text-sm font-black text-slate-950">Teste grátis com desejo real</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    Veja exemplos, conheça os fluxos e experimente recursos leves. Vídeos premium ficam disponíveis para assinantes ou usuários com Smart Tokens suficientes.
                  </p>
                  <Link to="/planos" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-800 px-5 py-3 text-sm font-black text-white hover:bg-primary-700">
                    Ver Smart Tokens
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
            <p className="text-xs font-black uppercase tracking-wide text-primary-700">Próximo passo</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Seu próximo imóvel pode sair com uma campanha pronta hoje.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500">
              Crie sua conta, escolha o que deseja divulgar e veja como a plataforma prepara materiais profissionais para o seu imóvel.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/cadastro" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-800 px-7 py-4 text-sm font-black text-white hover:bg-primary-700">
                Testar grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 px-7 py-4 text-sm font-black text-primary-800 hover:bg-primary-50">
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-sm font-semibold text-gray-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-800 text-cyan-100">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-black text-gray-950">SmartCorretorAI</span>
          </div>
          <p>© 2026 SmartCorretorAI. Marketing imobiliário com IA.</p>
          <div className="flex gap-5">
            <Link to="/termos" className="hover:text-gray-950">Termos</Link>
            <Link to="/privacidade" className="hover:text-gray-950">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
