import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { SmartMotionInput, SmartMotionPlan, SmartMotionRenderResult } from './schema.ts'
import { createSmartMotionPlan } from './planner.ts'
import { buildCrossfadeArgs, buildEncodeArgs, buildMusicArgs, buildSceneFilter } from './ffmpeg-builder.ts'
import { createSmartMotionReport } from './report.ts'
import { sanitizeText, wrapText } from './sanitize.ts'
import { createCommercialTypographyLayout } from './commercial-typography.ts'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function run(command: string, args: string[]) {
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
        reject(new Error(`ffmpeg_failed:${code}:${stderr.slice(-1200)}`))
      }
    })
  })
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

function resolveFontFile(): string {
  const candidates = [
    'C:/Windows/Fonts/ariblk.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial Black.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]
}

function writeTextFile(workDir: string, name: string, text: string, maxLineChars: number) {
  const file = path.join(workDir, name)
  const safeText = wrapText(text, maxLineChars, 3)
  fs.writeFileSync(file, safeText, 'utf8')
  return file
}

function assertReadableImages(plan: SmartMotionPlan) {
  for (const [index, scene] of plan.scenes.entries()) {
    if (!fs.existsSync(scene.imagePath)) {
      throw new Error(`scene_${index + 1}_image_not_found:${scene.imagePath}`)
    }
  }
}

async function createSceneSegment(input: {
  ffmpeg: string
  plan: SmartMotionPlan
  sceneIndex: number
  workDir: string
  fontFile: string
}) {
  const { ffmpeg, plan, sceneIndex, workDir, fontFile } = input
  const scene = plan.scenes[sceneIndex]
  const caption = scene.kind === 'cta'
    ? sanitizeText(scene.caption, 48).toUpperCase()
    : scene.caption
  const typography = createCommercialTypographyLayout(caption)
  const prefix = `caption-${String(sceneIndex + 1).padStart(2, '0')}`
  const focusFile = writeTextFile(workDir, `${prefix}-focus.txt`, typography.focus, 16)
  const supportFile = typography.support
    ? writeTextFile(workDir, `${prefix}-support.txt`, typography.support, scene.kind === 'cta' ? 18 : 20)
    : undefined
  const outputSegment = path.join(workDir, `segment-${String(sceneIndex + 1).padStart(2, '0')}.mp4`)
  const filter = buildSceneFilter({
    scene,
    plan,
    fontFile,
    typography: {
      layout: typography,
      focusFile,
      supportFile,
      useAccent: scene.kind === 'cta' || sceneIndex === 1 || (sceneIndex > 0 && sceneIndex % 2 === 0),
    },
  })

  await run(ffmpeg, [
    '-y',
    '-loop', '1',
    '-i', scene.imagePath,
    '-t', String(scene.durationSeconds),
    '-vf', filter,
    ...buildEncodeArgs(outputSegment, plan),
  ])

  return {
    file: outputSegment,
    durationSeconds: scene.durationSeconds,
    transition: scene.transition,
  }
}

export async function renderSmartMotion(input: SmartMotionInput): Promise<SmartMotionRenderResult> {
  const plan = createSmartMotionPlan(input)
  assertReadableImages(plan)

  const outputDir = path.dirname(plan.outputPath)
  ensureDir(outputDir)
  if (plan.reportPath) ensureDir(path.dirname(plan.reportPath))

  const ffmpeg = resolveFfmpegPath()
  const fontFile = resolveFontFile()
  const workDir = path.join(os.tmpdir(), `smart-motion-engine-${process.pid}-${Date.now()}`)
  ensureDir(workDir)

  let musicApplied = false
  try {
    const segments = []
    for (let index = 0; index < plan.scenes.length; index += 1) {
      segments.push(await createSceneSegment({ ffmpeg, plan, sceneIndex: index, workDir, fontFile }))
    }

    const noAudioOutput = path.join(workDir, 'smart-motion-no-audio.mp4')
    await run(ffmpeg, buildCrossfadeArgs({
      segments,
      targetFile: noAudioOutput,
      transitionSeconds: plan.transitionSeconds,
    }))

    if (plan.musicPath && fs.existsSync(plan.musicPath)) {
      const durationSeconds = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0)
        - Math.max(0, plan.scenes.length - 1) * plan.transitionSeconds
      await run(ffmpeg, buildMusicArgs({
        videoFile: noAudioOutput,
        musicFile: plan.musicPath,
        outputFile: plan.outputPath,
        durationSeconds,
      }))
      musicApplied = true
    } else {
      fs.copyFileSync(noAudioOutput, plan.outputPath)
    }

    const report = createSmartMotionReport({
      plan,
      outputPath: plan.outputPath,
      reportPath: plan.reportPath,
      ffmpegPath: ffmpeg,
      musicApplied,
    })

    if (plan.reportPath) {
      fs.writeFileSync(plan.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    }

    return {
      outputPath: plan.outputPath,
      reportPath: plan.reportPath,
      report,
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}
