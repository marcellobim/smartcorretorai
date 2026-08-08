import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ACTIVE_JOB_KEY,
  SMART_TOUR_STARTING_RECOVERY_WINDOW_MS,
  clearSmartTourActiveJob,
  parseSmartTourActiveJob,
  readSmartTourActiveJob,
  shouldRetryStartingJobNotFound,
  writeSmartTourActiveJob,
} from '../src/lib/smart-tour-job-recovery.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')
const statusFunction = readFileSync(path.join(repositoryRoot, 'supabase/functions/smart-tour-status/index.ts'), 'utf8')
const imageJobId = '123e4567-e89b-42d3-a456-426614174000'
const shortJobId = '223e4567-e89b-42d3-a456-426614174001'

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)) }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

test('parses the current record and legacy UUID without adding persisted data', () => {
  const current = parseSmartTourActiveJob(JSON.stringify({
    jobId: shortJobId,
    campaignPackage: { propertyType: 'Apartamento' },
    inputFlow: 'short-videos',
    phase: 'starting',
    updatedAt: 100,
  }))
  assert.deepEqual(current, {
    jobId: shortJobId,
    campaignPackage: { propertyType: 'Apartamento' },
    inputFlow: 'short-videos',
    phase: 'starting',
    updatedAt: 100,
    legacy: false,
  })
  assert.deepEqual(parseSmartTourActiveJob(imageJobId), {
    jobId: imageJobId,
    campaignPackage: {},
    inputFlow: 'images',
    phase: 'active',
    updatedAt: 0,
    legacy: true,
  })
  assert.equal(parseSmartTourActiveJob(JSON.stringify(imageJobId)).jobId, imageJobId)
  assert.equal(parseSmartTourActiveJob(JSON.stringify({ jobId: imageJobId, inputFlow: 'unknown' })).inputFlow, 'images')
})

test('rejects and safely clears invalid records', () => {
  for (const invalid of ['', '{}', '{broken', 'job-without-uuid', JSON.stringify({ jobId: 'invalid' })]) {
    assert.equal(parseSmartTourActiveJob(invalid), null)
  }
  const storage = new MemoryStorage({ [ACTIVE_JOB_KEY]: '{broken' })
  assert.deepEqual(readSmartTourActiveJob(storage), { record: null, invalid: true })
  clearSmartTourActiveJob(storage)
  assert.equal(storage.getItem(ACTIVE_JOB_KEY), null)
})

test('round-trips image and Short Videos recovery records in memory', () => {
  const storage = new MemoryStorage()
  writeSmartTourActiveJob(storage, { jobId: imageJobId, campaignPackage: { purpose: 'sale' }, phase: 'active', updatedAt: 200 })
  assert.equal(readSmartTourActiveJob(storage).record.inputFlow, 'images')
  writeSmartTourActiveJob(storage, { jobId: shortJobId, campaignPackage: { purpose: 'rent' }, inputFlow: 'short-videos', phase: 'starting', updatedAt: 300 })
  assert.equal(readSmartTourActiveJob(storage).record.inputFlow, 'short-videos')
})

test('retries only a recent provisional 404 and expires the bounded window', () => {
  const updatedAt = 1_000
  const record = { jobId: shortJobId, phase: 'starting', updatedAt }
  const notFound = { context: { status: 404 } }
  assert.equal(shouldRetryStartingJobNotFound(record, notFound, updatedAt), true)
  assert.equal(shouldRetryStartingJobNotFound(record, notFound, updatedAt + SMART_TOUR_STARTING_RECOVERY_WINDOW_MS), true)
  assert.equal(shouldRetryStartingJobNotFound(record, notFound, updatedAt + SMART_TOUR_STARTING_RECOVERY_WINDOW_MS + 1), false)
  assert.equal(shouldRetryStartingJobNotFound(record, { context: { status: 503 } }, updatedAt + 1), false)
  assert.equal(shouldRetryStartingJobNotFound({ ...record, phase: 'active' }, notFound, updatedAt + 1), false)
})

test('mount recovery restores the input flow and starts polling once', () => {
  assert.match(page, /const recoveryStartedRef = useRef\(false\)/)
  assert.match(page, /const \{ record: activeJob, invalid \} = readSmartTourActiveJob\(sessionStorage\)/)
  assert.match(page, /if \(recoveryStartedRef\.current\) return/)
  assert.match(page, /recoveryStartedRef\.current = true/)
  assert.match(page, /setActiveInputFlow\(activeJob\.inputFlow\)/)
  assert.match(page, /setMessage\('Retomando sua criação\.\.\.'\)/)
  assert.equal((page.match(/poll\(activeJob\.jobId\)/g) || []).length, 1)
})

test('terminal states clear recovery while transient errors preserve it', () => {
  const completed = page.slice(page.indexOf("if (data.status === 'completed')"), page.indexOf("if (data.status === 'failed')"))
  const failed = page.slice(page.indexOf("if (data.status === 'failed')"), page.indexOf('setMessage(data.message'))
  const catchBlock = page.slice(page.indexOf('} catch (error) {', page.indexOf('async function poll')), page.indexOf('\n  }', page.indexOf('} catch (error) {', page.indexOf('async function poll'))))
  assert.match(completed, /clearSmartTourActiveJob\(sessionStorage\)/)
  assert.match(completed, /activeJob\?\.campaignPackage \|\| \{\}/)
  assert.match(completed, /setResult\(\{ \.\.\.data,[\s\S]*?inputFlow: activeJob\?\.inputFlow \|\| 'images'/)
  assert.match(completed, /setStatus\('completed'\)/)
  assert.match(failed, /clearSmartTourActiveJob\(sessionStorage\)/)
  assert.match(failed, /setStatus\('error'\)/)
  assert.match(page, /shouldRetryStartingJobNotFound\(activeJob, error\)[\s\S]*?setTimeout\(\(\) => poll\(jobId\), 3000\)/)
  assert.match(page, /if \(getSmartTourStatusHttpStatus\(error\) === 404\)[\s\S]*?clearSmartTourActiveJob\(sessionStorage\)/)
  assert.doesNotMatch(catchBlock, /clearSmartTourActiveJob/)
})

test('reset clears the previous job before a new project can start', () => {
  const reset = page.slice(page.indexOf('const reset = () => {'), page.indexOf('\n  if (result)'))
  assert.match(reset, /clearSmartTourActiveJob\(sessionStorage\)/)
  assert.match(reset, /setResult\(null\)/)
  assert.match(page, /onCreateNew=\{reset\}/)
  const storage = new MemoryStorage({ [ACTIVE_JOB_KEY]: JSON.stringify({ jobId: imageJobId, campaignPackage: { stale: true } }) })
  clearSmartTourActiveJob(storage)
  assert.equal(readSmartTourActiveJob(storage).record, null)
})

test('backend ownership prevents another user record from producing a result', () => {
  assert.match(statusFunction, /auth\.getUser\(token\)/)
  assert.match(statusFunction, /\.eq\('id', jobId\)[\s\S]*?\.eq\('user_id', user\.id\)[\s\S]*?\.maybeSingle\(\)/)
  assert.match(statusFunction, /if \(!job\) return json\(\{ ok: false, error: 'Criação não encontrada\.' \}, 404\)/)
})
