import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  runVirtualStagingInitialDiscovery,
  VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE,
  VIRTUAL_STAGING_DISCOVERY_TIMEOUT_MS,
} from '../src/lib/virtual-staging-discovery.js'

const pageSource = await readFile(new URL('../src/pages/VirtualStaging.jsx', import.meta.url), 'utf8')
const helperSource = await readFile(new URL('../src/lib/virtual-staging-discovery.js', import.meta.url), 'utf8')

function callbacks(overrides = {}) {
  const calls = { built: [], persisted: [], cleared: 0, polled: [] }
  return {
    calls,
    options: {
      style: 'narrated_tour',
      journeyId: 'life-in-property',
      invokeDiscovery: async body => ({ data: { ok: true, status: 'generating', jobId: 'job-1' }, requestBody: body }),
      buildRecovery: data => { calls.built.push(data); return { jobId: data.jobId, status: data.status } },
      persistRecovery: recovery => { calls.persisted.push(recovery) },
      clearRecovery: () => { calls.cleared += 1 },
      startPolling: jobId => { calls.polled.push(jobId) },
      timeoutMs: 50,
      ...overrides,
    },
  }
}

async function runUiBoundary(overrides = {}) {
  let status = 'generating'
  let message = 'Procurando sua criação mais recente...'
  let recoveryStarted = false
  let recoveryMessage = ''
  const fixture = callbacks(overrides)
  const startPolling = fixture.options.startPolling
  fixture.options.startPolling = jobId => {
    message = 'Retomando sua criação...'
    startPolling(jobId)
  }
  try {
    const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
    recoveryStarted = outcome.state === 'started'
    recoveryMessage = outcome.state === 'failed' ? VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE : ''
  } catch {
    recoveryMessage = VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE
  } finally {
    if (!recoveryStarted) {
      status = 'idle'
      message = recoveryMessage
    }
  }
  return { status, message, recoveryStarted, ...fixture }
}

test('resposta sem job encerra discovery sem persistir ou iniciar polling', async () => {
  let receivedBody
  const fixture = callbacks({
    invokeDiscovery: async body => { receivedBody = body; return { data: { ok: true, status: 'none' } } },
  })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.deepEqual(outcome, { state: 'empty' })
  assert.deepEqual(receivedBody, { action: 'discover_latest', style: 'narrated_tour', journeyId: 'life-in-property' })
  assert.equal(fixture.calls.persisted.length, 0)
  assert.equal(fixture.calls.polled.length, 0)
})

test('job anterior válido é persistido e encaminhado ao polling', async () => {
  const fixture = callbacks()
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.deepEqual(outcome, { state: 'started', jobId: 'job-1' })
  assert.deepEqual(fixture.calls.persisted, [{ jobId: 'job-1', status: 'generating' }])
  assert.deepEqual(fixture.calls.polled, ['job-1'])
})

test('job concluído recuperado preserva o status recebido antes do polling', async () => {
  const fixture = callbacks({
    invokeDiscovery: async () => ({ data: { ok: true, status: 'completed', jobId: 'completed-1', signedVideoUrl: 'https://example.test/video.mp4' } }),
  })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'started')
  assert.equal(fixture.calls.built[0].status, 'completed')
  assert.deepEqual(fixture.calls.polled, ['completed-1'])
})

test('erro retornado pelo invoke falha de forma controlada', async () => {
  const fixture = callbacks({ invokeDiscovery: async () => ({ data: null, error: new Error('network') }) })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'failed')
  assert.equal(fixture.calls.polled.length, 0)
})

test('Promise rejeitada falha de forma controlada', async () => {
  const fixture = callbacks({ invokeDiscovery: async () => { throw new Error('rejected') } })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'failed')
  assert.match(outcome.error.message, /rejected/)
})

test('timeout aborta somente a descoberta inicial e retorna falha', async () => {
  let signal
  const fixture = callbacks({
    timeoutMs: 10,
    invokeDiscovery: (_body, receivedSignal) => { signal = receivedSignal; return new Promise(() => {}) },
  })
  const startedAt = Date.now()
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'failed')
  assert.equal(outcome.error.code, 'virtual_staging_discovery_timeout')
  assert.equal(signal.aborted, true)
  assert.ok(Date.now() - startedAt < 500)
})

test('erro ao reconstruir o pacote não persiste recovery nem inicia polling', async () => {
  const fixture = callbacks({ buildRecovery: () => { throw new Error('package_failed') } })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'failed')
  assert.equal(fixture.calls.persisted.length, 0)
  assert.equal(fixture.calls.polled.length, 0)
})

test('erro no sessionStorage não inicia polling', async () => {
  const fixture = callbacks({ persistRecovery: () => { throw new Error('storage_failed') } })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'failed')
  assert.equal(fixture.calls.polled.length, 0)
})

test('erro ao iniciar polling remove o recovery parcialmente persistido', async () => {
  const fixture = callbacks({ startPolling: () => { throw new Error('poll_failed') } })
  const outcome = await runVirtualStagingInitialDiscovery(fixture.options)
  assert.equal(outcome.state, 'failed')
  assert.equal(fixture.calls.persisted.length, 1)
  assert.equal(fixture.calls.cleared, 1)
})

test('falha sempre devolve a UI para idle e desbloqueia a criação', async () => {
  const result = await runUiBoundary({ invokeDiscovery: async () => { throw new Error('offline') } })
  assert.equal(result.status, 'idle')
  assert.equal(['uploading', 'generating'].includes(result.status), false)
  assert.equal(result.message, VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE)
})

test('finally não sobrescreve estado válido quando o polling foi iniciado', async () => {
  const result = await runUiBoundary()
  assert.equal(result.recoveryStarted, true)
  assert.equal(result.status, 'generating')
  assert.equal(result.message, 'Retomando sua criação...')
  assert.deepEqual(result.calls.polled, ['job-1'])
})

test('discovery não inicia geração automaticamente', async () => {
  const fixture = callbacks()
  await runVirtualStagingInitialDiscovery(fixture.options)
  assert.deepEqual(fixture.calls.polled, ['job-1'])
  assert.doesNotMatch(helperSource, /virtual-staging-generate|createTour/)
})

test('discovery não contém reserva, débito ou custo de 325 ST', () => {
  assert.doesNotMatch(helperSource, /reserve|debit|consume|325|SmartToken/i)
  assert.match(pageSource, /invokeDiscovery: \(body, signal\) => supabase\.functions\.invoke\('virtual-staging-status'/)
})

test('Apresentação pelo Corretor mantém discovery isolado por guided_tour', () => {
  assert.match(pageSource, /isBrokerPresentation \? 'guided_tour'/)
  assert.match(pageSource, /style: discoveryStyle/)
  assert.doesNotMatch(helperSource, /presenter|broker-presentation|cta|caption/i)
})

test('Smart Space permanece fora deste discovery e timeout padrão é de 10 segundos', () => {
  assert.match(pageSource, /if \(isFurnishRenovate\) return[\s\S]*const storedValue = sessionStorage\.getItem\(activeJobKey\)/)
  assert.equal(VIRTUAL_STAGING_DISCOVERY_TIMEOUT_MS, 10_000)
  assert.match(pageSource, /if \(!recoveryStarted\)[\s\S]*setStatus\('idle'\)/)
})
