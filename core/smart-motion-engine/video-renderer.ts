import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { StudioHeroBrainSmartMotionContract, StudioHeroMotionCut, StudioHeroMotionFinishingPlan } from './studio-hero-motion/contract.ts'

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
  finishing?: StudioHeroMotionFinishingPlan
}

export type SmartMotionMainReelRenderResult = {
  outputPath: string
  sourceVideoPath: string
  cutCount: number
  totalDurationSeconds: number
  ffmpegPath: string
  finishing: {
    backgroundMusicApplied: boolean
    backgroundMusicSource?: string
    musicVolumeLevel?: number
    ctaStatus: 'planned_not_rendered' | 'not_configured'
    captionsStatus: 'planned_not_rendered' | 'not_configured'
  }
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

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0.08
  return Math.min(0.3, Math.max(0.02, value))
}

function resolveMusicVolume(finishing?: StudioHeroMotionFinishingPlan) {
  const music = finishing?.backgroundMusic
  if (!music?.enabled) return 0
  if (music.volumeMode === 'fixed' && typeof music.volumeLevel === 'number') {
    return clampVolume(music.volumeLevel)
  }
  return clampVolume(music.volumeLevel ?? 0.08)
}

function buildGeneratedMusicFilter(durationSeconds: number) {
  return [
    `sine=frequency=196:sample_rate=44100:duration=${durationSeconds}`,
    'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo',
  ].join(',')
}

function buildMusicFinishingArgs(input: {
  videoFile: string
  outputFile: string
  musicFile?: string
  musicVolume: number
  durationSeconds: number
  fadeInSeconds: number
  fadeOutSeconds: number
}) {
  const args = ['-y', '-i', input.videoFile]
  if (input.musicFile) {
    args.push('-stream_loop', '-1', '-i', input.musicFile)
  } else {
    args.push('-f', 'lavfi', '-i', buildGeneratedMusicFilter(input.durationSeconds))
  }

  const fadeOutStart = Math.max(0, input.durationSeconds - input.fadeOutSeconds)
  const filters = [
    `[1:a]volume=${input.musicVolume.toFixed(3)},afade=t=in:st=0:d=${input.fadeInSeconds.toFixed(2)},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${input.fadeOutSeconds.toFixed(2)}[music]`,
    `[0:a]volume=1.0[voice]`,
    '[voice][music]amix=inputs=2:duration=first:dropout_transition=0[aout]',
  ]

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '0:v:0',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    input.outputFile,
  )

  return args
}

async function applyFinishingLayer(input: {
  ffmpegPath: string
  baseVideoPath: string
  outputPath: string
  finishing?: StudioHeroMotionFinishingPlan
  durationSeconds: number
}) {
  const music = input.finishing?.backgroundMusic
  if (!music?.enabled) {
    fs.copyFileSync(input.baseVideoPath, input.outputPath)
    return {
      backgroundMusicApplied: false,
      backgroundMusicSource: undefined,
      musicVolumeLevel: undefined,
    }
  }

  const musicFile = music.source === 'file' && music.filePath && fs.existsSync(music.filePath)
    ? music.filePath
    : undefined
  const musicVolume = resolveMusicVolume(input.finishing)

  await runFfmpeg(input.ffmpegPath, buildMusicFinishingArgs({
    videoFile: input.baseVideoPath,
    outputFile: input.outputPath,
    musicFile,
    musicVolume,
    durationSeconds: input.durationSeconds,
    fadeInSeconds: music.fadeInSeconds ?? 1.2,
    fadeOutSeconds: music.fadeOutSeconds ?? 2.2,
  }))

  return {
    backgroundMusicApplied: true,
    backgroundMusicSource: musicFile || 'internal_placeholder',
    musicVolumeLevel: musicVolume,
  }
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
    finishing: input.contract.mainReel.finishing,
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

    const baseOutputPath = path.join(workDir, 'main-reel-base.mp4')

    await runFfmpeg(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      baseOutputPath,
    ])

    const totalDurationSeconds = input.cuts.reduce((total, cut) => total + (cut.endSeconds - cut.startSeconds), 0)
    const finishingResult = await applyFinishingLayer({
      ffmpegPath,
      baseVideoPath: baseOutputPath,
      outputPath: input.outputPath,
      finishing: input.finishing,
      durationSeconds: totalDurationSeconds,
    })

    return {
      outputPath: input.outputPath,
      sourceVideoPath: input.sourceVideoPath,
      cutCount: input.cuts.length,
      totalDurationSeconds,
      ffmpegPath,
      finishing: {
        ...finishingResult,
        ctaStatus: input.finishing?.cta?.enabled ? 'planned_not_rendered' : 'not_configured',
        captionsStatus: input.finishing?.captions?.enabled ? 'planned_not_rendered' : 'not_configured',
      },
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
