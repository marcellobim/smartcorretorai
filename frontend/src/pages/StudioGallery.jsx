import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Play, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const GALLERY_ROOT = '/showcase/smart-studio-gallery'

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
]

function getVideoSource(fileName) {
  return `${GALLERY_ROOT}/${fileName}`
}

export default function StudioGallery() {
  const navigate = useNavigate()
  const [selectedVideo, setSelectedVideo] = useState(null)
  const modalVideoRef = useRef(null)
  const closeButtonRef = useRef(null)

  const closeModal = () => {
    modalVideoRef.current?.pause()
    setSelectedVideo(null)
  }

  useEffect(() => {
    if (!selectedVideo) return undefined

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeModal()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedVideo])

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_38%,#f8fafc_100%)] px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => navigate('/studio-hero')}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </button>

        <header className="mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_50%,#4c1d95_100%)] px-6 py-10 text-white shadow-2xl shadow-cyan-950/20 sm:px-10 sm:py-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100 ring-1 ring-white/10">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Galeria Smart Studio
          </div>
          <h1 className="mt-5 text-4xl font-black sm:text-5xl">Inspire-se</h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-200 sm:text-lg">
            Veja alguns exemplos do que o Smart Studio pode criar para você.
          </p>
        </header>

        <div className="mt-8 space-y-10 pb-12">
          {GALLERY_SECTIONS.map((section) => (
            <GallerySection key={section.id} section={section} onOpen={setSelectedVideo} />
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
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeModal}
              aria-label="Fechar vídeo"
              className="absolute -top-2 right-0 z-10 flex h-11 w-11 -translate-y-full items-center justify-center rounded-full bg-white text-slate-950 shadow-xl transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="max-h-[82vh] w-auto max-w-full overflow-hidden rounded-[2rem] border border-white/15 bg-black p-2 shadow-2xl">
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
                controlsList="nodownload"
                disablePictureInPicture
                onContextMenu={(event) => event.preventDefault()}
                className="max-h-[80vh] w-auto max-w-full rounded-[1.5rem] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function GallerySection({ section, onOpen }) {
  const isViolet = section.accent === 'violet'

  return (
    <section className={`rounded-[2rem] border bg-white p-4 shadow-sm sm:p-6 ${isViolet ? 'border-violet-100' : 'border-cyan-100'}`}>
      <div className="mb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${isViolet ? 'text-violet-700' : 'text-cyan-700'}`}>
            {section.videos.length} exemplos reais
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{section.title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{section.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
        {section.videos.map((fileName, index) => (
          <GalleryPhone
            key={fileName}
            fileName={fileName}
            index={index}
            categoryTitle={section.title}
            isViolet={isViolet}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )
}

function GalleryPhone({ fileName, index, categoryTitle, isViolet, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(fileName)}
      className={`group min-w-0 rounded-[1.7rem] border p-2.5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 sm:rounded-[2rem] sm:p-3 ${isViolet ? 'border-violet-100 bg-violet-50/60 focus:ring-violet-400' : 'border-cyan-100 bg-cyan-50/60 focus:ring-cyan-400'}`}
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
            className="absolute inset-0 h-full w-full object-cover object-center"
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
    </button>
  )
}
