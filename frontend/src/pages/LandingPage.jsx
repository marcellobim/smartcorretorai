import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  Layers3,
  LayoutTemplate,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Video,
  Zap,
} from 'lucide-react'

const products = [
  {
    name: 'Studio IA',
    description: 'Apresentações cinematográficas que valorizam cada detalhe do imóvel.',
    icon: ImagePlus,
    accent: 'from-cyan-400/20 to-blue-500/5',
  },
  {
    name: 'Carrossel de Anúncios',
    description: 'Fotos organizadas em uma narrativa elegante, dinâmica e profissional.',
    icon: Layers3,
    accent: 'from-emerald-400/20 to-teal-500/5',
  },
  {
    name: 'Banners Rápidos',
    description: 'Campanhas visuais completas, prontas para publicar em poucos minutos.',
    icon: LayoutTemplate,
    accent: 'from-violet-400/20 to-fuchsia-500/5',
  },
  {
    name: 'IA Livre',
    description: 'Inteligência criativa para transformar ideias em comunicação imobiliária.',
    icon: BrainCircuit,
    accent: 'from-amber-300/20 to-orange-500/5',
  },
]

export default function LandingPage() {
  const [submitted, setSubmitted] = useState(false)

  const handlePreviewSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
  }

  const scrollToWaitlist = () => {
    document.getElementById('lista-de-espera')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#030d1b] text-white selection:bg-blue-400 selection:text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70" aria-hidden="true">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-blue-500/15 blur-[120px]" />
        <div className="absolute -right-28 top-1/3 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-600/10 blur-[130px]" />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-[#030d1b]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="SmartCorretorAI" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/20 bg-gradient-to-br from-blue-400/20 to-cyan-300/10 text-blue-100 shadow-[0_14px_38px_-18px_rgba(59,130,246,0.8)]">
              <Zap className="h-5 w-5" />
            </span>
            <span>
              <strong className="block text-base font-black tracking-[-0.025em]">SmartCorretorAI</strong>
              <small className="block text-[10px] font-bold uppercase tracking-[0.24em] text-blue-100/50">Inteligência que vende</small>
            </span>
          </Link>

          <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200 sm:px-4 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />
            Em breve
          </span>
        </div>
      </header>

      <main className="relative z-10">
        <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.78fr)] lg:gap-16 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-white/[0.045] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-100/80 shadow-inner shadow-white/5">
              <Sparkles className="h-4 w-4 text-blue-300" />
              Inteligência que vende
            </div>

            <h1 className="mt-7 text-5xl font-black leading-[0.92] tracking-[-0.06em] text-white sm:text-7xl lg:text-[5.35rem]">
              SmartCorretor<span className="bg-gradient-to-b from-blue-300 to-blue-600 bg-clip-text text-transparent">AI</span>
            </h1>
            <h2 className="mt-7 max-w-3xl text-3xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
              A nova geração do marketing imobiliário com <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Inteligência Artificial.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
              Estamos finalizando os últimos detalhes para entregar uma plataforma que cria campanhas imobiliárias completas em poucos minutos.
            </p>

            <div className="mt-7 flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-blue-200">
              <Clock3 className="h-5 w-5" />
              Em breve.
            </div>

            <button
              type="button"
              onClick={scrollToWaitlist}
              className="group mt-9 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 px-7 py-4 text-base font-black text-white shadow-[0_22px_60px_-22px_rgba(37,99,235,0.95)] transition duration-300 hover:-translate-y-0.5 hover:from-blue-500 hover:to-cyan-400 sm:w-auto sm:px-8"
            >
              Quero ser um dos primeiros
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="mt-9 grid grid-cols-2 gap-3 text-xs font-black uppercase tracking-[0.08em] text-slate-300 sm:flex sm:flex-wrap sm:gap-x-6">
              <span className="flex items-center gap-2"><Video className="h-4 w-4 text-blue-400" />Vídeos</span>
              <span className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-blue-400" />Banners</span>
              <span className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-400" />Carrosséis</span>
              <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" />Textos</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] pb-10">
            <div className="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-blue-500/20 via-transparent to-cyan-300/10 blur-2xl" />
            <div className="relative rounded-[1.8rem] border-[10px] border-[#111b28] bg-[#07111e] p-1.5 shadow-[0_45px_110px_-35px_rgba(0,0,0,0.95)] sm:border-[14px]">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1rem] bg-slate-950">
                <img
                  src="/banners-rapidos/hero-imovel.jpg"
                  alt="Imóvel contemporâneo representando o futuro do marketing imobiliário"
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                />
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(3,13,27,0.98),rgba(3,13,27,0.7)_52%,rgba(3,13,27,0.2))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-7">
                  <div className="flex items-center gap-2 text-xs font-black"><Zap className="h-4 w-4 text-blue-400" />SmartCorretor<span className="text-blue-400">AI</span></div>
                  <div className="max-w-[76%]">
                    <p className="text-xl font-black leading-tight sm:text-3xl">Crie campanhas imobiliárias completas com <span className="text-blue-400">Inteligência Artificial.</span></p>
                    <p className="mt-3 hidden text-xs font-semibold leading-5 text-slate-300 sm:block">Vídeos, banners, carrosséis e textos prontos para divulgar seus imóveis.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {products.map(({ name, icon: Icon }) => (
                      <div key={name} className="flex aspect-[1.15] items-center justify-center rounded-xl border border-blue-300/20 bg-blue-500/10 text-blue-200 backdrop-blur-md">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-x-[-4%] bottom-3 h-10 rounded-b-[2.5rem] bg-gradient-to-b from-slate-500 to-slate-800 shadow-[0_24px_38px_-15px_rgba(0,0,0,0.9)] [clip-path:polygon(5%_0,95%_0,100%_70%,95%_100%,5%_100%,0_70%)]">
              <span className="mx-auto block h-1.5 w-24 rounded-b-xl bg-slate-900/70" />
            </div>
            <div className="absolute -right-2 top-8 rounded-2xl border border-blue-300/20 bg-[#0b1b34]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:-right-7">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Status</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-black"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />Últimos ajustes</p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Produtos em destaque</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">Tudo o que o corretor precisa para criar e divulgar.</h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map(({ name, description, icon: Icon, accent }, index) => (
                <article key={name} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/25 hover:bg-white/[0.065]">
                  <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${accent}`} />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-100">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="text-xs font-black text-white/25">0{index + 1}</span>
                    </div>
                    <h3 className="mt-7 text-xl font-black tracking-tight text-white">{name}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">{description}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
                      <Sparkles className="h-3.5 w-3.5" />Em preparação
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="lista-de-espera" className="relative py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,0.7fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                <ShieldCheck className="h-4 w-4" />Lista de espera oficial
              </div>
              <h2 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl">Seja avisado antes de todo mundo.</h2>
              <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-slate-300">
                Entre para a lista de pré-lançamento e receba a novidade assim que o SmartCorretorAI estiver disponível.
              </p>
              <div className="mt-8 space-y-3 text-sm font-bold text-slate-300">
                <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-300" />Aviso antecipado do lançamento</p>
                <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-300" />Nenhuma mensagem desnecessária</p>
                <p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-300" />Seus dados tratados com cuidado</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/[0.07] p-5 shadow-[0_32px_90px_-40px_rgba(34,211,238,0.55)] backdrop-blur-xl sm:p-8">
              {!submitted ? (
                <form onSubmit={handlePreviewSubmit} className="space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Quero participar</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Reserve seu lugar na lista.</h3>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-200">Nome</span>
                    <span className="relative block">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input required autoComplete="name" name="name" placeholder="Seu nome" className="w-full rounded-2xl border border-white/10 bg-[#071a28]/80 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10" />
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-200">E-mail</span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input required type="email" autoComplete="email" name="email" placeholder="voce@exemplo.com" className="w-full rounded-2xl border border-white/10 bg-[#071a28]/80 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10" />
                    </span>
                  </label>

                  <button type="submit" className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 px-6 py-4 text-base font-black text-white shadow-[0_18px_44px_-20px_rgba(37,99,235,0.95)] transition hover:from-blue-500 hover:to-cyan-400">
                    Quero ser um dos primeiros
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </button>

                  <p className="rounded-xl border border-amber-200/15 bg-amber-200/5 px-3 py-2.5 text-center text-[11px] font-bold leading-5 text-amber-100/70">
                    Prévia local para aprovação visual. Nesta etapa, nenhum dado é enviado ou armazenado.
                  </p>
                </form>
              ) : (
                <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/15 text-emerald-200 shadow-[0_18px_50px_-22px_rgba(52,211,153,0.9)]">
                    <CheckCircle2 className="h-8 w-8" />
                  </span>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Prévia da confirmação</p>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-white">Cadastro realizado com sucesso.</h3>
                  <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-300">Avisaremos você assim que o SmartCorretorAI estiver disponível.</p>
                  <p className="mt-6 rounded-xl border border-amber-200/15 bg-amber-200/5 px-4 py-3 text-xs font-bold leading-5 text-amber-100/70">Demonstração visual local — nenhum dado foi gravado.</p>
                  <button type="button" onClick={() => setSubmitted(false)} className="mt-6 text-sm font-black text-cyan-200 transition hover:text-cyan-100">Voltar ao formulário</button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 text-sm font-semibold text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><Zap className="h-4 w-4" /></span>
            <span className="font-black">SmartCorretorAI</span>
          </div>
          <p>© 2026 SmartCorretorAI. A nova geração do marketing imobiliário.</p>
          <div className="flex gap-5">
            <Link to="/termos" className="transition hover:text-white">Termos</Link>
            <Link to="/privacidade" className="transition hover:text-white">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
