import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCampaignPackage } from '../src/components/campaign/buildCampaignPackage.js'
import { buildSmartTourCampaignPackage } from '../src/components/campaign/buildSmartTourCampaignPackage.js'
import {
  buildSmartTourPublicationIntent,
  buildSmartTourPublicationRequest,
  clearPendingSmartTourPublication,
  preservePendingSmartTourPublication,
  publishSmartTourPublication,
  readPendingSmartTourPublication,
  recoverSmartTourPublication,
  restorePendingSmartTourPublication,
} from '../src/lib/smart-tour-social-publish.js'

const jobId = '6b66b517-8fea-4b62-a180-89f64c418cba'
const basePackage = buildSmartTourCampaignPackage({
  property: { purpose: 'sale', type: 'Apartamento', district: 'Centro', city: 'São Paulo', state: 'SP', bedrooms: 2, suites: 1, parkingSpaces: 1, area: 70, highlights: ['Varanda'], description: 'Ambientes bem distribuídos.', price: 'R$ 750.000' },
  language: 'pt-BR', cta: 'Saiba mais', phone: '', unifiedSocialPublishing: true,
})
const campaign = buildCampaignPackage({ ...basePackage, sourceType: 'video_imobiliario', sourceId: jobId, mediaAssetId: jobId, previewUrl: 'https://private.invalid/video.mp4' })
const fields = campaign.modules.find(module => module.id === 'social')?.fields || []
const memoryStorage = () => { const values = new Map(); return { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value), removeItem:key => values.delete(key) } }

test('Vídeo Imobiliário entrega exatamente três textos sociais estáveis', () => {
  assert.equal(fields.length, 3)
  assert.deepEqual(fields.map(field => field.id), ['smart-tour-caption-option-1', 'smart-tour-caption-option-2', 'smart-tour-caption-option-3'])
  assert.ok(fields.every(field => field.text && field.label.startsWith('Texto ')))
})

test('Short Videos conserva o contrato legado sem publicação social unificada', () => {
  const shortPackage = buildSmartTourCampaignPackage({
    property: { purpose: 'sale', type: 'Apartamento', district: 'Centro', city: 'São Paulo', state: 'SP', bedrooms: 2, highlights: ['Varanda'] },
    language: 'pt-BR', cta: 'Saiba mais', phone: '',
  })
  assert.deepEqual(shortPackage.aiCampaigns.map(option => option.id), ['smart-tour-1', 'smart-tour-2', 'smart-tour-3'])
  assert.equal('unifiedSocialPublishing' in shortPackage, false)
  assert.equal('publicationOptions' in shortPackage, false)
})

for (const index of [0, 1, 2]) {
  test(`Texto ${index + 1} vincula o vídeo e caption_snapshot exatos`, () => {
    const intent = buildSmartTourPublicationIntent({ campaign, field: fields[index], optionIndex: index })
    assert.equal(intent.mediaType, 'video')
    assert.equal(intent.mediaAssetId, jobId)
    assert.equal(intent.mediaPreviewUrl, 'https://private.invalid/video.mp4')
    assert.equal(intent.captionSnapshot, fields[index].text)
    assert.equal(intent.optionId, `smart-tour-caption-option-${index + 1}`)
  })
}

test('Instagram, Facebook e ambos geram referências estáveis com a legenda confirmada', () => {
  const intent = buildSmartTourPublicationIntent({ campaign, field: fields[0] })
  for (const destinations of [['instagram'], ['facebook'], ['instagram', 'facebook']]) {
    const body = buildSmartTourPublicationRequest(intent, destinations)
    assert.deepEqual(body.destinations, destinations)
    assert.equal(body.source.type, 'video_imobiliario')
    assert.equal(body.source.id, jobId)
    assert.equal(body.media_asset_id, jobId)
    assert.equal('caption' in body, false)
    assert.equal(body.caption_snapshot, fields[0].text)
    assert.equal('preview_url' in body, false)
    assert.doesNotMatch(JSON.stringify(body), /signed_url|access_token|ciphertext|secret/i)
  }
})

test('legenda original, edição parcial, substituição total e vazio são enviados exatamente', () => {
  const baseIntent = buildSmartTourPublicationIntent({ campaign, field: fields[0] })
  for (const captionSnapshot of [
    fields[0].text,
    `${fields[0].text}\nTexto editado.`,
    'Vídeo novo ✨\nVisite hoje.',
    '',
  ]) {
    const body = buildSmartTourPublicationRequest({ ...baseIntent, captionSnapshot }, ['facebook'])
    assert.equal(body.caption_snapshot, captionSnapshot)
  }
})

test('retorno OAuth preserva a intenção sem URL ou segredo', () => {
  const storage = memoryStorage()
  const intent = buildSmartTourPublicationIntent({ campaign, field: fields[1], optionIndex: 1 })
  assert.equal(preservePendingSmartTourPublication(storage, 'owner-a', intent), true)
  const pending = readPendingSmartTourPublication(storage, 'owner-a')
  assert.equal(pending.captionSnapshot, fields[1].text)
  assert.equal(readPendingSmartTourPublication(storage, 'owner-b'), null)
  assert.doesNotMatch(JSON.stringify(pending), /private\.invalid|access_token|ciphertext|secret/i)
  assert.equal(restorePendingSmartTourPublication({ campaign, pending }).captionSnapshot, fields[1].text)
  assert.equal(clearPendingSmartTourPublication(storage, 'owner-a'), true)
})

test('publish e recovery usam somente social-publish-video autenticado e 0 ST', async () => {
  const calls = []
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'browser-session' } }, error: null }) },
    functions: { invoke: async (name, input) => { calls.push({ name, input }); return { data: { ok:true, status:'partial_success', results:[{destination:'instagram',status:'published'},{destination:'facebook',status:'failed'}], smart_tokens:0 }, error:null } } },
  }
  const intent = buildSmartTourPublicationIntent({ campaign, field: fields[2], optionIndex: 2 })
  await publishSmartTourPublication(client, intent, ['instagram', 'facebook'])
  await recoverSmartTourPublication(client, intent, ['instagram', 'facebook'])
  assert.deepEqual(calls.map(call => call.name), ['social-publish-video', 'social-publish-video'])
  assert.deepEqual(calls.map(call => call.input.body.action), ['publish', 'recovery'])
  assert.ok(calls.every(call => call.input.headers.Authorization === 'Bearer browser-session'))
  assert.ok(calls.every(call => !('caption' in call.input.body) && call.input.body.caption_snapshot === fields[2].text))
  assert.doesNotMatch(JSON.stringify(calls.map(call => call.input.body)), /browser-session|access_token|ciphertext|secret/i)
})

test('sessão ausente, cancelamento e identidade divergente não iniciam backend', async () => {
  let invoked = 0
  const client = { auth:{getSession:async()=>({data:{session:null},error:null})}, functions:{invoke:async()=>{invoked += 1}} }
  await assert.rejects(() => publishSmartTourPublication(client, {}, ['instagram']), /session_required/)
  assert.equal(invoked, 0)
  assert.throws(() => buildSmartTourPublicationIntent({ campaign:{...campaign,mediaAssetId:'different'},field:fields[0] }), /identity_incomplete/)
  const dialog = readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx', import.meta.url), 'utf8')
  assert.match(dialog, /onClick=\{close\}[\s\S]{0,240}>Cancelar<\/button>/)
  assert.match(dialog, /const close = \(\) => \{[\s\S]*?onClose\?\.\(\)/)
  assert.doesNotMatch(dialog, /\bFeed\b|\bReel\b|\bStory\b|container|lease/i)
})

test('integração do produto mantém geração normal e publicação sem IA ou ST', () => {
  const page = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')
  const helper = readFileSync(new URL('../src/lib/smart-tour-social-publish.js', import.meta.url), 'utf8')
  assert.match(page, /!isShortVideoResult \? \{ sourceType:'video_imobiliario', sourceId:result\.jobId, mediaAssetId:result\.jobId \} : \{\}/)
  assert.match(page, /videoPublish=\{!isShortVideoResult/)
  assert.doesNotMatch(page, /smart-tour-result-recovery|materializeSmartTourCompletedResult|discoverLatestSmartTourJob/)
  assert.doesNotMatch(helper, /openai|gemini|generate|smart_tokens.*[1-9]|credit/i)
})
