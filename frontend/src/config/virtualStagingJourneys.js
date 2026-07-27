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
