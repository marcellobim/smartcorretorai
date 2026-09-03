export const FURNISH_RENOVATE_JOURNEY_ID = 'furnish-renovate'
export const FURNISH_RENOVATE_MAX_IMAGES = 5

export const VIRTUAL_STAGING_CHAT_INTRO = Object.freeze({
  title: 'Smart Space',
  description: 'Transforme ambientes e mostre novas possibilidades para cada espaço.',
  action: 'Começar',
})

export const FURNISH_RENOVATE_TRANSFORMATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'furnish', label: 'Mobiliar um espaço vazio com móveis e uma nova decoração' }),
  Object.freeze({ id: 'remove_and_redecorate', label: 'Remover os móveis e criar uma decoração completamente nova' }),
  Object.freeze({ id: 'remove_furniture', label: 'Remover os móveis para visualizar o espaço livre' }),
  Object.freeze({ id: 'clear_area', label: 'Limpar um terreno ou uma área para visualizar melhor o espaço' }),
])

export const FURNISH_RENOVATE_STYLE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'cozy', label: 'Aconchegante', description: 'Ambientes acolhedores, claros e convidativos.' }),
  Object.freeze({ id: 'contemporary', label: 'Contemporâneo', description: 'Visual atual, elegante e com presença mais marcante.' }),
])

const FURNISH_RENOVATE_LEGACY_TRANSFORMATION_LABELS = Object.freeze({
  empty_or_nearly_empty: 'Mobiliar ambientes vazios ou quase vazios',
  mixed: 'Tenho ambientes vazios e mobiliados',
  furnished: 'Criar uma nova decoração em ambientes já mobiliados',
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
  destinationsHint: 'Selecione todos os canais em que deseja utilizar os resultados.',
  reviewNotice: FURNISH_RENOVATE_AI_NOTICE,
})

export const FURNISH_RENOVATE_QUESTIONS = Object.freeze([
  ['transformation_type', 1, 'O que você quer fazer com o espaço destas imagens?'],
  ['decoration_style', 2, 'Qual estilo você prefere para os ambientes?'],
  ['images', 3, FURNISH_RENOVATE_COPY.uploadQuestion],
  ['image_destinations', 4, 'Onde você pretende usar estas imagens?'],
  ['review', 5, 'Revise seu projeto'],
])

export function canAddFurnishRenovateImages(currentCount, addedCount) {
  return currentCount >= 0 && addedCount >= 0 && currentCount + addedCount <= FURNISH_RENOVATE_MAX_IMAGES
}

export function getFurnishRenovateOptionLabel(options, value) {
  return options.find(option => option.id === value)?.label || ''
}

export function getFurnishRenovateTransformationLabel(value) {
  return getFurnishRenovateOptionLabel(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS, value) || FURNISH_RENOVATE_LEGACY_TRANSFORMATION_LABELS[value] || ''
}

export function getFurnishRenovateStyleLabel(value) {
  return getFurnishRenovateOptionLabel(FURNISH_RENOVATE_STYLE_OPTIONS, value) || FURNISH_RENOVATE_LEGACY_STYLE_LABELS[value] || ''
}

export function furnishRenovateRequiresStyle(value) {
  return ['furnish', 'remove_and_redecorate', 'empty_or_nearly_empty', 'mixed', 'furnished'].includes(value)
}

export function getSmartSpaceUnitCost(value) {
  return value === 'remove_and_redecorate' ? 60 : 30
}

export function getSmartSpaceQuote(value, imageCount) {
  return getSmartSpaceUnitCost(value) * Math.max(0, Number(imageCount) || 0)
}

export function buildFurnishRenovateReviewItems({ imagesCount, transformationType, decorationStyle, imageDestinations }) {
  return [
    { id: 'transformation_type', displayLabel: 'Tipo de transformação', label: getFurnishRenovateTransformationLabel(transformationType) },
    ...(furnishRenovateRequiresStyle(transformationType) ? [{ id: 'decoration_style', displayLabel: 'Estilo', label: getFurnishRenovateStyleLabel(decorationStyle) }] : []),
    { id: 'images', displayLabel: 'Imagens', label: imagesCount === 1 ? '1 imagem' : imagesCount > 1 ? `${imagesCount} imagens` : '' },
    { id: 'image_destinations', displayLabel: 'Destino das imagens', label: FURNISH_RENOVATE_DESTINATION_OPTIONS.filter(option => imageDestinations.includes(option.id)).map(option => option.label).join(' · ') },
  ].filter(item => Boolean(item.label))
}
