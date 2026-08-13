export type CompletedBannerGeneration = {
  id?: unknown
  user_id?: unknown
  status?: unknown
  prompt_briefing?: unknown
  image_storage_path?: unknown
  completed_at?: unknown
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function boundedText(value: unknown, maximum = 200) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maximum) : ''
}

export function buildBannerImobiliarioTitle(promptBriefing: unknown) {
  const briefing = record(promptBriefing)
  if (briefing.schema_version !== 'hero_prompt_briefing_v1') return null
  const property = record(briefing.property)
  const persistedPropertyId = boundedText(property.id)
  const persistedTitle = boundedText(property.title)
  if (persistedPropertyId && persistedTitle) return persistedTitle

  const propertyType = boundedText(property.type)
  const location = boundedText(property.neighborhood) || boundedText(property.city)
  if (propertyType && location) return `${propertyType} em ${location}`.slice(0, 200)
  return propertyType || null
}

export function buildBannerImobiliarioCreationInput(generation: CompletedBannerGeneration) {
  const id = boundedText(generation.id)
  const userId = boundedText(generation.user_id)
  const outputPath = boundedText(generation.image_storage_path, 1024)
  const completedAt = boundedText(generation.completed_at)
  const allowedPaths = new Set([
    `${userId}/hero-ia-next/${id}/hero-principal.jpg`,
    `${userId}/hero-ia/${id}/hero-principal.jpg`,
  ])

  if (
    generation.status !== 'completed'
    || !id
    || !userId
    || !completedAt
    || !allowedPaths.has(outputPath)
  ) return null

  return {
    user_id: userId,
    product_key: 'banner_imobiliario' as const,
    source_ref: id,
    title: buildBannerImobiliarioTitle(generation.prompt_briefing),
    delivery_kind: 'file' as const,
    result_manifest: {
      version: 1 as const,
      files: [{
        bucket: 'smartcorretor-assets' as const,
        path: outputPath,
        name: 'smartcorretorai-banner-imobiliario.jpg',
        mime_type: 'image/jpeg',
      }],
    },
    completed_at: completedAt,
  }
}
