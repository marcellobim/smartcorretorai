import { FURNISH_RENOVATE_JOURNEY_ID } from './virtualStagingFurnish.js'

export const VIRTUAL_STAGING_JOURNEYS = Object.freeze([
  {
    id: FURNISH_RENOVATE_JOURNEY_ID,
    title: 'Virtual Staging',
    description: 'Transforme fotos de ambientes vazios, quase vazios ou já mobiliados em novas apresentações visuais criadas por inteligência artificial.',
  },
  {
    id: 'life-in-property',
    title: 'Vida no Imóvel',
    description: 'Crie cenas naturais com pessoas utilizando os ambientes e torne a apresentação mais envolvente.',
    demoVideo: '/demos-videos/vida-no-imovel.mp4',
    demoAssetStatus: 'official',
  },
  {
    id: 'broker-presentation',
    title: 'Apresentação pelo Corretor',
    description: 'Utilize sua própria imagem para apresentar o imóvel de forma profissional e personalizada.',
    demoVideo: '/demos-videos/apresentacao-pelo-proprio-corretor.mp4',
    demoAssetStatus: 'official',
  },
])

const RECOVERABLE_LEGACY_JOURNEY_IDS = new Set(['life-in-property', 'broker-presentation'])

export function getVirtualStagingJourney(journeyId) {
  return VIRTUAL_STAGING_JOURNEYS.find(journey => journey.id === journeyId) || null
}

export function getVirtualStagingJourneySessionKey(journeyId) {
  return `smartcorretorai:virtual-staging:${journeyId}:active-job`
}

export function parseVirtualStagingJobRecord(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'string') return parsed.trim() ? { jobId: parsed.trim() } : null
    return typeof parsed?.jobId === 'string' && parsed.jobId.trim()
      ? { ...parsed, jobId: parsed.jobId.trim() }
      : null
  } catch {
    return typeof value === 'string' && value.trim() ? { jobId: value.trim() } : null
  }
}

export function getRecoverableVirtualStagingJourneyId(storage) {
  const candidates = VIRTUAL_STAGING_JOURNEYS.flatMap((journey, index) => {
    if (!RECOVERABLE_LEGACY_JOURNEY_IDS.has(journey.id)) return []
    const storageKey = getVirtualStagingJourneySessionKey(journey.id)
    let storedValue = null
    let record = null
    try {
      storedValue = storage?.getItem?.(storageKey)
      record = parseVirtualStagingJobRecord(storedValue)
    } catch {
      return []
    }
    if (!record) {
      if (storedValue) {
        try { storage?.removeItem?.(storageKey) } catch { /* storage indisponível: apenas ignora */ }
      }
      return []
    }
    const persistedStatus = String(record.result?.status || record.status || '').toLowerCase()
    if (['completed', 'failed'].includes(persistedStatus)) {
      try { storage?.removeItem?.(storageKey) } catch { /* storage indisponível: apenas ignora */ }
      return []
    }
    const updatedAt = Number(record.updatedAt)
    return [{ journeyId: journey.id, index, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 }]
  })

  candidates.sort((left, right) => right.updatedAt - left.updatedAt || left.index - right.index)
  return candidates[0]?.journeyId || null
}

export function isUsableVirtualStagingVideoUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
