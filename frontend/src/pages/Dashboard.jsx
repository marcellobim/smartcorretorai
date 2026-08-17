import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Box,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileText,
  Gauge,
  Image as ImageIcon,
  Minus,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'
import Header from '../components/layout/Header'
import AppFooter from '../components/layout/AppFooter'
import {
  ProductButton,
  ProductCard,
  ProductSectionHeading,
  SMART_UI,
} from '../components/design-system'
import VIRTUAL_STAGING_BEFORE_IMAGE from '../../../assets-imoveis/apartamento-vazio-02/virtual-staging-antes.jpg'
import VIRTUAL_STAGING_AFTER_IMAGE from '../../../assets-imoveis/apartamento-vazio-02/virtual-staging-pos.png'

const PLANS_ROUTE = '/planos'
const SMART_TOKENS_LABEL = ['Smart', 'Tokens'].join(' ')
const HOME_PAGE_CLASS = 'mx-auto w-full max-w-[92rem] px-smart-page py-6 sm:py-8'

const mainActions = [
  {
    id: 'smart-tour-ai',
    title: 'Vídeo Imobiliário',
    description: 'Transforme as fotos do imóvel em um vídeo pronto para apresentar e divulgar.',
    to: '/smart-tour-ai',
    label: 'Criar vídeo',
    tone: 'violet',
    icon: Video,
  },
  {
    id: 'hero-ia',
    title: 'Banner Imobiliário',
    description: 'Crie uma peça visual profissional para destacar o imóvel em anúncios e redes sociais.',
    to: '/hero',
    label: 'Criar Banner',
    tone: 'mint',
    icon: ImageIcon,
  },
  {
    id: 'studio-hero',
    title: 'Studio IA',
    description: 'Produza comerciais, vídeos criativos e carrosséis para campanhas com mais presença.',
    to: '/studio-hero',
    label: 'Abrir Studio IA',
    tone: 'blue',
    icon: Wand2,
  },
  {
    id: 'virtual-staging',
    title: 'Virtual Space',
    description: 'Transforme ambientes e apresente novas possibilidades para cada espaço do imóvel.',
    to: '/virtual-staging',
    label: 'Criar projeto',
    tone: 'cyan',
    icon: Box,
  },
  {
    id: 'banners-rapidos',
    title: 'Banners Rápidos',
    description: 'Monte materiais consistentes a partir de modelos profissionais.',
    to: '/nova-campanha',
    label: 'Criar banners',
    tone: 'peach',
    icon: Zap,
  },
  {
    id: 'campanha-de-textos',
    title: 'Campanha de Textos',
    description: 'Prepare textos para portais, redes sociais, WhatsApp e outros canais.',
    to: '/campanha-de-textos',
    label: 'Criar campanha',
    tone: 'gold',
    icon: FileText,
  },
]

const productTones = Object.freeze({
  violet: 'bg-violet-500',
  mint: 'bg-emerald-500',
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  peach: 'bg-orange-500',
  gold: 'bg-amber-500',
})

const heroMediaItems = [
  {
    id: 'video-imobiliario',
    label: 'Vídeo Imobiliário',
    src: '/demos-videos/animar-imagens.mp4',
    type: 'video',
  },
  {
    id: 'banner-imobiliario',
    label: 'Banner Imobiliário',
    src: '/showcase/hero/hero-principal 1.jpg',
    type: 'image',
  },
  {
    id: 'virtual-space',
    label: 'Virtual Space',
    beforeSrc: VIRTUAL_STAGING_BEFORE_IMAGE,
    src: VIRTUAL_STAGING_AFTER_IMAGE,
    type: 'comparison',
  },
  {
    id: 'studio-ia',
    label: 'Studio IA',
    src: '/showcase/smartcarrossel/showcase-carrossel.mp4',
    type: 'video',
  },
  {
    id: 'banners-rapidos',
    label: 'Banners Rápidos',
    src: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    type: 'image',
  },
]

const benefits = [
  {
    icon: Gauge,
    title: 'Agilidade com qualidade',
    description: 'Fluxos guiados para criar com clareza e avançar sem etapas desnecessárias.',
  },
  {
    icon: ShieldCheck,
    title: 'Seguro e privado',
    description: 'Acesso protegido pela sua conta e controle sobre os materiais enviados.',
  },
  {
    icon: Coins,
    title: 'Economia inteligente',
    description: 'Use seus Smart Tokens conforme o recurso escolhido para cada criação.',
  },
  {
    icon: BadgeCheck,
    title: 'Materiais prontos para divulgar',
    description: 'Baixe, revise e publique nos canais adequados para o seu imóvel.',
  },
]

const faqItems = [
  {
    question: 'Qual produto devo usar para o que preciso criar?',
    answer: 'Para vídeos do imóvel, use Vídeo Imobiliário. Banner Imobiliário cria uma campanha visual guiada, enquanto Banners Rápidos parte de modelos profissionais. Studio IA atende produções visuais e criativas, Virtual Space transforma e apresenta ambientes, e Campanha de Textos prepara conteúdo escrito para diferentes canais. Produtos elegíveis também podem entregar conteúdo textual preparado para uso manual no Google Ads.',
  },
  {
    question: `Preciso assinar um plano ou posso comprar ${SMART_TOKENS_LABEL} quando precisar?`,
    answer: `Você pode escolher um plano para uso frequente ou adquirir ${SMART_TOKENS_LABEL} separadamente quando precisar de mais capacidade. Consulte sua contratação em Configurações → Plano e Assinatura; para saldo e capacidade adicional, use Smart Tokens na Sidebar.`,
    link: { to: PLANS_ROUTE, label: `Ir para ${SMART_TOKENS_LABEL}` },
  },
  {
    question: `Como funcionam os ${SMART_TOKENS_LABEL}? E se uma geração der erro?`,
    answer: `${SMART_TOKENS_LABEL} são usados nas criações conforme o recurso escolhido. Quando uma geração falha ou não é concluída corretamente, a reserva é cancelada e os tokens não são consumidos; você não precisa solicitar estorno manual por essa criação.`,
    link: { to: PLANS_ROUTE, label: `Ir para ${SMART_TOKENS_LABEL} na Sidebar` },
  },
  {
    question: 'Quais são os planos do SmartCorretorAI?',
    answer: 'Os planos são indicados principalmente para quem cria com frequência e oferecem capacidade recorrente conforme a opção contratada. Consulte seu plano atual em Configurações → Plano e Assinatura, onde também há acesso às condições disponíveis.',
    link: { to: '/configuracoes?tab=plano', label: 'Ver Plano e Assinatura' },
  },
  {
    question: 'Posso cancelar minha assinatura quando quiser?',
    answer: 'O cancelamento pode ser solicitado a qualquer momento, com efeito ao final do período vigente, conforme os Termos de Uso. Em Configurações → Plano e Assinatura você consulta o plano atual, mas o cancelamento direto pela conta ainda não está disponível nesta versão; para solicitar, fale com o suporte.',
    link: { to: '/configuracoes?tab=plano', label: 'Ver Plano e Assinatura' },
  },
  {
    question: `Meus ${SMART_TOKENS_LABEL} expiram?`,
    answer: `${SMART_TOKENS_LABEL} comprados separadamente, fora do plano, não expiram. Os tokens incluídos em assinaturas seguem as condições do ciclo e da oferta contratada.`,
    link: { to: PLANS_ROUTE, label: `Ir para ${SMART_TOKENS_LABEL}` },
  },
  {
    question: 'Como publico minhas criações nas redes sociais?',
    answer: 'Finalize e revise a criação, baixe o material e copie o texto preparado, quando houver. Depois, abra o canal desejado, anexe a imagem ou o vídeo, cole o texto, revise novamente e publique manualmente.',
  },
  {
    question: 'Onde altero meu e-mail de acesso ou minha senha?',
    answer: 'O e-mail profissional fica em Configurações → Cadastro e pode ser usado nos seus materiais. Em Configurações → Acesso e Senha você identifica o e-mail de acesso/login e pode definir uma nova senha. A troca do e-mail de acesso não está disponível nessa tela.',
    link: { to: '/configuracoes?tab=acesso', label: 'Ir para Acesso e Senha' },
  },
  {
    question: 'Minhas criações ficam salvas?',
    answer: 'O SmartCorretorAI não oferece galeria ou armazenamento permanente. Baixe e salve sua criação assim que ela estiver pronta. Resultados e arquivos podem existir temporariamente por necessidade técnica, mas não há promessa de recuperação posterior pela interface; guarde localmente todo material que quiser conservar.',
  },
  {
    question: 'O SmartCorretorAI altera meus dados profissionais automaticamente?',
    answer: 'Não. Nome, telefone ou WhatsApp, e-mail profissional e CRECI são controlados por você em Configurações → Cadastro. Atualize esses dados sempre que necessário para que os produtos possam utilizar as informações corretas quando o layout comportar.',
    link: { to: '/configuracoes?tab=cadastro', label: 'Ir para Cadastro' },
  },
  {
    question: 'Quem é responsável pelas imagens, vídeos e materiais que eu envio?',
    answer: 'Você é responsável pelo conteúdo enviado e deve possuir as autorizações ou os direitos necessários para usar imagens, vídeos, marcas, textos e outros materiais. O SmartCorretorAI não transfere esses direitos para sua conta.',
    link: { to: '/termos', label: 'Ver Termos de Uso' },
  },
  {
    question: 'A inteligência artificial pode cometer erros ou alterar algum detalhe?',
    answer: 'Sim. Conteúdos gerados com IA podem apresentar erros, imprecisões ou variações. Revise as informações do imóvel, os textos e os elementos visuais antes de divulgar ou publicar o material.',
  },
  {
    question: 'Ainda ficou com alguma dúvida ou quer falar com a gente?',
    answer: 'Se você tiver dúvidas, sugestões, precisar de ajuda ou quiser nos contar sobre algum problema, entre em contato com nossa equipe. Vamos analisar sua mensagem e responder assim que possível.',
    link: { href: 'mailto:suporte@smartcorretorai.com.br', label: 'Falar com o SmartCorretorAI' },
  },
]

export default function Dashboard() {
  return (
    <div className="min-w-0">
      <Header title="Home" subtitle="Sua central de criação imobiliária" />

      <main className={`${HOME_PAGE_CLASS} min-w-0`}>
        <ProductCard className="overflow-hidden border-slate-200 bg-white p-5 shadow-[0_28px_75px_-55px_rgba(15,23,42,0.38)] sm:p-7 lg:p-9">
          <div data-home-hero className="grid min-w-0 gap-8 lg:grid-cols-[minmax(350px,0.9fr)_minmax(480px,1.1fr)] lg:items-center">
            <div className="max-w-xl">
              <h1 className="text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl lg:text-[2.6rem] lg:leading-[1.08] xl:text-[2.85rem]">
              O que vamos criar para o seu imóvel hoje?
              </h1>
              <p className={`${SMART_UI.body} mt-4 max-w-lg`}>
                Crie vídeos, imagens e campanhas profissionais para apresentar e divulgar seus imóveis.
              </p>
            </div>

            <HeroMediaShowcase />
          </div>
        </ProductCard>

        <section className="mt-8" aria-labelledby="home-products-title">
          <ProductSectionHeading
            id="home-products-title"
            title="O que você quer criar hoje?"
          />

          <div data-home-product-grid className="mt-5 grid min-w-0 auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mainActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </section>

        <ProductCard data-home-benefits className="mt-8 grid overflow-hidden border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
          {benefits.map((benefit, index) => (
            <BenefitItem key={benefit.title} benefit={benefit} divided={index > 0} />
          ))}
        </ProductCard>

        <section className="mt-5" aria-labelledby="home-faq-title">
          <ProductCard as="details" onToggle={handleFaqSectionToggle} className="group/faq-section overflow-hidden border-slate-200 bg-white" data-home-faq>
            <summary onKeyDown={handleFaqSectionSummaryKeyDown} className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:hidden sm:px-6 ${SMART_UI.focus}`}>
              <h2 id="home-faq-title" className="text-base font-black text-slate-950 sm:text-lg">Perguntas frequentes</h2>
              <Plus className="h-5 w-5 shrink-0 text-primary-600 group-open/faq-section:hidden" aria-hidden="true" />
              <Minus className="hidden h-5 w-5 shrink-0 text-primary-600 group-open/faq-section:block" aria-hidden="true" />
            </summary>
            <div className="border-t border-slate-200">
              {faqItems.map(item => (
                <FaqItem key={item.question} item={item} />
              ))}
            </div>
          </ProductCard>
        </section>
      </main>
      <AppFooter />
    </div>
  )
}

function HeroMediaShowcase() {
  const [activeIndex, setActiveIndex] = useState(1)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [isUserPaused, setIsUserPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const touchStartX = useRef(null)
  const totalItems = heroMediaItems.length
  const isPaused = isHovered || isFocused || isTouching || isUserPaused || prefersReducedMotion

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (isPaused) return undefined
    const timer = window.setTimeout(() => {
      setActiveIndex(current => (current + 1) % totalItems)
    }, 5200)
    return () => window.clearTimeout(timer)
  }, [activeIndex, isPaused, totalItems])

  const moveTo = nextIndex => {
    setActiveIndex((nextIndex + totalItems) % totalItems)
  }

  const moveBy = direction => {
    setActiveIndex(current => (current + direction + totalItems) % totalItems)
  }

  const handleTouchStart = event => {
    touchStartX.current = event.touches[0]?.clientX ?? null
    setIsTouching(true)
  }

  const handleTouchEnd = event => {
    const endX = event.changedTouches[0]?.clientX
    const distance = touchStartX.current == null || endX == null ? 0 : endX - touchStartX.current
    if (Math.abs(distance) >= 42) moveBy(distance < 0 ? 1 : -1)
    touchStartX.current = null
    setIsTouching(false)
  }

  const handleKeyDown = event => {
    if (event.key === 'ArrowLeft') moveBy(-1)
    if (event.key === 'ArrowRight') moveBy(1)
  }

  return (
    <div
      data-home-hero-carousel
      className="relative min-w-0 touch-pan-y select-none"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Exemplos reais de materiais criados no SmartCorretorAI"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false)
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setIsTouching(false)}
    >
      <div className="relative h-[19rem] overflow-hidden rounded-3xl sm:h-[21rem] lg:h-[19rem]">
        {heroMediaItems.map((item, index) => {
          const position = getCarouselPosition(index, activeIndex, totalItems)
          return (
            <HeroMediaCard
              key={item.id}
              item={item}
              isActive={position === 0}
              position={position}
              shouldPlay={position === 0 && !isPaused}
            />
          )
        })}

        <button
          type="button"
          onClick={() => moveBy(-1)}
          className={`absolute left-2 top-1/2 z-40 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-white/90 text-primary-950 shadow-lg backdrop-blur transition hover:bg-white motion-reduce:transition-none ${SMART_UI.focus}`}
          aria-label="Mostrar exemplo anterior"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => moveBy(1)}
          className={`absolute right-2 top-1/2 z-40 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-white/90 text-primary-950 shadow-lg backdrop-blur transition hover:bg-white motion-reduce:transition-none ${SMART_UI.focus}`}
          aria-label="Mostrar próximo exemplo"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2" aria-label="Selecionar exemplo">
        {heroMediaItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => moveTo(index)}
            className={`h-2 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${index === activeIndex ? 'w-6 bg-primary-900' : 'w-2 bg-slate-300 hover:bg-slate-400'} ${SMART_UI.focus}`}
            aria-label={`Mostrar ${item.label}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
        <button
          type="button"
          onClick={event => {
            setIsUserPaused(current => !current)
            if (isUserPaused) event.currentTarget.blur()
          }}
          className={`ml-1 grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-primary-950 motion-reduce:transition-none ${SMART_UI.focus}`}
          aria-label={isUserPaused ? 'Retomar carrossel' : 'Pausar carrossel'}
        >
          {isUserPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {heroMediaItems[activeIndex].label}, exemplo {activeIndex + 1} de {totalItems}
      </p>
    </div>
  )
}

const carouselPositionClasses = Object.freeze({
  '-2': 'pointer-events-none z-10 opacity-0 lg:w-[40%] lg:-translate-x-[138%] lg:scale-[0.9] lg:opacity-60',
  '-1': 'pointer-events-none z-20 opacity-0 lg:w-[42%] lg:-translate-x-[103%] lg:scale-[0.94] lg:opacity-90',
  0: 'z-30 w-[88%] opacity-100 lg:w-[46%]',
  1: 'pointer-events-none z-20 opacity-0 lg:w-[42%] lg:translate-x-[3%] lg:scale-[0.94] lg:opacity-90',
  2: 'pointer-events-none z-10 opacity-0 lg:w-[40%] lg:translate-x-[38%] lg:scale-[0.9] lg:opacity-60',
})

function getCarouselPosition(index, activeIndex, totalItems) {
  const forwardDistance = (index - activeIndex + totalItems) % totalItems
  if (forwardDistance > Math.floor(totalItems / 2)) return forwardDistance - totalItems
  return forwardDistance
}

function HeroMediaCard({ item, isActive, position, shouldPlay }) {
  const { label, src, beforeSrc, type } = item
  const videoRef = useRef(null)

  useEffect(() => {
    if (type !== 'video' || !videoRef.current) return
    if (shouldPlay) {
      videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.pause()
    }
  }, [shouldPlay, type])

  return (
    <div
      className={`absolute bottom-8 left-1/2 aspect-[4/3] w-[88%] origin-bottom -translate-x-1/2 overflow-hidden rounded-2xl border-2 border-white bg-slate-950 shadow-[0_20px_44px_-22px_rgba(15,23,42,0.58)] transition-[transform,width,opacity] duration-500 ease-out motion-reduce:transition-none ${carouselPositionClasses[position]}`}
      aria-hidden={!isActive}
    >
      {type === 'video' && (
        <video ref={videoRef} src={src} muted loop autoPlay={shouldPlay} playsInline preload={isActive ? 'metadata' : 'none'} draggable="false" aria-label={`Exemplo real de ${label}`} className="h-full w-full object-contain" />
      )}
      {type === 'image' && (
        <img src={src} alt={`Exemplo real de ${label}`} draggable="false" className="h-full w-full object-contain" />
      )}
      {type === 'comparison' && (
        <div className="grid h-full grid-cols-2">
          <img src={beforeSrc} alt="Ambiente antes da transformação" draggable="false" className="h-full min-w-0 object-cover" />
          <img src={src} alt="Ambiente depois da transformação" draggable="false" className="h-full min-w-0 object-cover" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/25" />
      <span className={`absolute left-0 top-0 rounded-br-lg bg-slate-950/85 px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none sm:text-[10px] ${isActive ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
      {type === 'video' && (
        <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-slate-950/75 text-white shadow-lg backdrop-blur-sm" aria-hidden="true">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </span>
      )}
      {type === 'comparison' && (
        <div className="absolute inset-x-0 bottom-2 flex justify-around text-[9px] font-black uppercase tracking-wide text-white">
          <span>Antes</span>
          <span>Depois</span>
        </div>
      )}
    </div>
  )
}

function ActionCard({ action }) {
  const Icon = action.icon
  const content = (
    <ProductCard
      as="article"
      data-home-product={action.id}
      className="group relative flex h-full min-h-[250px] min-w-0 flex-col overflow-hidden border border-slate-200 bg-white p-5 transition duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_55px_-38px_rgba(15,23,42,0.36)]"
    >
      <div className="flex-1">
        <Icon className="h-8 w-8 stroke-[1.65] text-primary-950" aria-hidden="true" />
        <h2 className="mt-5 text-base font-black tracking-[-0.02em] text-slate-950">{action.title}</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{action.description}</p>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary-900">
          {action.label}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-1 ${productTones[action.tone]}`} aria-hidden="true" />
    </ProductCard>
  )

  return (
    <Link to={action.to} className={`block h-full min-w-0 rounded-3xl ${SMART_UI.focus}`}>
      {content}
    </Link>
  )
}

function BenefitItem({ benefit, divided }) {
  const Icon = benefit.icon
  return (
    <article className={`flex gap-4 px-5 py-5 sm:px-6 ${divided ? 'border-t border-slate-200 sm:border-t-0 sm:[&:nth-child(odd)]:border-l xl:border-l' : ''}`}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 text-primary-900">
        <Icon className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-950">{benefit.title}</h3>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{benefit.description}</p>
      </div>
    </article>
  )
}

function handleFaqSummaryKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  const details = event.currentTarget.closest('details')
  if (!details) return

  const shouldOpen = !details.open
  if (shouldOpen) {
    document.querySelectorAll('details[name="home-faq"][open]').forEach(item => {
      if (item !== details) item.open = false
    })
  }
  details.open = shouldOpen
}

function handleFaqSectionToggle(event) {
  if (event.currentTarget.open) return
  event.currentTarget.querySelectorAll('details[name="home-faq"][open]').forEach(item => {
    item.open = false
  })
}

function handleFaqSectionSummaryKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  const details = event.currentTarget.closest('details')
  if (details) details.open = !details.open
}

function FaqItem({ item }) {
  return (
    <details name="home-faq" className="group border-b border-slate-200 px-5 py-1 last:border-b-0 sm:px-6">
      <summary onKeyDown={handleFaqSummaryKeyDown} className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-sm font-black text-slate-950 marker:hidden sm:text-[15px] ${SMART_UI.focus}`}>
        <span>{item.question}</span>
        <Plus className="h-5 w-5 shrink-0 text-primary-600 group-open:hidden" aria-hidden="true" />
        <Minus className="hidden h-5 w-5 shrink-0 text-primary-600 group-open:block" aria-hidden="true" />
      </summary>
      <div className="max-w-3xl pb-5 pr-8">
        <p className="text-sm font-medium leading-7 text-slate-600">{item.answer}</p>
        {item.link && (
          <ProductButton as={item.link.href ? 'a' : Link} href={item.link.href} to={item.link.to} variant="ghost" size="sm" className="mt-3 -ml-3">
            {item.link.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ProductButton>
        )}
      </div>
    </details>
  )
}
