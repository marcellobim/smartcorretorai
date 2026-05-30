import { CREDIT_COSTS } from './creditCosts'

export const CAMPAIGN_MODES = {
  economica: {
    id: 'economica',
    name: 'Economica',
    label: 'Econômica',
    shortDescription: 'Pacote leve com artes essenciais e um video basico.',
    creditCost: CREDIT_COSTS.packages.economica,
    videoIaPremium: false,
    estimatedDeliverables: {
      premiumArts: 4,
      premiumVideos: 1,
    },
  },
  premium_ia: {
    id: 'premium_ia',
    name: 'Premium IA',
    label: 'Premium IA',
    shortDescription: 'Artes premium com textos IA inclusos sem consumo adicional.',
    creditCost: CREDIT_COSTS.packages.premium_ia,
    videoIaPremium: false,
    estimatedDeliverables: {
      premiumArts: 4,
      premiumVideos: 0,
    },
  },
  completa: {
    id: 'completa',
    name: 'Completa',
    label: 'Completa',
    shortDescription: 'Pacote completo com artes premium, videos e formatos principais.',
    creditCost: CREDIT_COSTS.packages.completa,
    videoIaPremium: true,
    estimatedDeliverables: {
      premiumArts: 8,
      premiumVideos: 2,
    },
  },
}

export const CAMPAIGN_MODE_ORDER = ['economica', 'premium_ia', 'completa']

export const getCampaignMode = (modeId) => CAMPAIGN_MODES[modeId] || null

export default CAMPAIGN_MODES
