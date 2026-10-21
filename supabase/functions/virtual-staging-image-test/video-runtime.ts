import {
  buildSmartSpaceRenderScript,
  buildSmartSpaceConsolidatedVideoPlan,
  buildSmartSpaceVideoPlan,
  normalizeSmartSpaceVideoMarketing,
  smartSpaceVideoIdempotencyKey,
  SMART_SPACE_VIDEO_MIME,
  SMART_SPACE_VIDEO_RENDERER,
} from './video-contract.ts'

export type VideoRenderRecord = { id: string; status: string; url?: string | null }

export type SmartSpaceVideoDependencies = {
  recoverItem(input: { userId: string; clientRequestId: string; itemIndex: number }): Promise<Record<string, any> | null>
  claimVideo(input: { userId: string; clientRequestId: string; itemIndex: number; idempotencyKey: string }): Promise<{ item: Record<string, any>; claimed: boolean; claimToken: string | null }>
  registerVideo(input: { userId: string; clientRequestId: string; itemIndex: number; claimToken: string; renderId: string }): Promise<void>
  completeVideo(input: { userId: string; clientRequestId: string; itemIndex: number; claimToken: string; outputPath: string }): Promise<void>
  failVideo(input: { userId: string; clientRequestId: string; itemIndex: number; claimToken: string | null; reason: string; retryable: boolean }): Promise<void>
  signSources(paths: string[]): Promise<string[]>
  startRender(source: Record<string, unknown>, metadata: string): Promise<VideoRenderRecord>
  getRender(renderId: string): Promise<VideoRenderRecord>
  downloadRender(url: string): Promise<Uint8Array>
  uploadVideo(path: string, bytes: Uint8Array): Promise<void>
  signVideo(path: string): Promise<string>
  log(event: string, details: Record<string, unknown>): void
  recoverConsolidatedVideo?(input: { userId: string; clientRequestId: string }): Promise<{ request: Record<string, any>; items: Record<string, any>[]; video: Record<string, any> | null } | null>
  claimConsolidatedVideo?(input: { userId: string; clientRequestId: string; idempotencyKey: string }): Promise<{ video: Record<string, any>; claimed: boolean; claimToken: string | null }>
  registerConsolidatedVideo?(input: { userId: string; clientRequestId: string; claimToken: string; renderId: string }): Promise<void>
  completeConsolidatedVideo?(input: { userId: string; clientRequestId: string; claimToken: string; outputPath: string }): Promise<void>
  failConsolidatedVideo?(input: { userId: string; clientRequestId: string; claimToken: string | null; reason: string; retryable: boolean }): Promise<void>
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function requestFields(input: Record<string, unknown>) {
  const clientRequestId = String(input.client_request_id ?? '')
  const itemIndex = Number(input.item_index)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
    || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 4) {
    throw new Error('invalid_smart_space_video_request')
  }
  return { clientRequestId, itemIndex }
}

function requestMarketing(input: Record<string, unknown>) {
  return normalizeSmartSpaceVideoMarketing(input.marketing)
}

function storedMarketing(item: Record<string, any>, fallback: Record<string, unknown>) {
  const request = item.virtual_staging_image_requests
  const deliveryMetadata = request && typeof request === 'object' ? request.delivery_metadata : null
  const normalized = normalizeSmartSpaceVideoMarketing(deliveryMetadata)
  return Object.values(normalized).some(Boolean) ? normalized : requestMarketing(fallback)
}

function publicVideo(item: Record<string, any>) {
  return {
    state: String(item.video_state || 'not_requested'),
    renderer: item.video_renderer || SMART_SPACE_VIDEO_RENDERER,
    render_id: item.video_render_id || null,
    output_path: item.video_output_path || null,
    failure_reason: item.video_failure_reason || null,
  }
}

async function completedResponse(item: Record<string, any>, deps: SmartSpaceVideoDependencies) {
  const path = String(item.video_output_path || '')
  if (!path) return json({ ok: false, code: 'smart_space_video_output_missing', video: publicVideo(item) }, 409)
  return json({ ok: true, video: { ...publicVideo(item), signed_url: await deps.signVideo(path) } })
}

export async function handleSmartSpaceVideoAction(
  userId: string,
  input: Record<string, unknown>,
  deps: SmartSpaceVideoDependencies,
) {
  const action = String(input.action || '')
  if (['start_consolidated_video', 'consolidated_video_status'].includes(action)) {
    return handleSmartSpaceConsolidatedVideoAction(userId, input, deps)
  }
  const { clientRequestId, itemIndex } = requestFields(input)
  const item = await deps.recoverItem({ userId, clientRequestId, itemIndex })
  if (!item) return json({ ok: false, code: 'smart_space_item_not_found' }, 404)
  if (item.video_state === 'completed') return completedResponse(item, deps)

  if (action === 'start_video') {
    const plan = buildSmartSpaceVideoPlan(item.result || {}, storedMarketing(item, input))
    if (!plan) {
      // Partial image delivery is intentionally preserved without pretending the full transformation video exists.
      return json({ ok: true, skipped: true, video: publicVideo(item) })
    }
    const idempotencyKey = smartSpaceVideoIdempotencyKey(String(item.id || ''), plan)
    const claim = await deps.claimVideo({ userId, clientRequestId, itemIndex, idempotencyKey })
    if (!claim.claimed || !claim.claimToken) return json({ ok: true, pending: true, video: publicVideo(claim.item) }, 202)
    try {
      const signedSources = await deps.signSources(plan.scenes.map(scene => scene.storagePath))
      const render = await deps.startRender(buildSmartSpaceRenderScript(plan, signedSources), idempotencyKey)
      if (!render.id) throw new Error('creatomate_render_id_missing')
      await deps.registerVideo({ userId, clientRequestId, itemIndex, claimToken: claim.claimToken, renderId: render.id })
      deps.log('video_render_started', { itemIndex, renderer: SMART_SPACE_VIDEO_RENDERER, sceneCount: plan.scenes.length, durationSeconds: plan.durationSeconds })
      return json({ ok: true, pending: true, video: { state: 'rendering', provider_status: render.status || 'planned', renderer: SMART_SPACE_VIDEO_RENDERER, render_id: render.id } }, 202)
    } catch (error) {
      const reason = String(error instanceof Error ? error.message : error).slice(0, 120)
      await deps.failVideo({ userId, clientRequestId, itemIndex, claimToken: claim.claimToken, reason, retryable: false })
      deps.log('video_render_submission_failed', { itemIndex, reason })
      return json({ ok: false, code: 'smart_space_video_render_failed', error: 'As imagens estão prontas, mas o vídeo não pôde ser iniciado.' }, 502)
    }
  }

  if (action === 'video_status') {
    if (!item.video_render_id || !['rendering', 'submitted'].includes(String(item.video_state))) {
      return json({ ok: true, pending: false, video: publicVideo(item) })
    }
    let render: VideoRenderRecord
    try {
      render = await deps.getRender(String(item.video_render_id))
    } catch {
      return json({ ok: true, pending: true, warning: 'video_status_temporarily_unavailable', video: { ...publicVideo(item), state: 'rendering' } }, 202)
    }
    if (render.status === 'failed') {
      await deps.failVideo({ userId, clientRequestId, itemIndex, claimToken: item.video_claim_token || null, reason: 'creatomate_render_failed', retryable: true })
      return json({ ok: true, pending: false, video: { ...publicVideo(item), state: 'failed', failure_reason: 'creatomate_render_failed' } })
    }
    if (render.status !== 'succeeded' || !render.url) return json({ ok: true, pending: true, video: { ...publicVideo(item), state: 'rendering' } }, 202)

    try {
      const bytes = await deps.downloadRender(render.url)
      if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') throw new Error('invalid_mp4_output')
      const outputPath = `${userId}/virtual-staging-images/outputs/${clientRequestId}/${String(itemIndex + 1).padStart(2, '0')}-transformation.mp4`
      await deps.uploadVideo(outputPath, bytes)
      await deps.completeVideo({ userId, clientRequestId, itemIndex, claimToken: item.video_claim_token, outputPath })
      const completed = { ...item, video_state: 'completed', video_output_path: outputPath, video_failure_reason: null }
      deps.log('video_render_completed', { itemIndex, renderer: SMART_SPACE_VIDEO_RENDERER, outputBytes: bytes.length })
      return completedResponse(completed, deps)
    } catch (error) {
      const reason = String(error instanceof Error ? error.message : error).slice(0, 120)
      deps.log('video_delivery_pending', { itemIndex, reason })
      // Keep the same provider render attached so recovery retries only the protected copy/sign step.
      return json({ ok: true, pending: true, warning: 'smart_space_video_delivery_pending', video: { ...publicVideo(item), state: 'rendering' } }, 202)
    }
  }

  return json({ ok: false, code: 'invalid_smart_space_video_action' }, 400)
}

function publicConsolidatedVideo(video: Record<string, any> | null) {
  return {
    state: String(video?.state || 'not_requested'),
    renderer: video?.renderer || SMART_SPACE_VIDEO_RENDERER,
    render_id: video?.render_id || null,
    output_path: video?.output_path || null,
    failure_reason: video?.failure_reason || null,
  }
}

async function completedConsolidatedResponse(video: Record<string, any>, deps: SmartSpaceVideoDependencies) {
  const path = String(video.output_path || '')
  if (!path) return json({ ok: false, code: 'smart_space_consolidated_output_missing', video: publicConsolidatedVideo(video) }, 409)
  return json({ ok: true, video: { ...publicConsolidatedVideo(video), signed_url: await deps.signVideo(path) } })
}

async function handleSmartSpaceConsolidatedVideoAction(userId: string, input: Record<string, unknown>, deps: SmartSpaceVideoDependencies) {
  const clientRequestId = String(input.client_request_id ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)) {
    return json({ ok: false, code: 'invalid_smart_space_consolidated_request' }, 400)
  }
  if (!deps.recoverConsolidatedVideo || !deps.claimConsolidatedVideo || !deps.registerConsolidatedVideo || !deps.completeConsolidatedVideo || !deps.failConsolidatedVideo) {
    return json({ ok: false, code: 'smart_space_consolidated_video_unavailable' }, 503)
  }
  const recovered = await deps.recoverConsolidatedVideo({ userId, clientRequestId })
  if (!recovered) return json({ ok: false, code: 'smart_space_request_not_found' }, 404)
  if (recovered.video?.state === 'completed') return completedConsolidatedResponse(recovered.video, deps)

  if (input.action === 'start_consolidated_video') {
    const plan = buildSmartSpaceConsolidatedVideoPlan(recovered.items, recovered.request.delivery_metadata)
    if (!plan) return json({ ok: true, skipped: true, video: publicConsolidatedVideo(recovered.video) })
    const idempotencyKey = `smart-space-consolidated:${clientRequestId}:v${plan.version}`
    const claim = await deps.claimConsolidatedVideo({ userId, clientRequestId, idempotencyKey })
    if (!claim.claimed || !claim.claimToken) return json({ ok: true, pending: true, video: publicConsolidatedVideo(claim.video) }, 202)
    try {
      const sources = await deps.signSources(plan.scenes.map(scene => scene.storagePath))
      const render = await deps.startRender(buildSmartSpaceRenderScript(plan, sources), idempotencyKey)
      if (!render.id) throw new Error('creatomate_render_id_missing')
      await deps.registerConsolidatedVideo({ userId, clientRequestId, claimToken: claim.claimToken, renderId: render.id })
      deps.log('consolidated_video_render_started', { renderer: SMART_SPACE_VIDEO_RENDERER, sceneCount: plan.scenes.length })
      return json({ ok: true, pending: true, video: { state: 'rendering', renderer: SMART_SPACE_VIDEO_RENDERER, render_id: render.id } }, 202)
    } catch (error) {
      const reason = String(error instanceof Error ? error.message : error).slice(0, 120)
      await deps.failConsolidatedVideo({ userId, clientRequestId, claimToken: claim.claimToken, reason, retryable: false })
      return json({ ok: false, code: 'smart_space_consolidated_render_failed' }, 502)
    }
  }

  if (input.action === 'consolidated_video_status') {
    const video = recovered.video
    if (!video?.render_id || !['rendering', 'submitted'].includes(String(video.state))) {
      return json({ ok: true, pending: false, video: publicConsolidatedVideo(video) })
    }
    let render: VideoRenderRecord
    try {
      render = await deps.getRender(String(video.render_id))
    } catch {
      return json({ ok: true, pending: true, video: { ...publicConsolidatedVideo(video), state: 'rendering' } }, 202)
    }
    if (render.status === 'failed') {
      await deps.failConsolidatedVideo({ userId, clientRequestId, claimToken: video.claim_token || null, reason: 'creatomate_render_failed', retryable: true })
      return json({ ok: true, pending: false, video: { ...publicConsolidatedVideo(video), state: 'failed' } })
    }
    if (render.status !== 'succeeded' || !render.url) return json({ ok: true, pending: true, video: { ...publicConsolidatedVideo(video), state: 'rendering' } }, 202)
    try {
      const bytes = await deps.downloadRender(render.url)
      if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') throw new Error('invalid_mp4_output')
      const outputPath = `${userId}/virtual-staging-images/outputs/${clientRequestId}/campaign-transformation.mp4`
      await deps.uploadVideo(outputPath, bytes)
      await deps.completeConsolidatedVideo({ userId, clientRequestId, claimToken: String(video.claim_token || ''), outputPath })
      return completedConsolidatedResponse({ ...video, state: 'completed', output_path: outputPath }, deps)
    } catch {
      return json({ ok: true, pending: true, video: { ...publicConsolidatedVideo(video), state: 'rendering' } }, 202)
    }
  }
  return json({ ok: false, code: 'invalid_smart_space_consolidated_video_action' }, 400)
}

export function isSmartSpaceVideoAction(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input)
    && ['start_video', 'video_status', 'start_consolidated_video', 'consolidated_video_status'].includes(String((input as Record<string, unknown>).action || '')))
}

export { SMART_SPACE_VIDEO_MIME }
