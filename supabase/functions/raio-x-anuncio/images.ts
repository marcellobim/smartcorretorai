import {
  LISTING_XRAY_ACCEPTED_IMAGE_TYPES, LISTING_XRAY_MAX_IMAGE_BYTES, LISTING_XRAY_MAX_IMAGES,
  ListingXrayValidationError,
} from './contract.ts'

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/

export type ValidatedListingXrayImage = { dataUrl: string; mimeType: string; byteLength: number }

export function validateListingXrayImages(value: unknown): ValidatedListingXrayImage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > LISTING_XRAY_MAX_IMAGES) throw new ListingXrayValidationError('invalid_image_count')
  let total = 0
  return value.map((raw) => {
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const dataUrl = typeof record.data_url === 'string' ? record.data_url : ''
    const match = DATA_URL.exec(dataUrl)
    if (!match || !LISTING_XRAY_ACCEPTED_IMAGE_TYPES.includes(match[1] as typeof LISTING_XRAY_ACCEPTED_IMAGE_TYPES[number])) throw new ListingXrayValidationError('invalid_image_type')
    let byteLength = 0
    try { byteLength = atob(match[2]).length } catch { throw new ListingXrayValidationError('invalid_image_data') }
    if (byteLength < 1 || byteLength > LISTING_XRAY_MAX_IMAGE_BYTES) throw new ListingXrayValidationError('invalid_image_size')
    total += byteLength
    if (total > LISTING_XRAY_MAX_IMAGES * LISTING_XRAY_MAX_IMAGE_BYTES) throw new ListingXrayValidationError('invalid_image_payload_size')
    return { dataUrl, mimeType: match[1], byteLength }
  })
}
