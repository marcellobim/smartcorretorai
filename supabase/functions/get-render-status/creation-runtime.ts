import {
  createSupabaseCreationStore,
  registerCompletedCreation,
  type CreationRegistrationResult,
} from '../_shared/creations.ts'

const CREATION_BUCKET = 'smartcorretor-assets'
const MAX_BANNER_BYTES = 5 * 1024 * 1024
const READY_STATUSES = new Set(['succeeded', 'completed'])

type SupabaseClientLike = {
  from(table: string): any
  storage: { from(bucket: string): any }
}

type StoredRender = Record<string, unknown>

export class BannersRapidosCreationError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'BannersRapidosCreationError'
    this.code = code
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function boundedText(value: unknown, maximum = 200) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maximum) : ''
}

export function buildBannersRapidosTitle(campaign: Record<string, unknown>) {
  const property = record(campaign.dados_imovel)
  if (property.schema_version !== 'campaign_property_input_v1') return null
  const propertyType = boundedText(property.tipo)
  const location = boundedText(property.bairro) || boundedText(property.cidade)
  if (propertyType && location) return `${propertyType} em ${location}`.slice(0, 200)
  return propertyType || null
}

function getFinalUrl(render: StoredRender) {
  for (const value of [render.download_url, render.url]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function validateProviderUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BannersRapidosCreationError('invalid_provider_url')
  }
  const host = url.hostname.toLowerCase()
  const allowedHost = host === 'creatomate.com'
    || host.endsWith('.creatomate.com')
    || host === 'backblazeb2.com'
    || host.endsWith('.backblazeb2.com')
  if (url.protocol !== 'https:' || !allowedHost || url.username || url.password) {
    throw new BannersRapidosCreationError('invalid_provider_url')
  }
  return url.toString()
}

const FILE_TYPES = {
  'image/jpeg': {
    extension: 'jpg',
    valid: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    valid: (bytes: Uint8Array) => bytes.length >= 8
      && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value),
  },
  'image/webp': {
    extension: 'webp',
    valid: (bytes: Uint8Array) => bytes.length >= 12
      && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
      && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP',
  },
} as const

export async function fetchCompletedBanner(
  render: StoredRender,
  fetchImpl: typeof fetch = fetch,
) {
  const status = boundedText(render.status).toLowerCase()
  if (!READY_STATUSES.has(status)) throw new BannersRapidosCreationError('render_not_completed')
  const response = await fetchImpl(validateProviderUrl(getFinalUrl(render)), {
    method: 'GET',
    signal: AbortSignal.timeout(30000),
  })
  if (response.status !== 200) throw new BannersRapidosCreationError('provider_download_failed')

  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BANNER_BYTES) {
    throw new BannersRapidosCreationError('provider_file_too_large')
  }
  const mimeType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
  const fileType = FILE_TYPES[mimeType as keyof typeof FILE_TYPES]
  if (!fileType) throw new BannersRapidosCreationError('provider_mime_not_allowed')

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.byteLength) throw new BannersRapidosCreationError('provider_file_empty')
  if (bytes.byteLength > MAX_BANNER_BYTES) throw new BannersRapidosCreationError('provider_file_too_large')
  if (!fileType.valid(bytes)) throw new BannersRapidosCreationError('provider_file_signature_invalid')
  return { bytes, mimeType, extension: fileType.extension, sizeBytes: bytes.byteLength }
}

function isDuplicateStorageError(error: unknown) {
  const value = record(error)
  const message = boundedText(value.message).toLowerCase()
  return value.statusCode === 409 || value.status === 409 || message.includes('duplicate') || message.includes('already exists')
}

export async function registerBannersRapidosCreation(args: {
  supabase: SupabaseClientLike
  userId: string
  campaign: Record<string, unknown>
  render: StoredRender
  completedAt?: string
  fetchImpl?: typeof fetch
}): Promise<CreationRegistrationResult> {
  const campaignId = boundedText(args.campaign.id)
  if (!campaignId) throw new BannersRapidosCreationError('invalid_campaign_id')

  const store = createSupabaseCreationStore(args.supabase)
  const identity = { user_id: args.userId, product_key: 'banners_rapidos' as const, source_ref: campaignId }
  const existing = await store.findByIdentity(identity)
  if (existing) {
    return { created: false, creation: {
      id: existing.id,
      user_id: existing.user_id,
      product_key: existing.product_key,
      source_ref: existing.source_ref,
      title: existing.title,
      delivery_kind: existing.delivery_kind,
      completed_at: existing.completed_at,
      expires_at: existing.expires_at,
      downloaded_at: existing.downloaded_at,
      deleted_at: existing.deleted_at,
    } }
  }

  const downloaded = await fetchCompletedBanner(args.render, args.fetchImpl)
  const path = `${args.userId}/creations/banners-rapidos/${campaignId}/banner.${downloaded.extension}`
  const { error: uploadError } = await args.supabase.storage
    .from(CREATION_BUCKET)
    .upload(path, downloaded.bytes, {
      contentType: downloaded.mimeType,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError && !isDuplicateStorageError(uploadError)) {
    throw new BannersRapidosCreationError('creation_storage_upload_failed')
  }

  return registerCompletedCreation(store, {
    user_id: args.userId,
    product_key: 'banners_rapidos',
    source_ref: campaignId,
    title: buildBannersRapidosTitle(args.campaign),
    delivery_kind: 'file',
    result_manifest: {
      version: 1,
      files: [{
        bucket: CREATION_BUCKET,
        path,
        name: `smartcorretorai-banners-rapidos.${downloaded.extension}`,
        mime_type: downloaded.mimeType,
        size_bytes: downloaded.sizeBytes,
      }],
    },
    completed_at: args.completedAt || new Date().toISOString(),
  })
}
