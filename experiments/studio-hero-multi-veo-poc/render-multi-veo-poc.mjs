#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')
const outputDir = path.join(__dirname, 'output')
const clipsDir = path.join(outputDir, 'clips')
const reportPath = path.join(outputDir, 'report.json')
const finalVideoPath = path.join(outputDir, 'final-multi-veo.mp4')
const defaultConfigPath = path.join(__dirname, 'sample-config.json')
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_VEO_MODEL = 'veo-3.1-lite-generate-preview'

function parseArgs(argv) {
  const args = {
    configPath: defaultConfigPath,
    run: false,
    dryRun: true,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--run') {
      args.run = true
      args.dryRun = false
    } else if (arg === '--dry-run') {
      args.run = false
      args.dryRun = true
    } else if (arg === '--config') {
      args.configPath = path.resolve(process.cwd(), argv[index + 1] || '')
      index += 1
    }
  }

  return args
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function normalizeText(value, maxLength = 500) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function resolveLocalPath(value, baseDir) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  return path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean)
}

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  const localFfmpeg = path.join(repoRoot, 'experiments', 'slideshow-poc', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (fs.existsSync(localFfmpeg)) return localFfmpeg
  return 'ffmpeg'
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`command_failed:${code}:${stderr.slice(-1200)}`))
    })
  })
}

const FONT_5X7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function writeSolidPng(filePath, width, height, background, draw) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < width; x += 1) {
      const index = rowStart + 1 + x * 3
      raw[index] = background[0]
      raw[index + 1] = background[1]
      raw[index + 2] = background[2]
    }
  }

  const putPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const index = y * (width * 3 + 1) + 1 + x * 3
    raw[index] = color[0]
    raw[index + 1] = color[1]
    raw[index + 2] = color[2]
  }

  const fillRect = (x, y, w, h, color) => {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) putPixel(xx, yy, color)
    }
  }

  draw?.({ fillRect, putPixel, width, height })

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  header[10] = 0
  header[11] = 0
  header[12] = 0

  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND'),
  ]))
}

function drawBlockText(ctx, text, x, y, scale, color) {
  let cursorX = x
  for (const char of text.toUpperCase()) {
    const glyph = FONT_5X7[char] || FONT_5X7[' ']
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === '1') {
          ctx.fillRect(cursorX + col * scale, y + row * scale, scale - 1, scale - 1, color)
        }
      }
    }
    cursorX += 6 * scale
  }
}

function createCtaFrame(ctaText) {
  const filePath = path.join(outputDir, 'cta-frame.png')
  const text = normalizeText(ctaText || 'Agende sua visita', 22)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
  writeSolidPng(filePath, 720, 1280, [17, 24, 39], (ctx) => {
    ctx.fillRect(60, 430, 600, 300, [8, 13, 24])
    ctx.fillRect(60, 430, 600, 5, [240, 244, 248])
    const scale = text.length > 16 ? 14 : 17
    const textWidth = text.length * 6 * scale
    drawBlockText(ctx, text, Math.max(40, Math.round((720 - textWidth) / 2)), 540, scale, [255, 255, 255])
    drawBlockText(ctx, 'SMARTCORRETORAI', 154, 695, 9, [203, 213, 225])
  })
  return filePath
}

function createEmptyFrame() {
  const filePath = path.join(outputDir, 'empty-frame.png')
  writeSolidPng(filePath, 720, 1280, [15, 23, 42])
  return filePath
}

function buildStudioHeroBasePrompt(propertyFacts) {
  const dadosLimpos = normalizeText(propertyFacts, 500)
  const prompt = `ROLE

You are an award-winning director of real estate commercials.

MISSION

Create a short cinematic commercial that makes people stop scrolling and want to know more.

PROPERTY

Use the uploaded image as the visual reference.

Use the property facts naturally in a fluent Brazilian Portuguese narration.

Property facts:
${dadosLimpos}

Never narrate in English.

EMOTIONAL ATMOSPHERE

Create an elegant, premium and emotionally engaging commercial.

If the environment is empty, you may enrich it naturally while preserving the architecture.

If already furnished, preserve the existing furniture and decoration.

Do not use people.

Do not use logos.

Do not use watermarks.

Surprise the viewer.`

  if (prompt.includes('{') || prompt.includes('}')) throw new Error('prompt_placeholder_detected')
  return prompt
}

function detectMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  throw new Error(`unsupported_image_type:${filePath}`)
}

function imageToVeoPart(filePath) {
  return {
    mimeType: detectMimeType(filePath),
    bytesBase64Encoded: fs.readFileSync(filePath).toString('base64'),
  }
}

function withApiKey(url, apiKey) {
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
}

function buildModelUrl(modelId, method, apiKey) {
  return withApiKey(`${GEMINI_API_BASE}/models/${modelId}:${method}`, apiKey)
}

function buildOperationUrl(operationName, apiKey) {
  const clean = operationName.replace(/^\/+/, '')
  if (/^https?:\/\//i.test(clean)) return withApiKey(clean, apiKey)
  return withApiKey(`${GEMINI_API_BASE}/${clean}`, apiKey)
}

function findStringByKey(value, keys) {
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys)
      if (found) return found
    }
    return ''
  }
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key) && typeof nested === 'string' && nested.trim()) return nested.trim()
    const found = findStringByKey(nested, keys)
    if (found) return found
  }
  return ''
}

async function startVeoPair(pair, config, prompt) {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const modelId = process.env.VEO_MODEL_ID || DEFAULT_VEO_MODEL
  const endpoint = buildModelUrl(modelId, 'predictLongRunning', apiKey)
  const instance = {
    prompt,
    image: imageToVeoPart(pair.fromImage),
    lastFrame: imageToVeoPart(pair.toImage),
  }
  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: config.aspectRatio || '9:16',
      durationSeconds: Number(config.durationSeconds || 8),
      resolution: config.resolution || '720p',
      sampleCount: 1,
    },
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`veo_start_failed:${response.status}:${text.slice(0, 240)}`)
  }
  const data = await response.json()
  const providerJobId = typeof data.name === 'string' ? data.name : ''
  if (!providerJobId) throw new Error('veo_provider_job_empty')
  return providerJobId
}

async function fetchVideoUri(uri, apiKey) {
  if (uri.startsWith('gs://')) throw new Error('video_uri_requires_signed_download')
  const response = await fetch(withApiKey(uri, apiKey), {
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`video_download_failed:${response.status}:${text.slice(0, 160)}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function pollVeoJob(providerJobId, config) {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const endpoint = buildOperationUrl(providerJobId, apiKey)
  const maxAttempts = Number(config.maxPollAttempts || 80)
  const intervalMs = Number(config.pollIntervalMs || 15000)
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(endpoint)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`veo_status_failed:${response.status}:${text.slice(0, 160)}`)
    }
    const data = await response.json()
    if (data.done === false || (!data.done && !data.response && !data.error) || data.metadata?.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      continue
    }
    if (data.error) throw new Error(String(data.error.message || data.error.code || 'veo_job_failed').slice(0, 500))

    const videoBase64 = findStringByKey(data, new Set(['videoBytes', 'video_bytes', 'bytesBase64', 'bytesBase64Encoded', 'base64']))
    if (videoBase64) return Buffer.from(videoBase64.includes(',') ? videoBase64.split(',').pop() : videoBase64, 'base64')

    const videoUri = findStringByKey(data, new Set(['videoUri', 'video_uri', 'gcsUri', 'gcs_uri', 'uri']))
    if (videoUri) return fetchVideoUri(videoUri, apiKey)

    throw new Error('video_result_missing')
  }
  throw new Error('veo_poll_timeout')
}

async function concatClips(ffmpeg, clips, targetFile) {
  const listPath = path.join(outputDir, 'concat-list.txt')
  const lines = clips.map((clip) => `file '${clip.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
  fs.writeFileSync(listPath, `${lines.join('\n')}\n`, 'utf8')
  await run(ffmpeg, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    targetFile,
  ])
}

async function main() {
  const args = parseArgs(process.argv)
  const configPath = path.resolve(process.cwd(), args.configPath)
  const configDir = path.dirname(configPath)
  const config = readJson(configPath)

  ensureDir(outputDir)
  ensureDir(clipsDir)

  const warnings = []
  const errors = []
  const imagePaths = (Array.isArray(config.images) ? config.images : [])
    .map((image) => resolveLocalPath(image, configDir))
    .filter(Boolean)

  if (imagePaths.length < 1) throw new Error('at_least_one_image_required')
  for (const imagePath of imagePaths) {
    if (!fs.existsSync(imagePath)) throw new Error(`image_not_found:${imagePath}`)
  }

  const prompt = buildStudioHeroBasePrompt(config.propertyFacts || '')
  const useCta = config.useCta !== false && Boolean(normalizeText(config.cta, 48))
  const finalFramePath = useCta
    ? createCtaFrame(config.cta)
    : createEmptyFrame()
  const finalFrameKind = useCta ? 'cta' : 'empty'

  const pairs = imagePaths.map((fromImage, index) => {
    const nextImage = imagePaths[index + 1] || finalFramePath
    return {
      index: index + 1,
      fromImage,
      toImage: nextImage,
      finalPairKind: index === imagePaths.length - 1 ? finalFrameKind : 'image',
      providerJobId: null,
      clipPath: path.join(clipsDir, `clip-${String(index + 1).padStart(2, '0')}.mp4`),
      durationSeconds: Number(config.durationSeconds || 8),
      status: 'planned',
      error: null,
    }
  })

  const environment = {
    veoEnabled: process.env.VEO_ENABLED === 'true',
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    modelId: process.env.VEO_MODEL_ID || DEFAULT_VEO_MODEL,
  }

  if (!args.run) warnings.push('dry_run_no_veo_jobs_started')
  if (args.run && !environment.veoEnabled) warnings.push('veo_disabled_by_flag')
  if (args.run && !environment.hasGeminiApiKey) warnings.push('missing_gemini_api_key')

  if (args.run && environment.veoEnabled && environment.hasGeminiApiKey) {
    for (const pair of pairs) {
      try {
        pair.status = 'starting'
        pair.providerJobId = await startVeoPair(pair, config, prompt)
        pair.status = 'processing'
        const videoBytes = await pollVeoJob(pair.providerJobId, config)
        fs.writeFileSync(pair.clipPath, videoBytes)
        pair.status = 'completed'
      } catch (error) {
        pair.status = 'failed'
        pair.error = error instanceof Error ? error.message : String(error)
        errors.push({ pairIndex: pair.index, error: pair.error })
      }
    }

    const completedClips = pairs.filter((pair) => pair.status === 'completed').map((pair) => pair.clipPath)
    if (completedClips.length === pairs.length) {
      const ffmpeg = resolveFfmpegPath()
      await concatClips(ffmpeg, completedClips, finalVideoPath)
    } else {
      warnings.push('final_concat_skipped_missing_completed_clips')
    }
  }

  const report = {
    poc: 'studio-hero-multi-veo-poc',
    generatedAt: new Date().toISOString(),
    mode: args.run ? 'run' : 'dry-run',
    configPath,
    environment,
    imagesUsed: imagePaths,
    useCta,
    finalFrameKind,
    finalFramePath,
    prompt,
    pairs: pairs.map((pair) => ({
      index: pair.index,
      fromImage: pair.fromImage,
      toImage: pair.toImage,
      finalPairKind: pair.finalPairKind,
      providerJobId: pair.providerJobId,
      clipPath: pair.clipPath,
      durationSeconds: pair.durationSeconds,
      status: pair.status,
      error: pair.error,
    })),
    finalVideoPath: fs.existsSync(finalVideoPath) ? finalVideoPath : null,
    warnings,
    errors,
  }

  writeJson(reportPath, report)
  console.log(JSON.stringify({
    ok: errors.length === 0,
    mode: report.mode,
    pairs: report.pairs.length,
    finalVideoPath: report.finalVideoPath,
    reportPath,
    warnings,
    errors,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
