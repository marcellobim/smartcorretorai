import { CAMPAIGN_MODES } from './campaignModes'
import { getSelectedTemplatesFromCatalogIds } from './templateCatalog'

export const CAMPAIGN_IDS = {
  venda_rapida: 'venda_rapida',
  luxo_premium: 'luxo_premium',
  lancamento: 'lancamento',
  mcmv: 'mcmv',
  airbnb_temporada: 'airbnb_temporada',
  comercial: 'comercial',
  captacao_imovel: 'captacao_imovel',
}

const createMode = (modeId, catalogItems) => ({
  ...CAMPAIGN_MODES[modeId],
  catalogItems,
  selectedTemplates: getSelectedTemplatesFromCatalogIds(catalogItems),
})

export const CAMPAIGN_TEMPLATES = {
  venda_rapida: {
    id: CAMPAIGN_IDS.venda_rapida,
    name: 'Venda Rapida',
    label: 'Venda Rápida',
    description: 'Campanha direta para gerar interesse rapido em imoveis prontos.',
    bestUse: 'Imoveis prontos para venda e captacao imediata de leads.',
    modes: {
      economica: createMode('economica', [
        'real_estate_banner',
        'real_estate_card',
        'new_listing_story',
        'sc_reels_moderno_01',
      ]),
      premium_ia: createMode('premium_ia', [
        'sc_banner_luxo_01',
        'real_estate_detailed',
        'triple_slide_carousel',
        'chat_with_photos',
      ]),
      completa: createMode('completa', [
        'sc_banner_luxo_01',
        'real_estate_banner',
        'real_estate_card',
        'real_estate_detailed',
        'triple_slide_carousel',
        'new_listing_story',
        'chat_with_photos',
        'sc_reels_moderno_01',
        'real_estate_video_montage',
      ]),
    },
  },
  luxo_premium: {
    id: CAMPAIGN_IDS.luxo_premium,
    name: 'Luxo Premium',
    label: 'Luxo Premium',
    description: 'Campanha sofisticada para destacar exclusividade e acabamento.',
    bestUse: 'Alto padrao, cobertura, vista privilegiada e fotos fortes.',
    modes: {
      economica: createMode('economica', [
        'sc_banner_luxo_01',
        'sc_story_premium_01',
        'polaroid_photos',
        'sc_video_cinematic_01',
      ]),
      premium_ia: createMode('premium_ia', [
        'sc_banner_luxo_01',
        'searchlight_reveal',
        'polaroid_photos',
        'sc_story_premium_01',
      ]),
      completa: createMode('completa', [
        'sc_banner_luxo_01',
        'sc_story_premium_01',
        'searchlight_reveal',
        'polaroid_photos',
        'photo_montage',
        'sc_video_cinematic_01',
        'video_compilation',
      ]),
    },
  },
  lancamento: {
    id: CAMPAIGN_IDS.lancamento,
    name: 'Lancamento',
    label: 'Lançamento',
    description: 'Campanha para expectativa, urgencia e apresentacao de empreendimento.',
    bestUse: 'Pre-venda, obra, planta, em construcao e oportunidade.',
    modes: {
      economica: createMode('economica', [
        'new_listing_story',
        'triple_slide_carousel',
        'sc_story_premium_01',
        'sc_reels_moderno_01',
      ]),
      premium_ia: createMode('premium_ia', [
        'new_listing_story',
        'sc_story_premium_01',
        'triple_slide_carousel',
        'searchlight_reveal',
      ]),
      completa: createMode('completa', [
        'new_listing_story',
        'triple_slide_carousel',
        'sc_story_premium_01',
        'sc_banner_luxo_01',
        'real_estate_detailed',
        'sc_reels_moderno_01',
        'real_estate_video_montage',
      ]),
    },
  },
  mcmv: {
    id: CAMPAIGN_IDS.mcmv,
    name: 'Minha Casa Minha Vida',
    label: 'Minha Casa Minha Vida',
    description: 'Campanha clara para preco, financiamento e conversa no WhatsApp.',
    bestUse: 'Primeiro imovel, FGTS, subsidio e entrada facilitada.',
    modes: {
      economica: createMode('economica', [
        'sc_banner_popular_01',
        'real_estate_card',
        'chat_with_photos',
        'sc_reels_moderno_01',
      ]),
      premium_ia: createMode('premium_ia', [
        'sc_banner_popular_01',
        'real_estate_card',
        'triple_slide_carousel',
        'animated_review',
      ]),
      completa: createMode('completa', [
        'sc_banner_popular_01',
        'real_estate_card',
        'real_estate_detailed',
        'triple_slide_carousel',
        'chat_with_photos',
        'animated_review',
        'sc_reels_moderno_01',
      ]),
    },
  },
  airbnb_temporada: {
    id: CAMPAIGN_IDS.airbnb_temporada,
    name: 'Airbnb / Temporada',
    label: 'Airbnb / Temporada',
    description: 'Campanha focada em experiencia, ambientes, lazer e reserva.',
    bestUse: 'Imovel mobiliado, praia, lazer, estadia curta e diaria.',
    modes: {
      economica: createMode('economica', [
        'polaroid_photos',
        'photo_montage',
        'new_listing_story',
        'sc_reels_moderno_01',
      ]),
      premium_ia: createMode('premium_ia', [
        'polaroid_photos',
        'searchlight_reveal',
        'photo_montage',
        'chat_with_photos',
      ]),
      completa: createMode('completa', [
        'polaroid_photos',
        'photo_montage',
        'real_estate_video_montage',
        'image_slideshow',
        'new_listing_story',
        'sc_reels_moderno_01',
        'chat_with_photos',
      ]),
    },
  },
  comercial: {
    id: CAMPAIGN_IDS.comercial,
    name: 'Comercial',
    label: 'Comercial',
    description: 'Campanha objetiva para metragem, localizacao e decisao B2B.',
    bestUse: 'Sala, loja, galpao, terreno e ponto comercial.',
    modes: {
      economica: createMode('economica', [
        'real_estate_banner',
        'real_estate_detailed',
        'real_estate_card',
        'image_slideshow',
      ]),
      premium_ia: createMode('premium_ia', [
        'real_estate_banner',
        'real_estate_detailed',
        'sc_video_cinematic_01',
        'video_compilation',
      ]),
      completa: createMode('completa', [
        'real_estate_banner',
        'real_estate_card',
        'real_estate_detailed',
        'triple_slide_carousel',
        'image_slideshow',
        'video_compilation',
        'sc_video_cinematic_01',
      ]),
    },
  },
  captacao_imovel: {
    id: CAMPAIGN_IDS.captacao_imovel,
    name: 'Captacao de Imovel',
    label: 'Captação de Imóvel',
    description: 'Campanha para atrair proprietarios e gerar conversas de avaliacao.',
    bestUse: 'Autoridade do corretor, avaliacao gratuita e captacao de carteira.',
    modes: {
      economica: createMode('economica', [
        'animated_review',
        'chat_with_photos',
        'searchlight_reveal',
        'real_estate_card',
      ]),
      premium_ia: createMode('premium_ia', [
        'animated_review',
        'searchlight_reveal',
        'chat_with_photos',
        'polaroid_photos',
      ]),
      completa: createMode('completa', [
        'animated_review',
        'searchlight_reveal',
        'chat_with_photos',
        'polaroid_photos',
        'new_listing_story',
        'sc_reels_moderno_01',
      ]),
    },
  },
}

export const CAMPAIGN_TEMPLATE_OPTIONS = Object.values(CAMPAIGN_TEMPLATES)

export const getCampaignModeTemplates = (campaignId, modeId) => (
  CAMPAIGN_TEMPLATES[campaignId]?.modes?.[modeId]?.selectedTemplates || []
)

export default CAMPAIGN_TEMPLATES
