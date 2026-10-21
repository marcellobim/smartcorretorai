import { VIRTUAL_STAGING_MAX_IMAGES, VIRTUAL_STAGING_PRODUCT_DESCRIPTOR, VIRTUAL_STAGING_PRODUCT_NAME } from './virtualStaging.js'

export const FURNISH_RENOVATE_JOURNEY_ID = 'furnish-renovate'
// Virtual Staging always uses the product-wide 1–5 image contract. It is not
// a guest/trial-specific limit and must stay aligned with the normal product.
export const FURNISH_RENOVATE_MAX_IMAGES = VIRTUAL_STAGING_MAX_IMAGES

export const VIRTUAL_STAGING_CHAT_INTRO = Object.freeze({
  title: VIRTUAL_STAGING_PRODUCT_NAME,
  description: VIRTUAL_STAGING_PRODUCT_DESCRIPTOR,
  action: 'Começar',
})

export const FURNISH_RENOVATE_TRANSFORMATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'remove_furniture', label: 'Limpar o ambiente', description: 'Remove móveis, decoração e objetos soltos para deixar o espaço limpo.' }),
  Object.freeze({ id: 'remove_and_redecorate', label: 'Redecorar completamente', description: 'Primeiro limpa o ambiente; depois cria uma decoração nova do zero.' }),
])

export const FURNISH_RENOVATE_STYLE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'cozy', label: 'Aconchegante', description: 'Ambientes acolhedores, claros e convidativos.' }),
  Object.freeze({ id: 'contemporary', label: 'Contemporâneo', description: 'Visual atual, elegante e com presença mais marcante.' }),
])

const FURNISH_RENOVATE_LEGACY_TRANSFORMATION_LABELS = Object.freeze({
  furnish: 'Mobiliar um ambiente vazio',
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
  Object.freeze({ id: 'social', label: 'Redes sociais' }),
  Object.freeze({ id: 'portal', label: 'Portal / plataforma imobiliária' }),
])

export const FURNISH_RENOVATE_AI_NOTICE = 'Como o resultado é criado por inteligência artificial, alguns detalhes do ambiente podem ser alterados para melhorar a composição visual.'

export const FURNISH_RENOVATE_COPY = Object.freeze({
  transformationQuestion: 'O que você quer fazer com o espaço destas imagens?',
  styleQuestion: 'Qual estilo você prefere para os ambientes?',
  uploadQuestion: 'Envie as fotos do imóvel',
  uploadDescription: 'Adicione de 1 a 5 fotos. Cada imagem será analisada e transformada individualmente.',
  uploadHint: 'Para melhores resultados, use fotos nítidas, bem iluminadas e que mostrem claramente o ambiente.',
  destinationQuestion: 'Onde você vai usar este material?',
  socialOptionsQuestion: 'Deseja incluir dados do imóvel?',
  socialProperty: 'Dados do imóvel', socialCaption: 'Legenda', socialCta: 'CTA', socialPhone: 'Telefone', socialIdentity: 'Identificação profissional',
  socialPropertyQuestion: 'Conte um pouco sobre o imóvel',
  socialPropertyHelp: 'Todos os campos são opcionais. Informe apenas o que deseja usar na legenda.',
  socialCaptionDecisionQuestion: 'Deseja incluir uma legenda?',
  socialCaptionModeQuestion: 'Como deseja preparar a legenda?',
  socialCaptionGenerated: 'Usar legenda gerada pela SNETIA', socialCaptionCustom: 'Escrever minha própria legenda',
  socialCaptionNeedsDetails: 'Adicione ao menos uma informação do imóvel para gerar uma legenda factual.',
  socialCaptionCustomQuestion: 'Escreva sua legenda',
  socialCtaDecisionQuestion: 'Deseja incluir um CTA?',
  socialPhoneDecisionQuestion: 'Deseja incluir seu telefone profissional?',
  socialIdentityDecisionQuestion: 'Deseja incluir sua identificação profissional?',
  reviewQuestion: 'Revise seu projeto',
  reviewNotice: FURNISH_RENOVATE_AI_NOTICE,
  imagesConfirmation: 'Ótimo! As fotos serão usadas na ordem escolhida.',
})

const FURNISH_RENOVATE_EN_COPY = Object.freeze({
  transformationQuestion: 'What would you like to do with these spaces?',
  styleQuestion: 'Which style do you prefer for the spaces?',
  uploadQuestion: 'Upload property photos',
  uploadDescription: 'Add 1 to 5 photos. Each image will be analyzed and transformed individually.',
  uploadHint: 'For best results, use sharp, well-lit photos that clearly show the space.',
  destinationQuestion: 'Where will you use this content?',
  socialOptionsQuestion: 'Would you like to include property details?',
  socialProperty: 'Property details', socialCaption: 'Caption', socialCta: 'CTA', socialPhone: 'Phone', socialIdentity: 'Professional identity',
  socialPropertyQuestion: 'Tell us about the property',
  socialPropertyHelp: 'Everything is optional. Add only what you want to use in the caption.',
  socialCaptionDecisionQuestion: 'Would you like to include a caption?',
  socialCaptionModeQuestion: 'How would you like to prepare the caption?',
  socialCaptionGenerated: 'Use a SNETIA-generated caption', socialCaptionCustom: 'Write my own caption',
  socialCaptionNeedsDetails: 'Add at least one property detail to generate a factual caption.',
  socialCaptionCustomQuestion: 'Write your caption',
  socialCtaDecisionQuestion: 'Would you like to include a CTA?',
  socialPhoneDecisionQuestion: 'Would you like to include your professional phone number?',
  socialIdentityDecisionQuestion: 'Would you like to include your professional identity?',
  reviewQuestion: 'Review your project',
  reviewNotice: 'Because the result is created with artificial intelligence, some details of the space may change to improve the visual composition.',
  imagesConfirmation: 'Great! The photos will be used in the selected order.',
})

const FURNISH_RENOVATE_EN_TRANSFORMATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'remove_furniture', label: 'Clear the space', description: 'Removes furniture, décor, and loose objects for a clean space.' }),
  Object.freeze({ id: 'remove_and_redecorate', label: 'Redesign completely', description: 'First clears the space, then creates a new design from scratch.' }),
])

const FURNISH_RENOVATE_EN_STYLE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'cozy', label: 'Cozy', description: 'Warm, bright, and inviting spaces.' }),
  Object.freeze({ id: 'contemporary', label: 'Contemporary', description: 'A current, elegant look with a stronger presence.' }),
])

const FURNISH_RENOVATE_EN_LEGACY_TRANSFORMATION_LABELS = Object.freeze({
  furnish: 'Furnish an empty room',
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

export function getFurnishRenovateDestinationOptions(locale = 'pt-BR') {
  return locale === 'en-US'
    ? [{ id: 'social', label: 'Social media' }, { id: 'portal', label: 'Real estate portal / platform' }]
    : FURNISH_RENOVATE_DESTINATION_OPTIONS
}

export function getFurnishRenovateSocialOptions(locale = 'pt-BR') {
  const copy = getFurnishRenovateCopy(locale)
  return [
    { id: 'property', label: copy.socialProperty },
    { id: 'caption', label: copy.socialCaption },
    { id: 'cta', label: copy.socialCta },
    { id: 'phone', label: copy.socialPhone },
    { id: 'identity', label: copy.socialIdentity },
  ]
}

export const FURNISH_RENOVATE_QUESTIONS = Object.freeze([
  ['transformation_type', 1, FURNISH_RENOVATE_COPY.transformationQuestion],
  ['decoration_style', 2, FURNISH_RENOVATE_COPY.styleQuestion],
  ['images', 3, FURNISH_RENOVATE_COPY.uploadQuestion],
  ['use_destination', 4, FURNISH_RENOVATE_COPY.destinationQuestion],
  ['social_options', 5, FURNISH_RENOVATE_COPY.socialOptionsQuestion],
  ['social_property_details', 5, FURNISH_RENOVATE_COPY.socialPropertyQuestion],
  ['social_caption_decision', 5, FURNISH_RENOVATE_COPY.socialCaptionDecisionQuestion],
  ['social_caption_mode', 5, FURNISH_RENOVATE_COPY.socialCaptionModeQuestion],
  ['social_caption_custom', 5, FURNISH_RENOVATE_COPY.socialCaptionCustomQuestion],
  ['social_cta_decision', 5, FURNISH_RENOVATE_COPY.socialCtaDecisionQuestion],
  ['cta', 5, 'Qual chamada deseja usar?'],
  ['social_phone_decision', 5, FURNISH_RENOVATE_COPY.socialPhoneDecisionQuestion],
  ['phone', 5, 'Deseja incluir seu telefone profissional?'],
  ['social_identity_decision', 5, FURNISH_RENOVATE_COPY.socialIdentityDecisionQuestion],
  ['professional_identity', 5, 'Deseja incluir sua identificação profissional?'],
  ['review', 6, FURNISH_RENOVATE_COPY.reviewQuestion],
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

export function isRecoverableFurnishRenovateTransformation(value) {
  return isAvailableFurnishRenovateTransformation(value) || Object.prototype.hasOwnProperty.call(FURNISH_RENOVATE_LEGACY_TRANSFORMATION_LABELS, value)
}

export function getSmartSpaceUnitCost(value) {
  return value === 'remove_and_redecorate' ? 60 : 30
}

export function getSmartSpaceQuote(value, imageCount) {
  return getSmartSpaceUnitCost(value) * Math.max(0, Number(imageCount) || 0)
}

export function getFurnishRenovateSelectionQuote({ images = [], transformationType = '', balance = null } = {}) {
  const imageCount = Array.isArray(images) ? images.length : 0
  const unitCost = getSmartSpaceUnitCost(transformationType)
  const totalCost = getSmartSpaceQuote(transformationType, imageCount)
  const hasValidImageCount = imageCount >= 1 && imageCount <= FURNISH_RENOVATE_MAX_IMAGES
  const hasSufficientBalance = balance === null || balance >= totalCost

  return Object.freeze({ imageCount, unitCost, totalCost, hasValidImageCount, hasSufficientBalance })
}

export function buildFurnishRenovateReviewItems({ imagesCount, transformationType, decorationStyle, useDestination = '', socialOptions = {}, locale = 'pt-BR' }) {
  const isEnglish = locale === 'en-US'
  return [
    { id: 'transformation_type', displayLabel: isEnglish ? 'Transformation type' : 'Tipo de transformação', label: getFurnishRenovateTransformationLabel(transformationType, locale) },
    ...(furnishRenovateRequiresStyle(transformationType) ? [{ id: 'decoration_style', displayLabel: isEnglish ? 'Style' : 'Estilo', label: getFurnishRenovateStyleLabel(decorationStyle, locale) }] : []),
    { id: 'images', displayLabel: isEnglish ? 'Images' : 'Imagens', label: imagesCount === 1 ? `1 ${isEnglish ? 'image' : 'imagem'}` : imagesCount > 1 ? `${imagesCount} ${isEnglish ? 'images' : 'imagens'}` : '' },
    ...(useDestination ? [{ id: 'use_destination', displayLabel: isEnglish ? 'Use' : 'Uso', label: getFurnishRenovateDestinationOptions(locale).find(option => option.id === useDestination)?.label || '' }] : []),
    ...(useDestination === 'social' && Object.values(socialOptions).some(value => value === true)
      ? [{ id: 'social_options', displayLabel: isEnglish ? 'Social delivery' : 'Entrega social', label: getFurnishRenovateSocialOptions(locale).filter(option => socialOptions[option.id]).map(option => option.label).join(' · ') }]
      : []),
  ].filter(item => Boolean(item.label))
}
