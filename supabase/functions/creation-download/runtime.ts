import { jsonResponse } from '../_shared/cors.ts'
import {
  CREATION_DELIVERY_KINDS,
  CreationValidationError,
  validateCreationResultManifest,
  type CreationDeliveryKind,
  type CreationResultManifest,
} from '../_shared/creations.ts'

export const CREATION_DOWNLOAD_SIGNED_URL_TTL_SECONDS = 5 * 60
const MAX_REQUEST_BYTES = 1024

export type DownloadCreation = {
  id: string
  user_id: string
  delivery_kind: CreationDeliveryKind
  result_manifest: CreationResultManifest
  expires_at: string
  downloaded_at: string | null
  deleted_at: string | null
}

type ConfirmResult = 'confirmed' | 'already_confirmed' | 'unavailable'

export type CreationDownloadDependencies = {
  authenticate(token: string): Promise<{ id: string } | null>
  getCreation(creationId: string, userId: string): Promise<DownloadCreation | null>
  createSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>
  confirmCreation(creationId: string, userId: string, downloadedAt: string): Promise<ConfirmResult>
  now?: () => number
  log?: (event: string, details: { action: 'prepare' | 'confirm'; outcome: string }) => void
}

type DownloadAction = 'prepare' | 'confirm'

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  return /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, '').trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseCreationId(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : ''
}

async function parsePayload(request: Request): Promise<{ action: DownloadAction; creationId: string } | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null
  const raw = await request.text().catch(() => '')
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'action,creation_id') return null
  if (value.action !== 'prepare' && value.action !== 'confirm') return null
  const creationId = parseCreationId(value.creation_id)
  return creationId ? { action: value.action, creationId } : null
}

function unavailable(status = 404) {
  return jsonResponse({ ok: false, error: 'Criação indisponível.' }, status)
}

function validateStoredManifest(creation: DownloadCreation) {
  if (!CREATION_DELIVERY_KINDS.includes(creation.delivery_kind)) {
    throw new CreationValidationError('invalid_delivery_kind')
  }
  return validateCreationResultManifest(
    creation.delivery_kind,
    creation.result_manifest,
    creation.user_id,
  )
}

async function prepare(
  creation: DownloadCreation,
  dependencies: CreationDownloadDependencies,
  now: number,
) {
  const expiresAt = Date.parse(creation.expires_at)
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return unavailable(410)
  if (creation.downloaded_at || creation.deleted_at) return unavailable(410)

  let manifest: CreationResultManifest
  try {
    manifest = validateStoredManifest(creation)
  } catch {
    dependencies.log?.('creation_download', { action: 'prepare', outcome: 'invalid_manifest' })
    return unavailable()
  }

  if (creation.delivery_kind === 'text') {
    dependencies.log?.('creation_download', { action: 'prepare', outcome: 'prepared' })
    return jsonResponse({
      ok: true,
      action: 'prepare',
      creation_id: creation.id,
      delivery_kind: 'text',
      download: {
        name: manifest.download_name,
        mime_type: 'text/plain;charset=utf-8',
        content: manifest.content,
      },
    })
  }

  try {
    const files = await Promise.all((manifest.files || []).map(async file => ({
      name: file.name,
      mime_type: file.mime_type,
      ...(file.size_bytes === undefined ? {} : { size_bytes: file.size_bytes }),
      url: await dependencies.createSignedUrl(
        file.bucket,
        file.path,
        CREATION_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
      ),
    })))
    dependencies.log?.('creation_download', { action: 'prepare', outcome: 'prepared' })
    return jsonResponse({
      ok: true,
      action: 'prepare',
      creation_id: creation.id,
      delivery_kind: creation.delivery_kind,
      expires_in: CREATION_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
      ...(creation.delivery_kind === 'file' ? { download: files[0] } : { files }),
    })
  } catch {
    dependencies.log?.('creation_download', { action: 'prepare', outcome: 'sign_failed' })
    return jsonResponse({ ok: false, error: 'Não foi possível preparar o download.' }, 502)
  }
}

export async function handleCreationDownload(
  request: Request,
  dependencies: CreationDownloadDependencies,
) {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)

  const token = bearerToken(request)
  if (!token) return jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401)
  const user = await dependencies.authenticate(token).catch(() => null)
  if (!user) return jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401)

  const payload = await parsePayload(request)
  if (!payload) return jsonResponse({ ok: false, error: 'Solicitação inválida.' }, 400)

  let creation: DownloadCreation | null
  try {
    creation = await dependencies.getCreation(payload.creationId, user.id)
  } catch {
    dependencies.log?.('creation_download', { action: payload.action, outcome: 'lookup_failed' })
    return jsonResponse({ ok: false, error: 'Não foi possível processar sua solicitação.' }, 502)
  }
  if (!creation || creation.user_id !== user.id) return unavailable()

  if (payload.action === 'prepare') {
    return prepare(creation, dependencies, dependencies.now?.() ?? Date.now())
  }

  if (creation.deleted_at) return unavailable(410)
  if (creation.downloaded_at) {
    return jsonResponse({ ok: true, action: 'confirm', confirmed: true, already_confirmed: true })
  }

  try {
    const result = await dependencies.confirmCreation(
      creation.id,
      user.id,
      new Date(dependencies.now?.() ?? Date.now()).toISOString(),
    )
    if (result === 'unavailable') return unavailable(410)
    dependencies.log?.('creation_download', { action: 'confirm', outcome: result })
    return jsonResponse({
      ok: true,
      action: 'confirm',
      confirmed: true,
      already_confirmed: result === 'already_confirmed',
    })
  } catch {
    dependencies.log?.('creation_download', { action: 'confirm', outcome: 'confirm_failed' })
    return jsonResponse({ ok: false, error: 'Não foi possível confirmar o download.' }, 502)
  }
}
