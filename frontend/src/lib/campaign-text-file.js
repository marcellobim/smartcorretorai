import { BRAND } from '../config/brand'

export function buildCampaignTextFile(campaign) {
  if (!campaign) return ''

  const moduleSections = campaign.modules.map((module) => {
    const moduleTitle = String(module.title || '').toLocaleUpperCase('pt-BR')
    const moduleContent = module.fields?.length
      ? module.fields.map((field) => `${String(field.label || '').toLocaleUpperCase('pt-BR')}\n\n${field.text}`).join('\n\n')
      : module.text
    return `${moduleTitle}\n\n${moduleContent}`
  })
  const contactSection = campaign.contact.length
    ? `CTA E CONTATO\n\n${campaign.contact.map((item) => `${String(item.label || '').toLocaleUpperCase('pt-BR')}\n\n${item.value}`).join('\n\n')}`
    : ''

  return [
    `CAMPANHA HERO IA - ${BRAND.name.toLocaleUpperCase('pt-BR')}`,
    ...moduleSections,
    contactSection,
  ].filter(Boolean).join('\n\n----------------------------------------\n\n')
}
