import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  STUDIO_ACTIVE_JOB_KEY,
  clearStudioActiveJob,
  getStudioActiveMode,
  getStudioUiMode,
  parseStudioActiveJob,
  readStudioActiveJob,
  writeStudioActiveJob,
} from '../src/lib/studio-active-job.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/StudioHero.jsx'), 'utf8')
const jobId = '123e4567-e89b-42d3-a456-426614174000'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

test('job start persists only the job UUID and the normalized Studio mode', () => {
  const storage = new MemoryStorage()
  const record = writeStudioActiveJob(storage, {
    jobId,
    mode: 'dynamic_reel',
    accessToken: 'must-not-be-stored',
    captchaToken: 'must-not-be-stored',
    email: 'must-not-be-stored',
    imageBase64: 'must-not-be-stored',
  })

  assert.deepEqual(record, { jobId, mode: 'dynamic_reel' })
  assert.deepEqual(JSON.parse(storage.getItem(STUDIO_ACTIVE_JOB_KEY)), { jobId, mode: 'dynamic_reel' })
  assert.doesNotMatch(storage.getItem(STUDIO_ACTIVE_JOB_KEY), /token|email|base64|must-not-be-stored/i)
})

test('active record validates UUID and the two supported backend modes', () => {
  assert.deepEqual(parseStudioActiveJob(JSON.stringify({ jobId, mode: 'free_ai' })), { jobId, mode: 'free_ai' })
  assert.equal(parseStudioActiveJob(JSON.stringify({ jobId: 'invalid', mode: 'free_ai' })), null)
  assert.equal(parseStudioActiveJob(JSON.stringify({ jobId, mode: 'cinematic' })), null)
  assert.equal(parseStudioActiveJob('{broken'), null)
  assert.equal(getStudioActiveMode('cinematic'), 'dynamic_reel')
  assert.equal(getStudioUiMode('dynamic_reel'), 'cinematic')
})

test('unmount cancels only the local timer and leaves sessionStorage untouched', () => {
  const storage = new MemoryStorage()
  writeStudioActiveJob(storage, { jobId, mode: 'dynamic_reel' })
  const cleanup = page.slice(page.indexOf('return () => {', page.indexOf('componentMountedRef.current = true')), page.indexOf('\n    }', page.indexOf('return () => {', page.indexOf('componentMountedRef.current = true'))) + 6)
  assert.match(cleanup, /componentMountedRef\.current = false/)
  assert.match(cleanup, /clearPolling\(\)/)
  assert.doesNotMatch(cleanup, /clearStudioActiveJob/)
  assert.deepEqual(readStudioActiveJob(storage).record, { jobId, mode: 'dynamic_reel' })
})

test('remount restores mode and processing state and resumes the same job', () => {
  assert.match(page, /initialActiveJobRef\.current = [\s\S]*readStudioActiveJob\(window\.sessionStorage\)\.record/)
  assert.match(page, /setStudioMode\(getStudioUiMode\(activeJob\.mode\)\)/)
  assert.match(page, /setStatus\('generating'\)/)
  assert.match(page, /scheduleVideoPoll\(activeJob\.jobId, 0, \{ mode: 'recovery' \}\)/)
  assert.match(page, /isRecoveredJob && \([\s\S]*<RecoveredStudioJobPanel/)
  assert.match(page, /function RecoveredStudioJobPanel\([\s\S]*<LoadingCard/)
  assert.match(page, /function RecoveredStudioJobPanel\([\s\S]*video src=\{videoUrl\}/)
})

test('recovery only polls status and never starts a generation or a new reservation', () => {
  const recovery = page.slice(page.indexOf('const activeJob = initialActiveJobRef.current'), page.indexOf('return () => {', page.indexOf('const activeJob = initialActiveJobRef.current')))
  assert.match(recovery, /scheduleVideoPoll/)
  assert.doesNotMatch(recovery, /criar-video-ia|handleGenerate|reserve|Smart Tokens/)
  assert.equal((page.match(/invokeStudioFunction\('criar-video-ia'/g) || []).length, 1)
  assert.match(page, /invokeStudioFunction\('get-video-job-status', \{ jobId: normalizedJobId \}\)/)
})

test('an existing active job blocks creation of a duplicate job', () => {
  const generateStart = page.slice(page.indexOf('const handleGenerate = async'), page.indexOf("if (!isFreeAiMode && !studioHeroAccess.canGenerate)"))
  assert.match(generateStart, /readStudioActiveJob\(window\.sessionStorage\)\.record/)
  assert.match(generateStart, /scheduleVideoPoll\(storedActiveJob\.jobId, 0, \{ mode: 'recovery' \}\)/)
  assert.match(generateStart, /return/)
})

test('only one timer and one in-flight request are allowed for the active job', () => {
  assert.match(page, /const scheduleVideoPoll = [\s\S]*clearPolling\(\)[\s\S]*pollTimerRef\.current = window\.setTimeout/)
  assert.match(page, /if \(pollInFlightRef\.current === normalizedJobId\) return/)
  assert.match(page, /if \(activeJobRef\.current\?\.jobId !== normalizedJobId\) return/)
})

test('completed stops polling but preserves its recoverable reference', () => {
  const completed = page.slice(page.indexOf("if (data.status === 'completed')"), page.indexOf("if (['failed'"))
  assert.match(completed, /clearPolling\(\)/)
  assert.match(completed, /setStatus\('completed'\)/)
  assert.match(completed, /setVideoUrl\(nextVideoUrl\)/)
  assert.doesNotMatch(completed, /clearStudioActiveJob|activeJobRef\.current = null/)
})

test('failed and cancelled terminal statuses clear only their job', () => {
  const failed = page.slice(page.indexOf("if (['failed'"), page.indexOf("setStatus('generating')", page.indexOf("if (['failed'")))
  assert.match(failed, /clearPolling\(\)/)
  assert.match(failed, /clearStudioActiveJob\(window\.sessionStorage, normalizedJobId\)/)
  assert.match(failed, /activeJobRef\.current = null/)

  const storage = new MemoryStorage()
  writeStudioActiveJob(storage, { jobId, mode: 'dynamic_reel' })
  assert.equal(clearStudioActiveJob(storage, '223e4567-e89b-42d3-a456-426614174001'), false)
  assert.notEqual(storage.getItem(STUDIO_ACTIVE_JOB_KEY), null)
  assert.equal(clearStudioActiveJob(storage, jobId), true)
  assert.equal(storage.getItem(STUDIO_ACTIVE_JOB_KEY), null)
})

test('reload after completed restores the result without generation or economic side effects', () => {
  const mountRecovery = page.slice(page.indexOf('const activeJob = initialActiveJobRef.current'), page.indexOf('return () => {', page.indexOf('const activeJob = initialActiveJobRef.current')))
  const completed = page.slice(page.indexOf("if (data.status === 'completed')"), page.indexOf("if (['failed'"))
  assert.match(mountRecovery, /scheduleVideoPoll\(activeJob\.jobId, 0, \{ mode: 'recovery' \}\)/)
  assert.match(completed, /setVideoUrl\(nextVideoUrl\)/)
  assert.doesNotMatch(mountRecovery, /criar-video-ia|reserve|consume|registerStudioCreation/)
  assert.doesNotMatch(completed, /criar-video-ia|reserve|consume/)
})

test('Create new explicitly clears the completed reference before resetting the flow', () => {
  const createNew = page.slice(page.indexOf('const createNewStudioVersion ='), page.indexOf('const selectStudioMode'))
  assert.match(createNew, /clearStudioActiveJob\(window\.sessionStorage, recoverableJobId\)/)
  assert.match(createNew, /activeJobRef\.current = null/)
  assert.match(createNew, /resetFlow\(nextMode\)/)
  assert.match(page, /onReset=\{createNewStudioVersion\}/)
  assert.match(page, /onClick=\{status === 'completed' \? createNewStudioVersion : resetFlow\}/)
})

test('a transient polling error preserves the job and schedules another poll', () => {
  const catchBlock = page.slice(page.indexOf('} catch (error) {', page.indexOf('const pollVideoStatus')), page.indexOf('} finally {', page.indexOf('const pollVideoStatus')))
  assert.doesNotMatch(catchBlock, /clearStudioActiveJob|setStatus\('failed'\)/)
  assert.match(catchBlock, /setStatus\('generating'\)/)
  assert.match(catchBlock, /scheduleVideoPoll\(normalizedJobId\)/)
})

test('persisted payload cannot contain credentials, personal data or media', () => {
  const helper = readFileSync(path.join(frontendRoot, 'src/lib/studio-active-job.js'), 'utf8')
  const serializedRecord = helper.slice(helper.indexOf('JSON.stringify({'), helper.indexOf('}))', helper.indexOf('JSON.stringify({')) + 3)
  assert.match(serializedRecord, /jobId/)
  assert.match(serializedRecord, /mode/)
  assert.doesNotMatch(serializedRecord, /access|refresh|secret|captcha|email|file|image|base64/i)
})
