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
    title: 'Campanha de venda',
    label: 'IA criando campanha',
    type: 'image',
    src: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
  },
  {
    title: 'Peça para redes sociais',
    label: 'Formato guiado',
    type: 'video',
    src: '/previews/produto3/story-premium-preview-1x1.mp4',
  },
  {
    title: 'Argumento visual do imóvel',
    label: 'Estratégia da campanha',
    type: 'video',
    src: '/previews/produto3/imovel-detalhes-preview-1x1.mp4',
  },
  {
    title: 'Campanha com movimento',
    label: 'Visual de impacto',
    type: 'video',
    src: '/previews/produto3/video-tour-preview-1x1.mp4',
  },
]

const creationPaths = [
  {
    icon: Sparkles,
    title: 'Hero IA',
    desc: 'Crie uma peça visual de impacto para destacar o imóvel e abrir a conversa com o cliente.',
  },
  {
    icon: Video,
    title: 'Studio Hero',
    desc: 'Transforme fotos em um vídeo cinematográfico para redes sociais e atendimento.',
  },
  {
    icon: Image,
    title: 'Banners Rápidos',
    desc: 'Use modelos profissionais para criar materiais consistentes quando precisar de agilidade.',
  },
]

const campaignProfiles = [
  {
    title: 'Popular / Minha Casa Minha Vida',
    desc: 'Comunicação direta, oportunidade clara e foco em facilitar o primeiro contato.',
    cta: 'Simular interesse',
  },
  {
    title: 'Imóvel usado',
    desc: 'Destaque de localização, diferenciais reais e argumentos para visita.',
    cta: 'Agendar visita',
  },
  {
    title: 'Médio padrão',
    desc: 'Linguagem comercial, objetiva e equilibrada para redes e portais.',
    cta: 'Solicitar detalhes',
  },
  {
    title: 'Alto padrão',
    desc: 'Visual mais sofisticado, texto elegante e foco em exclusividade.',
    cta: 'Conhecer o imóvel',
  },
  {
    title: 'Investidor',
    desc: 'Argumentos racionais, potencial de valorização e leitura de oportunidade.',
    cta: 'Receber análise',
  },
  {
    title: 'Lançamento',
    desc: 'Construção de desejo, chamada para pré-venda e captação de leads.',
    cta: 'Entrar na lista',
  },
]

const steps = [
  {
    icon: MessageSquareText,
    title: 'Responda um briefing guiado',
    desc: 'A IA pergunta o essencial sobre o imóvel, público, objetivo, valores, fotos e canal de uso.',
  },
  {
    icon: Wand2,
    title: 'A IA monta a estratégia',
    desc: 'O sistema transforma suas respostas em direção visual, headline, CTA e textos da campanha.',
  },
  {
    icon: BadgeCheck,
    title: 'Receba peças prontas para uso',
    desc: 'Você recebe imagens e textos organizados por canal, prontos para publicar, enviar ou adaptar.',
  },
]

const stats = [
  ['Briefing guiado', 'sem formulário complicado'],
  ['Peças por canal', 'feed, story, WhatsApp e mais'],
  ['Textos prontos', 'legendas, CTA e mensagens'],
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(14,116,144,0.12),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(224,242,254,0.8),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-700 shadow-sm">
                <Sparkles className="h-4 w-4 text-primary-600" />
                Marketing imobiliário com IA
              </div>
              <h1 className="mt-7 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-6xl">
                Crie campanhas imobiliárias com aparência profissional
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Comece com Hero IA, Studio Hero ou Banners Rápidos. A plataforma guia você e transforma dados, fotos e contexto do imóvel em materiais prontos para divulgar.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {['Criar Hero IA', 'Criar vídeo do imóvel', 'Gerar banners rápidos', 'Receber textos prontos'].map(item => (
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

            <div className="relative min-h-[520px]">
              <PreviewCard item={visualExamples[0]} className="absolute left-0 top-5 w-[54%]" />
              <PreviewCard item={visualExamples[1]} className="absolute right-0 top-0 w-[48%]" />
              <PreviewCard item={visualExamples[2]} className="absolute bottom-8 left-10 w-[46%]" />
              <div className="absolute bottom-0 right-0 w-[50%] rounded-3xl border border-blue-100 bg-white p-4 shadow-2xl">
                <p className="text-xs font-black uppercase tracking-wide text-primary-600">Fluxo guiado</p>
                <h3 className="mt-2 text-lg font-black text-slate-950">Do briefing à campanha pronta</h3>
                <div className="mt-4 space-y-3">
                  {['Chat guiado', 'Estratégia da campanha', 'Peças para publicar'].map(item => (
                    <p key={item} className="flex items-center gap-2 text-sm font-bold text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {item}
                    </p>
                  ))}
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

        <section id="exemplos" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-primary-700">Exemplos visuais</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Campanhas criadas para vender a ideia do imóvel.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-500">
                Os exemplos mostram como a IA organiza imagem, promessa, CTA e canal de uso. Não é só visual pronto: é direção de campanha.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visualExamples.map(item => (
                <PreviewCard key={item.title} item={item} />
              ))}
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

        <section className="bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-primary-900/5 sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-primary-700">Briefing guiado</p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                    A IA entende o imóvel antes de criar.
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-slate-500">
                    Em vez de pedir que o corretor escolha um modelo visual, o SmartCorretorAI conduz perguntas simples e monta a estratégia da campanha.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['Chat guiado', 'Fotos e contexto', 'Estratégia da campanha', 'CTA por canal', 'Textos prontos', 'Peças por formato'].map(item => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-primary-50 p-4 text-sm font-bold text-primary-900">
                      <ShieldCheck className="h-5 w-5 text-primary-700" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Perfis de campanha</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
                Linguagem certa para cada imóvel
              </h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {campaignProfiles.map(profile => (
                <article key={profile.title} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-gray-950">{profile.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{profile.desc}</p>
                  <div className="mt-5 inline-flex rounded-full border border-blue-100 bg-primary-50 px-3 py-1 text-xs font-black text-primary-800">
                    Chamada: {profile.cta}
                  </div>
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
                    Hero IA, Studio Hero e Banners Rápidos usam a mesma carteira de Smart Tokens. Você entra, vê exemplos, testa a plataforma e adiciona capacidade quando quiser continuar criando.
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
              Crie sua conta, responda o briefing guiado e deixe a IA preparar a primeira entrega.
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
