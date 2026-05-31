import { Link } from 'react-router-dom'
import {
  Zap, Sparkles, Image, Video, FileText, Share2,
  ArrowRight, Building2, Star, ChevronRight,
} from 'lucide-react'

const features = [
  {
    icon: Image,
    title: 'Banners Profissionais',
    desc: 'Banners personalizados para Instagram, Facebook, WhatsApp e mais, gerados em segundos com IA.',
  },
  {
    icon: Video,
    title: 'Vídeos Automáticos',
    desc: 'Vídeos de apresentação do imóvel com trilha sonora e narração gerados automaticamente.',
  },
  {
    icon: FileText,
    title: 'Textos Persuasivos',
    desc: 'Descrições, legendas e chamadas para ação otimizadas para cada rede social.',
  },
  {
    icon: Share2,
    title: 'Todas as Redes Sociais',
    desc: 'Instagram, Facebook, WhatsApp, TikTok, YouTube e LinkedIn — tudo no tamanho certo.',
  },
]

const testimonials = [
  { name: 'Marcos Oliveira', role: 'Corretor · São Paulo', text: 'Economizo 4 horas por semana. A IA gera tudo que eu precisava contratar um designer.' },
  { name: 'Ana Paula Lima', role: 'Corretora · Rio de Janeiro', text: 'Minhas publicações ficaram muito mais profissionais. As vendas aumentaram 30% em 2 meses.' },
  { name: 'Ricardo Santos', role: 'Imobiliária · Curitiba', text: 'Toda a equipe usa. A produção de conteúdo da nossa imobiliária triplicou.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">SmartCorretorAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funcionalidades" className="hover:text-gray-900 transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-gray-900 transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-gray-900 transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link to="/cadastro" className="btn-primary text-sm px-4 py-2">
              Campanha grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-white/80 text-sm mb-8 border border-white/20">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            ✨ Inteligência Artificial Multimodelo
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight text-balance">
            Marketing imobiliário{' '}
            <span className="text-yellow-300">em segundos</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto text-balance">
            Crie campanhas imobiliárias profissionais em minutos.<br />
            Escolha os formatos que deseja e utilize seus créditos de forma inteligente.<br />
            Sem designer. Sem esforço.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/cadastro" className="btn-primary text-base px-8 py-3.5 shadow-xl shadow-primary-900/40">
              Gerar campanha demonstrativa
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#funcionalidades" className="flex items-center gap-2 text-white/80 hover:text-white font-medium transition-colors">
              Ver como funciona
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-4 text-sm text-white/50">1 campanha demonstrativa gratuita</p>
          <p className="mt-2 text-sm text-white/60">Teste o SmartCorretorAI sem cartão e gere sua primeira campanha.</p>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L1440 60L1440 30C1320 55 1200 65 1080 55C960 45 840 10 720 5C600 0 480 15 360 30C240 45 120 55 0 50V60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Tudo que você precisa para vender mais</h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">Do cadastro do imóvel ao pacote de marketing completo, tudo automatizado com inteligência artificial.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Simples como 1, 2, 3</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Building2, title: 'Cadastre o imóvel', desc: 'Adicione fotos, descrição, preço e localização do imóvel na plataforma.' },
              { step: '02', icon: Sparkles, title: 'IA gera o pacote', desc: 'Nossa IA cria banners, vídeos e textos otimizados para cada rede social automaticamente.' },
              { step: '03', icon: Share2, title: 'Publique e venda', desc: 'Baixe todos os arquivos prontos e publique nas redes sociais em segundos.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-accent-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {step}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Planos e Preços</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Simples, sem surpresas</h2>
            <p className="mt-4 text-gray-500">Teste o SmartCorretorAI sem cartão e gere sua primeira campanha.</p>
          </div>
          <div className="flex justify-center">
            <Link to="/planos" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-primary-500/20">
              Ver planos e créditos
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Depoimentos</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Quem usa, aprova</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">"{t.text}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 gradient-hero">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">
            Comece a vender mais hoje
          </h2>
          <p className="mt-4 text-white/70 text-lg">
            Grátis para começar. Sem cartão de crédito. Pronto em 2 minutos.
          </p>
          <Link to="/cadastro" className="mt-8 inline-flex items-center gap-2 btn-primary text-base px-8 py-4 shadow-2xl shadow-primary-900/40">
            Criar minha conta grátis
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 gradient-primary rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">SmartCorretorAI</span>
            </div>
            <p className="text-sm">© 2026 SmartCorretorAI. Todos os direitos reservados.</p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/termos" className="hover:text-white transition-colors">Termos</Link>
              <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
              <a href="mailto:contato@smartcorretorai.com.br" className="hover:text-white transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
