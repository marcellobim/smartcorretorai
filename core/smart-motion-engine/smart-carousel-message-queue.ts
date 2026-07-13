import { sanitizeCaption } from './sanitize.ts'

export type SmartCarouselCommercialCommunication = {
  objective?: unknown
  propertyType?: unknown
  typology?: unknown
  uf?: unknown
  neighborhood?: unknown
  bedrooms?: unknown
  suites?: unknown
  parking?: unknown
  area?: unknown
  areaM2?: unknown
  areaSqm?: unknown
  highlights?: unknown
  stage?: unknown
  situation?: unknown
  commercialCondition?: unknown
  conditions?: unknown
  phone?: unknown
  cta?: unknown
}

export type SmartCarouselMessageQueue = {
  captions: string[]
  messages: string[]
  breathingSceneIndexes: number[]
}

function message(value: unknown) {
  return sanitizeCaption(value).toLocaleUpperCase('pt-BR')
}

function messageKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
}

function formatObjective(value: unknown) {
  const raw = message(value)
  const key = messageKey(raw)
  if (key === 'VENDA' || key === 'SALE') return 'À VENDA'
  if (key === 'LOCACAO' || key === 'ALUGUEL' || key === 'RENT') return 'PARA LOCAÇÃO'
  return raw
}

function formatCount(value: unknown, singular: string, plural: string, emptyLabel: string) {
  const raw = message(value)
  if (!raw) return ''
  const key = messageKey(raw)
  if (key === messageKey(emptyLabel)) return message(emptyLabel)
  if (/^\d+\+?$/.test(raw)) return `${raw} ${raw === '1' ? singular : plural}`
  return raw
}

function formatArea(commercial: SmartCarouselCommercialCommunication) {
  const rawValue = commercial.area ?? commercial.areaM2 ?? commercial.areaSqm
  const raw = message(rawValue)
  if (!raw) return ''
  return /^\d+(?:[.,]\d+)?$/.test(raw) ? `${raw} M²` : raw
}

function firstMessage(...values: unknown[]) {
  return values.map(message).find(Boolean) || ''
}

function distributeMessages(messages: string[], sceneCount: number) {
  const captions = Array.from({ length: sceneCount }, () => '')
  if (sceneCount < 1 || messages.length < 1) return captions
  if (messages.length >= sceneCount) {
    messages.slice(0, sceneCount).forEach((item, index) => { captions[index] = item })
    return captions
  }
  if (messages.length === 1) {
    captions[0] = messages[0]
    return captions
  }

  messages.forEach((item, index) => {
    const sceneIndex = Math.round((index * (sceneCount - 1)) / (messages.length - 1))
    captions[sceneIndex] = item
  })
  return captions
}

export function buildSmartCarouselMessageQueue(
  commercial: SmartCarouselCommercialCommunication,
  imageCount: number,
): SmartCarouselMessageQueue {
  const totalScenes = Math.max(0, Math.min(20, Math.floor(Number(imageCount) || 0)))
  if (totalScenes < 1) return { captions: [], messages: [], breathingSceneIndexes: [] }

  const ctaText = message(commercial.cta)
  const phone = message(commercial.phone)
  const cta = [ctaText, phone].filter(Boolean).join(' - ')
  const seen = new Set([cta, ctaText, phone].filter(Boolean).map(messageKey))
  const messages: string[] = []
  const add = (value: unknown) => {
    const item = message(value)
    const key = messageKey(item)
    if (!item || !key || seen.has(key)) return
    seen.add(key)
    messages.push(item)
  }

  add(commercial.neighborhood)

  const propertyType = firstMessage(commercial.propertyType, commercial.typology)
  const objective = formatObjective(commercial.objective)
  add([propertyType, objective].filter(Boolean).join(' '))
  if (propertyType) seen.add(messageKey(propertyType))
  if (objective) seen.add(messageKey(objective))

  add(formatCount(commercial.bedrooms, 'DORMITÓRIO', 'DORMITÓRIOS', 'SEM DORMITÓRIO'))
  add(formatCount(commercial.suites, 'SUÍTE', 'SUÍTES', 'SEM SUÍTE'))
  add(formatCount(commercial.parking, 'VAGA', 'VAGAS', 'SEM VAGA'))
  add(formatArea(commercial))

  const highlights = Array.isArray(commercial.highlights) ? commercial.highlights : []
  highlights.forEach(add)

  add(commercial.situation)
  add(commercial.stage)
  add(commercial.commercialCondition)
  if (Array.isArray(commercial.conditions)) commercial.conditions.forEach(add)
  else add(commercial.conditions)
  add(commercial.typology)

  const messageScenes = totalScenes - 1
  const captions = distributeMessages(messages.slice(0, messageScenes), messageScenes)
  captions.push(cta)

  return {
    captions,
    messages: captions.filter(Boolean),
    breathingSceneIndexes: captions
      .map((caption, index) => ({ caption, index }))
      .filter(({ caption, index }) => !caption && index < totalScenes - 1)
      .map(({ index }) => index),
  }
}
