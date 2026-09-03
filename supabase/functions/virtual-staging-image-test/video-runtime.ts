import {
  buildSmartSpaceRenderScript,
  buildSmartSpaceVideoPlan,
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
  const { clientRequestId, itemIndex } = requestFields(input)
  const item = await deps.recoverItem({ userId, clientRequestId, itemIndex })
  if (!item) return json({ ok: false, code: 'smart_space_item_not_found' }, 404)
  if (item.video_state === 'completed') return completedResponse(item, deps)

  if (action === 'start_video') {
    const plan = buildSmartSpaceVideoPlan(item.result || {})
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

export function isSmartSpaceVideoAction(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input)
    && ['start_video', 'video_status'].includes(String((input as Record<string, unknown>).action || '')))
}

export { SMART_SPACE_VIDEO_MIME }
