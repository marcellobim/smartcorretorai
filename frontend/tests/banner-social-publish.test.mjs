import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildBannerPublicationIntent,
  buildBannerPublicationRequest,
  clearPendingBannerPublication,
  getBannerConnectionDestinations,
  publishBannerPublication,
  preservePendingBannerPublication,
  readPendingBannerPublication,
  recoverBannerPublication,
  restorePendingBannerPublication,
  selectBannerMediaForOption,
} from '../src/lib/banner-social-publish.js'

const sourceId = '6b66b517-8fea-4b62-a180-89f64c418cba'
const captions = [
  'Texto comercial exato.',
  'Texto emocional exato.\n\nCom segunda linha.',
  'Texto direto exato.',
]
const campaign = {
  sourceProduct: 'Banner Imobiliário',
  sourceType: 'banner_imobiliario',
  sourceId,
  files: captions.map((_, index) => ({
    id: `idea-${index + 1}-instagram-feed`,
    assetId: `idea-${index + 1}-instagram-feed`,
    optionId: `banner-caption-option-${index + 1}`,
    optionNumber: index + 1,
    name: `Arte ${index + 1}`,
    previewUrl: `https://private-preview.invalid/${index + 1}`,
  })),
}

const memoryStorage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

for (const index of [0, 1, 2]) {
  test(`Texto ${index + 1} mantém legenda e mídia correspondentes na confirmação`, () => {
    const intent = buildBannerPublicationIntent({
      campaign,
      field: { id: `banner-caption-option-${index + 1}`, label: `Texto ${index + 1}`, text: captions[index] },
      optionIndex: index,
    })
    assert.equal(intent.optionNumber, index + 1)
    assert.equal(intent.captionSnapshot, captions[index])
    assert.equal(intent.mediaAssetId, `idea-${index + 1}-instagram-feed`)
    assert.equal(selectBannerMediaForOption(campaign.files, intent.optionId)?.name, `Arte ${index + 1}`)
  })
}

test('retorno do OAuth preserva somente referência estável, mídia e caption snapshot', () => {
  const storage = memoryStorage()
  const intent = buildBannerPublicationIntent({ campaign, field: { id: 'banner-caption-option-2', label: 'Texto 2', text: captions[1] }, optionIndex: 1 })
  assert.equal(preservePendingBannerPublication(storage, 'user-a', intent), true)
  assert.deepEqual(readPendingBannerPublication(storage, 'user-a'), {
    sourceType: 'banner_imobiliario', sourceId, mediaAssetId: 'idea-2-instagram-feed', optionId: 'banner-caption-option-2', optionNumber: 2, captionSnapshot: captions[1],
  })
  assert.equal(readPendingBannerPublication(storage, 'user-b'), null)
  assert.doesNotMatch(JSON.stringify(readPendingBannerPublication(storage, 'user-a')), /private-preview|signed|access_token/i)
  const restored = restorePendingBannerPublication({ campaign: { ...campaign, modules: [{ fields: captions.map((caption, index) => ({ id: `banner-caption-option-${index + 1}`, label: `Texto ${index + 1}`, text: caption })) }] }, pending: readPendingBannerPublication(storage, 'user-a') })
  assert.equal(restored.captionSnapshot, captions[1])
  assert.equal(clearPendingBannerPublication(storage, 'user-a'), true)
  assert.equal(readPendingBannerPublication(storage, 'user-a'), null)
})

test('identidade incompleta bloqueia a confirmação', () => {
  assert.throws(() => buildBannerPublicationIntent({ campaign: { ...campaign, sourceId: '' }, field: { id: 'banner-caption-option-1', text: captions[0] } }), /identity_incomplete/)
})

test('usuário conectado recebe destinos públicos e usuário desconectado recebe ação de conexão', () => {
  assert.deepEqual(getBannerConnectionDestinations({ connected: true, status: 'active', username: 'smartcorretorai', pageName: 'SmartCorretorAI', selectionRequired: false }), [
    { id: 'instagram', label: 'Instagram @smartcorretorai' },
    { id: 'facebook', label: 'Facebook SmartCorretorAI' },
  ])
  assert.deepEqual(getBannerConnectionDestinations({ connected: false, status: 'reconnect_required' }), [])
  assert.deepEqual(getBannerConnectionDestinations({ connected: true, status: 'active', username: 'a', pageName: 'b', selectionRequired: true }), [])
})

test('frontend envia referências estáveis, destinos e a legenda confirmada, nunca credencial', () => {
  const intent = buildBannerPublicationIntent({ campaign, field: { id: 'banner-caption-option-1', label: 'Texto 1', text: captions[0] } })
  const body = buildBannerPublicationRequest(intent, ['instagram', 'facebook'])
  assert.deepEqual(body, {
    action: 'publish', source: { type: 'banner_imobiliario', id: sourceId },
    media_asset_id: 'idea-1-instagram-feed', option_id: 'banner-caption-option-1', caption_snapshot: captions[0], destinations: ['instagram', 'facebook'],
  })
  assert.doesNotMatch(JSON.stringify(body), /token|secret|preview|signed/i)
})

test('legenda original, edição parcial, substituição total e vazio são enviados exatamente', () => {
  const baseIntent = buildBannerPublicationIntent({ campaign, field: { id: 'banner-caption-option-1', label: 'Texto 1', text: captions[0] } })
  for (const captionSnapshot of [
    captions[0],
    'Texto comercial editado parcialmente.',
    'Imóvel à venda 🏡\nAgende sua visita.',
    '',
  ]) {
    const body = buildBannerPublicationRequest({ ...baseIntent, captionSnapshot }, ['instagram'])
    assert.equal(body.caption_snapshot, captionSnapshot)
  }
})

test('publicação e recovery usam apenas social-publish-banner com sessão autenticada e ST zero', async () => {
  const calls = []
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'session-only' } }, error: null }) },
    functions: { invoke: async (name, input) => {
      calls.push({ name, input })
      return { data: { ok: true, status: 'published', results: [{ destination: 'instagram', job_id: 'job-a', status: 'published' }], smart_tokens: 0 }, error: null }
    } },
  }
  const intent = buildBannerPublicationIntent({ campaign, field: { id: 'banner-caption-option-1', label: 'Texto 1', text: captions[0] } })
  await publishBannerPublication(client, intent, ['instagram'])
  await recoverBannerPublication(client, intent, ['instagram'])
  assert.deepEqual(calls.map(call => call.name), ['social-publish-banner', 'social-publish-banner'])
  assert.deepEqual(calls.map(call => call.input.body.action), ['publish', 'recovery'])
  assert.equal(calls[0].input.headers.Authorization, 'Bearer session-only')
  assert.ok(calls.every(call => call.input.body.caption_snapshot === captions[0]))
  assert.doesNotMatch(JSON.stringify(calls.map(call => call.input.body)), /session-only|token|secret/i)
})

test('usuário sem sessão não inicia publicação', async () => {
  let invoked = 0
  const client = { auth: { getSession: async () => ({ data: { session: null }, error: null }) }, functions: { invoke: async () => { invoked += 1 } } }
  await assert.rejects(() => publishBannerPublication(client, { sourceType: 'banner_imobiliario' }, ['instagram']), /session_required/)
  assert.equal(invoked, 0)
})

test('Cancelar usa o fechamento centralizado sem acionar o backend', () => {
  const dialogSource = readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx', import.meta.url), 'utf8')
  assert.match(dialogSource, /onClick=\{close\}[\s\S]{0,240}>Cancelar<\/button>/)
  assert.match(dialogSource, /shouldClearSocialPublishRecoveryOnClose\(results\)[\s\S]{0,120}onTerminalClose\?\.\(\)[\s\S]{0,120}onClose\?\.\(\)/)
  assert.equal((dialogSource.match(/onPublish\?\./g) || []).length, 1)
})

test('fluxo é opt-in somente no Banner, sem acesso direto ao banco ou chamada Meta pelo frontend', () => {
  const packageSource = readFileSync(new URL('../src/components/campaign/CampaignPackage.jsx', import.meta.url), 'utf8')
  const dialogSource = readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx', import.meta.url), 'utf8')
  const helperSource = readFileSync(new URL('../src/lib/banner-social-publish.js', import.meta.url), 'utf8')
  const source = `${packageSource}\n${dialogSource}\n${helperSource}`
  assert.match(packageSource, /campaign\.sourceProduct === 'Banner Imobiliário'/)
  assert.match(helperSource, /Instagram @\$\{text\(connection\.username\)\}/)
  assert.match(helperSource, /Facebook \$\{text\(connection\.pageName\)\}/)
  assert.match(dialogSource, /Publicar agora/)
  assert.match(dialogSource, /Conectar Instagram e Facebook/)
  assert.doesNotMatch(source, /media_publish|social_publish_jobs|create_social_publish_job/i)
  assert.doesNotMatch(dialogSource, /localStorage|ciphertext|auth_tag|claim_token|client_secret/i)
})
