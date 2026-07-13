import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { renderSmartMotionMainReel } from '../video-renderer.ts'
import { renderSmartMotion } from '../renderer.ts'
import { buildSmartCarouselMessageQueue } from '../smart-carousel-message-queue.ts'
import { resolveSmartCarouselMusic } from '../smart-carousel-music.ts'

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
const bucket = String(process.env.SMART_MEDIA_BUCKET || 'studio-videos')
const SMART_VIDEO_MAX_DURATION_SECONDS = 195
const SMART_VIDEO_MAX_OUTPUT_BYTES = 45 * 1024 * 1024
const SMART_VIDEO_AUDIO_BITRATE_KBPS = 128
const SMART_VIDEO_BITRATE_SAFETY_FACTOR = 0.9
const SMART_CAROUSEL_MAX_IMAGES = 20
const targetJobId = String(process.env.SMART_MEDIA_JOB_ID || '').trim()
const localBridgeRequested = process.env.SMART_MEDIA_LOCAL_BRIDGE === '1'
const localBridgeEnabled = localBridgeRequested && process.env.NODE_ENV !== 'production'
const localBridgePort = Number(process.env.SMART_MEDIA_LOCAL_BRIDGE_PORT || 43129)
const localBridgeOrigins = new Set(['http://127.0.0.1:5173'])
const runMode = String(process.env.SMART_MEDIA_RUN_MODE || 'once')
const environment = String(process.env.SMART_MEDIA_ENV || (process.env.NODE_ENV === 'production' ? '' : 'dev'))
const expectedProjectRef = String(process.env.SMART_MEDIA_EXPECTED_PROJECT_REF || '')
const workerId = String(process.env.SMART_MEDIA_WORKER_ID || `${os.hostname()}-${process.pid}`).replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 100)
const pollIntervalMs = Number(process.env.SMART_MEDIA_POLL_INTERVAL_MS || 5000)
const leaseSeconds = Number(process.env.SMART_MEDIA_LEASE_SECONDS || 120)
const heartbeatSeconds = Number(process.env.SMART_MEDIA_HEARTBEAT_SECONDS || 30)
const healthHost = String(process.env.SMART_MEDIA_HEALTH_HOST || '127.0.0.1')
const healthPort = Number(process.env.SMART_MEDIA_HEALTH_PORT || process.env.PORT || 8080)
const leasesEnabled = process.env.SMART_MEDIA_LEASES_ENABLED === '1' || runMode === 'service'
if (!url || !serviceKey) throw new Error('SUPABASE_URL_and_SUPABASE_SERVICE_ROLE_KEY_required')
if (!['dev', 'staging', 'production'].includes(environment)) throw new Error('SMART_MEDIA_ENV_required')
if (!['once', 'service'].includes(runMode)) throw new Error('SMART_MEDIA_RUN_MODE_invalid')
if (process.env.NODE_ENV === 'production' && (!expectedProjectRef || !url.includes(`://${expectedProjectRef}.supabase.co`))) throw new Error('SMART_MEDIA_EXPECTED_PROJECT_REF_mismatch')
if (bucket !== 'studio-videos') throw new Error('SMART_MEDIA_BUCKET_must_match_existing_contract')
if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1000 || !Number.isInteger(leaseSeconds) || leaseSeconds < 30 || heartbeatSeconds < 10 || heartbeatSeconds >= leaseSeconds) throw new Error('smart_media_worker_timing_invalid')
if (localBridgeRequested && !localBridgeEnabled) throw new Error('smart_media_local_bridge_not_allowed_in_production')

let shuttingDown = false
let currentJobId = ''
let lastCompletedAt = ''
let lastErrorCode = ''
const log = (level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, workerId, environment, ...fields }))
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
const rest = async (resource: string, init: RequestInit = {}) => {
  const response = await fetch(`${url}/rest/v1/${resource}`, { ...init, headers: { ...headers, ...init.headers } })
  if (!response.ok) throw new Error(`supabase_${response.status}:${await response.text()}`)
  return response
}

function runMediaCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000) })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`media_command_failed:${code}:${stderr}`)))
  })
}

async function probeDurationSeconds(filePath: string) {
  const ffprobePath = String(process.env.FFPROBE_PATH || 'ffprobe')
  return new Promise<number>((resolve, reject) => {
    const child = spawn(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2000) })
    child.once('error', reject)
    child.once('close', (code) => {
      const duration = Number(stdout.trim())
      if (code !== 0 || !Number.isFinite(duration) || duration <= 0) reject(new Error(`smart_video_duration_probe_failed:${code}:${stderr}`))
      else resolve(duration)
    })
  })
}

async function enforceSmartVideoSizeLimit(outputFile: string, workDir: string, jobId: string) {
  const sizeBeforeBytes = fs.statSync(outputFile).size
  if (sizeBeforeBytes <= SMART_VIDEO_MAX_OUTPUT_BYTES) {
    log('info', 'smart_video_size_check', { jobId, sizeBeforeBytes, sizeAfterBytes: sizeBeforeBytes, compressed: false })
    return outputFile
  }

  const durationSeconds = await probeDurationSeconds(outputFile)
  const targetTotalBitrateBps = Math.floor((SMART_VIDEO_MAX_OUTPUT_BYTES * 8 / durationSeconds) * SMART_VIDEO_BITRATE_SAFETY_FACTOR)
  const videoBitrateKbps = Math.max(300, Math.floor((targetTotalBitrateBps / 1000) - SMART_VIDEO_AUDIO_BITRATE_KBPS))
  const compressedFile = path.join(workDir, 'smart-video-compressed.mp4')
  const ffmpegPath = String(process.env.FFMPEG_PATH || 'ffmpeg')
  await runMediaCommand(ffmpegPath, [
    '-y', '-i', outputFile,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'medium',
    '-b:v', `${videoBitrateKbps}k`, '-maxrate', `${videoBitrateKbps}k`, '-bufsize', `${videoBitrateKbps * 2}k`,
    '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', `${SMART_VIDEO_AUDIO_BITRATE_KBPS}k`, '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    compressedFile,
  ])
  const sizeAfterBytes = fs.statSync(compressedFile).size
  log('info', 'smart_video_compressed', { jobId, sizeBeforeBytes, sizeAfterBytes, videoBitrateKbps, audioBitrateKbps: SMART_VIDEO_AUDIO_BITRATE_KBPS, durationSeconds: Number(durationSeconds.toFixed(3)) })
  if (sizeAfterBytes > SMART_VIDEO_MAX_OUTPUT_BYTES) {
    throw new Error(`smart_video_output_too_large_after_compression:${sizeAfterBytes}:${SMART_VIDEO_MAX_OUTPUT_BYTES}`)
  }
  return compressedFile
}

async function updateJob(id: string, values: Record<string, unknown>) {
  await rest(`video_jobs?id=eq.${id}${leasesEnabled ? `&worker_id=eq.${encodeURIComponent(workerId)}` : ''}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(values),
  })
}

async function rpc(name: string, body: Record<string, unknown>) {
  const response = await rest(`rpc/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return response.json()
}

async function storageOutputExists(outputPath: string) {
  const parts = outputPath.split('/')
  const fileName = parts.pop()
  const prefix = parts.join('/')
  const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, search: fileName, limit: 2, offset: 0 }),
  })
  if (!response.ok) throw new Error(`output_probe_failed:${response.status}`)
  const objects = await response.json() as Array<{ name?: string }>
  return objects.some((object) => object.name === fileName)
}

async function processNextJob(selectedJobId = targetJobId, expectedUserId = '') {
  const jobs = leasesEnabled
    ? await rpc('claim_video_job', { p_worker_id: workerId, p_lease_seconds: leaseSeconds, p_job_id: selectedJobId || null }) as Array<Record<string, any>>
    : await (selectedJobId
      ? rest(`video_jobs?id=eq.${encodeURIComponent(selectedJobId)}&status=eq.queued&limit=1&select=*`)
      : rest('video_jobs?mode=in.(smart_video,smart_carousel)&status=eq.queued&order=created_at.asc&limit=1&select=*')).then((response) => response.json()) as Array<Record<string, any>>
  const [job] = jobs
  if (selectedJobId) {
    if (!job) throw new Error('smart_media_target_job_not_found')
    if (expectedUserId && job.user_id !== expectedUserId) throw new Error('smart_media_target_job_owner_mismatch')
  }
  if (!job) return { processed: false }

  if (!leasesEnabled) await updateJob(job.id, { status: 'processing', error_message: null })
  currentJobId = String(job.id)
  const startedAt = Date.now()
  const heartbeat = leasesEnabled ? setInterval(() => {
    void rpc('heartbeat_video_job', { p_job_id: job.id, p_worker_id: workerId, p_lease_seconds: leaseSeconds })
      .catch((error) => log('error', 'job_heartbeat_failed', { jobId: job.id, errorCode: classifyError(error).code }))
  }, heartbeatSeconds * 1000) : undefined
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `smart-video-${job.id}-`))
  try {
    const contract = JSON.parse(String(job.prompt_final || '{}'))
    const outputFile = path.join(workDir, 'smart-video.mp4')
    const commercial = contract.commercialCommunication || {}
    const outputFolder = job.mode === 'smart_carousel' ? 'super-carrossel' : 'smart-video'
    const outputPath = `${job.user_id}/${outputFolder}/${job.id}/final.mp4`
    if (await storageOutputExists(outputPath)) {
      await updateJob(job.id, { status: 'completed', output_video_path: outputPath, completed_at: new Date().toISOString(), ...(leasesEnabled ? { worker_id: null, lease_expires_at: null, heartbeat_at: null } : {}) })
      log('info', 'job_completed_idempotently', { jobId: job.id, durationMs: Date.now() - startedAt })
      return { processed: true, jobId: job.id, outputPath, reusedOutput: true }
    }
    await updateJob(job.id, { status: 'rendering' })

    if (job.mode === 'smart_carousel') {
      const images = Array.isArray(contract.images) ? contract.images : []
      if (images.length < 1 || images.length > SMART_CAROUSEL_MAX_IMAGES || images[0]?.isCover !== true) throw new Error('smart_carousel_contract_invalid')
      const imageFiles: string[] = []
      for (const [index, image] of images.entries()) {
        const storagePath = String(image.storagePath || '')
        if (!storagePath.startsWith(`${job.user_id}/super-carrossel/`) || Number(image.order) !== index) throw new Error('smart_carousel_image_invalid')
        const sourceResponse = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${storagePath.split('/').map(encodeURIComponent).join('/')}`, { headers })
        if (!sourceResponse.ok) throw new Error(`source_download_failed:${sourceResponse.status}`)
        const imageFile = path.join(workDir, `image-${String(index + 1).padStart(2, '0')}.${storagePath.split('.').pop() || 'jpg'}`)
        fs.writeFileSync(imageFile, Buffer.from(await sourceResponse.arrayBuffer()))
        imageFiles.push(imageFile)
      }
      const messageQueue = buildSmartCarouselMessageQueue(commercial, imageFiles.length)
      const music = resolveSmartCarouselMusic(commercial.musicStyle)
      await renderSmartMotion({
        outputType: 'motion_video',
        visualModelId: commercial.objective === 'Locação' ? 'rental_direct' : 'clean_showcase',
        scenes: imageFiles.map((imagePath, index) => ({ imagePath, caption: messageQueue.captions[index] || '' })),
        outputPath: outputFile,
        musicPath: music.musicPath,
        cta: String(commercial.cta || ''),
        ctaEnabled: false,
        captionsEnabled: true,
      })
    } else {
      const music = resolveSmartCarouselMusic()
      const sourcePath = String(contract.video?.storagePath || '')
      const sourceDuration = Number(contract.video?.durationSeconds || 0)
      if (!sourcePath.startsWith(`${job.user_id}/smart-video/`) || sourceDuration <= 0 || sourceDuration > SMART_VIDEO_MAX_DURATION_SECONDS) throw new Error('smart_video_contract_invalid')
      const sourceResponse = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${sourcePath.split('/').map(encodeURIComponent).join('/')}`, { headers })
      if (!sourceResponse.ok) throw new Error(`source_download_failed:${sourceResponse.status}`)
      const sourceFile = path.join(workDir, `source.${sourcePath.split('.').pop() || 'mp4'}`)
      fs.writeFileSync(sourceFile, Buffer.from(await sourceResponse.arrayBuffer()))
      await renderSmartMotionMainReel({
        sourceVideoPath: sourceFile,
        outputPath: outputFile,
        cuts: [{ id: 'source-video', startSeconds: 0, endSeconds: sourceDuration }],
        finishing: {
          backgroundMusic: music.musicPath ? {
            enabled: true,
            source: 'file',
            filePath: music.musicPath,
            volumeMode: 'fixed',
            volumeLevel: 0.45,
            fadeInSeconds: 0,
            fadeOutSeconds: 2,
            preserveOriginalAudio: false,
          } : undefined,
          commercialCommunication: {
            enabled: true, renderNow: true,
            dealType: commercial.dealType === 'Locação' ? 'PARA LOCAÇÃO' : 'À VENDA',
            propertyType: String(commercial.propertyType || 'Imóvel'),
            highlights: Array.isArray(commercial.highlights) ? commercial.highlights.slice(0, 3) : [],
            cta: String(commercial.cta || 'Entre em contato'),
            phone: commercial.phone ? String(commercial.phone) : undefined,
          },
        },
      })
    }

    const uploadFile = job.mode === 'smart_video'
      ? await enforceSmartVideoSizeLimit(outputFile, workDir, job.id)
      : outputFile
    const uploadResponse = await fetch(`${url}/storage/v1/object/${bucket}/${outputPath.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
      body: fs.readFileSync(uploadFile),
    })
    if (!uploadResponse.ok) throw new Error(`output_upload_failed:${uploadResponse.status}:${await uploadResponse.text()}`)
    await updateJob(job.id, { status: 'completed', output_video_path: outputPath, completed_at: new Date().toISOString(), ...(leasesEnabled ? { worker_id: null, lease_expires_at: null, heartbeat_at: null } : {}) })
    lastCompletedAt = new Date().toISOString()
    log('info', 'job_completed', { jobId: job.id, mode: job.mode, attempt: job.attempt_count, durationMs: Date.now() - startedAt })
    return { processed: true, jobId: job.id, outputPath }
  } catch (error) {
    const failure = classifyError(error)
    lastErrorCode = failure.code
    if (leasesEnabled) {
      await rpc('release_video_job', { p_job_id: job.id, p_worker_id: workerId, p_retryable: failure.retryable, p_error_code: failure.code, p_error_message: failure.message })
    } else {
      await updateJob(job.id, { status: 'failed', error_message: failure.message })
    }
    log('error', 'job_failed', { jobId: job.id, mode: job.mode, attempt: job.attempt_count, durationMs: Date.now() - startedAt, errorCode: failure.code, retryable: failure.retryable })
    throw error
  } finally {
    if (heartbeat) clearInterval(heartbeat)
    fs.rmSync(workDir, { recursive: true, force: true })
    currentJobId = ''
  }
}

function classifyError(error: unknown) {
  const message = error instanceof Error ? error.message : 'smart_video_worker_failed'
  const code = message.split(':', 1)[0].slice(0, 100)
  const permanent = /contract_invalid|image_invalid|target_job_owner_mismatch|not_smart_carousel|duration|mime|too_large_after_compression|SyntaxError/i.test(code)
  return { code, message: message.slice(0, 500), retryable: !permanent }
}

async function validateLocalBridgeRequest(jobId: string, accessToken: string) {
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!userResponse.ok) throw new Error(`smart_media_local_bridge_auth_${userResponse.status}`)
  const authenticatedUser = await userResponse.json() as { id?: string }
  const userId = String(authenticatedUser.id || '')
  if (!userId) throw new Error('smart_media_local_bridge_user_missing')

  const jobResponse = await rest(`video_jobs?id=eq.${encodeURIComponent(jobId)}&limit=1&select=id,user_id,status,mode`)
  const [job] = await jobResponse.json() as Array<Record<string, any>>
  if (!job) throw new Error('smart_media_target_job_not_found')
  if (job.user_id !== userId) throw new Error('smart_media_target_job_owner_mismatch')
  if (job.status !== 'queued') throw new Error('smart_media_target_job_not_queued')
  if (job.mode !== 'smart_carousel') throw new Error('smart_media_target_job_not_smart_carousel')
  return userId
}

async function auditLocalBridgeJob(jobId: string, userId: string) {
  const response = await rest(`video_jobs?id=eq.${encodeURIComponent(jobId)}&limit=1&select=id,user_id,status,mode,output_video_path,error_message,completed_at`)
  const [job] = await response.json() as Array<Record<string, any>>
  const expectedPath = `${userId}/super-carrossel/${jobId}/final.mp4`
  if (!job || job.user_id !== userId) throw new Error('smart_media_local_bridge_audit_owner_mismatch')
  if (job.mode !== 'smart_carousel') throw new Error('smart_media_local_bridge_audit_mode_mismatch')
  if (job.status !== 'completed') throw new Error(`smart_media_local_bridge_audit_status_${job.status || 'missing'}`)
  if (job.output_video_path !== expectedPath) throw new Error('smart_media_local_bridge_audit_output_path_mismatch')
  return { jobId, status: job.status, mode: job.mode, outputPath: job.output_video_path, completedAt: job.completed_at }
}

function readLocalBridgeBody(request: http.IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 4096) {
        reject(new Error('smart_media_local_bridge_body_too_large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('smart_media_local_bridge_body_invalid'))
      }
    })
    request.on('error', reject)
  })
}

function writeLocalBridgeResponse(response: http.ServerResponse, status: number, origin: string, body: Record<string, unknown>) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': origin,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  })
  response.end(JSON.stringify(body))
}

function runLocalBridge() {
  let accepted = false
  let handling = false
  const server = http.createServer(async (request, response) => {
    const origin = String(request.headers.origin || '')
    if (!localBridgeOrigins.has(origin)) {
      writeLocalBridgeResponse(response, 403, 'null', { ok: false, error: 'origin_not_allowed' })
      return
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '60',
        Vary: 'Origin',
      })
      response.end()
      return
    }
    if (request.method !== 'POST' || request.url !== '/smart-media/job') {
      writeLocalBridgeResponse(response, 404, origin, { ok: false, error: 'not_found' })
      return
    }
    if (accepted || handling) {
      writeLocalBridgeResponse(response, 409, origin, { ok: false, error: 'job_already_accepted' })
      return
    }

    handling = true
    try {
      const body = await readLocalBridgeBody(request)
      const jobId = String(body.jobId || '').trim()
      const accessToken = String(body.accessToken || '').trim()
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) throw new Error('SMART_MEDIA_JOB_ID_invalid')
      if (!accessToken) throw new Error('smart_media_local_bridge_access_token_missing')
      const userId = await validateLocalBridgeRequest(jobId, accessToken)
      accepted = true
      writeLocalBridgeResponse(response, 202, origin, { ok: true, jobId })
      server.close()
      const result = await processNextJob(jobId, userId)
      const audit = await auditLocalBridgeJob(jobId, userId)
      console.log(JSON.stringify({ result, audit }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'smart_media_local_bridge_failed'
      if (!response.headersSent) writeLocalBridgeResponse(response, 400, origin, { ok: false, error: message })
      console.error(error)
      if (accepted) {
        server.close()
        process.exitCode = 1
      }
    } finally {
      if (!accepted) handling = false
    }
  })
  server.listen(localBridgePort, '127.0.0.1', () => {
    console.log(JSON.stringify({ ready: true, mode: 'smart_carousel', host: '127.0.0.1', port: localBridgePort }))
  })
}

function startHealthServer() {
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404).end()
      return
    }
    response.writeHead(shuttingDown ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify({ status: shuttingDown ? 'stopping' : 'ok', environment, workerId, currentJobId: currentJobId || null, lastCompletedAt: lastCompletedAt || null, lastErrorCode: lastErrorCode || null }))
  })
  server.listen(healthPort, healthHost, () => log('info', 'health_server_ready', { host: healthHost, port: healthPort }))
  return server
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function runService() {
  const healthServer = startHealthServer()
  const stop = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log('info', 'shutdown_requested', { signal, currentJobId: currentJobId || null })
    healthServer.close()
  }
  process.once('SIGTERM', () => stop('SIGTERM'))
  process.once('SIGINT', () => stop('SIGINT'))
  log('info', 'worker_ready', { runMode, leasesEnabled, ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg', bucket })
  while (!shuttingDown) {
    try {
      const result = await processNextJob()
      if (!result.processed && !shuttingDown) await wait(pollIntervalMs)
    } catch (error) {
      lastErrorCode = classifyError(error).code
      if (!shuttingDown) await wait(pollIntervalMs)
    }
  }
  log('info', 'worker_stopped')
}

if (localBridgeEnabled) {
  runLocalBridge()
} else if (runMode === 'service') {
  runService().catch((error) => {
    log('error', 'worker_fatal', { errorCode: classifyError(error).code })
    process.exitCode = 1
  })
} else {
  processNextJob().then((result) => log('info', 'worker_once_finished', result)).catch((error) => {
    log('error', 'worker_once_failed', { errorCode: classifyError(error).code })
    process.exitCode = 1
  })
}
