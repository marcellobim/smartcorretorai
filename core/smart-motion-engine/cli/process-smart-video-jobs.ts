import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { renderSmartMotionMainReel } from '../video-renderer.ts'

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
const bucket = 'studio-videos'
const SMART_VIDEO_MAX_DURATION_SECONDS = 195
if (!url || !serviceKey) throw new Error('SUPABASE_URL_and_SUPABASE_SERVICE_ROLE_KEY_required')

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

async function processNextJob() {
  const response = await rest('video_jobs?mode=eq.smart_video&status=eq.queued&order=created_at.asc&limit=1&select=*')
  const [job] = await response.json() as Array<Record<string, any>>
  if (!job) return { processed: false }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `smart-video-${job.id}-`))
  try {
    await updateJob(job.id, { status: 'processing', error_message: null })
    const contract = JSON.parse(String(job.prompt_final || '{}'))
    const sourcePath = String(contract.video?.storagePath || '')
    const sourceDuration = Number(contract.video?.durationSeconds || 0)
    if (!sourcePath.startsWith(`${job.user_id}/smart-video/`) || sourceDuration <= 0 || sourceDuration > SMART_VIDEO_MAX_DURATION_SECONDS) {
      throw new Error('smart_video_contract_invalid')
    }

    const sourceResponse = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${sourcePath.split('/').map(encodeURIComponent).join('/')}`, { headers })
    if (!sourceResponse.ok) throw new Error(`source_download_failed:${sourceResponse.status}`)
    const sourceFile = path.join(workDir, `source.${sourcePath.split('.').pop() || 'mp4'}`)
    fs.writeFileSync(sourceFile, Buffer.from(await sourceResponse.arrayBuffer()))

    const outputFile = path.join(workDir, 'smart-video.mp4')
    const commercial = contract.commercialCommunication || {}
    await updateJob(job.id, { status: 'rendering' })
    await renderSmartMotionMainReel({
      sourceVideoPath: sourceFile,
      outputPath: outputFile,
      cuts: [{ id: 'source-video', startSeconds: 0, endSeconds: sourceDuration }],
      finishing: {
        backgroundMusic: { enabled: true, source: 'internal_placeholder', volumeMode: 'auto', volumeLevel: 0.06 },
        commercialCommunication: {
          enabled: true,
          renderNow: true,
          dealType: commercial.dealType === 'Locação' ? 'PARA LOCAÇÃO' : 'À VENDA',
          propertyType: String(commercial.propertyType || 'Imóvel'),
          highlights: Array.isArray(commercial.highlights) ? commercial.highlights.slice(0, 3) : [],
          cta: String(commercial.cta || 'Entre em contato'),
          phone: commercial.phone ? String(commercial.phone) : undefined,
        },
      },
    })

    const outputPath = `${job.user_id}/smart-video/${job.id}/final.mp4`
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

processNextJob().then((result) => console.log(JSON.stringify(result))).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
