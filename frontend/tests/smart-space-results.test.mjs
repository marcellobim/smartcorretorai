import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartSpaceRecovery,
  normalizeSmartSpaceResult,
  normalizeSmartSpaceVideo,
  parseSmartSpaceRecovery,
  readSmartSpaceRecoveryClientRequestId,
  resolveSmartSpaceRecoveryInputs,
  smartSpaceStageLabel,
} from '../src/lib/smart-space-results.js'

test('normaliza entrega Mobiliar e as duas ações de remoção em Antes/Depois', () => {
  for (const [action, kind, label] of [
    ['furnish', 'furnish', 'Ambiente mobiliado'],
    ['remove_furniture', 'remove_furniture', 'Espaço livre'],
    ['clear_area', 'clear_area', 'Área limpa'],
  ]) {
    const result = normalizeSmartSpaceResult({ action, output_path: `result/${action}.jpg`, stages: [{ kind, output_path: `result/${action}.jpg` }] })
    assert.equal(result.stages.length, 1)
    assert.equal(result.stages[0].label, label)
  }
})

test('preserva Espaço livre e Nova decoração como duas entregas oficiais', () => {
  const result = normalizeSmartSpaceResult({
    action: 'remove_and_redecorate',
    delivery_status: 'completed',
    stages: [
      { kind: 'free_space', output_path: 'result/free-space.jpg' },
      { kind: 'new_decoration', output_path: 'result/new-decoration.jpg' },
    ],
  })
  assert.deepEqual(result.stages.map(stage => [stage.label, stage.outputPath]), [
    ['Espaço livre', 'result/free-space.jpg'],
    ['Nova decoração', 'result/new-decoration.jpg'],
  ])
})

test('mantém entrega parcial explícita quando somente a etapa 1 conclui', () => {
  const result = normalizeSmartSpaceResult({
    action: 'remove_and_redecorate',
    delivery_status: 'partial',
    partial_failure_code: 'openai_edit_failed',
    stages: [{ kind: 'free_space', output_path: 'result/free-space.jpg' }],
  })
  assert.equal(result.deliveryStatus, 'partial')
  assert.equal(result.partialFailureCode, 'openai_edit_failed')
  assert.equal(result.stages[0].label, 'Espaço livre')
})

test('recovery persiste ids e paths, sem URL assinada ou conteúdo da imagem', () => {
  const recovery = buildSmartSpaceRecovery({
    clientRequestId: '33333333-3333-4333-8333-333333333333',
    transformationType: 'remove_and_redecorate',
    decorationStyle: 'contemporary',
    inputs: [{ itemIndex: 0, inputPath: 'user/virtual-staging-images/inputs/request/01.jpg' }],
  })
  const serialized = JSON.stringify(recovery)
  assert.deepEqual(parseSmartSpaceRecovery(serialized), recovery)
  assert.doesNotMatch(serialized, /signed|https?:|data:image|token/i)
  assert.equal(parseSmartSpaceRecovery('{invalid'), null)
})

test('recovery explícito aceita somente UUID e reconstrói o input pelo resultado persistido', () => {
  const clientRequestId = '88a00343-4203-401a-8546-ba925af49741'
  assert.equal(readSmartSpaceRecoveryClientRequestId(`?recover_smart_space_id=${clientRequestId}`), clientRequestId)
  assert.equal(readSmartSpaceRecoveryClientRequestId('?recover_smart_space_id=invalid'), '')
  assert.deepEqual(resolveSmartSpaceRecoveryInputs([{
    item_index: 0,
    result: { input_path: 'owner/virtual-staging-images/inputs/request/01.png' },
  }]), [{ itemIndex: 0, inputPath: 'owner/virtual-staging-images/inputs/request/01.png' }])
})

test('recovery local existente continua tendo prioridade sobre reconstrução remota', () => {
  const persisted = [{ itemIndex: 0, inputPath: 'owner/persisted.png' }]
  assert.equal(resolveSmartSpaceRecoveryInputs([{ item_index: 0, result: { input_path: 'owner/remote.png' } }], persisted), persisted)
})

test('labels públicos não usam Virtual Staging', () => {
  assert.equal(smartSpaceStageLabel('free_space'), 'Espaço livre')
  assert.equal(smartSpaceStageLabel('new_decoration'), 'Nova decoração')
  assert.doesNotMatch(['furnish', 'free_space', 'new_decoration', 'clear_area'].map(smartSpaceStageLabel).join(' '), /Virtual Staging/i)
})

test('materializa vídeo concluído e mantém falha de vídeo separada das imagens', () => {
  const completed = normalizeSmartSpaceVideo({
    state: 'completed', render_id: 'render-1', output_path: 'private/result.mp4', signed_url: 'https://storage.test/result.mp4',
  })
  assert.equal(completed.state, 'completed')
  assert.equal(completed.signedUrl, 'https://storage.test/result.mp4')
  const failed = normalizeSmartSpaceVideo({ state: 'failed_retryable', failure_reason: 'render_failed' })
  assert.equal(failed.state, 'failed_retryable')
  assert.equal(failed.signedUrl, '')
})
