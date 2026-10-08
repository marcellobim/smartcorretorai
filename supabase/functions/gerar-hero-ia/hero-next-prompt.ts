type RecordLike = Record<string, unknown>

const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const list = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : []

/**
 * The provider-facing US supplement. It is intentionally isolated so the
 * request handler and its test use the same executable prompt path.
 */
export function buildHeroNextUSSinglePiecePrompt(humanPrompt: string, choices: RecordLike, property: RecordLike) {
  const destination = (choices.primary_destination && typeof choices.primary_destination === 'object'
    ? choices.primary_destination : {}) as RecordLike
  const format = (choices.format_generation && typeof choices.format_generation === 'object'
    ? choices.format_generation : {}) as RecordLike
  const strategy = (choices.format_strategy && typeof choices.format_strategy === 'object'
    ? choices.format_strategy : {}) as RecordLike
  const identity = choices.show_professional_identity === true ? text(choices.professional_identity) : ''
  const phone = text(choices.display_phone || choices.contact_phone)
  const cta = text(choices.cta) || 'Learn more'
  const destinationLabel = text(destination.label) || 'the selected channel'
  const highlights = list(choices.highlights || property.master_highlights)
  const valueCondition = (choices.value_condition && typeof choices.value_condition === 'object' ? choices.value_condition : {}) as RecordLike
  const imageCount = list(choices.inline_images).length

  return [
    humanPrompt,
    '',
    'US ENGLISH DELIVERY RULES:',
    `Create exactly one final ${text(format.format_id) === 'story_reels' ? 'vertical' : 'square feed'} real-estate asset for ${destinationLabel}.`,
    `This is piece ${text(format.index) || '1'} of ${text(format.total) || '1'} in the same campaign.`,
    `Use this CTA exactly: ${cta}.`,
    identity ? `Professional identification, if displayed, must appear exactly once: ${identity}.` : 'Do not invent or display a license number, agent identification, or contact information.',
    phone ? `Use this phone exactly as provided: ${phone}.` : 'Do not display a phone number, WhatsApp, website, Instagram handle, or email.',
    highlights.length ? `Verified highlights: ${highlights.join(', ')}.` : '',
    text(valueCondition.details) ? `Pricing and optional terms: ${text(valueCondition.details)}.` : 'Do not invent a price or commercial terms.',
    `Format composition: ${text(strategy.compositionInstruction) || 'Create a clear, polished composition for this format.'}`,
    imageCount ? `Use the ${imageCount} supplied reference image${imageCount === 1 ? '' : 's'} as visual context; do not invent property facts.` : 'No reference images were supplied; do not invent property-specific facts.',
    'All text rendered in the asset must be natural US English only.',
    'Use USD, square feet, bedrooms, bathrooms, and parking spaces when those facts are present.',
    'Do not use Portuguese, Brazilian currency, Brazilian housing programs, Brazilian real-estate terminology, or Brazilian CTAs.',
    'Do not create a collage, mockup, presentation board, multiple formats, or multiple variants in one image.',
  ].filter(Boolean).join('\n')
}
