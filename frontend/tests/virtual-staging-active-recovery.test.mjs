import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getRecoverableVirtualStagingJourneyId,
  getVirtualStagingJourneySessionKey,
} from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/VirtualStaging.jsx'), 'utf8')

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  const removed = []
  return {
    removed,
    getItem(key) { return values.has(key) ? values.get(key) : null },
    removeItem(key) { removed.push(key); values.delete(key) },
  }
}

const record = (jobId, status = 'generating', updatedAt = 1) => JSON.stringify({
  jobId,
  status,
  campaignPackage: { sourceProduct: 'Virtual Space' },
  updatedAt,
})

test('Vida no Imóvel em processamento é selecionado para recovery', () => {
  const key = getVirtualStagingJourneySessionKey('life-in-property')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [key]: record('life-job', 'processing'),
  })), 'life-in-property')
})

test('Apresentação pelo Corretor em processamento é selecionada para recovery', () => {
  const key = getVirtualStagingJourneySessionKey('broker-presentation')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [key]: record('broker-job', 'generating'),
  })), 'broker-presentation')
})

test('a jornada ativa mais recente vence entre os dois módulos legados', () => {
  const lifeKey = getVirtualStagingJourneySessionKey('life-in-property')
  const brokerKey = getVirtualStagingJourneySessionKey('broker-presentation')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [lifeKey]: record('life-job', 'processing', 20),
    [brokerKey]: record('broker-job', 'generating', 30),
  })), 'broker-presentation')
})

for (const terminalStatus of ['completed', 'failed']) {
  test(`${terminalStatus} não é recuperado e seu registro é limpo`, () => {
    const key = getVirtualStagingJourneySessionKey('life-in-property')
    const storage = memoryStorage({ [key]: record(`${terminalStatus}-job`, terminalStatus) })
    assert.equal(getRecoverableVirtualStagingJourneyId(storage), null)
    assert.deepEqual(storage.removed, [key])
  })
}

test('registro inválido é ignorado e limpo com segurança', () => {
  const key = getVirtualStagingJourneySessionKey('broker-presentation')
  const storage = memoryStorage({ [key]: JSON.stringify({ status: 'processing' }) })
  assert.equal(getRecoverableVirtualStagingJourneyId(storage), null)
  assert.deepEqual(storage.removed, [key])
})

test('furnish antigo é ignorado sem ocultar um job ativo de Vida no Imóvel', () => {
  const furnishKey = getVirtualStagingJourneySessionKey('furnish-renovate')
  const lifeKey = getVirtualStagingJourneySessionKey('life-in-property')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [furnishKey]: record('old-furnish-job', 'processing', 100),
    [lifeKey]: record('life-job', 'processing', 10),
  })), 'life-in-property')
})

test('novo Virtual Staging de imagens não grava nem retoma o recovery legado', () => {
  const imageFlow = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.doesNotMatch(imageFlow, /activeJobKey|sessionStorage\.setItem|virtual-staging-status/)
  assert.match(page, /if \(isFurnishRenovate\) return\s*const storedValue = sessionStorage\.getItem\(activeJobKey\)/)
})

test('mount retoma uma única vez o mesmo job, inclusive sob Strict Mode', () => {
  const recoveryEffect = page.slice(page.indexOf('const storedValue = sessionStorage.getItem(activeJobKey)'), page.indexOf('const addImages'))
  assert.match(recoveryEffect, /recoveryStartedJobIdRef\.current === stored\.jobId/)
  assert.match(recoveryEffect, /recoveryStartedJobIdRef\.current = stored\.jobId[\s\S]*poll\(stored\.jobId\)/)
})

test('erro transitório preserva o registro para recuperação posterior', () => {
  const poll = page.slice(page.indexOf('async function poll(jobId)'), page.indexOf('const retryResultStatus'))
  const catchBranch = poll.slice(poll.lastIndexOf('catch'))
  assert.doesNotMatch(catchBranch, /sessionStorage\.removeItem/)
  assert.match(catchBranch, /setStatus\('error'\)/)
})

test('completed e failed limpam recovery e completed não é persistido novamente', () => {
  const poll = page.slice(page.indexOf('async function poll(jobId)'), page.indexOf('const retryResultStatus'))
  const completed = poll.slice(poll.indexOf("if (data.status === 'completed')"), poll.indexOf("if (data.status === 'failed')"))
  const failed = poll.slice(poll.indexOf("if (data.status === 'failed')"))
  assert.match(completed, /sessionStorage\.removeItem\(activeJobKey\)/)
  assert.doesNotMatch(completed, /sessionStorage\.setItem/)
  assert.match(failed, /sessionStorage\.removeItem\(activeJobKey\)/)
})

test('registro é gravado somente depois da criação do job e reset limpa refs de recovery', () => {
  assert.match(page, /if \(error \|\| !data\?\.ok \|\| !data\?\.jobId\) throw[\s\S]*sessionStorage\.setItem\(activeJobKey, JSON\.stringify\(\{ jobId:data\.jobId, status:'generating', campaignPackage, updatedAt:Date\.now\(\) \}\)\)/)
  assert.match(page, /const reset = \(\) => \{ sessionStorage\.removeItem\(activeJobKey\); activeJobIdRef\.current = ''; recoveryStartedJobIdRef\.current = '';/)
})
