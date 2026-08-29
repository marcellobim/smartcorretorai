export const VIRTUAL_STAGING_PRODUCT_NAME = 'Smart Space'
export const VIRTUAL_STAGING_ROUTE = '/virtual-staging'
export const VIRTUAL_STAGING_MAX_IMAGES = 5
export const VIRTUAL_STAGING_LANGUAGES = [
  { id: 'pt-BR', label: 'Português do Brasil' },
  { id: 'en-US', label: 'Inglês' },
  { id: 'es', label: 'Espanhol' },
]
export const VIRTUAL_STAGING_MODES = [
  { id: 'guided_tour', label: 'Apresentação com Corretor(a) Virtual', description: 'Apresentador virtual, narração e textos elegantes.' },
  { id: 'narrated_tour', label: 'Apresentação com Narração', description: 'Narração e textos, sem apresentador.' },
  { id: 'smart_staging', label: 'Apresentação com Sugestão de Decoração', description: 'Sugestão realista de mobiliário, preservando a arquitetura.' },
  { id: 'cinematic_tour', label: 'Apresentação Dinâmica', description: 'Experiência visual focada no imóvel.' },
  { id: 'free_ai', label: 'IA Livre ⭐', description: 'A IA usa todo o contexto confirmado e define livremente a apresentação.' },
]
export const VIRTUAL_STAGING_EXAMPLES = [
  {
    id: 'animate-images',
    title: 'Animar Imagens',
    description: 'As fotos do imóvel ganham movimento e profundidade para uma apresentação mais envolvente.',
    video: '/demos-videos/animar-imagens.mp4',
    hasNarration: false,
    hasTexts: false,
    hasPresenter: false,
    hasFurniture: false,
    placeholder: false,
  },
  {
    id: 'campaign-video',
    title: 'Vídeo para Campanha',
    description: 'Uma peça vertical pronta para apresentar o imóvel com ritmo e destaque comercial.',
    video: '/demos-videos/video-campanha.mp4',
    hasNarration: false,
    hasTexts: true,
    hasPresenter: false,
    hasFurniture: false,
    placeholder: false,
  },
  {
    id: 'narrated-video',
    title: 'Vídeo Narrado',
    description: 'A apresentação combina imagens do imóvel, narração profissional e informações relevantes.',
    video: '/demos-videos/video-narrado.mp4',
    hasNarration: true,
    hasTexts: true,
    hasPresenter: false,
    hasFurniture: false,
    placeholder: false,
  },
  {
    id: 'virtual-agent',
    title: 'Corretor Virtual',
    description: 'Um apresentador virtual conduz a experiência e dá contexto à apresentação do imóvel.',
    video: '/demos-videos/corretor-virtual.mp4',
    hasNarration: true,
    hasTexts: false,
    hasPresenter: true,
    hasFurniture: false,
    placeholder: false,
  },
]
export const VIRTUAL_STAGING_CINEMATIC_VISUAL_CTA = true
