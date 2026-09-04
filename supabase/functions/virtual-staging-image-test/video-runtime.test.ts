import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartSpaceRenderScript,
  buildSmartSpaceVideoPlan,
  estimateSmartSpaceCreatomateCredits,
  SMART_SPACE_VIDEO_HEIGHT,
  SMART_SPACE_VIDEO_WIDTH,
} from './video-contract.ts'
import { handleSmartSpaceVideoAction, type SmartSpaceVideoDependencies } from './video-runtime.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const clientRequestId = '33333333-3333-4333-8333-333333333333'
const itemId = '22222222-2222-4222-8222-222222222222'

function completedResult(action: string, stages: Array<[string, string]>) {
  return {
    action,
    delivery_status: 'completed',
    input_path: `${userId}/virtual-staging-images/inputs/${clientRequestId}/01.jpg`,
    stages: stages.map(([kind, output_path]) => ({ kind, output_path })),
  }
}

test('as quatro ações geram sequências determinísticas de dois ou três estados', () => {
  const cases = [
    ['furnish', [['furnish', 'out/furnished.jpg']], ['Antes', 'Depois']],
    ['remove_furniture', [['free_space', 'out/free.jpg']], ['Antes', 'Espaço livre']],
    ['remove_and_redecorate', [['free_space', 'out/free.jpg'], ['new_decoration', 'out/new.jpg']], ['Antes', 'Espaço livre', 'Nova decoração']],
    ['clear_area', [['clear_area', 'out/clean.jpg']], ['Antes', 'Depois']],
  ] as const
  for (const [action, stages, labels] of cases) {
    const plan = buildSmartSpaceVideoPlan(completedResult(action, [...stages]))
    assert.ok(plan)
    assert.equal(plan.version, 4)
    assert.deepEqual(plan.scenes.map(scene => scene.label), labels)
    assert.equal(plan.durationSeconds, labels.length === 3 ? 8 : 6)
    const script = buildSmartSpaceRenderScript(plan, plan.scenes.map((_, index) => `https://storage.test/${index}.jpg`))
    assert.equal(script.width, SMART_SPACE_VIDEO_WIDTH)
    assert.equal(script.height, SMART_SPACE_VIDEO_HEIGHT)
    assert.equal(script.output_format, 'mp4')
    const images = script.elements.filter(element => element.type === 'image')
    const textElements = script.elements.filter(element => element.type === 'text')
    assert.equal(images.length, plan.scenes.length)
    assert.equal(images.every(element => element.track === 1 && element.fit === 'cover' && element.x === '50%' && element.y === '50%' && element.width === '100%' && element.height === '100%'), true)
    assert.equal(images.every(element => !('blur_radius' in element) && !('blur_mode' in element) && !('color_overlay' in element) && !('border_radius' in element) && !('shadow_color' in element) && !('shadow_blur' in element) && !('shadow_y' in element)), true)
    assert.equal(textElements.length, 0)
    assert.deepEqual(images.map(element => element.time), plan.scenes.map((_, index) => index * (plan.durationSeconds / plan.scenes.length)))
    assert.equal(JSON.stringify(script).includes('contain'), false)
    assert.equal(JSON.stringify(script).includes('SMART SPACE'), false)
    assert.equal(labels.some(label => JSON.stringify(script).includes(label)), false)
    assert.equal(JSON.stringify(script).includes('audio'), false)
  }
})

test('render 720x1280 curto custa dois créditos e não altera preço de imagem', () => {
  const two = buildSmartSpaceVideoPlan(completedResult('furnish', [['furnish', 'out.jpg']]))!
  const three = buildSmartSpaceVideoPlan(completedResult('remove_and_redecorate', [['free_space', 'free.jpg'], ['new_decoration', 'new.jpg']]))!
  assert.equal(estimateSmartSpaceCreatomateCredits(two), 2)
  assert.equal(estimateSmartSpaceCreatomateCredits(three), 2)
})

function dependencies(itemOverrides: Record<string, unknown> = {}) {
  let item: Record<string, any> = {
    id: itemId,
    status: 'completed',
    stage_state: 'completed',
    result: completedResult('furnish', [['furnish', 'out/furnished.jpg']]),
    video_state: 'not_requested',
    ...itemOverrides,
  }
  let starts = 0
  let uploads = 0
  const deps: SmartSpaceVideoDependencies = {
    recoverItem: async () => item,
    claimVideo: async ({ idempotencyKey }) => {
      if (item.video_state !== 'not_requested') return { item, claimed: false, claimToken: null }
      item = { ...item, video_state: 'submitting', video_idempotency_key: idempotencyKey, video_claim_token: '44444444-4444-4444-8444-444444444444' }
      return { item, claimed: true, claimToken: item.video_claim_token }
    },
    registerVideo: async ({ renderId }) => { item = { ...item, video_state: 'rendering', video_render_id: renderId } },
    completeVideo: async ({ outputPath }) => { item = { ...item, video_state: 'completed', video_output_path: outputPath } },
    failVideo: async ({ retryable }) => { item = { ...item, video_state: retryable ? 'failed_retryable' : 'failed_unknown' } },
    signSources: async paths => paths.map((_, index) => `https://storage.test/${index}.jpg`),
    startRender: async () => { starts += 1; return { id: 'render-1', status: 'planned' } },
    getRender: async () => ({ id: 'render-1', status: 'succeeded', url: 'https://renderer.test/result.mp4' }),
    downloadRender: async () => new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 1, 2, 3, 4]),
    uploadVideo: async () => { uploads += 1 },
    signVideo: async () => 'https://storage.test/signed-result.mp4',
    log: () => undefined,
  }
  return { deps, starts: () => starts, uploads: () => uploads, item: () => item }
}

test('start é idempotente e recovery não cria segundo render nem chama OpenAI', async () => {
  const state = dependencies()
  const input = { action: 'start_video', client_request_id: clientRequestId, item_index: 0 }
  assert.equal((await handleSmartSpaceVideoAction(userId, input, state.deps)).status, 202)
  assert.equal((await handleSmartSpaceVideoAction(userId, input, state.deps)).status, 202)
  assert.equal(state.starts(), 1)
  assert.equal('openAI' in state.deps, false)
})

test('status concluído persiste MP4 e entrega URL assinada sem nova geração de imagem', async () => {
  const state = dependencies({ video_state: 'rendering', video_render_id: 'render-1', video_claim_token: '44444444-4444-4444-8444-444444444444' })
  const response = await handleSmartSpaceVideoAction(userId, { action: 'video_status', client_request_id: clientRequestId, item_index: 0 }, state.deps)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.video.state, 'completed')
  assert.match(body.video.signed_url, /^https:\/\//)
  assert.equal(state.uploads(), 1)
})

test('recovery de vídeo já concluído apenas renova a URL e não cria render nem upload', async () => {
  const state = dependencies({
    video_state: 'completed',
    video_render_id: 'render-1',
    video_output_path: `${userId}/virtual-staging-images/outputs/${clientRequestId}/01-transformation.mp4`,
  })
  const response = await handleSmartSpaceVideoAction(userId, { action: 'video_status', client_request_id: clientRequestId, item_index: 0 }, state.deps)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.video.state, 'completed')
  assert.match(body.video.signed_url, /^https:\/\//)
  assert.equal(state.starts(), 0)
  assert.equal(state.uploads(), 0)
})

test('resultado parcial preserva Espaço livre e não tenta produzir vídeo completo', async () => {
  const state = dependencies({
    stage_state: 'partial',
    result: { ...completedResult('remove_and_redecorate', [['free_space', 'out/free.jpg']]), delivery_status: 'partial' },
  })
  const response = await handleSmartSpaceVideoAction(userId, { action: 'start_video', client_request_id: clientRequestId, item_index: 0 }, state.deps)
  const body = await response.json()
  assert.equal(body.skipped, true)
  assert.equal(state.starts(), 0)
})
