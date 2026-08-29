import { jsonResponse } from '../_shared/cors.ts'
import {
  LISTING_XRAY_FIELD_KEYS, LISTING_XRAY_MAX_IMAGES, LISTING_XRAY_TEXT_MODEL, LISTING_XRAY_VISION_MODEL,
  ListingXrayValidationError, type AnalysisInputKind, type ContentTypeHint,
  type ListingXrayUsage, type NormalizedListing, validateListingXrayModelOutput,
} from './contract.ts'
import { extractListing, type ListingExtraction } from './extract.ts'
import { validateListingXrayImages } from './images.ts'
import { normalizeListing } from './normalize.ts'
import { finalizeListingXrayResult } from './scoring.ts'
import { ListingXrayFetchError, parseListingUrl, type SecureHtmlResult } from './secure-fetch.ts'
import type { ListingXrayStoredRequest } from './store.ts'

type AuthUser = { id: string }
type GenerationInput = { inputKind: AnalysisInputKind; listing: NormalizedListing | null; images: string[]; contentTypeHint: ContentTypeHint }
export type ListingXrayRuntimeDependencies = {
  authenticate: (token: string) => Promise<AuthUser | null>
  authorizeAcquireOnly?: (input: { userId: string; token: string }) => Promise<boolean>
  cleanup?: () => Promise<void>
  claim: (input: { userId: string; clientRequestId: string; inputKind: AnalysisInputKind; sourceDomain: string; sourceUrlHash: string; sourceUrlSanitized: string; imageCount: number; contentTypeHint: ContentTypeHint }) => Promise<ListingXrayStoredRequest>
  complete: (input: { userId: string; clientRequestId: string; claimToken: string; normalized?: NormalizedListing | null; result: unknown; model: string; usage: ListingXrayUsage; durationMs: number }) => Promise<ListingXrayStoredRequest>
  awaitInput: (input: { userId: string; clientRequestId: string; claimToken: string; errorCode: 'additional_image_required' | 'classification_required'; continuation: Record<string, unknown>; usage: ListingXrayUsage; model: string }) => Promise<ListingXrayStoredRequest>
  finish: (input: { userId: string; clientRequestId: string; claimToken: string; status: 'insufficient' | 'failed'; errorCode: string; normalized?: NormalizedListing | null; usage?: ListingXrayUsage; model?: string | null }) => Promise<ListingXrayStoredRequest>
  get: (input: { userId: string; clientRequestId: string }) => Promise<ListingXrayStoredRequest | null>
  fetchHtml: (url: string) => Promise<SecureHtmlResult>
  extract?: (html: string, url: string) => ListingExtraction
  normalize?: (extraction: ListingExtraction) => NormalizedListing
  generate: (input: GenerationInput) => Promise<{ output: unknown; usage: ListingXrayUsage; model: string }>
  now?: () => number
  log?: (event: string, details: Record<string, unknown>) => void
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const LISTING_XRAY_FAILURE_CATEGORIES = Object.freeze(['SOURCE_UNAVAILABLE', 'SOURCE_LOW_CONFIDENCE', 'ANALYSIS_PROCESSING_ERROR', 'PROVIDER_ERROR', 'INVALID_RESULT'] as const)
export type ListingXrayFailureCategory = typeof LISTING_XRAY_FAILURE_CATEGORIES[number]
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const bearer = (request: Request) => (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
async function sha256(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(part => part.toString(16).padStart(2, '0')).join('') }

function completedResponse(stored: ListingXrayStoredRequest, recovery = false) {
  if (!stored.result || typeof stored.result !== 'object') return jsonResponse({ ok: false, code: 'RESULT_UNAVAILABLE', error: 'O resultado temporário não está mais disponível.' }, 410)
  return jsonResponse({ ok: true, status: 'completed', recovery, result: stored.result, expires_at: stored.expiresAt, economy: { reserved: stored.reservedTokens, consumed: stored.consumedTokens, refunded: stored.refundedTokens } })
}
function categoryFromStoredError(errorCode: string | null): ListingXrayFailureCategory {
  const category = String(errorCode || '').split(':', 1)[0].toUpperCase()
  return LISTING_XRAY_FAILURE_CATEGORIES.includes(category as ListingXrayFailureCategory) ? category as ListingXrayFailureCategory : 'ANALYSIS_PROCESSING_ERROR'
}
function publicFailure(category: ListingXrayFailureCategory) {
  const source = category === 'SOURCE_UNAVAILABLE' || category === 'SOURCE_LOW_CONFIDENCE'
  return { code: category, error: source ? 'Não conseguimos analisar este anúncio pelo link.' : 'Não conseguimos concluir esta análise. Tente novamente.' }
}
function terminalResponse(stored: ListingXrayStoredRequest, recovery = false) {
  if (stored.status === 'completed') return completedResponse(stored, recovery)
  if (stored.status === 'processing') return jsonResponse({ ok: false, status: 'processing', recovery, retry_after_seconds: 2 }, 202)
  if (stored.status === 'awaiting_input') return jsonResponse({ ok: false, status: 'awaiting_input', recovery, code: stored.errorCode?.toUpperCase(), continuation: stored.continuation, error: stored.continuation?.message || 'Envie uma captura adicional para continuar a mesma análise.' })
  if (stored.status === 'insufficient') { const failure = publicFailure(categoryFromStoredError(stored.errorCode)); return jsonResponse({ ok: false, status: 'insufficient', recovery, ...failure }, 422) }
  if (stored.status === 'failed') { const failure = publicFailure(categoryFromStoredError(stored.errorCode)); return jsonResponse({ ok: false, status: 'failed', recovery, ...failure }, 502) }
  return jsonResponse({ ok: false, status: 'expired', recovery, code: 'RESULT_EXPIRED', error: 'Este resultado temporário expirou.' }, 410)
}

type ParsedBody =
  | { action: 'acquire_only'; clientRequestId: null; url: string; inputKind: null; images: []; contentTypeHint: null }
  | { action: 'recover'; clientRequestId: string; url: null; inputKind: null; images: []; contentTypeHint: null }
  | { action: 'analyze_url'; clientRequestId: string; url: string; inputKind: 'url'; images: []; contentTypeHint: 'PROPERTY_LISTING' }
  | { action: 'analyze_images'; clientRequestId: string; url: null; inputKind: 'images'; images: ReturnType<typeof validateListingXrayImages>; contentTypeHint: ContentTypeHint }

function requestId(value: unknown) { const normalized = typeof value === 'string' ? value.toLowerCase() : ''; if (!UUID.test(normalized)) throw new ListingXrayValidationError('invalid_client_request_id'); return normalized }
function parseBody(value: unknown): ParsedBody {
  if (!isRecord(value)) throw new ListingXrayValidationError('invalid_payload')
  const action = value.action === 'analyze' ? 'analyze_url' : value.action
  if (action === 'acquire_only') { if (Object.keys(value).some(key => !['action', 'url'].includes(key))) throw new ListingXrayValidationError('invalid_payload'); return { action, clientRequestId: null, url: parseListingUrl(value.url).toString(), inputKind: null, images: [], contentTypeHint: null } }
  if (action === 'recover') { if (Object.keys(value).some(key => !['action', 'client_request_id'].includes(key))) throw new ListingXrayValidationError('invalid_payload'); return { action, clientRequestId: requestId(value.client_request_id), url: null, inputKind: null, images: [], contentTypeHint: null } }
  if (action === 'analyze_url') { if (Object.keys(value).some(key => !['action', 'client_request_id', 'url'].includes(key))) throw new ListingXrayValidationError('invalid_payload'); return { action, clientRequestId: requestId(value.client_request_id), url: parseListingUrl(value.url).toString(), inputKind: 'url', images: [], contentTypeHint: 'PROPERTY_LISTING' } }
  if (action === 'analyze_images') {
    if (Object.keys(value).some(key => !['action', 'client_request_id', 'images', 'content_type_hint'].includes(key))) throw new ListingXrayValidationError('invalid_payload')
    const hint = value.content_type_hint == null ? null : String(value.content_type_hint) as ContentTypeHint
    if (hint !== null && !['PROPERTY_LISTING', 'SOCIAL_PUBLICATION'].includes(hint)) throw new ListingXrayValidationError('invalid_content_type_hint')
    return { action, clientRequestId: requestId(value.client_request_id), url: null, inputKind: 'images', images: validateListingXrayImages(value.images), contentTypeHint: hint }
  }
  throw new ListingXrayValidationError('invalid_payload')
}

function acquisitionFields(normalized: NormalizedListing) {
  const entries = [...LISTING_XRAY_FIELD_KEYS.map(key => [key, normalized.fields[key].state] as const), ['detectedImageCount', normalized.detectedImageCount.state] as const, ['videoDetected', normalized.videoDetected.state] as const]
  return { confirmedFields: entries.filter(([, state]) => state === 'CONFIRMED').map(([key]) => key), notFoundFields: entries.filter(([, state]) => state === 'NOT_FOUND').map(([key]) => key), ambiguousFields: entries.filter(([, state]) => state === 'AMBIGUOUS').map(([key]) => key) }
}
function acquireFailure(url: string, error: unknown, elapsedMs: number) {
  const code = error instanceof ListingXrayFetchError ? error.code : 'fetch_failed'; const match = /^upstream_http_(\d{3})$/.exec(code); let sourceDomain = ''
  try { sourceDomain = parseListingUrl(url).hostname.toLowerCase() } catch { /* sanitized */ }
  return jsonResponse({ ok: false, sourceDomain, upstreamStatus: match ? Number(match[1]) : null, stage: 'secure_fetch', adapter: null, extractionConfidence: null, gate: 'FAIL', confirmedFields: [], notFoundFields: [], ambiguousFields: [], redirectCount: 0, contentType: null, bytesReceived: 0, elapsedMs }, code.startsWith('blocked_') || ['invalid_url', 'blocked_port'].includes(code) ? 400 : 422)
}

export function classifyListingXrayFailure(error: unknown): { category: ListingXrayFailureCategory; reason: string } {
  const reason = error instanceof ListingXrayFetchError ? error.code : error instanceof Error ? error.message : 'analysis_failed'
  if (error instanceof ListingXrayFetchError || reason.startsWith('upstream_http_') || ['fetch_timeout', 'fetch_failed', 'invalid_content_type', 'empty_html'].includes(reason)) return { category: 'SOURCE_UNAVAILABLE', reason }
  if (error instanceof ListingXrayValidationError) return { category: 'INVALID_RESULT', reason }
  if (reason.startsWith('openai_') || /timeout|abort/i.test(reason)) return { category: 'PROVIDER_ERROR', reason }
  return { category: 'ANALYSIS_PROCESSING_ERROR', reason }
}

export async function handleListingXray(request: Request, dependencies: ListingXrayRuntimeDependencies) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)
  const token = bearer(request); if (!token) return jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401)
  const user = await dependencies.authenticate(token).catch(() => null); if (!user) return jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401)
  let parsed: ParsedBody
  try { parsed = parseBody(await request.json()) } catch (error) { const code = error instanceof Error ? error.message : 'invalid_payload'; return jsonResponse({ ok: false, code: code.toUpperCase(), error: code.startsWith('invalid_image') ? 'Use de 1 a 5 imagens JPG, PNG ou WebP válidas.' : 'Revise os dados enviados para a análise.' }, 400) }

  if (parsed.action === 'acquire_only') {
    const authorized = await dependencies.authorizeAcquireOnly?.({ userId: user.id, token }).catch(() => false); if (!authorized) return jsonResponse({ ok: false, error: 'Acesso administrativo não autorizado.' }, 403)
    const startedAt = (dependencies.now || Date.now)()
    try {
      const fetched = await dependencies.fetchHtml(parsed.url); const extraction = (dependencies.extract || extractListing)(fetched.html, fetched.finalUrl); const normalized = (dependencies.normalize || normalizeListing)(extraction); const fields = acquisitionFields(normalized)
      dependencies.log?.('acquire_only_completed', { domain: fetched.sourceDomain, upstream_status: fetched.status, adapter: normalized.adapter, confidence: normalized.extractionConfidence.score, gate: normalized.extractionConfidence.gate, bytes: fetched.bytes, redirects: fetched.redirects })
      return jsonResponse({ ok: true, sourceDomain: fetched.sourceDomain, upstreamStatus: fetched.status, stage: 'confidence_gate', adapter: normalized.adapter, extractionConfidence: normalized.extractionConfidence, gate: normalized.extractionConfidence.gate, ...fields, redirectCount: fetched.redirects, contentType: fetched.contentType, bytesReceived: fetched.bytes, elapsedMs: Math.max(0, (dependencies.now || Date.now)() - startedAt) })
    } catch (error) { const elapsedMs = Math.max(0, (dependencies.now || Date.now)() - startedAt); dependencies.log?.('acquire_only_failed', { domain: parseListingUrl(parsed.url).hostname.toLowerCase(), code: error instanceof ListingXrayFetchError ? error.code : 'acquisition_failed', elapsed_ms: elapsedMs }); return acquireFailure(parsed.url, error, elapsedMs) }
  }
  if (parsed.action === 'recover') { const stored = await dependencies.get({ userId: user.id, clientRequestId: parsed.clientRequestId }).catch(() => null); return stored ? terminalResponse(stored, true) : jsonResponse({ ok: false, status: 'not_found', recovery: true, code: 'RESULT_NOT_FOUND', error: 'Nenhum resultado temporário foi encontrado.' }, 404) }

  const inputKind = parsed.inputKind; const sourceUrl = parsed.url; const sourceDomain = sourceUrl ? parseListingUrl(sourceUrl).hostname.toLowerCase() : 'user-upload'; const sanitized = sourceUrl ? `${parseListingUrl(sourceUrl).origin}${parseListingUrl(sourceUrl).pathname}`.slice(0, 2048) : `images:${parsed.images.length}`
  const sourceHash = await sha256(sourceUrl || parsed.images.map(image => `${image.mimeType}:${image.byteLength}:${image.dataUrl.slice(-64)}`).join('|'))
  await dependencies.cleanup?.().catch(() => dependencies.log?.('cleanup_failed', { product_code: 'listing_xray' }))
  let claim: ListingXrayStoredRequest
  try { claim = await dependencies.claim({ userId: user.id, clientRequestId: parsed.clientRequestId, inputKind, sourceDomain, sourceUrlHash: sourceHash, sourceUrlSanitized: sanitized, imageCount: parsed.images.length, contentTypeHint: parsed.contentTypeHint }) }
  catch (error) { const message = error instanceof Error ? error.message : ''; if (/insuf|saldo|credit/i.test(message)) return jsonResponse({ ok: false, code: 'INSUFFICIENT_SMART_TOKENS', error: 'Você precisa de 10 Smart Tokens para iniciar esta análise.' }, 402); return jsonResponse({ ok: false, error: 'Não foi possível iniciar a análise agora.' }, 503) }
  if (claim.rateLimited || claim.status === 'rate_limited') return jsonResponse({ ok: false, code: 'RATE_LIMITED', error: 'Aguarde um pouco antes de iniciar outro Raio-X.' }, 429)
  if (!claim.claimed) return terminalResponse(claim)
  if (!claim.claimToken) return jsonResponse({ ok: false, error: 'Não foi possível confirmar esta análise.' }, 503)

  const startedAt = (dependencies.now || Date.now)(); let normalized: NormalizedListing | null = null; let usage: ListingXrayUsage | undefined; let model = inputKind === 'url' ? LISTING_XRAY_TEXT_MODEL : LISTING_XRAY_VISION_MODEL
  try {
    if (inputKind === 'url' && sourceUrl) {
      const fetched = await dependencies.fetchHtml(sourceUrl); const extraction = (dependencies.extract || extractListing)(fetched.html, fetched.finalUrl); normalized = (dependencies.normalize || normalizeListing)(extraction)
      dependencies.log?.('extraction_completed', { domain: fetched.sourceDomain, adapter: normalized.adapter, confidence: normalized.extractionConfidence.score, bytes: fetched.bytes, redirects: fetched.redirects, duration_ms: fetched.durationMs })
      if (normalized.extractionConfidence.gate !== 'PASS') {
        const reason = normalized.extractionConfidence.reasons[0] || 'insufficient_data'
        await dependencies.finish({ userId: user.id, clientRequestId: parsed.clientRequestId, claimToken: claim.claimToken, status: 'insufficient', errorCode: `source_low_confidence:${reason}`, normalized })
        return jsonResponse({ ok: false, status: 'insufficient', ...publicFailure('SOURCE_LOW_CONFIDENCE') }, 422)
      }
    }
    const generated = await dependencies.generate({ inputKind, listing: normalized, images: parsed.images.map(image => image.dataUrl), contentTypeHint: parsed.contentTypeHint }); usage = generated.usage; model = generated.model
    const output = validateListingXrayModelOutput(generated.output)
    const unresolvedClassification = output.content_type === 'UNSURE' || output.classification_confidence < 75
    if (inputKind === 'images' && (output.needs_more_input || unresolvedClassification)) {
      if (output.needs_more_input && parsed.images.length >= LISTING_XRAY_MAX_IMAGES) {
        await dependencies.finish({ userId: user.id, clientRequestId: parsed.clientRequestId, claimToken: claim.claimToken, status: 'insufficient', errorCode: 'insufficient_images', usage, model })
        return jsonResponse({ ok: false, status: 'insufficient', code: 'INSUFFICIENT_DATA', error: 'As imagens não têm informações legíveis suficientes para uma análise confiável.' }, 422)
      }
      const errorCode = unresolvedClassification ? 'classification_required' : 'additional_image_required'
      const message = unresolvedClassification ? 'O que você quer analisar?' : output.additional_input_message || 'Para uma análise mais completa, envie também uma captura da descrição.'
      const awaiting = await dependencies.awaitInput({ userId: user.id, clientRequestId: parsed.clientRequestId, claimToken: claim.claimToken, errorCode, continuation: { message, classification_required: unresolvedClassification, image_count: parsed.images.length }, usage, model })
      return jsonResponse({ ok: false, status: 'awaiting_input', code: errorCode.toUpperCase(), continuation: awaiting.continuation || { message, classification_required: unresolvedClassification }, error: message, economy: { reserved: awaiting.reservedTokens, consumed: 0, refunded: 0 } })
    }
    if (output.needs_more_input || unresolvedClassification) throw new ListingXrayValidationError('insufficient_model_evidence')
    const result = finalizeListingXrayResult({ inputKind, listing: normalized, imageCount: parsed.images.length }, output); const durationMs = Math.max(0, (dependencies.now || Date.now)() - startedAt)
    const completed = await dependencies.complete({ userId: user.id, clientRequestId: parsed.clientRequestId, claimToken: claim.claimToken, normalized, result, model, usage, durationMs })
    dependencies.log?.('analysis_completed', { input_kind: inputKind, model, image_count: parsed.images.length, usage, duration_ms: durationMs })
    return completedResponse({ ...completed, result: completed.result || result })
  } catch (error) {
    const classified = classifyListingXrayFailure(error); const reason = classified.reason.slice(0, 80)
    const insufficient = classified.category === 'SOURCE_UNAVAILABLE' || classified.category === 'SOURCE_LOW_CONFIDENCE'
    await dependencies.finish({ userId: user.id, clientRequestId: parsed.clientRequestId, claimToken: claim.claimToken, status: insufficient ? 'insufficient' : 'failed', errorCode: `${classified.category.toLowerCase()}:${reason}`.slice(0, 120), normalized, usage, model }).catch(() => null)
    dependencies.log?.('analysis_failed', { input_kind: inputKind, domain: sourceDomain, model, category: classified.category, reason, image_count: parsed.images.length })
    if (reason.startsWith('blocked_') || ['invalid_url', 'blocked_port'].includes(reason)) return jsonResponse({ ok: false, code: 'URL_NOT_ALLOWED', error: 'Este link não pode ser analisado.' }, 400)
    return jsonResponse({ ok: false, status: insufficient ? 'insufficient' : 'failed', ...publicFailure(classified.category) }, insufficient ? 422 : 502)
  }
}
