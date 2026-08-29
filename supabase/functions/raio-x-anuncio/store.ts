import type { AnalysisInputKind, ContentTypeHint, ListingXrayUsage, NormalizedListing } from './contract.ts'

type SupabaseClientLike = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }> }
export type ListingXrayStoredRequest = {
  id: string | null; status: 'processing' | 'awaiting_input' | 'completed' | 'insufficient' | 'failed' | 'expired' | 'rate_limited'
  claimed: boolean; rateLimited: boolean; claimToken: string | null; reservationId: string | null
  result: unknown | null; continuation: Record<string, unknown> | null; errorCode: string | null; expiresAt: string
  reservedTokens: number; consumedTokens: number; refundedTokens: number
}
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined
function parse(value: unknown): ListingXrayStoredRequest {
  const item = first(value); if (!item) throw new Error('invalid_listing_xray_store_response')
  const continuation = item.returned_continuation ?? item.continuation
  return {
    id: typeof item.request_id === 'string' ? item.request_id : typeof item.id === 'string' ? item.id : null,
    status: String(item.request_status ?? item.status) as ListingXrayStoredRequest['status'], claimed: item.claimed === true, rateLimited: item.rate_limited === true,
    claimToken: typeof (item.returned_claim_token ?? item.claim_token) === 'string' ? String(item.returned_claim_token ?? item.claim_token) : null,
    reservationId: typeof (item.returned_reservation_id ?? item.reservation_id) === 'string' ? String(item.returned_reservation_id ?? item.reservation_id) : null,
    result: item.returned_result ?? item.result ?? null,
    continuation: continuation && typeof continuation === 'object' && !Array.isArray(continuation) ? continuation as Record<string, unknown> : null,
    errorCode: typeof (item.returned_error_code ?? item.error_code) === 'string' ? String(item.returned_error_code ?? item.error_code) : null,
    expiresAt: String(item.returned_expires_at ?? item.expires_at ?? ''),
    reservedTokens: Number(item.returned_reserved_tokens ?? item.smart_tokens_reserved ?? 0), consumedTokens: Number(item.returned_consumed_tokens ?? item.smart_tokens_consumed ?? 0), refundedTokens: Number(item.returned_refunded_tokens ?? item.smart_tokens_refunded ?? 0),
  }
}
const normalizedFacts = (normalized?: NormalizedListing | null) => normalized ? { schemaVersion: normalized.schemaVersion, sourceDomain: normalized.sourceDomain, fields: Object.fromEntries(Object.entries(normalized.fields).map(([key, field]) => [key, { state: field.state, value: field.value }])), extractionConfidence: normalized.extractionConfidence, inconsistencies: normalized.inconsistencies } : null

export function createListingXrayStore(client: SupabaseClientLike) {
  const rpc = async (name: string, args?: Record<string, unknown>) => { const { data, error } = await client.rpc(name, args); if (error) { const wrapped = new Error(error.message || name) as Error & { code?: string }; wrapped.code = error.code; throw wrapped } return data }
  return {
    async cleanup() { await rpc('cleanup_listing_xray_requests') },
    async claim(input: { userId: string; clientRequestId: string; inputKind: AnalysisInputKind; sourceDomain: string; sourceUrlHash: string; sourceUrlSanitized: string; imageCount: number; contentTypeHint: ContentTypeHint }) {
      return parse(await rpc('claim_listing_xray_request', { p_user_id: input.userId, p_client_request_id: input.clientRequestId, p_input_kind: input.inputKind, p_source_domain: input.sourceDomain, p_source_url_hash: input.sourceUrlHash, p_source_url_sanitized: input.sourceUrlSanitized, p_image_count: input.imageCount, p_content_type_hint: input.contentTypeHint }))
    },
    async complete(input: { userId: string; clientRequestId: string; claimToken: string; normalized?: NormalizedListing | null; result: unknown; model: string; usage: ListingXrayUsage; durationMs: number }) {
      return parse(await rpc('complete_listing_xray_request', { p_user_id: input.userId, p_client_request_id: input.clientRequestId, p_claim_token: input.claimToken, p_normalized_facts: normalizedFacts(input.normalized), p_result: input.result, p_provider_model: input.model, p_usage: input.usage, p_duration_ms: input.durationMs }))
    },
    async awaitInput(input: { userId: string; clientRequestId: string; claimToken: string; errorCode: 'additional_image_required' | 'classification_required'; continuation: Record<string, unknown>; usage: ListingXrayUsage; model: string }) {
      return parse(await rpc('await_listing_xray_input', { p_user_id: input.userId, p_client_request_id: input.clientRequestId, p_claim_token: input.claimToken, p_error_code: input.errorCode, p_continuation: input.continuation, p_usage: input.usage, p_provider_model: input.model }))
    },
    async finish(input: { userId: string; clientRequestId: string; claimToken: string; status: 'insufficient' | 'failed'; errorCode: string; normalized?: NormalizedListing | null; usage?: ListingXrayUsage; model?: string | null }) {
      return parse(await rpc('finish_listing_xray_without_result', { p_user_id: input.userId, p_client_request_id: input.clientRequestId, p_claim_token: input.claimToken, p_status: input.status, p_error_code: input.errorCode, p_normalized_facts: normalizedFacts(input.normalized), p_usage: input.usage || {}, p_provider_model: input.model || null }))
    },
    async get(input: { userId: string; clientRequestId: string }) { const data = await rpc('get_listing_xray_request', { p_user_id: input.userId, p_client_request_id: input.clientRequestId }); return first(data) ? parse(data) : null },
  }
}
