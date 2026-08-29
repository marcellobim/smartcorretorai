import {
  ATTRACTION_SECTION_COMPONENTS, LISTING_SECTION_COMPONENTS, LISTING_XRAY_FIELD_KEYS, LISTING_XRAY_SCHEMA_VERSION, SOCIAL_SECTION_COMPONENTS, type AnalysisInputKind,
  type ListingXrayModelOutput, type ModelSection, type NormalizedListing,
} from './contract.ts'
import { informationScoreFromListing } from './normalize.ts'
import { buildListingXrayOpportunities, buildListingXrayPriorities } from './opportunities.ts'
import { groundListingAnalysis } from './grounding.ts'
import { normalizePtBrQuantities } from './pt-br-quantities.ts'

const LABELS = [
  { minimum: 90, label: 'Excelente' }, { minimum: 80, label: 'Muito bom' },
  { minimum: 70, label: 'Bom' }, { minimum: 60, label: 'Pode melhorar' },
  { minimum: 0, label: 'Precisa de atenção' },
]
export const labelListingXrayScore = (score: number) => LABELS.find(item => score >= item.minimum)?.label || 'Precisa de atenção'
const ATTRACTION_LABELS = [
  { minimum: 90, label: 'Muito forte' }, { minimum: 80, label: 'Forte' },
  { minimum: 70, label: 'Bom potencial' }, { minimum: 60, label: 'Há oportunidades' },
  { minimum: 0, label: 'Pode ser melhor explorado' },
]
export const labelAttractionPotentialScore = (score: number) => ATTRACTION_LABELS.find(item => score >= item.minimum)?.label || 'Pode ser melhor explorado'
export function normalizeComponentScore(components: Record<string, number>, definition: Record<string, number>) {
  const maximum = Object.values(definition).reduce((sum, value) => sum + value, 0)
  const earned = Object.entries(definition).reduce((sum, [key, limit]) => sum + Math.max(0, Math.min(limit, Number(components[key]) || 0)), 0)
  return maximum ? Math.round((earned / maximum) * 100) : 0
}

function publicSection<T extends ModelSection>(section: T, definition: Record<string, number>, forcedScore?: number) {
  if (!section.evaluated) return { ...section, score: null, label: null, suggestion_mode: 'none' as const, suggestion: null, copy_text: null }
  const score = forcedScore ?? normalizeComponentScore(section.components, definition)
  if (score >= 90 && !section.issue_codes.length) return { ...section, score, label: labelListingXrayScore(score), suggestion_mode: 'none' as const, suggestion: null, copy_text: null }
  return { ...section, score, label: labelListingXrayScore(score) }
}

function overallScore(sections: Record<string, ReturnType<typeof publicSection>>, weights: Record<string, number>) {
  const evaluated = Object.entries(weights).filter(([key]) => sections[key]?.score !== null)
  const weightTotal = evaluated.reduce((sum, [, weight]) => sum + weight, 0)
  return weightTotal ? Math.round(evaluated.reduce((sum, [key, weight]) => sum + Number(sections[key].score) * weight, 0) / weightTotal) : null
}

export function finalizeListingXrayResult(input: { inputKind: AnalysisInputKind; listing: NormalizedListing | null; imageCount?: number }, model: ListingXrayModelOutput) {
  if (model.needs_more_input || model.content_type === 'UNSURE') throw new Error('analysis_not_deliverable')
  if (model.content_type === 'PROPERTY_LISTING' && model.listing) {
    const grounded = groundListingAnalysis(input.listing, model.listing, input.imageCount || 0)
    const detectedImages = input.listing?.detectedImageCount.state === 'CONFIRMED' ? Number(input.listing.detectedImageCount.value) || 0 : 0
    const abundantImages = Math.max(input.imageCount || 0, detectedImages) >= 20
    const sections = {
      title: publicSection(grounded.title, LISTING_SECTION_COMPONENTS.title), description: publicSection(grounded.description, LISTING_SECTION_COMPONENTS.description),
      information: publicSection(grounded.information, LISTING_SECTION_COMPONENTS.information, input.listing ? informationScoreFromListing(input.listing) : undefined),
      persuasion: publicSection(grounded.persuasion, LISTING_SECTION_COMPONENTS.persuasion),
    }
    const overall = overallScore(sections, { title: 0.20, description: 0.30, information: 0.25, persuasion: 0.25 })
    const attraction = publicSection(grounded.attraction, ATTRACTION_SECTION_COMPONENTS)
    const fields = input.listing
      ? Object.fromEntries(Object.entries(input.listing.fields).map(([key, field]) => [key, { state: field.state, value: field.value }]))
      : Object.fromEntries(LISTING_XRAY_FIELD_KEYS.map(key => {
        const observed = grounded.observed_fields.find(field => field.key === key)
        return [key, observed ? { state: observed.state, value: observed.value } : { state: 'NOT_FOUND', value: null }]
      }))
    const inconsistencies = input.listing?.inconsistencies || grounded.observed_fields
      .filter(field => field.state === 'AMBIGUOUS' && field.evidence && ((field.evidence.match(/\b\d+(?:[.,]\d+)?\b/g) || []).length >= 2 || /venda.*aluguel|aluguel.*venda/i.test(field.evidence)))
      .map(field => ({ field: field.key, values: [], message: field.evidence as string }))
    const opportunities = buildListingXrayOpportunities({ inputKind: input.inputKind, imageCount: input.imageCount || 0, listing: input.listing, analysis: grounded })
    const priorities = buildListingXrayPriorities(model.priorities, opportunities, grounded.attraction, abundantImages)
    return normalizePtBrQuantities({
      schema_version: LISTING_XRAY_SCHEMA_VERSION, status: 'completed', input_kind: input.inputKind, content_type: 'PROPERTY_LISTING',
      classification_confidence: model.classification_confidence,
      listing_quality_score: overall, listing_quality_label: overall === null ? null : labelListingXrayScore(overall),
      attraction_potential_score: attraction.score, attraction_potential_label: attraction.score === null ? null : labelAttractionPotentialScore(attraction.score),
      overall_score: overall, overall_label: overall === null ? null : labelListingXrayScore(overall), summary: model.summary, attraction,
      description_completeness: grounded.description_completeness,
      fields, inconsistencies, sections, priorities, opportunities,
      recommendations: opportunities.map(item => ({ product: item.product_id, reason: item.reason })),
    })
  }
  if (model.content_type === 'SOCIAL_PUBLICATION' && model.social) {
    const sections = {
      hook: publicSection(model.social.hook, SOCIAL_SECTION_COMPONENTS.hook), clarity: publicSection(model.social.clarity, SOCIAL_SECTION_COMPONENTS.clarity), visual_communication: publicSection(model.social.visual_communication, SOCIAL_SECTION_COMPONENTS.visual_communication),
      cta: publicSection(model.social.cta, SOCIAL_SECTION_COMPONENTS.cta), conversion: publicSection(model.social.conversion, SOCIAL_SECTION_COMPONENTS.conversion),
    }
    const overall = overallScore(sections, { hook: 0.20, clarity: 0.20, visual_communication: 0.20, cta: 0.20, conversion: 0.20 })
    return normalizePtBrQuantities({
      schema_version: LISTING_XRAY_SCHEMA_VERSION, status: 'completed', input_kind: input.inputKind, content_type: 'SOCIAL_PUBLICATION',
      classification_confidence: model.classification_confidence, overall_score: overall, overall_label: overall === null ? null : labelListingXrayScore(overall), summary: model.summary,
      sections, priorities: model.priorities.slice(0, 3), recommendations: model.recommendations.slice(0, 3),
    })
  }
  throw new Error('invalid_analysis_branch')
}
