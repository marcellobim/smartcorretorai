export const VIRTUAL_STAGING_DISCOVERY_TIMEOUT_MS = 10_000

export const VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE = 'Não foi possível recuperar a criação anterior. Você pode tentar novamente ou criar um novo vídeo.'

const timeoutError = () => Object.assign(new Error('virtual_staging_discovery_timeout'), { code: 'virtual_staging_discovery_timeout' })

export async function runVirtualStagingInitialDiscovery({
  style,
  invokeDiscovery,
  buildRecovery,
  persistRecovery,
  clearRecovery = () => {},
  startPolling,
  timeoutMs = VIRTUAL_STAGING_DISCOVERY_TIMEOUT_MS,
}) {
  const controller = new AbortController()
  let active = true
  let persisted = false
  let timeoutId

  const ensureActive = () => {
    if (!active) throw timeoutError()
  }

  const discovery = (async () => {
    const response = await invokeDiscovery({ action: 'discover_latest', style }, controller.signal)
    ensureActive()
    if (!response || typeof response !== 'object') throw new Error('virtual_staging_discovery_invalid_response')
    const { data, error } = response
    if (error || !data?.ok) throw new Error(data?.error || 'virtual_staging_discovery_failed')
    if (!data.jobId) return { state: 'empty' }

    const recovery = buildRecovery(data)
    ensureActive()
    persistRecovery(recovery)
    persisted = true
    ensureActive()
    startPolling(data.jobId)
    return { state: 'started', jobId: data.jobId }
  })()

  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        active = false
        controller.abort()
        reject(timeoutError())
      }, timeoutMs)
    })
    return await Promise.race([discovery, timeout])
  } catch (error) {
    active = false
    if (persisted) {
      try { clearRecovery() } catch { /* A falha de limpeza não pode bloquear uma nova criação. */ }
    }
    return { state: 'failed', error }
  } finally {
    active = false
    if (timeoutId) clearTimeout(timeoutId)
  }
}
