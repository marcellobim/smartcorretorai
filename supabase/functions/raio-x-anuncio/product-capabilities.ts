export type ListingXrayProductId =
  | 'virtual_staging' | 'life_in_property' | 'broker_presentation' | 'real_estate_video'
  | 'commercial_real_estate' | 'creative_video' | 'quick_banners' | 'real_estate_banner'
  | 'smart_carousel' | 'text_campaign'

export type ProductCapability = {
  product_id: ListingXrayProductId
  public_name: string
  route: string
  purpose: string
  input_type: 'image' | 'images' | 'text' | 'mixed'
  minimum: number | null
  maximum: number | null
  price_st: number
  cta_label: string
}

const cost = (productCode: string, variant = 'standard') => getEconomicSku(productCode, variant).smartTokenCost

// Fonte server-side auditada contra os contratos atuais. O Raio-X apenas navega.
export const LISTING_XRAY_PRODUCT_CAPABILITIES = Object.freeze({
  virtual_staging: { product_id: 'virtual_staging', public_name: 'Virtual Staging', route: '/virtual-staging', purpose: 'Criar uma nova proposta visual para um ambiente vazio ou quase vazio.', input_type: 'image', minimum: 1, maximum: 5, price_st: cost('virtual_staging', 'image'), cta_label: 'Conhecer Virtual Staging' },
  life_in_property: { product_id: 'life_in_property', public_name: 'Vida no Imóvel', route: '/virtual-staging', purpose: 'Dar movimento a uma imagem adequada do imóvel.', input_type: 'image', minimum: 1, maximum: 5, price_st: cost('life_in_property'), cta_label: 'Conhecer Vida no Imóvel' },
  broker_presentation: { product_id: 'broker_presentation', public_name: 'Apresentação pelo Corretor', route: '/virtual-staging', purpose: 'Humanizar a apresentação com o corretor e material visual do imóvel.', input_type: 'mixed', minimum: 1, maximum: 5, price_st: cost('broker_presentation'), cta_label: 'Conhecer Apresentação pelo Corretor' },
  real_estate_video: { product_id: 'real_estate_video', public_name: 'Vídeo Imobiliário', route: '/smart-tour-ai', purpose: 'Criar uma apresentação em vídeo com uma seleção das melhores fotos.', input_type: 'images', minimum: 1, maximum: 5, price_st: cost('real_estate_video'), cta_label: 'Criar Vídeo Imobiliário' },
  commercial_real_estate: { product_id: 'commercial_real_estate', public_name: 'Comercial Imobiliário', route: '/studio-hero', purpose: 'Transformar uma oportunidade comercial em peça promocional.', input_type: 'mixed', minimum: 1, maximum: 1, price_st: cost('real_estate_commercial'), cta_label: 'Criar Comercial Imobiliário' },
  creative_video: { product_id: 'creative_video', public_name: 'Vídeo Criativo', route: '/studio-hero', purpose: 'Criar um vídeo a partir de uma ideia criativa.', input_type: 'text', minimum: 1, maximum: 1, price_st: cost('creative_video'), cta_label: 'Criar Vídeo Criativo' },
  quick_banners: { product_id: 'quick_banners', public_name: 'Banners Rápidos', route: '/nova-campanha', purpose: 'Criar peças rápidas para divulgar uma chamada comercial.', input_type: 'mixed', minimum: 1, maximum: 5, price_st: cost('quick_banners', 'item'), cta_label: 'Criar Banners Rápidos' },
  real_estate_banner: { product_id: 'real_estate_banner', public_name: 'Banner Imobiliário', route: '/hero', purpose: 'Organizar os diferenciais em uma peça visual imobiliária estruturada.', input_type: 'mixed', minimum: 1, maximum: 4, price_st: cost('real_estate_banner', 'item'), cta_label: 'Criar Banner Imobiliário' },
  smart_carousel: { product_id: 'smart_carousel', public_name: 'Smart Carrossel', route: '/smart-carrossel', purpose: 'Apresentar o imóvel em uma sequência visual.', input_type: 'images', minimum: SMART_CAROUSEL_MIN_IMAGES, maximum: SMART_CAROUSEL_MAX_IMAGES, price_st: cost('smart_carousel'), cta_label: 'Criar Smart Carrossel' },
  text_campaign: { product_id: 'text_campaign', public_name: 'Campanha de Textos', route: '/campanha-de-textos', purpose: 'Adaptar fatos confirmados do imóvel para outros canais.', input_type: 'text', minimum: 1, maximum: 1, price_st: cost('text_campaign'), cta_label: 'Criar Campanha de Textos' },
} satisfies Record<ListingXrayProductId, ProductCapability>)

export const listingXrayProductCapability = (productId: ListingXrayProductId) => LISTING_XRAY_PRODUCT_CAPABILITIES[productId]
import { getEconomicSku } from '../_shared/economic-catalog.ts'
import { SMART_CAROUSEL_MAX_IMAGES, SMART_CAROUSEL_MIN_IMAGES } from '../_shared/smart-carousel-economy.ts'
