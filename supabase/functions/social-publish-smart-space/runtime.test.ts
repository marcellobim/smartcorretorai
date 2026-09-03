import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handleSmartSpacePublish, type SmartSpaceDestination, type SmartSpaceIntent } from './runtime.ts'

const owner = '11111111-1111-4111-8111-111111111111'
const source = '22222222-2222-4222-8222-222222222222'
const item = '33333333-3333-4333-8333-333333333333'
const request = (sourceType = 'smart_space_life', action = 'publish', destinations: SmartSpaceDestination[] = ['instagram', 'facebook'], captionSnapshot = '') => new Request('https://local.invalid', {
  method: 'POST', headers: { Authorization: 'Bearer owner-session', 'Content-Type': 'application/json' },
  body: JSON.stringify({ action, source: { type: sourceType, id: source }, media_asset_id: sourceType === 'smart_space_image' ? '0:furnish' : sourceType === 'smart_space_transform' ? '0:transformation_video' : source, option_id: 'smart-space-no-caption', caption_snapshot: captionSnapshot, destinations }),
})

function context() {
  const calls = { created: [] as Array<{ intent: SmartSpaceIntent; destination: string }>, workers: [] as string[], resolved: 0 }
  const dependencies = {
    authenticate: async (token: string) => token === 'owner-session' ? { id: owner } : null,
    resolveIntent: async (_owner: string, input: any) => {
      calls.resolved += 1
      const isImage = input.sourceType === 'smart_space_image'
      const objectPath = isImage ? `${owner}/virtual-staging-images/results/${item}/generated-01.jpg`
        : input.sourceType === 'smart_space_transform' ? `${owner}/virtual-staging-images/outputs/${source}/01-transformation.mp4`
        : `${owner}/${source}/virtual-staging.mp4`
      return { ...input, connectionId: '44444444-4444-4444-8444-444444444444', bucket: 'studio-videos', objectPath, contentType: isImage ? 'image/jpeg' : 'video/mp4', contentLength: 1234 } as SmartSpaceIntent
    },
    deriveIdempotencyKey: async (_owner: string, _intent: any, destination: string) => destination === 'instagram' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666',
    createOrReuseJob: async ({ intent, destination }: any) => { calls.created.push({ intent, destination }); return { id: destination === 'instagram' ? '77777777-7777-4777-8777-777777777777' : '88888888-8888-4888-8888-888888888888', status: 'queued', reused: false } },
    findJob: async (_owner: string, _key: string, destination: SmartSpaceDestination) => ({ jobId: destination === 'instagram' ? '77777777-7777-4777-8777-777777777777' : '88888888-8888-4888-8888-888888888888', destination, status: 'processing', externalPostId: null, externalPostLink: null, publicErrorCode: null, captionSnapshot: '' }),
    claimJob: async (jobId: string) => ({ jobId, claimToken: '99999999-9999-4999-8999-999999999999' }),
    createLease: async () => true,
    hashCapability: async () => 'hash', randomCapability: () => 'opaque',
    invokeWorker: async ({ destination, intent }: any) => { calls.workers.push(`${destination}:${intent.contentType}`); return { ok: true } },
  }
  return { calls, dependencies }
}

Deno.test('os quatro tipos usam o mesmo contrato e aceitam legenda vazia', async () => {
  for (const sourceType of ['smart_space_image', 'smart_space_transform', 'smart_space_life', 'smart_space_broker']) {
    const state = context()
    const response = await handleSmartSpacePublish(request(sourceType), state.dependencies)
    assertEquals(response.status, 200)
    assertEquals(state.calls.created.length, 2)
    assert(state.calls.created.every(call => call.intent.optionId === 'smart-space-no-caption'))
    assert(state.calls.created.every(call => call.intent.captionSnapshot === ''))
    assertEquals(state.calls.workers.sort(), sourceType === 'smart_space_image'
      ? ['facebook:image/jpeg', 'instagram:image/jpeg'] : ['facebook:video/mp4', 'instagram:video/mp4'])
  }
})

Deno.test('recovery é read-only e não resolve mídia nem cria job', async () => {
  const state = context()
  const response = await handleSmartSpacePublish(request('smart_space_life', 'recovery'), state.dependencies)
  assertEquals(response.status, 200)
  assertEquals(state.calls.resolved, 0)
  assertEquals(state.calls.created.length, 0)
  assertEquals(state.calls.workers.length, 0)
})

Deno.test('preserva acentos, emojis e quebras e envia o mesmo snapshot para Instagram e Facebook', async () => {
  const state = context()
  const caption = 'Imóvel renovado ✨🏡\nAgende sua visita em São Paulo.'
  const response = await handleSmartSpacePublish(request('smart_space_life', 'publish', ['instagram', 'facebook'], caption), state.dependencies)
  assertEquals(response.status, 200)
  assertEquals(state.calls.created.map(call => call.destination).sort(), ['facebook', 'instagram'])
  assert(state.calls.created.every(call => call.intent.captionSnapshot === caption))
  assertEquals((await response.json()).smart_tokens, 0)
})

Deno.test('rejeita identidade de mídia incompatível', async () => {
  const invalid = new Request('https://local.invalid', { method: 'POST', headers: { Authorization: 'Bearer owner-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish', source: { type: 'smart_space_life', id: source }, media_asset_id: item, option_id: 'smart-space-no-caption', caption_snapshot: 'legenda válida', destinations: ['instagram'] }) })
  assertEquals((await handleSmartSpacePublish(invalid, context().dependencies)).status, 400)
})

Deno.test('recovery devolve o snapshot congelado sem recriar job', async () => {
  const state = context()
  const frozen = 'Legenda congelada 🔒\nSem mutação no F5.'
  const dependencies = {
    ...state.dependencies,
    findJob: async (_owner: string, _key: string, destination: SmartSpaceDestination) => ({ jobId: '77777777-7777-4777-8777-777777777777', destination, status: 'processing', externalPostId: null, externalPostLink: null, publicErrorCode: null, captionSnapshot: frozen }),
  }
  const response = await handleSmartSpacePublish(request('smart_space_broker', 'recovery', ['instagram'], 'texto local obsoleto'), dependencies)
  assertEquals(response.status, 200)
  const body = await response.json()
  assertEquals(body.results[0].caption_snapshot, frozen)
  assertEquals(state.calls.created.length, 0)
})

Deno.test('execução repetida reutiliza o mesmo job e não reinvoca worker em estado ativo', async () => {
  const state = context()
  const dependencies = { ...state.dependencies, createOrReuseJob: async () => ({ id: '77777777-7777-4777-8777-777777777777', status: 'processing', reused: true }) }
  const response = await handleSmartSpacePublish(request('smart_space_broker', 'publish', ['instagram']), dependencies)
  assertEquals(response.status, 200)
  assertEquals(state.calls.workers.length, 0)
})

Deno.test('expõe somente código público da etapa que rejeitou a identidade', async () => {
  const state = context()
  const dependencies = {
    ...state.dependencies,
    resolveIntent: async () => { throw new Error('smart_space_media_storage_invalid') },
  }
  const response = await handleSmartSpacePublish(request('smart_space_life', 'publish', ['instagram']), dependencies)
  assertEquals(response.status, 409)
  assertEquals(await response.json(), { ok: false, code: 'smart_space_media_storage_invalid' })
})
