export const SMART_TOUR_PRODUCT_NAME = 'Smart Tour AI'
export const SMART_TOUR_ROUTE = '/smart-tour-ai'
export const SMART_TOUR_MAX_IMAGES = 6
export const SMART_TOUR_LANGUAGES = [
  { id: 'pt-BR', label: 'Português do Brasil' },
  { id: 'en-US', label: 'Inglês' },
  { id: 'es', label: 'Espanhol' },
]
export const SMART_TOUR_MODES = [
  { id: 'guided_tour', label: 'Apresentação com Corretor(a) Virtual', description: 'Apresentador virtual, narração e textos elegantes.' },
  { id: 'narrated_tour', label: 'Apresentação com Narração', description: 'Narração e textos, sem apresentador.' },
  { id: 'smart_staging', label: 'Apresentação com Sugestão de Decoração', description: 'Sugestão realista de mobiliário, preservando a arquitetura.' },
  { id: 'cinematic_tour', label: 'Apresentação Dinâmica', description: 'Experiência visual focada no imóvel.' },
  { id: 'free_ai', label: 'IA Livre ⭐', description: 'A IA usa todo o contexto confirmado e define livremente a apresentação.' },
]
export const SMART_TOUR_EXAMPLES = [
  {
    id: 'guided-tour',
    title: 'Tour Guiado',
    description: 'Corretor virtual, narração, textos e movimentos cinematográficos.',
    video: '/smart-tour/examples/tour-guiado.mp4',
    hasNarration: true,
    hasTexts: true,
    hasPresenter: true,
    hasFurniture: false,
    placeholder: true,
  },
  {
    id: 'narrated-tour',
    title: 'Tour Narrado',
    description: 'O imóvel ganha movimento, narração profissional e destaques na tela.',
    video: '/smart-tour/examples/tour-narrado.mp4',
    hasNarration: true,
    hasTexts: true,
    hasPresenter: false,
    hasFurniture: false,
    placeholder: true,
  },
  {
    id: 'smart-staging',
    title: 'Smart Staging',
    description: 'Ambientes vazios recebem uma sugestão realista de mobiliário e apresentação narrada.',
    video: '/smart-tour/examples/smart-staging.mp4',
    hasNarration: true,
    hasTexts: false,
    hasPresenter: false,
    hasFurniture: true,
    placeholder: true,
  },
  {
    id: 'cinematic-tour',
    title: 'Tour Cinemático',
    description: 'Uma apresentação visual limpa, sem textos ou narração.',
    video: '/smart-tour/examples/tour-cinematico.mp4',
    hasNarration: false,
    hasTexts: false,
    hasPresenter: false,
    hasFurniture: false,
    placeholder: true,
  },
]
export const SMART_TOUR_CINEMATIC_VISUAL_CTA = true
