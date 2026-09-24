import { fail, MAX_BYTES } from './contract.mjs'

// These are presentation presets of the same persisted product, not separate tables.
// No client-selected table, bucket, path or URL crosses this boundary.
export const VIDEO_MODES = Object.freeze(['animate-images','campaign-video','narrated-video','virtual-agent'])
export const PUBLISHABLE_PRODUCTS = Object.freeze(['video_imobiliario'])
export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export function creationResolver({ readCreation, inspectObject }) {
 return async function resolveTikTokPublishableCreation(product_type, creation_id, user_id) {
  if (!PUBLISHABLE_PRODUCTS.includes(product_type) || !isUuid(creation_id) || !isUuid(user_id)) fail('posting_input_invalid')
  const creation = await readCreation(creation_id, user_id)
  const objectPath = user_id + '/' + creation_id + '/smart-tour.mp4'
  if (!creation || creation.id !== creation_id || creation.user_id !== user_id ||
      creation.status !== 'completed' || creation.mode !== 'smart_tour_gemini_omni' ||
      creation.output_video_path !== objectPath) fail('posting_creation_invalid')
  const media = await inspectObject({ bucket: 'studio-videos', objectPath })
  if (!media || media.contentType !== 'video/mp4' || !Number.isSafeInteger(media.size) ||
      media.size <= 0 || media.size > MAX_BYTES) fail('posting_media_invalid')
  return Object.freeze({
   product: 'video_imobiliario', creationId: creation.id, ownerId: user_id,
   status: creation.status, contentType: 'video/mp4', origin: 'supabase-storage',
   bucket: 'studio-videos', objectPath, media,
   metadata: { mode: creation.mode }, preview: { expiresInSeconds: 300 },
  })
 }
}
