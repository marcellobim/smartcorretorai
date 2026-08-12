import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon, X } from 'lucide-react'
import { ProductButton, ProductCard, SMART_UI } from '../design-system'

const INITIAL_EXAMPLE_COUNT = 12

const HERO_SHOWCASE_EXAMPLES = [
  { src: '/showcase/hero/hero-principal%201.jpg', width: 1536, height: 1024 },
  { src: '/showcase/hero/hero-captacao1.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-18semimagem.jpg', width: 1024, height: 1536 },
  { src: '/showcase/hero/hero-teste5.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-captacao2.jpg', width: 1024, height: 1536 },
  { src: '/showcase/hero/hero-16semimagem.jpg', width: 1536, height: 1024 },
  { src: '/showcase/hero/hero_teste2.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-captacao3.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste11semimagem.jpg', width: 1024, height: 1536 },
  { src: '/showcase/hero/hero-teste7.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-captacao4.jpg', width: 1024, height: 1536 },
  { src: '/showcase/hero/hero-teste14semimagem.jpg', width: 1536, height: 1024 },
  { src: '/showcase/hero/hero-teste1.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-captacao%205.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste10semimagem.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-test4.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste12semimagem.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste6.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste13semimagem.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste8.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste15semimagem.jpg', width: 1536, height: 1024 },
  { src: '/showcase/hero/hero-teste9.jpg', width: 1024, height: 1024 },
  { src: '/showcase/hero/hero-teste17semimagem.jpg', width: 1536, height: 1024 },
  { src: '/showcase/hero/hero-teste10.jpg', width: 1024, height: 1024 },
]

function ShowcasePhone({ example, index, onOpen, onFail }) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(example, event.currentTarget)}
      className="group mx-auto mb-10 block w-full max-w-[19rem] break-inside-avoid rounded-[2.35rem] bg-slate-950 p-[6px] text-left shadow-[0_24px_54px_-27px_rgba(15,23,42,0.82)] outline-none transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_32px_66px_-26px_rgba(15,95,122,0.36)] focus-visible:ring-4 focus-visible:ring-primary-300"
      aria-label={`Ampliar exemplo ${index + 1} de campanha criada pelo Banner Imobiliário`}
    >
      <span className="relative block overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900">
        <span className="absolute left-1/2 top-2 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-slate-700" aria-hidden="true" />
        <img
          src={example.src}
          width={example.width}
          height={example.height}
          loading={index < 4 ? 'eager' : 'lazy'}
          decoding="async"
          alt={`Exemplo ${index + 1} de campanha imobiliária criada pelo Banner Imobiliário`}
          onError={() => onFail(example.src)}
          className="block h-auto w-full object-contain transition duration-500 group-hover:scale-[1.015]"
        />
        <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/75 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
          <Expand className="h-4 w-4" />
        </span>
      </span>
    </button>
  )
}

export default function HeroShowcase({ onStart }) {
  const [expanded, setExpanded] = useState(false)
  const [failedSources, setFailedSources] = useState(() => new Set())
  const [activeSource, setActiveSource] = useState('')
  const sectionRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const lastTriggerRef = useRef(null)

  const examples = useMemo(
    () => HERO_SHOWCASE_EXAMPLES.filter((example) => !failedSources.has(example.src)),
    [failedSources],
  )
  const visibleExamples = expanded ? examples : examples.slice(0, INITIAL_EXAMPLE_COUNT)
  const activeIndex = examples.findIndex((example) => example.src === activeSource)
  const activeExample = activeIndex >= 0 ? examples[activeIndex] : null

  const handleFail = (source) => {
    setFailedSources((current) => {
      const next = new Set(current)
      next.add(source)
      return next
    })
    if (activeSource === source) setActiveSource('')
  }

  const closeLightbox = () => {
    setActiveSource('')
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus())
  }

  const moveLightbox = (direction) => {
    if (examples.length < 2 || activeIndex < 0) return
    const nextIndex = (activeIndex + direction + examples.length) % examples.length
    setActiveSource(examples[nextIndex].src)
  }

  useEffect(() => {
    if (!activeExample) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLightbox()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveLightbox(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveLightbox(1)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [activeExample, activeIndex, examples])

  const showLess = () => {
    setExpanded(false)
    window.requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const startCampaign = () => {
    onStart()
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  return (
    <>
      <ProductCard
        ref={sectionRef}
        className="relative mt-6 overflow-hidden p-5 sm:p-8 lg:p-10"
        aria-labelledby="hero-showcase-title"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className={`${SMART_UI.eyebrow} mx-auto inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5`}>
            <ImageIcon className="h-4 w-4" />
            Exemplos reais
          </div>
          <h2 id="hero-showcase-title" className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Inspire-se com campanhas reais
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base font-semibold leading-relaxed text-slate-600">
            Conheça alguns exemplos produzidos pelo Banner Imobiliário para diferentes tipos de imóveis e objetivos.
          </p>
          <p className="mt-3 text-sm font-black text-primary-700">
            Cada campanha é criada de forma exclusiva.
          </p>
          <p className="mx-auto mt-5 max-w-3xl rounded-2xl border border-smart-border bg-primary-50/70 px-5 py-4 text-sm font-semibold leading-relaxed text-slate-600">
            As campanhas abaixo são apenas exemplos reais da qualidade que o Banner Imobiliário pode produzir. Cada resultado é criado exclusivamente para o imóvel informado. Elas não são modelos para seleção.
          </p>
        </div>

        {visibleExamples.length > 0 ? (
          <div className="relative mt-10 columns-1 gap-7 sm:columns-2 lg:columns-3 xl:gap-9">
            {visibleExamples.map((example, index) => (
              <ShowcasePhone
                key={example.src}
                example={example}
                index={index}
                onFail={handleFail}
                onOpen={(selectedExample, trigger) => {
                  lastTriggerRef.current = trigger
                  setActiveSource(selectedExample.src)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="relative mt-9 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-600">Os exemplos estarão disponíveis novamente em breve.</p>
          </div>
        )}

        {examples.length > INITIAL_EXAMPLE_COUNT && (
          <div className="relative mt-9 flex justify-center">
            <ProductButton
              type="button"
              onClick={() => (expanded ? showLess() : setExpanded(true))}
              variant="secondary"
            >
              {expanded ? 'Ver menos exemplos' : 'Ver mais exemplos'}
            </ProductButton>
          </div>
        )}

        <div className="relative mx-auto mt-10 max-w-3xl rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 px-6 py-8 text-center text-white shadow-xl shadow-primary-950/15 sm:px-10">
          <p className="text-2xl font-black tracking-tight sm:text-3xl">Sua campanha também pode ter este acabamento.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-relaxed text-blue-50/85">
            Responda às perguntas do Banner Imobiliário e receba uma criação exclusiva para o seu objetivo.
          </p>
          <ProductButton type="button" onClick={startCampaign} variant="secondary" className="mt-6">
            Criar minha campanha
          </ProductButton>
        </div>
      </ProductCard>

      {activeExample && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-2 backdrop-blur-md sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLightbox()
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-showcase-dialog-title"
            className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col items-center justify-center rounded-3xl border border-white/15 bg-slate-950 p-2 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-3"
          >
            <h2 id="hero-showcase-dialog-title" className="sr-only">Exemplo ampliado de campanha criada pelo Banner Imobiliário</h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-white transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
              aria-label="Fechar exemplo ampliado"
            >
              <X className="h-5 w-5" />
            </button>

            {examples.length > 1 && (
              <button
                type="button"
                onClick={() => moveLightbox(-1)}
                className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-white transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 sm:left-5"
                aria-label="Ver exemplo anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <img
              src={activeExample.src}
              width={activeExample.width}
              height={activeExample.height}
              alt="Campanha imobiliária criada pelo Banner Imobiliário em tamanho ampliado"
              onError={() => handleFail(activeExample.src)}
              className="max-h-[calc(100dvh-2rem)] max-w-full rounded-2xl object-contain sm:max-h-[calc(100dvh-3.5rem)]"
            />

            {examples.length > 1 && (
              <button
                type="button"
                onClick={() => moveLightbox(1)}
                className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-white transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 sm:right-5"
                aria-label="Ver próximo exemplo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
