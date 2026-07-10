import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { renderSmartMotionMainReel } from '../video-renderer.ts'
import { renderSmartMotion } from '../renderer.ts'
import { buildSmartCarouselMessageQueue } from '../smart-carousel-message-queue.ts'
import { resolveSmartCarouselMusic } from '../smart-carousel-music.ts'

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
const bucket = 'studio-videos'
const SMART_VIDEO_MAX_DURATION_SECONDS = 195
const SMART_CAROUSEL_MAX_IMAGES = 20
const targetJobId = String(process.env.SMART_MEDIA_JOB_ID || '').trim()
const localBridgeRequested = process.env.SMART_MEDIA_LOCAL_BRIDGE === '1'
const localBridgeEnabled = localBridgeRequested && process.env.NODE_ENV !== 'production'
const localBridgePort = Number(process.env.SMART_MEDIA_LOCAL_BRIDGE_PORT || 43129)
const localBridgeOrigins = new Set(['http://127.0.0.1:5173'])
if (!url || !serviceKey) throw new Error('SUPABASE_URL_and_SUPABASE_SERVICE_ROLE_KEY_required')
if (localBridgeRequested && !localBridgeEnabled) throw new Error('smart_media_local_bridge_not_allowed_in_production')

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
const rest = async (resource: string, init: RequestInit = {}) => {
  const response = await fetch(`${url}/rest/v1/${resource}`, { ...init, headers: { ...headers, ...init.headers } })
  if (!response.ok) throw new Error(`supabase_${response.status}:${await response.text()}`)
  return response
}

async function updateJob(id: string, values: Record<string, unknown>) {
  await rest(`video_jobs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(values),
  })
}

async function processNextJob(selectedJobId = targetJobId, expectedUserId = '') {
  const response = selectedJobId
    ? await rest(`video_jobs?id=eq.${encodeURIComponent(selectedJobId)}&limit=1&select=*`)
    : await rest('video_jobs?mode=in.(smart_video,smart_carousel)&status=eq.queued&order=created_at.asc&limit=1&select=*')
  const [job] = await response.json() as Array<Record<string, any>>
  if (selectedJobId) {
    if (!job) throw new Error('smart_media_target_job_not_found')
    if (job.status !== 'queued') throw new Error('smart_media_target_job_not_queued')
    if (job.mode !== 'smart_carousel') throw new Error('smart_media_target_job_not_smart_carousel')
    if (expectedUserId && job.user_id !== expectedUserId) throw new Error('smart_media_target_job_owner_mismatch')
  }
  if (!job) return { processed: false }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `smart-video-${job.id}-`))
  try {
    await updateJob(job.id, { status: 'processing', error_message: null })
    const contract = JSON.parse(String(job.prompt_final || '{}'))
    const outputFile = path.join(workDir, 'smart-video.mp4')
    const commercial = contract.commercialCommunication || {}
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
      const music = resolveSmartCarouselMusic(commercial.musicStyle)
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
            volumeLevel: 0.28,
            fadeInSeconds: 1.2,
            fadeOutSeconds: 2,
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

    const outputFolder = job.mode === 'smart_carousel' ? 'super-carrossel' : 'smart-video'
    const outputPath = `${job.user_id}/${outputFolder}/${job.id}/final.mp4`
    const uploadResponse = await fetch(`${url}/storage/v1/object/${bucket}/${outputPath.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
      body: fs.readFileSync(outputFile),
    })
    if (!uploadResponse.ok) throw new Error(`output_upload_failed:${uploadResponse.status}:${await uploadResponse.text()}`)
    await updateJob(job.id, { status: 'completed', output_video_path: outputPath, completed_at: new Date().toISOString() })
    return { processed: true, jobId: job.id, outputPath }
  } catch (error) {
    await updateJob(job.id, { status: 'failed', error_message: error instanceof Error ? error.message.slice(0, 500) : 'smart_video_worker_failed' })
    throw error
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
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

if (localBridgeEnabled) {
  runLocalBridge()
} else {
  processNextJob().then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
