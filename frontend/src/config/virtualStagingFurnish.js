export const FURNISH_RENOVATE_JOURNEY_ID = 'furnish-renovate'
export const FURNISH_RENOVATE_MAX_IMAGES = 4
export const FURNISH_COMPLETE_VIDEO_MODE = 'complete-transformation'
export const FURNISH_VISUAL_ONLY_VIDEO_MODE = 'visual-only'

export const FURNISH_RENOVATE_COPY = Object.freeze({
  uploadQuestion: 'Envie de 1 a 4 fotos dos ambientes que deseja transformar.',
  uploadHint: 'Envie as fotos na ordem em que deseja transformar os ambientes.',
  styleQuestion: 'Escolha abaixo o estilo desejado.',
  styleIntroduction: 'Agora vamos definir o estilo da transformação.\n\nO estilo escolhido servirá como inspiração para renovar os ambientes enviados.\n\nEm ambientes vazios, a IA criará uma proposta completa de mobiliário e decoração.\n\nEm ambientes já mobiliados, ela substituirá e renovará os elementos existentes, preservando a estrutura original do ambiente.\n\nEscolha abaixo o estilo desejado.',
  reviewNotice: 'A IA transformará os ambientes preservando a estrutura original das fotografias.',
})

export const FURNISH_RENOVATE_QUESTIONS = Object.freeze([
  ['images', 1, FURNISH_RENOVATE_COPY.uploadQuestion],
  ['style_gallery', 2, FURNISH_RENOVATE_COPY.styleQuestion],
  ['video_mode', 3, 'Como deseja gerar o vídeo?'],
  ['purpose', 4, 'Qual é a finalidade do imóvel?'],
  ['stage', 4, 'Qual é o estado atual do imóvel?'],
  ['type', 4, 'Que tipo de imóvel vamos transformar?'],
  ['facts', 4, 'Quais são as principais medidas?'],
  ['location', 4, 'Onde fica o imóvel?'],
  ['highlights', 4, 'Quais destaques devem enriquecer a narração?'],
  ['narrated_cta', 4, 'Qual convite deseja no final da narração?'],
  ['review', 5, 'Tudo pronto. Revise a transformação antes de criar.'],
])

export const FURNISH_RENOVATE_VIDEO_MODES = Object.freeze([
  {
    id: FURNISH_COMPLETE_VIDEO_MODE,
    label: 'Transformação Completa',
    description: 'Inclui narração comercial sobre o imóvel e convite final narrado. Sem legendas, textos na tela, telefone ou CTA visual.',
    narrationEnabled: true,
  },
  {
    id: FURNISH_VISUAL_ONLY_VIDEO_MODE,
    label: 'Apenas Transformação',
    description: 'Mostra somente a transformação visual dos ambientes. Sem narração, convite final, textos, telefone ou CTA visual.',
    narrationEnabled: false,
  },
])

// Slots controlados: substituir nomes, descrições e demoVideo quando os assets oficiais forem aprovados.
export const FURNISH_RENOVATE_STYLES = Object.freeze([
  { id: 'style-placeholder-1', name: 'Estilo em definição 1', description: 'Referência visual aguardando curadoria e vídeo oficial.', demoVideo: '', assetStatus: 'pending' },
  { id: 'style-placeholder-2', name: 'Estilo em definição 2', description: 'Referência visual aguardando curadoria e vídeo oficial.', demoVideo: '', assetStatus: 'pending' },
  { id: 'style-placeholder-3', name: 'Estilo em definição 3', description: 'Referência visual aguardando curadoria e vídeo oficial.', demoVideo: '', assetStatus: 'pending' },
])

export const FURNISH_RENOVATE_HIGHLIGHT_GROUPS = Object.freeze([
  { title: 'Lazer', items: Object.freeze(['Lazer completo', 'Piscina', 'Academia', 'Espaço gourmet']) },
  { title: 'Região e localização', items: Object.freeze(['Próximo ao metrô', 'Próximo ao comércio', 'Bairro valorizado', 'Fácil acesso']) },
  { title: 'Diferencial principal', items: Object.freeze(['Varanda gourmet', 'Vista livre', 'Reformado', 'Alto padrão']) },
])
export const FURNISH_RENOVATE_MAX_HIGHLIGHTS = 3

export const FURNISH_RENOVATE_NARRATED_CTAS = Object.freeze([
  'Saiba mais',
  'Agende sua visita',
  'Entre em contato',
  'Conheça este imóvel',
  'Solicite mais informações',
])

export function getFurnishRenovateStyle(styleId) {
  return FURNISH_RENOVATE_STYLES.find(style => style.id === styleId) || null
}

export function getFurnishRenovateVideoMode(videoMode) {
  return FURNISH_RENOVATE_VIDEO_MODES.find(mode => mode.id === videoMode) || null
}

export function canAddFurnishRenovateImages(currentCount, addedCount) {
  return currentCount >= 0 && addedCount >= 0 && currentCount + addedCount <= FURNISH_RENOVATE_MAX_IMAGES
}

export function buildFurnishRenovatePayload({ imagePaths, transformationStyle, videoMode, property, narratedCta, language = 'pt-BR' }) {
  const mode = getFurnishRenovateVideoMode(videoMode)
  const base = {
    module: FURNISH_RENOVATE_JOURNEY_ID,
    property_images: { image_paths: [...imagePaths], image_order: [...imagePaths] },
    transformationStyle,
    videoMode,
    language,
  }
  if (!mode?.narrationEnabled) return base
  return {
    ...base,
    narrationEnabled: true,
    property: {
      purpose: property.purpose,
      stage: property.stage,
      type: property.type,
      bedrooms: property.bedrooms,
      suites: property.suites,
      parkingSpaces: property.parkingSpaces,
      area: property.area,
      district: property.district,
      city: property.city,
      highlights: [...property.highlights].slice(0, FURNISH_RENOVATE_MAX_HIGHLIGHTS),
    },
    narratedCta,
  }
}

export function buildFurnishRenovateReviewItems({ imagesCount, transformationStyle, videoMode, property, narratedCta }) {
  const selectedStyle = getFurnishRenovateStyle(transformationStyle)
  const selectedMode = getFurnishRenovateVideoMode(videoMode)
  return [
    { id: 'images', label: imagesCount && `${imagesCount} ambiente${imagesCount > 1 ? 's' : ''}` },
    { id: 'style_gallery', label: selectedStyle && `Estilo: ${selectedStyle.name}` },
    { id: 'video_mode', label: selectedMode?.label || '' },
    ...(videoMode === FURNISH_COMPLETE_VIDEO_MODE ? [
      { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação') },
      { id: 'stage', label: property.stage },
      { id: 'type', label: property.type },
      { id: 'bedrooms', editQuestionId: 'facts', displayLabel: 'Dormitórios', label: property.bedrooms },
      { id: 'suites', editQuestionId: 'facts', displayLabel: 'Suítes', label: property.suites },
      { id: 'parkingSpaces', editQuestionId: 'facts', displayLabel: 'Vagas', label: property.parkingSpaces },
      { id: 'area', editQuestionId: 'facts', displayLabel: 'Área', label: property.area && `${property.area} m²` },
      { id: 'district', editQuestionId: 'location', displayLabel: 'Bairro', label: property.district },
      { id: 'city', editQuestionId: 'location', displayLabel: 'Cidade', label: property.city },
      { id: 'highlights', label: property.highlights.length ? property.highlights.join(' · ') : 'Nenhum destaque adicional' },
      { id: 'narrated_cta', displayLabel: 'Convite final', label: narratedCta },
    ] : []),
  ].filter(item => Boolean(item.label))
}
