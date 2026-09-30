export const FURNISH_RENOVATE_JOURNEY_ID = 'furnish-renovate'
export const FURNISH_RENOVATE_MAX_IMAGES = 5

export const VIRTUAL_STAGING_CHAT_INTRO = Object.freeze({
  title: 'Smart Space',
  description: 'Transforme ambientes e mostre novas possibilidades para cada espaço.',
  action: 'Começar',
})

export const FURNISH_RENOVATE_TRANSFORMATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'furnish', label: 'Mobiliar um ambiente vazio', description: 'Para espaços sem móveis ou quase vazios.' }),
  Object.freeze({ id: 'remove_and_redecorate', label: 'Criar uma decoração completamente nova', description: 'Remove os móveis atuais e cria uma nova decoração.' }),
  Object.freeze({ id: 'remove_furniture', label: 'Remover os móveis', description: 'Deixa o ambiente livre para visualizar melhor o espaço.' }),
  Object.freeze({ id: 'clear_area', label: 'Limpar visualmente objetos e itens', description: 'Remove elementos soltos para revelar melhor a área.' }),
])

export const FURNISH_RENOVATE_STYLE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'cozy', label: 'Aconchegante', description: 'Ambientes acolhedores, claros e convidativos.' }),
  Object.freeze({ id: 'contemporary', label: 'Contemporâneo', description: 'Visual atual, elegante e com presença mais marcante.' }),
])

const FURNISH_RENOVATE_LEGACY_TRANSFORMATION_LABELS = Object.freeze({
  empty_or_nearly_empty: 'Mobiliar ambientes vazios ou quase vazios',
  mixed: 'Tenho ambientes vazios e mobiliados',
  furnished: 'Criar uma nova decoração em ambientes já mobiliados',
  clear_area: 'Limpar um terreno ou uma área para visualizar melhor o espaço',
})

const FURNISH_RENOVATE_LEGACY_STYLE_LABELS = Object.freeze({
  modern: 'Moderno',
  scandinavian: 'Escandinavo',
  sophisticated: 'Sofisticado',
})

export const FURNISH_RENOVATE_DESTINATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'instagram', label: 'Instagram', brand: 'instagram' }),
  Object.freeze({ id: 'facebook', label: 'Facebook', brand: 'facebook' }),
  Object.freeze({ id: 'whatsapp', label: 'WhatsApp', brand: 'whatsapp' }),
  Object.freeze({ id: 'real_estate_portals', label: 'Portais imobiliários', brand: 'real-estate-portals' }),
  Object.freeze({ id: 'google_ads', label: 'Google Ads', brand: 'google-ads' }),
  Object.freeze({ id: 'meta_ads', label: 'Meta Ads', brand: 'meta' }),
])

export const FURNISH_RENOVATE_AI_NOTICE = 'Como o resultado é criado por inteligência artificial, alguns detalhes do ambiente podem ser alterados para melhorar a composição visual.'

export const FURNISH_RENOVATE_COPY = Object.freeze({
  uploadQuestion: 'Envie as fotos do imóvel',
  uploadDescription: 'Adicione de 1 a 5 fotos. Cada imagem será analisada e transformada individualmente.',
  uploadHint: 'Para melhores resultados, use fotos nítidas, bem iluminadas e que mostrem claramente o ambiente.',
  reviewNotice: FURNISH_RENOVATE_AI_NOTICE,
})

const FURNISH_RENOVATE_EN_COPY = Object.freeze({
  uploadQuestion: 'Upload property photos',
  uploadDescription: 'Add 1 to 5 photos. Each image will be analyzed and transformed individually.',
  uploadHint: 'For best results, use sharp, well-lit photos that clearly show the space.',
  reviewNotice: 'Because the result is created with artificial intelligence, some details of the space may change to improve the visual composition.',
})

const FURNISH_RENOVATE_EN_TRANSFORMATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'furnish', label: 'Furnish an empty room', description: 'For spaces without furniture or nearly empty.' }),
  Object.freeze({ id: 'remove_and_redecorate', label: 'Create a completely new design', description: 'Removes current furniture and creates a new design.' }),
  Object.freeze({ id: 'remove_furniture', label: 'Remove furniture', description: 'Leaves the room open so you can see the space better.' }),
  Object.freeze({ id: 'clear_area', label: 'Visually clear objects and items', description: 'Removes loose elements to reveal the area more clearly.' }),
])

const FURNISH_RENOVATE_EN_STYLE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'cozy', label: 'Cozy', description: 'Warm, bright, and inviting spaces.' }),
  Object.freeze({ id: 'contemporary', label: 'Contemporary', description: 'A current, elegant look with a stronger presence.' }),
])

const FURNISH_RENOVATE_EN_LEGACY_TRANSFORMATION_LABELS = Object.freeze({
  empty_or_nearly_empty: 'Furnish empty or nearly empty rooms', mixed: 'I have empty and furnished rooms', furnished: 'Create a new design in furnished rooms', clear_area: 'Visually clear a lot or area to better see the space',
})
const FURNISH_RENOVATE_EN_LEGACY_STYLE_LABELS = Object.freeze({ modern: 'Modern', scandinavian: 'Scandinavian', sophisticated: 'Sophisticated' })

export function getFurnishRenovateCopy(locale = 'pt-BR') {
  return locale === 'en-US' ? FURNISH_RENOVATE_EN_COPY : FURNISH_RENOVATE_COPY
}

export function getFurnishRenovateTransformationOptions(locale = 'pt-BR') {
  return locale === 'en-US' ? FURNISH_RENOVATE_EN_TRANSFORMATION_OPTIONS : FURNISH_RENOVATE_TRANSFORMATION_OPTIONS
}

export function getFurnishRenovateStyleOptions(locale = 'pt-BR') {
  return locale === 'en-US' ? FURNISH_RENOVATE_EN_STYLE_OPTIONS : FURNISH_RENOVATE_STYLE_OPTIONS
}

export const FURNISH_RENOVATE_QUESTIONS = Object.freeze([
  ['transformation_type', 1, 'O que você quer fazer com o espaço destas imagens?'],
  ['decoration_style', 2, 'Qual estilo você prefere para os ambientes?'],
  ['images', 3, FURNISH_RENOVATE_COPY.uploadQuestion],
  ['review', 4, 'Revise seu projeto'],
])

export function canAddFurnishRenovateImages(currentCount, addedCount) {
  return currentCount >= 0 && addedCount >= 0 && currentCount + addedCount <= FURNISH_RENOVATE_MAX_IMAGES
}

export function getFurnishRenovateOptionLabel(options, value) {
  return options.find(option => option.id === value)?.label || ''
}

export function getFurnishRenovateTransformationLabel(value, locale = 'pt-BR') {
  const options = getFurnishRenovateTransformationOptions(locale)
  const legacy = locale === 'en-US' ? FURNISH_RENOVATE_EN_LEGACY_TRANSFORMATION_LABELS : FURNISH_RENOVATE_LEGACY_TRANSFORMATION_LABELS
  return getFurnishRenovateOptionLabel(options, value) || legacy[value] || ''
}

export function getFurnishRenovateStyleLabel(value, locale = 'pt-BR') {
  const options = getFurnishRenovateStyleOptions(locale)
  const legacy = locale === 'en-US' ? FURNISH_RENOVATE_EN_LEGACY_STYLE_LABELS : FURNISH_RENOVATE_LEGACY_STYLE_LABELS
  return getFurnishRenovateOptionLabel(options, value) || legacy[value] || ''
}

export function furnishRenovateRequiresStyle(value) {
  return ['furnish', 'remove_and_redecorate', 'empty_or_nearly_empty', 'mixed', 'furnished'].includes(value)
}

export function isAvailableFurnishRenovateTransformation(value) {
  return FURNISH_RENOVATE_TRANSFORMATION_OPTIONS.some(option => option.id === value)
}

export function getSmartSpaceUnitCost(value) {
  return value === 'remove_and_redecorate' ? 60 : 30
}

export function getSmartSpaceQuote(value, imageCount) {
  return getSmartSpaceUnitCost(value) * Math.max(0, Number(imageCount) || 0)
}

export function buildFurnishRenovateReviewItems({ imagesCount, transformationType, decorationStyle, locale = 'pt-BR' }) {
  const isEnglish = locale === 'en-US'
  return [
    { id: 'transformation_type', displayLabel: isEnglish ? 'Transformation type' : 'Tipo de transformação', label: getFurnishRenovateTransformationLabel(transformationType, locale) },
    ...(furnishRenovateRequiresStyle(transformationType) ? [{ id: 'decoration_style', displayLabel: isEnglish ? 'Style' : 'Estilo', label: getFurnishRenovateStyleLabel(decorationStyle, locale) }] : []),
    { id: 'images', displayLabel: isEnglish ? 'Images' : 'Imagens', label: imagesCount === 1 ? `1 ${isEnglish ? 'image' : 'imagem'}` : imagesCount > 1 ? `${imagesCount} ${isEnglish ? 'images' : 'imagens'}` : '' },
  ].filter(item => Boolean(item.label))
}
