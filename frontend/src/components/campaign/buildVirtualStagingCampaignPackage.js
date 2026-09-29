import { normalizeOfficialHashtags } from '../../../../supabase/functions/_shared/official-hashtags.ts'
import { buildGoogleAdsDelivery } from '../../../../supabase/functions/_shared/google-ads.ts'
import { presentCta, presentHighlights, presentLifeProfile, presentMetricLabel, presentPropertyType, presentPurpose } from '../../../../supabase/functions/_shared/virtual-staging/presentation.ts'

const clean = value => String(value || '').trim()
const location = property => [property.district, property.city, property.state].filter(Boolean).join(', ')
const validGeneratedHashtags = hashtags => Array.isArray(hashtags)
  ? hashtags.filter(value => typeof value === 'string' && /^#[\p{L}\p{N}_]+$/u.test(value.trim()))
  : []
const translations = {
  'pt-BR': { intro: 'Conheça', sale: 'à venda', rent: 'para locação', in: 'em', details: 'Destaques', contact: 'Entre em contato para saber mais.', bedrooms:'dormitórios',suites:'suítes',parking:'vagas' },
  'en-US': { intro: 'Discover', sale: 'for sale', rent: 'for rent', in: 'in', details: 'Highlights', contact: 'Get in touch to learn more.', bedrooms:'bedrooms',suites:'suites',parking:'parking spaces' },
  es: { intro: 'Descubre', sale: 'en venta', rent: 'en alquiler', in: 'en', details: 'Características', contact: 'Contáctanos para más información.', bedrooms:'dormitorios',suites:'suites',parking:'plazas de garaje' },
}
export function mergeVirtualStagingCampaignHashtags(campaignPackage, generatedHashtags) {
  const validHashtags = validGeneratedHashtags(generatedHashtags)
  if (!validHashtags.length) return campaignPackage
  const hashtags = normalizeOfficialHashtags(validHashtags, {
    purpose: campaignPackage?.purpose,
    propertyType: campaignPackage?.propertyType,
    city: campaignPackage?.city,
    district: campaignPackage?.district,
    state: campaignPackage?.state,
    bedrooms: campaignPackage?.bedrooms,
    suites: campaignPackage?.suites,
    parkingSpaces: campaignPackage?.parkingSpaces,
    highlights: campaignPackage?.highlights,
    cta: campaignPackage?.cta,
    language: campaignPackage?.language,
  })
  return {
    ...campaignPackage,
    aiCampaigns: (campaignPackage?.aiCampaigns || []).map(campaign => ({ ...campaign, hashtags })),
  }
}

export function buildVirtualStagingCampaignPackage({ property, language, cta, phone, videoUrl = '', hashtags: generatedHashtags = [], journeyId = '', lifeScene = '' }) {
  const socialLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const text = translations[socialLanguage]
  const isLife = journeyId === 'life-in-property'
  const localizedPurpose = socialLanguage === 'en-US' ? presentPurpose(property.purpose, socialLanguage).toLocaleLowerCase('en-US') : property.purpose === 'rent' ? text.rent : text.sale
  const propertyType = socialLanguage === 'en-US' ? presentPropertyType(property.type, socialLanguage).toLocaleLowerCase('en-US') : clean(property.type).toLocaleLowerCase(socialLanguage)
  const subject = [text.intro, propertyType, localizedPurpose, location(property) && `${text.in} ${location(property)}`].filter(Boolean).join(' ')
  const factLine = [property.bedrooms && `${property.bedrooms} ${presentMetricLabel('bedrooms', socialLanguage)}`, property.suites && `${property.suites} ${presentMetricLabel('suites', socialLanguage)}`, property.parkingSpaces && `${property.parkingSpaces} ${presentMetricLabel('parkingSpaces', socialLanguage)}`, socialLanguage === 'pt-BR' && property.area && `${property.area} m²`].filter(Boolean).join(' · ')
  const localizedHighlights = socialLanguage === 'en-US' ? presentHighlights(property.highlights, socialLanguage) : property.highlights || []
  const lifeProfile = isLife && socialLanguage === 'en-US' ? presentLifeProfile(lifeScene, socialLanguage) : ''
  const detail = [factLine, localizedHighlights.length ? `${text.details}: ${localizedHighlights.slice(0, 3).join(', ')}` : '', lifeProfile && `Lifestyle: ${lifeProfile}`, socialLanguage === 'pt-BR' ? clean(property.description) : '', clean(property.price)].filter(Boolean).join('\n\n')
  const localizedCta = clean(cta) ? presentCta(cta, socialLanguage) : isLife ? text.contact : ''
  const close = [localizedCta, phone].filter(Boolean).join('\n')
  const variants = [
    `${subject}.\n\n${detail}\n\n${close}`,
    `${localizedHighlights[0] || subject}.\n\n${subject}.\n\n${detail}\n\n${close}`,
    `${subject}.\n\n${localizedHighlights.slice(0,3).join(' · ') || detail}\n\n${close}`,
  ]
  const hashtags = normalizeOfficialHashtags(generatedHashtags, { purpose:property.purpose, propertyType:property.type, propertyStage:property.stage, city:property.city, district:property.district, state:property.state, bedrooms:property.bedrooms, suites:property.suites, parkingSpaces:property.parkingSpaces, highlights:property.highlights, cta:localizedCta, language:socialLanguage })
  const googleAds = buildGoogleAdsDelivery({ purpose:property.purpose, propertyType:property.type, district:property.district, city:property.city, state:property.state, bedrooms:property.bedrooms, suites:property.suites, highlights:localizedHighlights, cta:localizedCta })
  return { mediaType:'video', previewUrl:videoUrl, downloadUrl:videoUrl, language:socialLanguage, purpose:property.purpose, propertyType:property.type, district:property.district, city:property.city, state:property.state, bedrooms:property.bedrooms, suites:property.suites, parkingSpaces:property.parkingSpaces, area:property.area, price:property.price, description:socialLanguage === 'pt-BR' ? property.description : '', highlights:localizedHighlights, cta:localizedCta, phone, contactAuthorized:Boolean(phone), aiCampaigns:variants.map((value,index)=>({id:`virtual-staging-${index+1}`,name:`Opção ${index+1}`,instagram:value,facebook:value,whatsapp:value,linkedin:value,hashtags,cta:localizedCta})), googleAds }
}
