import { buildPublicationPackage } from '../../../core/copy-engine/index.ts'

type RecordValue = Record<string, unknown>
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const list = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : []
const folded = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const objectiveFrom = (property: RecordValue, choices: RecordValue) => {
  const profile = folded(choices.property_profile || property.master_profile)
  if (profile.includes('captacao de corretores')) return { id: 'broker_capture', label: 'Captação de Corretores' }
  if (profile.includes('captacao de imoveis')) return { id: 'property_capture', label: 'Captação de imóveis' }
  if (folded(choices.campaign_objective || property.purpose) === 'locacao') return { id: 'rent', label: 'Locação de imóvel' }
  return { id: 'sale', label: 'Venda de imóvel' }
}

export function buildPersistedBannerPublicationOptions(promptBriefing: unknown) {
  const briefing = object(promptBriefing)
  const choices = object(briefing.choices)
  const stored = Array.isArray(choices.publication_options) ? choices.publication_options : []
  const normalizedStored = stored.map((value, index) => {
    const item = object(value)
    return {
      id: text(item.id) || `banner-caption-option-${index + 1}`,
      label: text(item.label) || `Texto ${index + 1}`,
      text: typeof item.text === 'string' ? item.text : '',
    }
  }).filter(item => /^banner-caption-option-[1-3]$/.test(item.id) && item.text && Array.from(item.text).length <= 2200)
  if (normalizedStored.length === 3) return normalizedStored

  const property = object(briefing.property)
  const valueCondition = object(choices.value_condition)
  const objective = objectiveFrom(property, choices)
  const phone = text(choices.display_phone || choices.contact_phone)
  const output = buildPublicationPackage({
    objective: objective.id,
    objectiveLabel: objective.label,
    propertyType: text(property.type) || 'Imóvel',
    stage: text(property.master_property_state || choices.property_stage),
    city: text(property.city),
    district: text(property.neighborhood),
    features: list(choices.highlights || property.master_highlights),
    bedrooms: text(property.bedrooms),
    suites: text(property.suites),
    parking: text(property.parking_spaces),
    area: text(property.display_area || property.area),
    displayArea: text(property.display_area || property.area),
    value: text(valueCondition.details),
    displayPrice: text(valueCondition.details),
    showValue: !['hidden', 'no_values'].includes(text(valueCondition.mode)),
    contactPhone: phone,
    displayPhone: phone,
    cta: text(choices.cta) || (objective.id.includes('capture') ? 'Solicitar contato' : 'Fale comigo'),
  })
  return output.slice(0, 3).map((item, index) => ({
    id: `banner-caption-option-${index + 1}`,
    label: item.label,
    text: item.text,
  }))
}

export function normalizeBannerPublicationOptions(value: unknown) {
  if (!Array.isArray(value) || value.length !== 3) return []
  const normalized = value.map((raw, index) => {
    const item = object(raw)
    const id = text(item.id)
    const label = text(item.label)
    const exactText = typeof item.text === 'string' ? item.text : ''
    if (id !== `banner-caption-option-${index + 1}` || !label || !exactText || Array.from(exactText).length > 2200) return null
    return { id, label, text: exactText }
  })
  return normalized.some(item => item === null)
    ? []
    : normalized as Array<{ id: string; label: string; text: string }>
}
