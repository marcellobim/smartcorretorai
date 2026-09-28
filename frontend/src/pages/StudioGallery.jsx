import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../config/brand'
import { ArrowLeft, Play, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, SMART_UI } from '../components/design-system'

const GALLERY_ROOT = '/showcase/smart-studio-gallery'
const SMART_CAROUSEL_GALLERY_VIDEO = '/showcase/smartcarrossel/showcase-carrossel.mp4'

const IMAGE_CREATED_VIDEOS = [
  'Generated Video June 19, 2026 - 5_48PM.mp4',
  'showcase-comercial.mp4.mp4',
  'showcase-locacao.mp4',
  'showcase-planta-baixa.mp4.mp4',
  'showcase-venda.mp4',
  'showcase-venda0.mp4.mp4',
  'showcase-venda2.mp4.mp4',
  'teste-premium-lite-16s.mp4',
  'video (5).mp4',
  'video (7).mp4',
  'video (19).mp4',
  'video (21).mp4',
  'video (43).mp4',
  'video (53).mp4',
  'video (56).mp4',
  'video (57).mp4',
]

const AI_CREATED_VIDEOS = [
  'Generated Video June 18, 2026 - 2_09PM.mp4',
  'showcas-captacao-corretores2.mp4.mp4',
  'showcase-captacao-corretores.mp4',
  'showcase-captacao-venda.mp4',
  'showcase-lacamento.mp4.mp4',
  'venda1lapa.mp4',
  'video (37).mp4',
  'video (39).mp4',
  'video (41).mp4',
  'video (44).mp4',
  'video (45).mp4',
  'video (47).mp4',
  'video (48).mp4',
  'video (58).mp4',
  'video (59).mp4',
]

const GALLERY_SECTIONS = [
  {
    id: 'with-images',
    title: 'Criadas a partir das imagens do imóvel',
    description: 'Você envia as imagens. A IA cria a campanha.',
    videos: IMAGE_CREATED_VIDEOS,
    accent: 'cyan',
  },
  {
    id: 'ai-only',
    title: 'Criadas apenas com IA',
    description: 'Você informa apenas uma ideia. A IA cria toda a campanha.',
    videos: AI_CREATED_VIDEOS,
    accent: 'violet',
  },
  {
    id: 'smart-carousel',
    title: 'Carrossel de Anúncios',
    description: 'Você envia as imagens do imóvel. O Studio IA cria uma apresentação dinâmica pronta para divulgação.',
    videos: [SMART_CAROUSEL_GALLERY_VIDEO],
    accent: 'emerald',
  },
]

export function getVideoSource(fileName) {
  if (fileName.startsWith('/')) return fileName
  return `${GALLERY_ROOT}/${fileName}`
}

export default function StudioGallery() {
  const navigate = useNavigate()
  const [selectedVideo, setSelectedVideo] = useState(null)
  const modalVideoRef = useRef(null)
  const lastTriggerRef = useRef(null)

  const closeModal = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause()
      modalVideoRef.current.currentTime = 0
    }
    setSelectedVideo(null)
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus())
  }

  const openModal = (video, trigger) => {
    lastTriggerRef.current = trigger
    setSelectedVideo(video)
  }

  useEffect(() => {
    if (!selectedVideo) return undefined

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeModal()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedVideo])

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_38%,#f8fafc_100%)] text-slate-900">
      <div className={SMART_UI.page}>
        <ProductButton
          type="button"
          onClick={() => navigate('/studio-hero')}
          variant="secondary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </ProductButton>

        <header className="mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#f0f7ff_52%,#faf5ff_100%)] text-slate-900 shadow-2xl shadow-blue-100/70">
          <ProductHero
            id="studio-gallery-title"
            eyebrow={BRAND.name}
            productName="Studio IA"
            headline="Inspire-se"
            description="Veja alguns exemplos do que o Smart Studio pode criar para você."
          />
        </header>

        <div className="mt-8 space-y-10 pb-12">
          {GALLERY_SECTIONS.map((section) => (
            <GallerySection key={section.id} section={section} onOpen={openModal} />
          ))}
        </div>
      </div>

      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Vídeo ampliado da galeria"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <div className="relative flex max-h-full w-full max-w-md items-center justify-center">
            <ProductButton
              type="button"
              onClick={closeModal}
              aria-label="Fechar vídeo"
              autoFocus
              variant="secondary"
              className="absolute -top-2 right-0 z-10 h-11 w-11 -translate-y-full rounded-full p-0 shadow-xl focus:ring-offset-slate-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </ProductButton>
            <div
              className="relative aspect-[9/16] h-auto max-w-full overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-2xl"
              style={{ width: 'min(calc(100vw - 2rem), calc((100dvh - 8rem) * 0.5625), 427.5px)' }}
            >
              <video
                ref={modalVideoRef}
                key={selectedVideo}
                src={getVideoSource(selectedVideo)}
                aria-label="Reprodução ampliada do exemplo"
                autoPlay
                controls
                playsInline
                muted={false}
                preload="metadata"
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                onContextMenu={(event) => event.preventDefault()}
                className="smart-presentation-media"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function GallerySection({ section, onOpen }) {
  const accent = {
    violet: {
      section: 'bg-violet-50/30',
      phone: 'bg-violet-50/60 ring-violet-100 focus:ring-violet-400',
    },
    emerald: {
      section: 'bg-emerald-50/30',
      phone: 'bg-emerald-50/60 ring-emerald-100 focus:ring-emerald-400',
    },
    cyan: {
      section: 'bg-cyan-50/30',
      phone: 'bg-cyan-50/60 ring-cyan-100 focus:ring-cyan-400',
    },
  }[section.accent] || {
    section: 'bg-cyan-50/30',
    phone: 'bg-cyan-50/60 ring-cyan-100 focus:ring-cyan-400',
  }

  return (
    <ProductCard className={`p-4 sm:p-6 ${accent.section}`}>
      <div className="mb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
        <ProductSectionHeading
          eyebrow={`${section.videos.length} ${section.videos.length === 1 ? 'exemplo real' : 'exemplos reais'}`}
          title={section.title}
          description={section.description}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
        {section.videos.map((fileName, index) => (
          <GalleryPhone
            key={fileName}
            fileName={fileName}
            index={index}
            categoryTitle={section.title}
            accentClassName={accent.phone}
            onOpen={onOpen}
          />
        ))}
      </div>
    </ProductCard>
  )
}

function GalleryPhone({ fileName, index, categoryTitle, accentClassName, onOpen }) {
  return (
    <ProductCard
      as="button"
      variant="flat"
      type="button"
      onClick={(event) => onOpen(fileName, event.currentTarget)}
      className={`group min-w-0 p-2.5 text-left transition hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 sm:p-3 ${accentClassName}`}
      aria-label={`Abrir exemplo ${index + 1} de ${categoryTitle}`}
    >
      <span className="relative block overflow-hidden rounded-[1.35rem] bg-slate-950 p-1.5 shadow-lg sm:rounded-[1.65rem] sm:p-2">
        <span className="relative block aspect-[9/16] overflow-hidden rounded-[1.05rem] bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_55%,#0e7490_100%)] sm:rounded-[1.3rem]">
          <video
            src={getVideoSource(fileName)}
            muted
            loop
            playsInline
            preload="metadata"
            controls={false}
            disablePictureInPicture
            onMouseEnter={(event) => event.currentTarget.play().catch(() => {})}
            onMouseLeave={(event) => {
              event.currentTarget.pause()
              event.currentTarget.currentTime = 0
            }}
            onFocus={(event) => event.currentTarget.play().catch(() => {})}
            onContextMenu={(event) => event.preventDefault()}
            className="smart-phone-media absolute inset-0"
            aria-hidden="true"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
          <span className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-lg transition group-hover:scale-110">
            <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
          </span>
        </span>
      </span>
      <span className="block px-1 pb-1 pt-3 text-xs font-black uppercase tracking-wide text-slate-600">
        Exemplo {index + 1}
      </span>
    </ProductCard>
  )
}
