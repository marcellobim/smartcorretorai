export const VIRTUAL_STAGING_JOURNEYS = Object.freeze([
  {
    id: 'furnish-renovate',
    title: 'Mobiliar e Renovar',
    description: 'Adicione móveis, substitua a decoração ou transforme completamente os ambientes preservando a estrutura original do imóvel.',
    demoVideo: '/demos-videos/animar-imagens.mp4',
    demoAssetStatus: 'temporary',
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
    demoVideo: '/demos-videos/corretor-virtual.mp4',
    demoAssetStatus: 'temporary',
  },
])

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
    let record = null
    try {
      record = parseVirtualStagingJobRecord(storage?.getItem?.(getVirtualStagingJourneySessionKey(journey.id)))
    } catch {
      return []
    }
    if (!record) return []
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
