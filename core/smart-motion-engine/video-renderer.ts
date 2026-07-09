import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { StudioHeroBrainSmartMotionContract, StudioHeroMotionCut } from './studio-hero-motion/contract.ts'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type SmartMotionVideoCutInput = {
  id: string
  startSeconds: number
  endSeconds: number
  label?: string
}

export type SmartMotionMainReelRenderInput = {
  sourceVideoPath: string
  cuts: SmartMotionVideoCutInput[]
  outputPath: string
  width?: number
  height?: number
  fps?: number
}

export type SmartMotionMainReelRenderResult = {
  outputPath: string
  sourceVideoPath: string
  cutCount: number
  totalDurationSeconds: number
  ffmpegPath: string
  smartClips: {
    status: 'planned'
    message: string
  }
}

export type SmartMotionVideoRenderDemoInput = {
  sourceVideoPath: string
  outputPath: string
}

function resolveFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH

  try {
    return require('ffmpeg-static')
  } catch {
    const repoRoot = path.resolve(__dirname, '..', '..')
    const pocFfmpeg = path.join(repoRoot, 'experiments', 'slideshow-poc', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    if (fs.existsSync(pocFfmpeg)) return pocFfmpeg
    return 'ffmpeg'
  }
}

function runFfmpeg(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`smart_motion_video_render_failed:${code}:${stderr.slice(-1200)}`))
      }
    })
  })
}

function assertValidRenderInput(input: SmartMotionMainReelRenderInput) {
  if (!input || typeof input !== 'object') throw new Error('video_render_input_required')
  if (!input.sourceVideoPath || typeof input.sourceVideoPath !== 'string') throw new Error('source_video_path_required')
  if (!fs.existsSync(input.sourceVideoPath)) throw new Error(`source_video_not_found:${input.sourceVideoPath}`)
  if (!input.outputPath || typeof input.outputPath !== 'string') throw new Error('output_path_required')
  if (!Array.isArray(input.cuts) || input.cuts.length < 1) throw new Error('at_least_one_cut_required')

  input.cuts.forEach((cut, index) => {
    if (!cut?.id || typeof cut.id !== 'string') throw new Error(`cut_${index + 1}_id_required`)
    if (typeof cut.startSeconds !== 'number' || cut.startSeconds < 0) throw new Error(`cut_${index + 1}_start_required`)
    if (typeof cut.endSeconds !== 'number' || cut.endSeconds <= cut.startSeconds) throw new Error(`cut_${index + 1}_end_must_be_after_start`)
  })
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

function normalizeContractCut(cut: StudioHeroMotionCut): SmartMotionVideoCutInput {
  return {
    id: cut.id,
    startSeconds: cut.sourceStartSeconds,
    endSeconds: cut.sourceEndSeconds,
    label: cut.label,
  }
}

function buildSegmentArgs(input: {
  sourceVideoPath: string
  cut: SmartMotionVideoCutInput
  outputPath: string
  width: number
  height: number
  fps: number
}) {
  const durationSeconds = input.cut.endSeconds - input.cut.startSeconds

  return [
    '-y',
    '-ss', String(input.cut.startSeconds),
    '-t', String(durationSeconds),
    '-i', input.sourceVideoPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-vf', `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
    '-r', String(input.fps),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    input.outputPath,
  ]
}

export function createMainReelRenderInputFromContract(input: {
  contract: StudioHeroBrainSmartMotionContract
  sourceVideoPath: string
  outputPath: string
}): SmartMotionMainReelRenderInput {
  return {
    sourceVideoPath: input.sourceVideoPath,
    outputPath: input.outputPath,
    cuts: input.contract.mainReel.cuts.map(normalizeContractCut),
  }
}

export async function renderSmartMotionMainReel(input: SmartMotionMainReelRenderInput): Promise<SmartMotionMainReelRenderResult> {
  assertValidRenderInput(input)

  const width = Math.round(input.width || 1080)
  const height = Math.round(input.height || 1920)
  const fps = Math.round(input.fps || 30)
  const ffmpegPath = resolveFfmpegPath()
  const outputDir = path.dirname(input.outputPath)
  fs.mkdirSync(outputDir, { recursive: true })

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-motion-video-render-'))
  const concatListPath = path.join(workDir, 'main-reel-clips.txt')

  try {
    const segmentPaths: string[] = []
    for (const [index, cut] of input.cuts.entries()) {
      const segmentPath = path.join(workDir, `segment-${String(index + 1).padStart(2, '0')}.mp4`)
      await runFfmpeg(ffmpegPath, buildSegmentArgs({
        sourceVideoPath: input.sourceVideoPath,
        cut,
        outputPath: segmentPath,
        width,
        height,
        fps,
      }))
      segmentPaths.push(segmentPath)
    }

    const concatList = segmentPaths.map((segmentPath) => `file '${escapeConcatPath(segmentPath)}'`).join('\n')
    fs.writeFileSync(concatListPath, `${concatList}\n`, 'utf8')

    await runFfmpeg(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      input.outputPath,
    ])

    return {
      outputPath: input.outputPath,
      sourceVideoPath: input.sourceVideoPath,
      cutCount: input.cuts.length,
      totalDurationSeconds: input.cuts.reduce((total, cut) => total + (cut.endSeconds - cut.startSeconds), 0),
      ffmpegPath,
      smartClips: {
        status: 'planned',
        message: 'Smart clips usam a mesma base de cortes e serao renderizados em uma fase futura.',
      },
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

export function createSmartMotionVideoRendererDemoInput(
  demo: SmartMotionVideoRenderDemoInput,
): SmartMotionMainReelRenderInput {
  return {
    sourceVideoPath: demo.sourceVideoPath,
    outputPath: demo.outputPath,
    cuts: [
      { id: 'demo-vista-livre', label: 'Vista livre', startSeconds: 4, endSeconds: 11 },
      { id: 'demo-sala-integrada', label: 'Sala integrada', startSeconds: 14, endSeconds: 24 },
      { id: 'demo-cozinha', label: 'Cozinha', startSeconds: 29, endSeconds: 38 },
      { id: 'demo-varanda', label: 'Varanda', startSeconds: 43, endSeconds: 53 },
      { id: 'demo-cta-final', label: 'CTA final', startSeconds: 58, endSeconds: 64 },
    ],
  }
}
