export const CREATION_PRODUCT_KEYS = [
  'video_imobiliario',
  'short_videos',
  'banner_imobiliario',
  'studio_comercial',
  'studio_video_criativo',
  'studio_carrossel',
  'virtual_staging',
  'vida_no_imovel',
  'apresentacao_corretor',
  'banners_rapidos',
  'campanha_textos',
] as const

export const CREATION_DELIVERY_KINDS = ['file', 'bundle', 'text'] as const
export const CREATION_ALLOWED_BUCKETS = ['studio-videos', 'smartcorret-assets'] as const

const MAX_SOURCE_REF_LENGTH = 200
const MAX_TITLE_LENGTH = 200
const MAX_STORAGE_PATH_LENGTH = 1024
const MAX_FILE_NAME_LENGTH = 255
const MAX_BUNDLE_FILES = 50
const MAX_TEXT_MANIFEST_BYTES = 256 * 1024

export type CreationProductKey = typeof CREATION_PRODUCT_KEYS[number]
export type CreationDeliveryKind = typeof CREATION_DELIVERY_KINDS[number]

export type CreationFile = {
  bucket: typeof CREATION_ALLOWED_BUCKETS[number]
  path: string
  name: string
  mime_type: string
  size_bytes?: number
}

export type CreationResultManifest = {
  version: 1
  files?: CreationFile[]
  content?: Record<string, unknown>
  download_name?: string
}

export type RegisterCompletedCreationInput = {
  user_id: string
  product_key: CreationProductKey
  source_ref: string
  title?: string | null
  delivery_kind: CreationDeliveryKind
  result_manifest: CreationResultManifest
  completed_at: Date | string
}

export type CreationInsert = {
  user_id: string
  product_key: CreationProductKey
  source_ref: string
  title: string | null
  delivery_kind: CreationDeliveryKind
  result_manifest: CreationResultManifest
  completed_at: string
}

export type CreationRecord = CreationInsert & {
  id: string
  expires_at: string
  downloaded_at: string | null
  deleted_at: string | null
}

export type CreationRegistration = {
  id: string
  user_id: string
  product_key: CreationProductKey
  source_ref: string
  title: string | null
  delivery_kind: CreationDeliveryKind
  completed_at: string
  expires_at: string
  downloaded_at: string | null
  deleted_at: string | null
}

export type CreationRegistrationResult = {
  created: boolean
  creation: CreationRegistration
}

export interface CreationStore {
  findByIdentity(identity: Pick<CreationInsert, 'user_id' | 'product_key' | 'source_ref'>): Promise<CreationRecord | null>
  insertIfAbsent(input: CreationInsert): Promise<{ record: CreationRecord | null; conflict: boolean }>
}

export class CreationValidationError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'CreationValidationError'
    this.code = code
  }
}

export class CreationRegistrationError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'CreationRegistrationError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every(key => allowed.includes(key))
}

function requiredString(value: unknown, code: string, maximum: number) {
  if (typeof value !== 'string') throw new CreationValidationError(code)
  const normalized = value.trim()
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new CreationValidationError(code)
  }
  return normalized
}

function validateUserId(value: unknown) {
  const normalized = requiredString(value, 'invalid_user_id', 36).toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
    throw new CreationValidationError('invalid_user_id')
  }
  return normalized
}

function validateStoragePath(value: unknown, userId: string) {
  const path = requiredString(value, 'invalid_storage_path', MAX_STORAGE_PATH_LENGTH)
  if (
    path.startsWith('/')
    || path.includes('\\')
    || path.includes('?')
    || path.includes('#')
    || path.includes('://')
    || path.includes('//')
  ) throw new CreationValidationError('invalid_storage_path')

  const segments = path.split('/')
  if (segments.length < 2 || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new CreationValidationError('invalid_storage_path')
  }
  if (segments[0] !== userId) throw new CreationValidationError('invalid_storage_path')
  return path
}

function validateFile(value: unknown, userId: string): CreationFile {
  if (!isRecord(value) || !hasOnlyKeys(value, ['bucket', 'path', 'name', 'mime_type', 'size_bytes'])) {
    throw new CreationValidationError('invalid_file_manifest')
  }
  if (!CREATION_ALLOWED_BUCKETS.includes(value.bucket as typeof CREATION_ALLOWED_BUCKETS[number])) {
    throw new CreationValidationError('invalid_storage_bucket')
  }

  const name = requiredString(value.name, 'invalid_file_name', MAX_FILE_NAME_LENGTH)
  if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new CreationValidationError('invalid_file_name')
  }
  const mimeType = requiredString(value.mime_type, 'invalid_mime_type', 120).toLowerCase()
  if (!/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(mimeType)) {
    throw new CreationValidationError('invalid_mime_type')
  }
  if (value.size_bytes !== undefined && (!Number.isSafeInteger(value.size_bytes) || Number(value.size_bytes) < 0)) {
    throw new CreationValidationError('invalid_file_size')
  }

  return {
    bucket: value.bucket as CreationFile['bucket'],
    path: validateStoragePath(value.path, userId),
    name,
    mime_type: mimeType,
    ...(value.size_bytes === undefined ? {} : { size_bytes: Number(value.size_bytes) }),
  }
}

function normalizeManifest(kind: CreationDeliveryKind, value: unknown, userId: string): CreationResultManifest {
  if (!isRecord(value) || value.version !== 1) throw new CreationValidationError('invalid_result_manifest')

  if (kind === 'file' || kind === 'bundle') {
    if (!hasOnlyKeys(value, ['version', 'files']) || !Array.isArray(value.files)) {
      throw new CreationValidationError('invalid_result_manifest')
    }
    const expectedMinimum = kind === 'file' ? 1 : 2
    const expectedMaximum = kind === 'file' ? 1 : MAX_BUNDLE_FILES
    if (value.files.length < expectedMinimum || value.files.length > expectedMaximum) {
      throw new CreationValidationError('invalid_result_manifest')
    }
    const files = value.files.map(file => validateFile(file, userId))
    const identities = new Set(files.map(file => `${file.bucket}/${file.path}`))
    if (identities.size !== files.length) throw new CreationValidationError('duplicate_manifest_file')
    return { version: 1, files }
  }

  if (!hasOnlyKeys(value, ['version', 'content', 'download_name']) || !isRecord(value.content) || !Object.keys(value.content).length) {
    throw new CreationValidationError('invalid_result_manifest')
  }
  const downloadName = requiredString(value.download_name, 'invalid_download_name', MAX_FILE_NAME_LENGTH)
  if (downloadName.includes('/') || downloadName.includes('\\') || !downloadName.toLowerCase().endsWith('.txt')) {
    throw new CreationValidationError('invalid_download_name')
  }
  let serialized = ''
  try {
    serialized = JSON.stringify(value.content)
  } catch {
    throw new CreationValidationError('invalid_text_content')
  }
  if (!serialized || new TextEncoder().encode(serialized).byteLength > MAX_TEXT_MANIFEST_BYTES) {
    throw new CreationValidationError('invalid_text_content')
  }
  return { version: 1, content: JSON.parse(serialized), download_name: downloadName }
}

function normalizeCompletedAt(value: unknown) {
  if (!(value instanceof Date) && typeof value !== 'string') throw new CreationValidationError('invalid_completed_at')
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) {
    throw new CreationValidationError('invalid_completed_at')
  }
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new CreationValidationError('invalid_completed_at')
  return date.toISOString()
}

function normalizeInput(input: RegisterCompletedCreationInput): CreationInsert {
  if (!isRecord(input)) throw new CreationValidationError('invalid_creation_input')
  const userId = validateUserId(input.user_id)
  if (!CREATION_PRODUCT_KEYS.includes(input.product_key as CreationProductKey)) {
    throw new CreationValidationError('invalid_product_key')
  }
  if (!CREATION_DELIVERY_KINDS.includes(input.delivery_kind as CreationDeliveryKind)) {
    throw new CreationValidationError('invalid_delivery_kind')
  }
  const sourceRef = requiredString(input.source_ref, 'invalid_source_ref', MAX_SOURCE_REF_LENGTH)
  const title = input.title == null ? null : requiredString(input.title, 'invalid_title', MAX_TITLE_LENGTH)
  return {
    user_id: userId,
    product_key: input.product_key,
    source_ref: sourceRef,
    title,
    delivery_kind: input.delivery_kind,
    result_manifest: normalizeManifest(input.delivery_kind, input.result_manifest, userId),
    completed_at: normalizeCompletedAt(input.completed_at),
  }
}

function registration(record: CreationRecord): CreationRegistration {
  return {
    id: record.id,
    user_id: record.user_id,
    product_key: record.product_key,
    source_ref: record.source_ref,
    title: record.title,
    delivery_kind: record.delivery_kind,
    completed_at: record.completed_at,
    expires_at: record.expires_at,
    downloaded_at: record.downloaded_at,
    deleted_at: record.deleted_at,
  }
}

export async function registerCompletedCreation(
  store: CreationStore,
  input: RegisterCompletedCreationInput,
): Promise<CreationRegistrationResult> {
  const normalized = normalizeInput(input)
  const identity = {
    user_id: normalized.user_id,
    product_key: normalized.product_key,
    source_ref: normalized.source_ref,
  }
  const existing = await store.findByIdentity(identity)
  if (existing) return { created: false, creation: registration(existing) }

  const inserted = await store.insertIfAbsent(normalized)
  if (inserted.record) return { created: true, creation: registration(inserted.record) }
  if (!inserted.conflict) throw new CreationRegistrationError('creation_insert_failed')

  const concurrent = await store.findByIdentity(identity)
  if (!concurrent) throw new CreationRegistrationError('creation_conflict_not_found')
  return { created: false, creation: registration(concurrent) }
}

type SupabaseError = { code?: string } | null
type SupabaseResult = { data: CreationRecord | null; error: SupabaseError }
type SupabaseClientLike = { from(table: string): any }

const CREATION_RETURN_COLUMNS = 'id,user_id,product_key,source_ref,title,delivery_kind,completed_at,expires_at,downloaded_at,deleted_at'

export function createSupabaseCreationStore(client: SupabaseClientLike): CreationStore {
  return {
    async findByIdentity(identity) {
      const { data, error } = await client
        .from('creations')
        .select(CREATION_RETURN_COLUMNS)
        .eq('user_id', identity.user_id)
        .eq('product_key', identity.product_key)
        .eq('source_ref', identity.source_ref)
        .maybeSingle() as SupabaseResult
      if (error) throw new CreationRegistrationError('creation_lookup_failed')
      return data
    },
    async insertIfAbsent(input) {
      const { data, error } = await client
        .from('creations')
        .insert(input)
        .select(CREATION_RETURN_COLUMNS)
        .single() as SupabaseResult
      if (error?.code === '23505') return { record: null, conflict: true }
      if (error) throw new CreationRegistrationError('creation_insert_failed')
      if (!data) throw new CreationRegistrationError('creation_insert_missing')
      return { record: data, conflict: false }
    },
  }
}
