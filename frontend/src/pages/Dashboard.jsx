import { QUICK_BANNERS_AVAILABLE, visibleProducts } from '../config/productAvailability'
import { BRAND } from '../config/brand'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Box,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileText,
  Film,
  Gauge,
  Heart,
  Image as ImageIcon,
  ImagePlus,
  Minus,
  Pause,
  Play,
  Plus,
  Radar,
  ShieldCheck,
  UserRound,
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
import { useLocale } from '../i18n/useLocale'
const VIRTUAL_STAGING_BEFORE_IMAGE = '/virtual-staging/virtual-staging-before.jpg'
const VIRTUAL_STAGING_AFTER_IMAGE = '/virtual-staging/virtual-staging-after.png'

const PLANS_ROUTE = '/planos'
const SMART_TOKENS_LABEL = ['Smart', 'Tokens'].join(' ')
const HOME_PAGE_CLASS = 'mx-auto w-full max-w-[92rem] px-smart-page py-6 sm:py-8'

const mainActions = t => visibleProducts([
  {
    id: 'smart-tour-ai',
    title: t('dashboard.actions.realEstateVideo.title'),
    description: t('dashboard.actions.realEstateVideo.description'),
    to: '/smart-tour-ai',
    label: t('dashboard.actions.realEstateVideo.label'),
    tone: 'violet',
    icon: Video,
  },
  {
    id: 'hero-ia',
    title: t('dashboard.actions.realEstateBanner.title'),
    description: t('dashboard.actions.realEstateBanner.description'),
    to: '/hero',
    label: t('dashboard.actions.realEstateBanner.label'),
    tone: 'mint',
    icon: ImageIcon,
  },
  {
    id: 'comercial-imobiliario',
    title: t('dashboard.actions.realEstateCommercial.title'),
    description: t('dashboard.actions.realEstateCommercial.description'),
    to: '/studio-hero',
    label: t('dashboard.actions.realEstateCommercial.label'),
    tone: 'blue',
    icon: Film,
  },
  {
    id: 'video-criativo',
    title: t('dashboard.actions.creativeVideo.title'),
    description: t('dashboard.actions.creativeVideo.description'),
    to: '/studio-hero',
    label: t('dashboard.actions.creativeVideo.label'),
    tone: 'cyan',
    icon: Wand2,
  },
  {
    id: 'smart-carrossel',
    title: t('dashboard.actions.smartCarousel.title'),
    description: t('dashboard.actions.smartCarousel.description'),
    to: '/smart-carrossel',
    label: t('dashboard.actions.smartCarousel.label'),
    tone: 'violet',
    icon: ImagePlus,
  },
  {
    id: 'smart-space',
    title: t('dashboard.actions.smartSpace.title'),
    description: t('dashboard.actions.smartSpace.description'),
    to: '/virtual-staging',
    label: t('dashboard.actions.smartSpace.label'),
    tone: 'cyan',
    icon: Box,
  },
  {
    id: 'vida-no-imovel',
    title: t('dashboard.actions.propertyLife.title'),
    description: t('dashboard.actions.propertyLife.description'),
    to: '/virtual-staging',
    label: t('dashboard.actions.propertyLife.label'),
    tone: 'peach',
    icon: Heart,
  },
  {
    id: 'apresentacao-corretor',
    title: t('dashboard.actions.agentPresentation.title'),
    description: t('dashboard.actions.agentPresentation.description'),
    to: '/virtual-staging',
    label: t('dashboard.actions.agentPresentation.label'),
    tone: 'blue',
    icon: UserRound,
  },
  {
    id: 'banners-rapidos',
    title: t('dashboard.actions.quickBanners.title'),
    description: t('dashboard.actions.quickBanners.description'),
    to: '/nova-campanha',
    label: t('dashboard.actions.quickBanners.label'),
    tone: 'peach',
    icon: Zap,
  },
])

const textCampaignAction = t => Object.freeze({
  id: 'campanha-de-textos',
  title: t('dashboard.textCampaign.title'),
  description: t('dashboard.textCampaign.description'),
  to: '/campanha-de-textos',
  label: t('dashboard.textCampaign.label'),
})

const homeGroups = t => {
  const textCampaign = textCampaignAction(t)
  const actions = mainActions(t)
  return visibleProducts([
    { id: 'video', title: t('dashboard.groups.video.title'), description: t('dashboard.groups.video.description'), to: '/dashboard?grupo=video', label: t('dashboard.groups.video.label'), icon: Video, tone: 'violet', products: ['smart-tour-ai', 'comercial-imobiliario', 'video-criativo'] },
    { id: 'imagem', title: t('dashboard.groups.image.title'), description: t('dashboard.groups.image.description'), to: '/dashboard?grupo=imagem', label: t('dashboard.groups.image.label'), icon: ImageIcon, tone: 'mint', products: ['hero-ia', 'smart-space', 'banners-rapidos', 'smart-carrossel'] },
    { id: 'texto', title: t('dashboard.groups.text.title'), description: textCampaign.description, to: textCampaign.to, label: t('dashboard.groups.text.label'), icon: FileText, tone: 'gold' },
    { id: 'analisar', title: t('dashboard.groups.analyze.title'), description: t('dashboard.groups.analyze.description'), to: '/raio-x-anuncio', label: t('dashboard.groups.analyze.label'), icon: Radar, tone: 'cyan' },
  ]).map(group => ({ ...group, ...(group.products ? { products: group.products.filter(id => actions.some(action => action.id === id)) } : {}) })).filter(group => !group.products || group.products.length)
}

const productTones = Object.freeze({
  violet: 'bg-violet-500',
  mint: 'bg-emerald-500',
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  peach: 'bg-orange-500',
  gold: 'bg-amber-500',
})

const heroMediaItems = t => visibleProducts([
  {
    id: 'video-imobiliario',
    label: t('dashboard.carousel.realEstateVideo'),
    src: '/demos-videos/animar-imagens.mp4',
    type: 'video',
  },
  {
    id: 'banner-imobiliario',
    label: t('dashboard.carousel.realEstateBanner'),
    src: '/showcase/hero/hero-principal 1.jpg',
    type: 'image',
  },
  {
    id: 'virtual-space',
    label: t('dashboard.carousel.smartSpace'),
    beforeSrc: VIRTUAL_STAGING_BEFORE_IMAGE,
    src: VIRTUAL_STAGING_AFTER_IMAGE,
    type: 'comparison',
  },
  {
    id: 'studio-ia',
    label: t('dashboard.carousel.aiStudio'),
    src: '/showcase/smartcarrossel/showcase-carrossel.mp4',
    type: 'video',
  },
  {
    id: 'banners-rapidos',
    label: t('dashboard.carousel.quickBanners'),
    src: '/previews/produto3/anuncio-premium-preview-1x1.jpg',
    type: 'image',
  },
])

const benefits = t => [
  {
    icon: Gauge,
    title: t('dashboard.benefits.agility.title'),
    description: t('dashboard.benefits.agility.description'),
  },
  {
    icon: ShieldCheck,
    title: t('dashboard.benefits.security.title'),
    description: t('dashboard.benefits.security.description'),
  },
  {
    icon: Coins,
    title: t('dashboard.benefits.savings.title'),
    description: t('dashboard.benefits.savings.description'),
  },
  {
    icon: BadgeCheck,
    title: t('dashboard.benefits.materials.title'),
    description: t('dashboard.benefits.materials.description'),
  },
]

const faqItems = t => [
  {
    question: t('dashboard.faq.items.product.question'),
    answer: t(QUICK_BANNERS_AVAILABLE ? 'dashboard.faq.items.product.answerWithQuickBanners' : 'dashboard.faq.items.product.answerWithoutQuickBanners'),
  },
  {
    question: t('dashboard.faq.items.plan.question'), answer: t('dashboard.faq.items.plan.answer'), link: { to: PLANS_ROUTE, label: t('dashboard.faq.items.plan.link') },
  },
  {
    question: t('dashboard.faq.items.tokens.question'), answer: t('dashboard.faq.items.tokens.answer'), link: { to: PLANS_ROUTE, label: t('dashboard.faq.items.tokens.link') },
  },
  {
    question: `${t('dashboard.faq.items.plans.questionPrefix')} ${BRAND.name}?`, answer: t('dashboard.faq.items.plans.answer'), link: { to: '/configuracoes?tab=plano', label: t('dashboard.faq.items.plans.link') },
  },
  {
    question: t('dashboard.faq.items.cancel.question'), answer: t('dashboard.faq.items.cancel.answer'), link: { to: '/configuracoes?tab=plano', label: t('dashboard.faq.items.cancel.link') },
  },
  {
    question: t('dashboard.faq.items.expiration.question'), answer: t('dashboard.faq.items.expiration.answer'), link: { to: PLANS_ROUTE, label: t('dashboard.faq.items.expiration.link') },
  },
  {
    question: t('dashboard.faq.items.publish.question'), answer: `${t('dashboard.faq.items.publish.answerPrefix')} ${BRAND.name}.${t('dashboard.faq.items.publish.answerSuffix')}`,
  },
  {
    question: t('dashboard.faq.items.access.question'), answer: t('dashboard.faq.items.access.answer'), link: { to: '/configuracoes?tab=acesso', label: t('dashboard.faq.items.access.link') },
  },
  {
    question: t('dashboard.faq.items.savedCreations.question'),
    answer: `${BRAND.name} ${t('dashboard.faq.items.savedCreations.answerSuffix')}`,
  },
  {
    question: `${BRAND.name} ${t('dashboard.faq.items.professionalData.questionSuffix')}`,
    answer: t('dashboard.faq.items.professionalData.answer'),
    link: { to: '/configuracoes?tab=cadastro', label: t('dashboard.faq.items.professionalData.link') },
  },
  {
    question: t('dashboard.faq.items.responsibility.question'),
    answer: `${t('dashboard.faq.items.responsibility.answerPrefix')} ${BRAND.name} ${t('dashboard.faq.items.responsibility.answerSuffix')}`,
    link: { to: '/termos', label: t('dashboard.faq.items.responsibility.link') },
  },
  {
    question: t('dashboard.faq.items.aiErrors.question'),
    answer: t('dashboard.faq.items.aiErrors.answer'),
  },
  {
    question: t('dashboard.faq.items.contact.question'),
    answer: t('dashboard.faq.items.contact.answer'),
    link: { href: `mailto:${BRAND.supportEmail}`, label: `${t('dashboard.faq.items.contact.linkPrefix')} ${BRAND.name}` },
  },
]

export default function Dashboard() {
  const { t } = useLocale()
  const [searchParams] = useSearchParams()
  const groups = homeGroups(t)
  const actions = mainActions(t)
  const selectedGroup = groups.find(group => group.products && group.id === searchParams.get('grupo'))
  const visibleActions = selectedGroup
    ? selectedGroup.products.map(id => actions.find(action => action.id === id)).filter(Boolean)
    : groups

  return (
    <div className="min-w-0">
      <Header title={t('dashboard.header.title')} subtitle={t('dashboard.header.subtitle')} />

      <main className={`${HOME_PAGE_CLASS} min-w-0`}>
        <ProductCard className="overflow-hidden border-slate-200 bg-white p-5 shadow-[0_28px_75px_-55px_rgba(15,23,42,0.38)] sm:p-7 lg:p-9">
          <div data-home-hero className="grid min-w-0 gap-8 lg:grid-cols-[minmax(350px,0.9fr)_minmax(480px,1.1fr)] lg:items-center">
            <div className="max-w-xl">
              <h1 className="text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl lg:text-[2.6rem] lg:leading-[1.08] xl:text-[2.85rem]">
              {t('dashboard.hero.title')}
              </h1>
              <p className={`${SMART_UI.body} mt-4 max-w-lg`}>
                {t('dashboard.hero.description')}
              </p>
            </div>

            <HeroMediaShowcase />
          </div>
        </ProductCard>

        <section className="mt-8" aria-labelledby="home-products-title">
          {selectedGroup && (
            <Link to="/dashboard" className={`mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-primary-900 ${SMART_UI.focus}`}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('dashboard.backToGroups')}
            </Link>
          )}
          <ProductSectionHeading
            id="home-products-title"
            title={selectedGroup ? selectedGroup.title : t('dashboard.productsTitle')}
          />
          <div data-home-product-grid className="mt-5 grid min-w-0 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleActions.map(action => (
              <ActionCard key={action.id} action={action} isGroup={!selectedGroup} />
            ))}
          </div>
        </section>

        <ProductCard data-home-benefits className="mt-8 grid overflow-hidden border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
          {benefits(t).map((benefit, index) => (
            <BenefitItem key={benefit.title} benefit={benefit} divided={index > 0} />
          ))}
        </ProductCard>

        <section className="mt-5" aria-labelledby="home-faq-title">
          <ProductCard as="details" onToggle={handleFaqSectionToggle} className="group/faq-section overflow-hidden border-slate-200 bg-white" data-home-faq>
            <summary onKeyDown={handleFaqSectionSummaryKeyDown} className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:hidden sm:px-6 ${SMART_UI.focus}`}>
              <h2 id="home-faq-title" className="text-base font-black text-slate-950 sm:text-lg">{t('dashboard.faq.title')}</h2>
              <Plus className="h-5 w-5 shrink-0 text-primary-600 group-open/faq-section:hidden" aria-hidden="true" />
              <Minus className="hidden h-5 w-5 shrink-0 text-primary-600 group-open/faq-section:block" aria-hidden="true" />
            </summary>
            <div className="border-t border-slate-200">
              {faqItems(t).map(item => (
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
  const { t } = useLocale()
  const [activeIndex, setActiveIndex] = useState(1)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [isUserPaused, setIsUserPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const touchStartX = useRef(null)
  const mediaItems = heroMediaItems(t)
  const totalItems = mediaItems.length
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
      aria-roledescription={t('dashboard.carousel.roleDescription')}
      aria-label={`${t('dashboard.carousel.examplesCreatedBy')} ${BRAND.name}`}
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
        {mediaItems.map((item, index) => {
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
          aria-label={t('dashboard.carousel.previousExample')}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => moveBy(1)}
          className={`absolute right-2 top-1/2 z-40 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-white/90 text-primary-950 shadow-lg backdrop-blur transition hover:bg-white motion-reduce:transition-none ${SMART_UI.focus}`}
          aria-label={t('dashboard.carousel.nextExample')}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2" aria-label={t('dashboard.carousel.selectExample')}>
        {mediaItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => moveTo(index)}
            className={`h-2 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${index === activeIndex ? 'w-6 bg-primary-900' : 'w-2 bg-slate-300 hover:bg-slate-400'} ${SMART_UI.focus}`}
            aria-label={`${t('dashboard.carousel.show')} ${item.label}`}
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
          aria-label={isUserPaused ? t('dashboard.carousel.resume') : t('dashboard.carousel.pause')}
        >
          {isUserPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {mediaItems[activeIndex].label}, {t('dashboard.carousel.example')} {activeIndex + 1} {t('dashboard.carousel.of')} {totalItems}
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
  const { t } = useLocale()
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
        <video ref={videoRef} src={src} muted loop autoPlay={shouldPlay} playsInline preload={isActive ? 'metadata' : 'none'} draggable="false" aria-label={`${t('dashboard.carousel.realExampleOf')} ${label}`} className="h-full w-full object-contain" />
      )}
      {type === 'image' && (
        <img src={src} alt={`${t('dashboard.carousel.realExampleOf')} ${label}`} draggable="false" className="h-full w-full object-contain" />
      )}
      {type === 'comparison' && (
        <div className="grid h-full grid-cols-2">
          <img src={beforeSrc} alt={t('dashboard.carousel.beforeTransformation')} draggable="false" className="h-full min-w-0 object-cover" />
          <img src={src} alt={t('dashboard.carousel.afterTransformation')} draggable="false" className="h-full min-w-0 object-cover" />
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
          <span>{t('dashboard.carousel.before')}</span>
          <span>{t('dashboard.carousel.after')}</span>
        </div>
      )}
    </div>
  )
}

function ActionCard({ action, isGroup = false }) {
  const { t } = useLocale()
  const Icon = action.icon
  const content = (
    <ProductCard
      as="article"
      data-home-product={isGroup ? undefined : action.id}
      data-home-group={isGroup ? action.id : undefined}
      className="group relative flex h-full min-h-[250px] min-w-0 flex-col overflow-hidden border border-slate-200 bg-white p-5 transition duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_55px_-38px_rgba(15,23,42,0.36)]"
    >
      <div className="flex-1">
        <Icon className="h-8 w-8 stroke-[1.65] text-primary-950" aria-hidden="true" />
        {['comercial-imobiliario', 'video-criativo'].includes(action.id) && (
          <p className="mt-4 text-xs font-bold text-slate-500">{t('dashboard.carousel.aiStudio')}</p>
        )}
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
