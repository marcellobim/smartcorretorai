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
  parseLatestCompletedSmartTour,
  readSmartTourActiveJob,
  shouldRecoverSmartTourGenerateResponse,
  shouldRetrySmartTourStatusResponse,
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

test('recovers unavailable generation responses and retries transient status checks', () => {
  assert.equal(shouldRecoverSmartTourGenerateResponse(new Error('network'), null), true)
  assert.equal(shouldRecoverSmartTourGenerateResponse({ context: { status: 504 } }, null), true)
  assert.equal(shouldRecoverSmartTourGenerateResponse({ context: { status: 400 } }, null), false)
  assert.equal(shouldRecoverSmartTourGenerateResponse(null, { ok: true, jobId: imageJobId }), false)
  assert.equal(shouldRecoverSmartTourGenerateResponse(null, null), true)
  assert.equal(shouldRecoverSmartTourGenerateResponse(null, { ok: false, error: 'invalid' }), false)
  assert.equal(shouldRetrySmartTourStatusResponse(new Error('network'), null), true)
  assert.equal(shouldRetrySmartTourStatusResponse({ context: { status: 503 } }, null), true)
  assert.equal(shouldRetrySmartTourStatusResponse({ context: { status: 404 } }, null), false)
  assert.equal(shouldRetrySmartTourStatusResponse(null, { ok: false, error: 'terminal' }), false)
})

test('completed discovery restores the owned result and its persisted social publication options without initiating generation', () => {
  const publicationOptions = [1, 2, 3].map(index => ({ id: `smart-tour-caption-option-${index}`, text: `Legenda ${index}` }))
  const valid = { ok: true, status: 'completed', jobId: imageJobId, signedVideoUrl: 'https://project.example.test/signed.mp4', hashtags: ['#imovel'], publicationOptions }
  assert.deepEqual(parseLatestCompletedSmartTour(valid), { jobId: imageJobId, signedVideoUrl: valid.signedVideoUrl, hashtags: ['#imovel'], publicationOptions })
  for (const invalid of [{ ...valid, jobId: 'other-user' }, { ...valid, status: 'generating' }, { ...valid, signedVideoUrl: 'http://unsafe.test' }, { ...valid, hashtags: [1] }, { ...valid, publicationOptions: [] }, { ...valid, publicationOptions: [{ id: 'unexpected', text: 'x' }, ...publicationOptions.slice(1)] }, { ok: true, status: 'idle' }]) assert.equal(parseLatestCompletedSmartTour(invalid), null)
  const discovery = page.slice(page.indexOf("action: 'discover_latest'"), page.indexOf("action: 'discover_latest'") + 800)
  assert.match(discovery, /parseLatestCompletedSmartTour/)
  assert.match(discovery, /unifiedSocialPublishing: true/)
  assert.match(discovery, /publicationOptions/)
  assert.doesNotMatch(discovery, /smart-tour-generate/)
})

test('image generation persists a provisional recovery record before invoke and polls inconclusive responses', () => {
  const imageBranch = page.slice(page.indexOf('const orderedImages = images.slice()'), page.indexOf('\n    } catch (error)', page.indexOf('const orderedImages = images.slice()')))
  const startingIndex = imageBranch.indexOf("inputFlow:'images', phase:'starting'")
  const invokeIndex = imageBranch.indexOf("functions.invoke('smart-tour-generate'")
  assert.ok(startingIndex >= 0)
  assert.ok(invokeIndex > startingIndex)
  assert.match(imageBranch, /shouldRecoverSmartTourGenerateResponse\(error, data\)[\s\S]*?poll\(requestId\)[\s\S]*?return/)
  assert.match(imageBranch, /phase:'active'/)
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

test('backend discovery is scoped to the authenticated user, completed Smart Tour mode and exact MP4 path', () => {
  assert.match(statusFunction, /body\?\.action === 'discover_latest'/)
  const discovery = statusFunction.slice(statusFunction.indexOf("body?.action === 'discover_latest'"), statusFunction.indexOf("const jobId", statusFunction.indexOf("body?.action === 'discover_latest'")))
  for (const fragment of [".eq('user_id', user.id)", ".eq('status', 'completed')", ".eq('mode', 'smart_tour_gemini_omni')", '`${user.id}/${latest.id}/smart-tour.mp4`']) assert.ok(discovery.includes(fragment), fragment)
  assert.match(discovery, /publication_options/)
  assert.doesNotMatch(discovery, /settleGeminiVideoJobEconomy|smart-tour-generate/)
})
