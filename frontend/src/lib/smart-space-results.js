export const SMART_SPACE_RECOVERY_VERSION = 1
export const SMART_SPACE_RECOVERY_QUERY_PARAM = 'recover_smart_space_id'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function readSmartSpaceRecoveryClientRequestId(search = '') {
  const value = new URLSearchParams(search).get(SMART_SPACE_RECOVERY_QUERY_PARAM) || ''
  return UUID_PATTERN.test(value) ? value : ''
}

export function resolveSmartSpaceRecoveryInputs(items, persistedInputs = []) {
  if (Array.isArray(persistedInputs) && persistedInputs.length > 0) return persistedInputs
  if (!Array.isArray(items)) return []
  return items
    .map(item => ({
      itemIndex: Number(item?.item_index),
      inputPath: typeof item?.result?.input_path === 'string' ? item.result.input_path : '',
    }))
    .filter(input => Number.isInteger(input.itemIndex) && input.itemIndex >= 0 && input.inputPath)
}

export function getSmartSpaceRecoveryKey(userId) {
  return userId ? `smart-space:active:${userId}` : ''
}

export function smartSpaceStageLabel(kind) {
  return ({
    furnish: 'Ambiente mobiliado',
    empty_or_nearly_empty: 'Ambiente mobiliado',
    mixed: 'Ambiente transformado',
    remove_furniture: 'Espaço livre',
    free_space: 'Espaço livre',
    new_decoration: 'Nova decoração',
    clear_area: 'Área limpa',
  })[kind] || 'Resultado'
}

export function normalizeSmartSpaceResult(result) {
  if (!result || typeof result !== 'object') return null
  const rawStages = Array.isArray(result.stages) && result.stages.length
    ? result.stages
    : result.output_path
      ? [{ kind: result.action || 'result', output_path: result.output_path }]
      : []
  const stages = rawStages
    .filter(stage => stage && typeof stage.output_path === 'string' && stage.output_path)
    .map(stage => ({
      kind: String(stage.kind || 'result'),
      label: String(stage.label || smartSpaceStageLabel(stage.kind)),
      outputPath: stage.output_path,
      width: Number.isFinite(stage.width) ? Number(stage.width) : null,
      height: Number.isFinite(stage.height) ? Number(stage.height) : null,
      mimeType: typeof stage.mime_type === 'string' ? stage.mime_type : '',
      sizeBytes: Number.isFinite(stage.size_bytes) ? Number(stage.size_bytes) : null,
    }))
  if (!stages.length) return null
  return {
    action: typeof result.action === 'string' ? result.action : '',
    deliveryStatus: result.delivery_status === 'partial' ? 'partial' : 'completed',
    partialFailureCode: typeof result.partial_failure_code === 'string' ? result.partial_failure_code : '',
    stages,
  }
}

export function normalizeSmartSpaceVideo(video) {
  const state = typeof video?.state === 'string' ? video.state : 'not_requested'
  return {
    state,
    renderer: typeof video?.renderer === 'string' ? video.renderer : '',
    renderId: typeof video?.render_id === 'string' ? video.render_id : '',
    outputPath: typeof video?.output_path === 'string' ? video.output_path : '',
    signedUrl: typeof video?.signed_url === 'string' && /^https:\/\//i.test(video.signed_url) ? video.signed_url : '',
    failureReason: typeof video?.failure_reason === 'string' ? video.failure_reason : '',
  }
}

export function parseSmartSpaceRecovery(value) {
  try {
    const parsed = JSON.parse(value)
    if (parsed?.version !== SMART_SPACE_RECOVERY_VERSION || typeof parsed.clientRequestId !== 'string' || !Array.isArray(parsed.inputs)) return null
    return parsed
  } catch {
    return null
  }
}

export function buildSmartSpaceRecovery({ clientRequestId, transformationType, decorationStyle, inputs }) {
  return {
    version: SMART_SPACE_RECOVERY_VERSION,
    clientRequestId,
    transformationType,
    decorationStyle: decorationStyle || '',
    inputs: inputs.map(input => ({ itemIndex: input.itemIndex, inputPath: input.inputPath || '' })),
    updatedAt: Date.now(),
  }
}
