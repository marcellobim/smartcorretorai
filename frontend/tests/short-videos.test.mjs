import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  SHORT_VIDEO_MAX_BYTES,
  SHORT_VIDEO_MAX_DURATION_SECONDS,
  SHORT_VIDEOS_EXAMPLE_PATH,
  SHORT_VIDEOS_INPUT_BUCKET,
  SHORT_VIDEOS_MODULE_ID,
  SHORT_VIDEOS_VISIBLE,
  adaptQuestionsForShortVideos,
  buildShortVideoInputPath,
  cleanupShortVideoInput,
  getShortVideoTerminalActions,
  validateShortVideoDuration,
  validateShortVideoFile,
} from '../src/config/shortVideos.js'
import { SMART_TOUR_EXAMPLES } from '../src/config/smartTour.js'
import { parseSmartTourActiveJob } from '../src/lib/smart-tour-job-recovery.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')
const shortVideosConfig = readFileSync(path.join(frontendRoot, 'src/config/shortVideos.js'), 'utf8')
const campaignPackage = readFileSync(path.join(frontendRoot, 'src/components/campaign/CampaignPackage.jsx'), 'utf8')
const userId = '123e4567-e89b-42d3-a456-426614174000'
const requestId = '223e4567-e89b-42d3-a456-426614174000'

test('defines the functional Short Videos product without an unused engine variation', () => {
  assert.equal(SHORT_VIDEOS_MODULE_ID, 'short-videos')
  assert.equal(SHORT_VIDEOS_EXAMPLE_PATH, '/demos-videos/short-video-1.mp4')
  assert.equal(SHORT_VIDEOS_INPUT_BUCKET, 'short-videos-inputs')
  assert.equal(SHORT_VIDEO_MAX_BYTES, 262_144_000)
  assert.equal(SHORT_VIDEO_MAX_DURATION_SECONDS, 300)
  assert.equal(SMART_TOUR_EXAMPLES.at(-1).id, SHORT_VIDEOS_MODULE_ID)
  assert.equal(SMART_TOUR_EXAMPLES.at(-1).video, SHORT_VIDEOS_EXAMPLE_PATH)
  assert.ok(statSync(path.join(frontendRoot, 'public', SHORT_VIDEOS_EXAMPLE_PATH.replace(/^\//, ''))).size > 0)
  assert.doesNotMatch(readFileSync(path.join(frontendRoot, 'src/config/shortVideos.js'), 'utf8'), /SHORT_VIDEOS_ENGINE_VARIATION/)
})

test('keeps Short Videos frozen and inaccessible without removing its internal implementation', () => {
  assert.equal(SHORT_VIDEOS_VISIBLE, false)
  assert.match(page, /SMART_TOUR_EXAMPLES\.filter\(example => SHORT_VIDEOS_VISIBLE \|\| example\.id !== SHORT_VIDEOS_MODULE_ID\)/)
  assert.match(page, /restoredTourDraft\.activeInputFlow === 'images' \|\| \(SHORT_VIDEOS_VISIBLE && restoredTourDraft\.activeInputFlow === SHORT_VIDEOS_MODULE_ID\)/)
  assert.match(page, /if \(inputFlow === SHORT_VIDEOS_MODULE_ID && !SHORT_VIDEOS_VISIBLE\) return/)
  assert.match(page, /shortVideosVisible=\{SHORT_VIDEOS_VISIBLE\}/)
  assert.match(page, /\{shortVideosVisible && <ProductCard[\s\S]*?Transformar um vídeo em Short[\s\S]*?Criar Short com vídeo[\s\S]*?<\/ProductCard>\}/)
  assert.match(page, /onSelectImages=\{\(\) => selectInputFlow\('images'\)\}/)
  assert.match(page, /const addShortVideo = async files =>/)
  assert.match(page, /storage\.from\(SHORT_VIDEOS_INPUT_BUCKET\)\.upload/)
})

test('accepts only a non-empty MP4 up to 250 MiB and 300 seconds', () => {
  assert.equal(validateShortVideoFile({ type: 'video/mp4', size: SHORT_VIDEO_MAX_BYTES }), '')
  assert.match(validateShortVideoFile({ type: 'video/quicktime', size: 1024 }), /MP4/)
  assert.match(validateShortVideoFile({ type: 'video/mp4', size: 0 }), /vazio/)
  assert.match(validateShortVideoFile({ type: 'video/mp4', size: SHORT_VIDEO_MAX_BYTES + 1 }), /250 MB/)
  assert.equal(validateShortVideoDuration(300), '')
  assert.match(validateShortVideoDuration(300.01), /5 minutos/)
  assert.match(validateShortVideoDuration(Number.NaN), /duração/)
})

test('accepts long Short Videos inputs without treating the ten-second output as an upload limit', () => {
  for (const durationSeconds of [30, 60, 161.1741]) {
    assert.equal(validateShortVideoDuration(durationSeconds), '')
  }

  assert.doesNotMatch(shortVideosConfig, /durationSeconds\s*>\s*10\b/)
  assert.doesNotMatch(shortVideosConfig, /(?:máximo|limite|até)[^\n]{0,30}10\s*(?:s|segundos?)\b/i)
  assert.doesNotMatch(page, /(?:upload|entrada|arquivo enviado|vídeo enviado)[^\n]{0,80}(?:máximo|limite|até)[^\n]{0,30}10\s*(?:s|segundos?)\b/i)
})

test('keeps Short Videos independent from photos and removes the presenter question', () => {
  const questions = [['images'], ['purpose'], ['presenter'], ['narration'], ['review']]
  assert.deepEqual(adaptQuestionsForShortVideos(questions).map(([id]) => id), ['images', 'purpose', 'narration', 'review'])
  assert.match(page, /const isShortVideos = activeInputFlow === SHORT_VIDEOS_MODULE_ID/)
  assert.match(page, /onSelectShortVideos=\{\(\) => selectInputFlow\(SHORT_VIDEOS_MODULE_ID\)\}/)
  assert.match(page, /accept="video\/mp4"/)
  assert.doesNotMatch(page, /type="file"[^>]*accept="video\/mp4"[^>]*multiple/)
})

test('builds an owner-scoped input path and removes only that exact object', async () => {
  const expectedPath = `${userId}/short-videos/${requestId}/input.mp4`
  const calls = []
  const storage = {
    from(bucket) {
      calls.push(['from', bucket])
      return { remove: async paths => { calls.push(['remove', paths]); return { error: null } } }
    },
  }

  assert.equal(buildShortVideoInputPath(userId, requestId), expectedPath)
  assert.equal(await cleanupShortVideoInput(storage, userId, requestId), expectedPath)
  assert.deepEqual(calls, [
    ['from', SHORT_VIDEOS_INPUT_BUCKET],
    ['remove', [expectedPath]],
  ])
  assert.throws(() => buildShortVideoInputPath('../outro-usuario', requestId), /invalid_short_video_input_owner/)
})

test('propagates cleanup failure so the recovery record can be preserved', async () => {
  const storage = { from: () => ({ remove: async () => ({ error: new Error('network') }) }) }
  await assert.rejects(() => cleanupShortVideoInput(storage, userId, requestId), /short_video_input_cleanup_failed/)
})

test('cleans only a terminal 404 from a provisional Short Videos job', () => {
  assert.deepEqual(getShortVideoTerminalActions({ inputFlow:'short-videos', phase:'starting' }, 'not-found'), {
    releaseLock: true,
    cleanupInput: true,
  })
  assert.deepEqual(getShortVideoTerminalActions({ inputFlow:'short-videos', phase:'active' }, 'not-found'), {
    releaseLock: true,
    cleanupInput: false,
  })
  assert.deepEqual(getShortVideoTerminalActions({ inputFlow:'short-videos', phase:'active' }, 'failed'), {
    releaseLock: true,
    cleanupInput: false,
  })
  assert.deepEqual(getShortVideoTerminalActions({ inputFlow:'images', phase:'starting' }, 'not-found'), {
    releaseLock: false,
    cleanupInput: false,
  })
})

test('uploads the MP4 and persists starting before requesting generation', () => {
  const uploadIndex = page.indexOf("storage.from(SHORT_VIDEOS_INPUT_BUCKET).upload(videoPath, shortVideo.file")
  const startingIndex = page.indexOf("inputFlow: SHORT_VIDEOS_MODULE_ID, phase:'starting'")
  const generationIndex = page.indexOf("functions.invoke('smart-tour-generate'")

  assert.ok(uploadIndex >= 0)
  assert.ok(startingIndex > uploadIndex)
  assert.ok(generationIndex > startingIndex)
  assert.match(page, /videoMetadata: \{ durationSeconds: shortVideo\.duration, mimeType: 'video\/mp4' \}/)
})

test('keeps the provisional job on an inconclusive generation response and resumes polling', () => {
  assert.match(page, /if \(error \|\| !data\?\.ok \|\| !data\?\.jobId\) \{[\s\S]*?poll\(requestId\)[\s\S]*?return/)
  assert.match(page, /shouldRetryStartingJobNotFound\(activeJob, error\)/)
  assert.match(page, /setTimeout\(\(\) => poll\(jobId\), 3000\)/)
})

test('releases the lock after failed and terminal 404 while retaining duplicate-click protection', () => {
  assert.match(page, /if \(shortVideoGenerationLockRef\.current\)[\s\S]*?return/)
  assert.match(page, /getShortVideoTerminalActions\(activeJob, 'not-found'\)[\s\S]*?shortVideoGenerationLockRef\.current = false/)
  assert.match(page, /data\.status === 'failed'[\s\S]*?getShortVideoTerminalActions\(activeJob, 'failed'\)\.releaseLock\) shortVideoGenerationLockRef\.current = false/)
  assert.match(page, /status === 'error' \? 'Tentar novamente'/)
})

test('persists the confirmed job as active without running frontend cleanup', () => {
  assert.match(page, /jobId:data\.jobId, campaignPackage, inputFlow: SHORT_VIDEOS_MODULE_ID, phase:'active', updatedAt:Date\.now\(\)/)
  const activeRecord = parseSmartTourActiveJob(JSON.stringify({
    jobId: requestId,
    campaignPackage: { id: 'package' },
    inputFlow: 'short-videos',
    phase: 'active',
    updatedAt: 123,
  }))
  assert.equal(activeRecord.inputFlow, 'short-videos')
  assert.equal(activeRecord.phase, 'active')
  assert.equal(getShortVideoTerminalActions(activeRecord, 'failed').cleanupInput, false)
})

test('uses the existing endpoints and committed mobile delivery contract', () => {
  assert.match(page, /supabase\.functions\.invoke\('smart-tour-generate'/)
  assert.match(page, /supabase\.functions\.invoke\('smart-tour-status'/)
  assert.doesNotMatch(page, /short-videos-generate|short-videos-status/)
  assert.match(page, /mediaPresentation=\{isShortVideoResult \? 'mobile' : 'default'\} protectVideoDownload=\{isShortVideoResult\}/)
  assert.match(page, /downloadUrl: result\.signedVideoUrl/)
  assert.match(campaignPackage, /\{campaign\.downloadUrl && \(/)
  assert.match(campaignPackage, /Baixar vídeo/)
})
