export const ACTIVE_SOCIAL_PUBLISH_STATUSES = new Set(['queued', 'processing', 'publishing'])
export const TERMINAL_SOCIAL_PUBLISH_STATUSES = new Set(['published', 'completed', 'failed', 'cancelled'])

export const hasExistingSocialPublishJob = results => (
  Array.isArray(results) && results.some(result => Boolean(result?.job_id))
)

export const hasActiveSocialPublishJob = results => (
  Array.isArray(results) && results.some(result => ACTIVE_SOCIAL_PUBLISH_STATUSES.has(result?.status))
)

export const hasReconciliationSocialPublishJob = results => (
  Array.isArray(results) && results.some(result => result?.status === 'reconciliation_required')
)

export const shouldPollSocialPublishRecovery = results => (
  hasActiveSocialPublishJob(results) || hasReconciliationSocialPublishJob(results)
)

export const shouldClearSocialPublishRecoveryOnClose = results => (
  Array.isArray(results)
  && results.length > 0
  && results.every(result => Boolean(result?.job_id) && TERMINAL_SOCIAL_PUBLISH_STATUSES.has(result?.status))
)

export const isSocialPublishSubmissionLocked = ({ submissionStarted = false, results = [] } = {}) => (
  submissionStarted || hasExistingSocialPublishJob(results)
)

export function getSocialPublishResultLabel(status) {
  if (ACTIVE_SOCIAL_PUBLISH_STATUSES.has(status)) return 'Publicando...'
  if (status === 'published' || status === 'completed') return 'Publicado'
  if (status === 'reconciliation_required') return 'Confirmando publicação...'
  if (status === 'failed') return 'Não foi possível publicar'
  if (status === 'cancelled') return 'Cancelado'
  return 'Aguardando confirmação'
}

export function getSocialPublishNotice(results, { submissionStarted = false, confirmationPending = false } = {}) {
  const items = Array.isArray(results) ? results : []
  if (confirmationPending || hasReconciliationSocialPublishJob(items)) {
    return 'Estamos finalizando sua publicação. Aguarde a confirmação antes de sair desta tela.'
  }

  const published = items.filter(result => ['published', 'completed'].includes(result?.status)).length
  const active = items.filter(result => ACTIVE_SOCIAL_PUBLISH_STATUSES.has(result?.status)).length
  const failed = items.filter(result => result?.status === 'failed').length

  if (items.length > 0 && published === items.length) return 'Publicação concluída.'
  if (published > 0 && active > 0) {
    return 'Uma publicação já foi concluída. Estamos finalizando a outra. Aguarde a confirmação antes de sair desta tela.'
  }
  if (published > 0 && failed > 0) return 'Uma publicação foi concluída. Confira abaixo o destino que não foi publicado.'
  if (active > 0) return 'Estamos finalizando sua publicação. Aguarde a confirmação antes de sair desta tela.'
  if (submissionStarted) return 'Publicando...'
  if (failed > 0) return 'Não foi possível concluir a publicação. Confira abaixo o destino afetado.'
  return ''
}
