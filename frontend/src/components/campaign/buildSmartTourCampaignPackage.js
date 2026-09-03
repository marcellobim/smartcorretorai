import { normalizeOfficialHashtags } from '../../../../supabase/functions/_shared/official-hashtags.ts'
import { buildGoogleAdsDelivery } from '../../../../supabase/functions/_shared/google-ads.ts'
import { buildSmartTourPublicationOptions } from '../../../../supabase/functions/_shared/smart-tour/publication-options.ts'

const clean = value => String(value || '').trim()
const location = property => [property.district, property.city, property.state].filter(Boolean).join(', ')
const translations = {
  'pt-BR': { intro: 'Conheça', sale: 'à venda', rent: 'para locação', in: 'em', details: 'Destaques', contact: 'Entre em contato para saber mais.', bedrooms:'dormitórios',suites:'suítes',parking:'vagas' },
  'en-US': { intro: 'Discover', sale: 'for sale', rent: 'for rent', in: 'in', details: 'Highlights', contact: 'Get in touch to learn more.', bedrooms:'bedrooms',suites:'suites',parking:'parking spaces' },
  es: { intro: 'Descubre', sale: 'en venta', rent: 'en alquiler', in: 'en', details: 'Características', contact: 'Contáctanos para más información.', bedrooms:'dormitorios',suites:'suites',parking:'plazas de garaje' },
}
export function buildSmartTourCampaignPackage({ property, language, cta, phone, videoUrl = '', hashtags: generatedHashtags = [], unifiedSocialPublishing = false }) {
  const text = translations[language] || translations['pt-BR']
  const translatedTypes = { 'en-US':{Apartamento:'apartment',Casa:'house',Cobertura:'penthouse','Studio / Loft':'studio / loft',Sobrado:'townhouse','Terreno / Lote':'land',Comercial:'commercial property'}, es:{Apartamento:'apartamento',Casa:'casa',Cobertura:'ático','Studio / Loft':'estudio / loft',Sobrado:'casa adosada','Terreno / Lote':'terreno',Comercial:'inmueble comercial'} }
  const translatedCtas = { 'en-US':{'Agende sua visita':'Schedule your visit','Saiba mais':'Learn more','Entre em contato agora':'Contact us now','Fale comigo':'Talk to me'}, es:{'Agende sua visita':'Agenda tu visita','Saiba mais':'Más información','Entre em contato agora':'Contáctanos ahora','Fale comigo':'Habla conmigo'} }
  const propertyType = translatedTypes[language]?.[property.type] || clean(property.type).toLocaleLowerCase(language)
  const subject = [text.intro, propertyType, property.purpose === 'rent' ? text.rent : text.sale, location(property) && `${text.in} ${location(property)}`].filter(Boolean).join(' ')
  const factLine = [property.bedrooms && `${property.bedrooms} ${text.bedrooms}`, property.suites && `${property.suites} ${text.suites}`, property.parkingSpaces && `${property.parkingSpaces} ${text.parking}`, property.area && `${property.area} m²`].filter(Boolean).join(' · ')
  const localizedHighlights = language === 'pt-BR' ? property.highlights || [] : []
  const detail = [factLine, localizedHighlights.length ? `${text.details}: ${localizedHighlights.slice(0,5).join(', ')}` : '', language === 'pt-BR' ? clean(property.description) : '', clean(property.price)].filter(Boolean).join('\n\n')
  const localizedCta = translatedCtas[language]?.[cta] || cta || text.contact
  const close = [localizedCta, phone].filter(Boolean).join('\n')
  const variants = [
    `${subject}.\n\n${detail}\n\n${close}`,
    `${localizedHighlights[0] || subject}.\n\n${subject}.\n\n${detail}\n\n${close}`,
    `${subject}.\n\n${localizedHighlights.slice(0,3).join(' · ') || detail}\n\n${close}`,
  ]
  const publicationOptions = unifiedSocialPublishing ? buildSmartTourPublicationOptions({ property, language, cta, phone }) : []
  const campaignOptions = unifiedSocialPublishing
    ? publicationOptions
    : variants.map((value, index) => ({ id:`smart-tour-${index + 1}`, text:value }))
  const hashtags = normalizeOfficialHashtags(generatedHashtags, { purpose:property.purpose, propertyType:property.type, propertyStage:property.stage, city:property.city, district:property.district, state:property.state, bedrooms:property.bedrooms, suites:property.suites, parkingSpaces:property.parkingSpaces, highlights:property.highlights, cta:localizedCta })
  const googleAds = buildGoogleAdsDelivery({ purpose:property.purpose, propertyType:property.type, district:property.district, city:property.city, state:property.state, bedrooms:property.bedrooms, suites:property.suites, highlights:localizedHighlights, cta:localizedCta })
  return { mediaType:'video', previewUrl:videoUrl, downloadUrl:videoUrl, purpose:property.purpose, propertyType:property.type, district:property.district, city:property.city, state:property.state, bedrooms:property.bedrooms, suites:property.suites, parkingSpaces:property.parkingSpaces, area:property.area, price:property.price, description:language === 'pt-BR' ? property.description : '', highlights:localizedHighlights, cta:localizedCta, phone, contactAuthorized:Boolean(phone), ...(unifiedSocialPublishing ? { unifiedSocialPublishing:true, publicationOptions } : {}), aiCampaigns:campaignOptions.map((option,index)=>({id:option.id,name:`Opção ${index+1}`,instagram:option.text,facebook:option.text,whatsapp:option.text,linkedin:option.text,hashtags,cta:localizedCta})), googleAds }
}
