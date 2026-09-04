import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSocialPublishNotice,
  getSocialPublishResultLabel,
  isSocialPublishSubmissionLocked,
  shouldClearSocialPublishRecoveryOnClose,
  shouldPollSocialPublishRecovery,
} from '../src/components/campaign/socialPublishUiState.js'

const result = (destination, status, jobId = `${destination}-job`) => ({ destination, status, job_id: jobId })

test('ambos publicando bloqueiam nova submissão', () => {
  const results = [result('instagram', 'processing'), result('facebook', 'publishing')]
  assert.equal(isSocialPublishSubmissionLocked({ results }), true)
  assert.equal(getSocialPublishResultLabel('processing'), 'Publicando...')
  assert.equal(getSocialPublishResultLabel('publishing'), 'Publicando...')
  assert.equal(getSocialPublishNotice(results), 'Estamos finalizando sua publicação. Você pode sair desta tela.')
  assert.equal(shouldPollSocialPublishRecovery(results), true)
})

for (const first of ['facebook', 'instagram']) {
  test(`${first} conclui primeiro e o outro continua publicando`, () => {
    const other = first === 'facebook' ? 'instagram' : 'facebook'
    const results = [result(first, 'published'), result(other, 'processing')]
    assert.equal(getSocialPublishNotice(results), 'Uma publicação já foi concluída. Estamos finalizando a outra. Você pode sair desta tela.')
    assert.equal(getSocialPublishResultLabel(results[0].status), 'Publicado')
    assert.equal(getSocialPublishResultLabel(results[1].status), 'Publicando...')
    assert.equal(isSocialPublishSubmissionLocked({ results }), true)
  })
}

test('ambos concluídos permanecem bloqueados e mostram conclusão', () => {
  const results = [result('instagram', 'published'), result('facebook', 'published')]
  assert.equal(getSocialPublishNotice(results), 'Publicação concluída.')
  assert.equal(isSocialPublishSubmissionLocked({ results }), true)
  assert.equal(shouldPollSocialPublishRecovery(results), false)
  assert.equal(shouldClearSocialPublishRecoveryOnClose(results), true)
})

test('completed também é terminal, mas recovery ativo nunca é limpo ao fechar', () => {
  assert.equal(getSocialPublishResultLabel('completed'), 'Publicado')
  assert.equal(shouldClearSocialPublishRecoveryOnClose([result('instagram', 'completed')]), true)
  for (const status of ['queued', 'processing', 'publishing', 'reconciliation_required']) {
    assert.equal(shouldClearSocialPublishRecoveryOnClose([result('instagram', status)]), false)
  }
  assert.equal(shouldClearSocialPublishRecoveryOnClose([]), false)
})

test('sucesso parcial preserva Publicado e mostra somente a falha do outro destino', () => {
  const results = [result('instagram', 'published'), result('facebook', 'failed')]
  assert.equal(getSocialPublishResultLabel('published'), 'Publicado')
  assert.equal(getSocialPublishResultLabel('failed'), 'Não foi possível publicar')
  assert.equal(getSocialPublishNotice(results), 'Uma publicação foi concluída. Confira abaixo o destino que não foi publicado.')
  assert.equal(isSocialPublishSubmissionLocked({ results }), true)
})

test('reconciliation não parece falha, bloqueia clique e continua recovery read-only', () => {
  const results = [result('instagram', 'reconciliation_required')]
  assert.equal(getSocialPublishResultLabel('reconciliation_required'), 'Confirmando publicação...')
  assert.equal(getSocialPublishNotice(results), 'Estamos finalizando sua publicação. Você pode sair desta tela.')
  assert.equal(isSocialPublishSubmissionLocked({ results }), true)
  assert.equal(shouldPollSocialPublishRecovery(results), true)
})

test('F5 e reabertura bloqueiam pelo job recuperado, sem depender do estado local de envio', () => {
  const recovered = [result('instagram', 'queued'), result('facebook', 'published')]
  assert.equal(isSocialPublishSubmissionLocked({ submitting: false, results: recovered }), true)
  assert.equal(getSocialPublishNotice(recovered), 'Uma publicação já foi concluída. Estamos finalizando a outra. Você pode sair desta tela.')
})

test('duplo clique é bloqueado imediatamente pelo lock de submissão', () => {
  assert.equal(isSocialPublishSubmissionLocked({ submissionStarted: true, results: [] }), true)
  assert.equal(isSocialPublishSubmissionLocked({ submissionStarted: false, results: [] }), false)
  assert.equal(getSocialPublishNotice([], { submissionStarted: true }), 'Publicando...')
})

test('resposta ambígua mantém bloqueio e mensagem de confirmação', () => {
  assert.equal(getSocialPublishNotice([], { submissionStarted: true, confirmationPending: true }), 'Estamos finalizando sua publicação. Você pode sair desta tela.')
})
