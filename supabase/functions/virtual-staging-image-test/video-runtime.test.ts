import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartSpaceRenderScript,
  buildSmartSpaceConsolidatedVideoPlan,
  buildSmartSpaceVideoPlan,
  estimateSmartSpaceCreatomateCredits,
  SMART_SPACE_VIDEO_HEIGHT,
  SMART_SPACE_VIDEO_WIDTH,
} from './video-contract.ts'
import { handleSmartSpaceVideoAction, type SmartSpaceVideoDependencies } from './video-runtime.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const clientRequestId = '33333333-3333-4333-8333-333333333333'
const itemId = '22222222-2222-4222-8222-222222222222'

function completedResult(action: string, stages: ReadonlyArray<readonly [string, string]>) {
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
    assert.equal(plan.version, 6)
    assert.deepEqual(plan.scenes.map(scene => scene.label), labels)
    assert.equal(plan.durationSeconds, labels.length === 3 ? 8 : 6)
    const script = buildSmartSpaceRenderScript(plan, plan.scenes.map((_, index) => `https://storage.test/${index}.jpg`))
    assert.equal(script.width, SMART_SPACE_VIDEO_WIDTH)
    assert.equal(script.height, SMART_SPACE_VIDEO_HEIGHT)
    assert.equal(script.output_format, 'mp4')
    const images = script.elements.filter(element => element.type === 'image')
    const textElements = script.elements.filter(element => element.type === 'text')
    const foreground = images.filter(element => element.track === 2)
    const backdrop = images.filter(element => element.track === 1)
    assert.equal(foreground.length, plan.scenes.length)
    assert.equal(backdrop.length, plan.scenes.length)
    assert.equal(foreground.every(element => element.fit === 'contain' && element.x === '50%' && element.y === '50%' && element.width === '100%' && element.height === '100%'), true)
    assert.equal(backdrop.every(element => element.fit === 'cover' && element.width === '110%' && element.height === '110%' && element.blur === '5 vmin' && element.opacity === '72%'), true)
    assert.equal(backdrop.every((element, index) => element.source === foreground[index].source), true)
    assert.equal(textElements.filter(element => String(element.name).startsWith('Transformation-Step-')).length, plan.scenes.length)
    assert.deepEqual(foreground.map(element => element.time), plan.scenes.map((_, index) => index * (plan.durationSeconds / plan.scenes.length)))
    assert.equal(JSON.stringify(script).includes('contain'), true)
    assert.equal(JSON.stringify(script).includes('SMART SPACE'), false)
    assert.equal(JSON.stringify(script).includes('SNETIA'), false)
    assert.equal(JSON.stringify(script).includes('audio'), false)
  }
})

test('vídeo individual mantém imagem horizontal inteira, sem legenda promocional, e só inclui encerramento autorizado', () => {
  const plan = buildSmartSpaceVideoPlan(completedResult('remove_furniture', [['free_space', 'out/free.jpg']]), {
    locale: 'en-US', caption: 'Bright room, ready for a fresh start.', cta: 'Schedule a visit',
    professionalIdentity: 'Ana Silva · License #123 · FL', phone: '(813) 555-0100',
  })!
  const script = buildSmartSpaceRenderScript(plan, plan.scenes.map((_, index) => `https://storage.test/horizontal-${index}.jpg`))
  const imageLayers = script.elements.filter(element => element.type === 'image')
  const text = script.elements.filter(element => element.type === 'text')
  assert.equal(imageLayers.filter(element => element.track === 2 && element.fit === 'contain').length, plan.scenes.length)
  assert.equal(imageLayers.filter(element => element.track === 1 && element.fit === 'cover' && element.blur === '5 vmin').length, plan.scenes.length)
  assert.deepEqual(text.map(element => element.name), ['Transformation-Step-1', 'Transformation-Step-2', 'Campaign-CTA', 'Professional-Identity', 'Professional-Phone'])
  assert.ok(text.every(element => element.track === 3 && element.z_index === 10))
  assert.doesNotMatch(JSON.stringify(script), /Bright room, ready for a fresh start\./)
  assert.match(JSON.stringify(script), /Schedule a visit/)
  assert.match(JSON.stringify(script), /License #123/)
  assert.match(JSON.stringify(script), /813/)
  assert.match(JSON.stringify(script), /Before/)
  assert.match(JSON.stringify(script), /Clear space/)

  const noMarketingPlan = buildSmartSpaceVideoPlan(completedResult('furnish', [['furnish', 'out/furnished.jpg']]))!
  const noMarketing = buildSmartSpaceRenderScript(noMarketingPlan, noMarketingPlan.scenes.map((_, index) => `https://storage.test/no-marketing-${index}.jpg`))
  const noMarketingNames = noMarketing.elements.filter(element => element.type === 'text').map(element => element.name)
  assert.deepEqual(noMarketingNames, ['Transformation-Step-1', 'Transformation-Step-2'])

  const identityWithoutPhone = buildSmartSpaceVideoPlan(completedResult('furnish', [['furnish', 'out/furnished.jpg']]), { professionalIdentity: 'Ana Silva · CRECI-F 123/SP' })!
  const identityWithoutPhoneScript = buildSmartSpaceRenderScript(identityWithoutPhone, identityWithoutPhone.scenes.map((_, index) => `https://storage.test/identity-${index}.jpg`))
  assert.equal(identityWithoutPhoneScript.elements.some(element => element.name === 'Professional-Identity'), true)
  assert.equal(identityWithoutPhoneScript.elements.some(element => element.name === 'Professional-Phone'), false)

  const brPlan = buildSmartSpaceVideoPlan(completedResult('clear_area', [['clear_area', 'out/clear.jpg']]), { locale: 'pt-BR' })!
  const brScript = buildSmartSpaceRenderScript(brPlan, brPlan.scenes.map((_, index) => `https://storage.test/br-${index}.jpg`))
  assert.match(JSON.stringify(brScript), /Antes/)
  assert.match(JSON.stringify(brScript), /Depois/)
})

test('vídeo consolidado preserva a ordem Antes/Depois do lote e aplica somente os overlays escolhidos', () => {
  const items = [0, 1, 2].map(itemIndex => ({
    item_index: itemIndex,
    status: 'completed',
    stage_state: 'completed',
    result: completedResult('remove_furniture', [['free_space', `out/${itemIndex}-free.jpg`]]),
  }))
  const plan = buildSmartSpaceConsolidatedVideoPlan(items, {
    locale: 'pt-BR', caption: 'Veja esta transformação.', cta: 'Agende uma visita', professionalIdentity: 'Ana Silva · CRECI 123', phone: '(11) 99999-9999',
  })!
  assert.equal(plan.scenes.length, 6)
  assert.deepEqual(plan.scenes.map(scene => scene.label), ['Before', 'After', 'Before', 'After', 'Before', 'After'])
  assert.equal(plan.durationSeconds, 15)
  const script = buildSmartSpaceRenderScript(plan, plan.scenes.map((_, index) => `https://storage.test/${index}.jpg`))
  const text = script.elements.filter(element => element.type === 'text')
  assert.deepEqual(text.map(element => element.name), [
    'Transformation-Step-1', 'Transformation-Step-2', 'Transformation-Step-3', 'Transformation-Step-4', 'Transformation-Step-5', 'Transformation-Step-6',
    'Campaign-CTA', 'Professional-Identity', 'Professional-Phone',
  ])
  const audio = script.elements.filter(element => element.type === 'audio')
  assert.equal(audio.length, 1)
  assert.match(String(audio[0].source), /Veja como o Virtual Staging transforma este ambiente/i)
})

test('vídeo consolidado adiciona somente a narração curta persistida, sem alterar vídeos individuais ou adicionar trilha', () => {
  const items = [0, 1].map(item_index => ({
    item_index,
    status: 'completed',
    stage_state: 'completed',
    result: completedResult('remove_furniture', [['free_space', `out/${item_index}.jpg`]]),
  }))
  const plan = buildSmartSpaceConsolidatedVideoPlan(items, {
    locale: 'en-US',
    narration: 'See how Virtual Staging transforms this apartment in Tampa and reveals its potential.',
  })!
  const script = buildSmartSpaceRenderScript(plan, plan.scenes.map((_, index) => `https://storage.test/narration-${index}.jpg`))
  const audio = script.elements.filter(element => element.type === 'audio')
  assert.equal(audio.length, 1)
  assert.deepEqual(audio[0], {
    name: 'Smart-Space-Consolidated-Narration',
    type: 'audio',
    track: 4,
    time: 0,
    duration: plan.durationSeconds,
    source: 'See how Virtual Staging transforms this apartment in Tampa and reveals its potential.',
    provider: 'openai model=tts-1 voice=nova',
    volume: '100%',
    audio_fade_in: 0.15,
    audio_fade_out: 0.2,
  })
  assert.equal(script.elements.some(element => String(element.name).includes('Music')), false)

  const individual = buildSmartSpaceVideoPlan(completedResult('remove_furniture', [['free_space', 'out/free.jpg']]), { narration: 'Do not add this to an individual video.' })!
  const individualScript = buildSmartSpaceRenderScript(individual, individual.scenes.map((_, index) => `https://storage.test/individual-${index}.jpg`))
  assert.equal(individualScript.elements.some(element => element.type === 'audio'), false)
})

test('vídeo consolidado usa somente pares concluídos de lotes de 1, 2, 3 e 4 imagens', () => {
  for (const count of [1, 2, 3, 4]) {
    const items = Array.from({ length: count }, (_, itemIndex) => ({
      item_index: itemIndex,
      status: 'completed',
      stage_state: 'completed',
      result: completedResult('remove_furniture', [['free_space', `out/${count}-${itemIndex}.jpg`]]),
    }))
    const plan = buildSmartSpaceConsolidatedVideoPlan(items)
    assert.ok(plan)
    assert.equal(plan.scenes.length, count * 2)
    assert.deepEqual(plan.scenes.filter((_, index) => index % 2 === 0).map(scene => scene.storagePath), items.map(item => item.result.input_path))
  }

  const partialBatch = [
    { item_index: 0, status: 'completed', stage_state: 'completed', result: completedResult('remove_furniture', [['free_space', 'out/0.jpg']]) },
    { item_index: 1, status: 'failed', stage_state: 'failed', result: {} },
    { item_index: 2, status: 'completed', stage_state: 'completed', result: completedResult('remove_furniture', [['free_space', 'out/2.jpg']]) },
    { item_index: 3, status: 'processing', stage_state: 'partial', result: { delivery_status: 'partial' } },
  ]
  const partialPlan = buildSmartSpaceConsolidatedVideoPlan(partialBatch)
  assert.ok(partialPlan)
  assert.equal(partialPlan.scenes.length, 4)
  assert.deepEqual(partialPlan.scenes.map(scene => scene.storagePath), [
    `${userId}/virtual-staging-images/inputs/${clientRequestId}/01.jpg`, 'out/0.jpg',
    `${userId}/virtual-staging-images/inputs/${clientRequestId}/01.jpg`, 'out/2.jpg',
  ])
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

test('consolidado é iniciado, persistido e recuperado sem repetir a transformação de imagens', async () => {
  const items = [0, 1, 2].map(item_index => ({
    item_index,
    status: 'completed',
    stage_state: 'completed',
    result: completedResult('remove_furniture', [['free_space', `out/${item_index}.jpg`]]),
  }))
  let video: Record<string, any> = { state: 'not_requested' }
  let starts = 0
  let uploads = 0
  const deps: SmartSpaceVideoDependencies = {
    ...dependencies().deps,
    recoverConsolidatedVideo: async () => ({ request: { status: 'completed', delivery_metadata: {} }, items, video }),
    claimConsolidatedVideo: async ({ idempotencyKey }) => {
      if (video.state !== 'not_requested') return { video, claimed: false, claimToken: null }
      video = { state: 'submitting', idempotency_key: idempotencyKey, claim_token: '44444444-4444-4444-8444-444444444444' }
      return { video, claimed: true, claimToken: video.claim_token }
    },
    registerConsolidatedVideo: async ({ renderId }) => { video = { ...video, state: 'rendering', render_id: renderId } },
    completeConsolidatedVideo: async ({ outputPath }) => { video = { ...video, state: 'completed', output_path: outputPath, claim_token: null } },
    failConsolidatedVideo: async () => undefined,
    startRender: async () => { starts += 1; return { id: 'consolidated-render-1', status: 'planned' } },
    getRender: async () => ({ id: 'consolidated-render-1', status: 'succeeded', url: 'https://renderer.test/consolidated.mp4' }),
    uploadVideo: async () => { uploads += 1 },
    signVideo: async () => 'https://storage.test/consolidated.mp4',
  }
  const start = await handleSmartSpaceVideoAction(userId, { action: 'start_consolidated_video', client_request_id: clientRequestId }, deps)
  assert.equal(start.status, 202)
  assert.equal(starts, 1)
  const recovery = await handleSmartSpaceVideoAction(userId, { action: 'consolidated_video_status', client_request_id: clientRequestId }, deps)
  const body = await recovery.json()
  assert.equal(recovery.status, 200)
  assert.equal(body.video.state, 'completed')
  assert.match(body.video.signed_url, /^https:\/\//)
  assert.equal(uploads, 1)
  assert.equal(starts, 1)
})

test('consolidado aguarda o fechamento do lote e o polling de status inicia o mesmo render uma única vez', async () => {
  const items = [0, 1].map(item_index => ({
    item_index,
    status: 'completed',
    stage_state: 'completed',
    result: completedResult('remove_furniture', [['free_space', `out/${item_index}.jpg`]]),
  }))
  let requestStatus = 'processing'
  let video: Record<string, any> = { state: 'not_requested' }
  let starts = 0
  const deps: SmartSpaceVideoDependencies = {
    ...dependencies().deps,
    recoverConsolidatedVideo: async () => ({ request: { status: requestStatus, delivery_metadata: {} }, items, video }),
    claimConsolidatedVideo: async () => {
      video = { state: 'submitting', claim_token: '44444444-4444-4444-8444-444444444444' }
      return { video, claimed: true, claimToken: video.claim_token }
    },
    registerConsolidatedVideo: async ({ renderId }) => { video = { ...video, state: 'rendering', render_id: renderId } },
    completeConsolidatedVideo: async () => undefined,
    failConsolidatedVideo: async () => undefined,
    startRender: async () => { starts += 1; return { id: 'consolidated-render-1', status: 'planned' } },
  }
  const early = await handleSmartSpaceVideoAction(userId, { action: 'start_consolidated_video', client_request_id: clientRequestId }, deps)
  assert.equal(early.status, 202)
  assert.equal((await early.json()).pending, true)
  assert.equal(starts, 0)

  requestStatus = 'completed'
  const poll = await handleSmartSpaceVideoAction(userId, { action: 'consolidated_video_status', client_request_id: clientRequestId }, deps)
  assert.equal(poll.status, 202)
  assert.equal(starts, 1)
})
