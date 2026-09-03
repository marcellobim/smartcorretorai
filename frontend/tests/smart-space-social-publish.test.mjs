import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartSpacePublicationRequest,
  buildSmartSpaceImagePublicationIntent,
  buildSmartSpaceCampaignPublicationIntent,
  buildSmartSpaceVideoPublicationIntent,
  preservePendingSmartSpacePublication,
  readPendingSmartSpacePublication,
  restorePendingSmartSpaceCampaignPublication,
  restorePendingSmartSpacePublication,
} from '../src/lib/smart-space-social-publish.js'

const sourceId = '22222222-2222-4222-8222-222222222222'
const previewUrl = 'https://storage.test/transformacao.mp4'

test('identifica o MP4 de transformação sem legenda automática', () => {
  const intent = buildSmartSpaceVideoPublicationIntent({ clientRequestId: sourceId, itemIndex: 2, previewUrl })
  assert.equal(intent.sourceType, 'smart_space_transform')
  assert.equal(intent.mediaAssetId, '2:transformation_video')
  assert.equal(intent.mediaType, 'video')
  assert.deepEqual(buildSmartSpacePublicationRequest(intent, ['instagram', 'facebook']), {
    action: 'publish',
    source: { type: 'smart_space_transform', id: sourceId },
    media_asset_id: '2:transformation_video',
    option_id: 'smart-space-no-caption',
    caption_snapshot: '',
    destinations: ['instagram', 'facebook'],
  })
})

test('mantém cada imagem gerada publicável pela identidade de etapa existente', () => {
  const intent = buildSmartSpaceImagePublicationIntent({ clientRequestId: sourceId, itemIndex: 1, stageKind: 'new_decoration', stageLabel: 'Nova decoração', previewUrl: 'https://storage.test/nova-decoracao.jpg' })
  assert.equal(intent.sourceType, 'smart_space_image')
  assert.equal(intent.mediaAssetId, '1:new_decoration')
  assert.equal(intent.mediaType, 'image')
  assert.deepEqual(buildSmartSpacePublicationRequest(intent, ['facebook']), {
    action: 'publish', source: { type: 'smart_space_image', id: sourceId }, media_asset_id: '1:new_decoration', option_id: 'smart-space-no-caption', caption_snapshot: '', destinations: ['facebook'],
  })
})

test('Smart Space aceita legenda vazia ou personalizada sem alterar a identidade', () => {
  const empty = buildSmartSpaceVideoPublicationIntent({ clientRequestId: sourceId, itemIndex: 0, previewUrl })
  assert.equal(empty.captionSnapshot, '')
  assert.equal(empty.captionPlaceholder, 'Conte um pouco sobre esta transformação ou sobre o imóvel…')

  const custom = { ...empty, captionSnapshot: 'Sala renovada ✨\nAgende sua visita em São Paulo.' }
  const request = buildSmartSpacePublicationRequest(custom, ['instagram', 'facebook'])
  assert.equal(request.caption_snapshot, custom.captionSnapshot)
  assert.deepEqual(request.destinations, ['instagram', 'facebook'])
})

test('Vida no Imóvel e Apresentação pelo Corretor carregam a sugestão existente como snapshot editável', () => {
  for (const sourceType of ['smart_space_life', 'smart_space_broker']) {
    const suggestion = `Sugestão ${sourceType} 🏡\nSegunda linha com acentuação.`
    const intent = buildSmartSpaceCampaignPublicationIntent({
      campaign: { sourceType, sourceId, mediaAssetId: sourceId, previewUrl },
      field: { label: 'Opção 1', text: suggestion },
    })
    assert.equal(intent.captionSnapshot, suggestion)
    assert.equal(buildSmartSpacePublicationRequest(intent, ['facebook']).caption_snapshot, suggestion)
  }
})

test('recovery persiste somente identidade owner-scoped, nunca URL assinada', () => {
  const values = new Map()
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null, removeItem: key => values.delete(key) }
  const intent = buildSmartSpaceVideoPublicationIntent({ clientRequestId: sourceId, itemIndex: 0, previewUrl })
  assert.equal(preservePendingSmartSpacePublication(storage, 'owner-1', intent), true)
  const pending = readPendingSmartSpacePublication(storage, 'owner-1')
  assert.deepEqual(pending, { sourceType: 'smart_space_transform', sourceId, mediaAssetId: '0:transformation_video', captionSnapshot: '' })
  assert.doesNotMatch(JSON.stringify(pending), /https?:|signed|token/i)
  assert.equal(restorePendingSmartSpacePublication({ result: { clientRequestId: sourceId, originalIndex: 0, video: { signedUrl: previewUrl } }, pending })?.mediaPreviewUrl, previewUrl)
})

test('recovery/F5 preserva exatamente a legenda confirmada, inclusive vazia', () => {
  for (const frozenCaption of ['', 'Imóvel único 😍\nVisitas amanhã.']) {
    const values = new Map()
    const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null, removeItem: key => values.delete(key) }
    const intent = { ...buildSmartSpaceVideoPublicationIntent({ clientRequestId: sourceId, itemIndex: 0, previewUrl }), captionSnapshot: frozenCaption }
    assert.equal(preservePendingSmartSpacePublication(storage, 'owner-1', intent), true)
    const pending = readPendingSmartSpacePublication(storage, 'owner-1')
    const restored = restorePendingSmartSpacePublication({ result: { clientRequestId: sourceId, originalIndex: 0, video: { signedUrl: previewUrl } }, pending })
    assert.equal(restored?.captionSnapshot, frozenCaption)
  }
})

test('recovery/F5 restaura a legenda congelada também em Vida no Imóvel e Apresentação pelo Corretor', () => {
  for (const sourceType of ['smart_space_life', 'smart_space_broker']) {
    const campaign = {
      sourceType,
      sourceId,
      mediaAssetId: sourceId,
      previewUrl,
      modules: [{ id: 'social', fields: [{ id: 'opcao-1', label: 'Texto 1', text: 'Sugestão original' }] }],
    }
    const pending = { sourceType, sourceId, mediaAssetId: sourceId, captionSnapshot: 'Texto confirmado ✅\nPersistido.' }
    assert.equal(restorePendingSmartSpaceCampaignPublication({ campaign, pending })?.captionSnapshot, pending.captionSnapshot)
  }
})
