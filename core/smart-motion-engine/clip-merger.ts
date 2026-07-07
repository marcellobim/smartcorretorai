import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type StudioHeroMotionClipMergeInput = {
  clipPaths: string[]
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
        reject(new Error(`ffmpeg_merge_failed:${code}:${stderr.slice(-1200)}`))
      }
    })
  })
}

function assertReadableClip(clipPath: string, index: number) {
  if (!clipPath || typeof clipPath !== 'string') {
    throw new Error(`clip_${index + 1}_path_required`)
  }
  if (!fs.existsSync(clipPath)) {
    throw new Error(`clip_${index + 1}_not_found:${clipPath}`)
  }
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

export async function mergeStudioHeroMotionClips(input: StudioHeroMotionClipMergeInput) {
  const clipPaths = Array.isArray(input.clipPaths) ? input.clipPaths : []
  if (clipPaths.length < 1) throw new Error('at_least_one_clip_required')
  if (!input.outputPath) throw new Error('output_path_required')

  clipPaths.forEach(assertReadableClip)
  fs.mkdirSync(path.dirname(input.outputPath), { recursive: true })

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-hero-motion-merge-'))
  const concatListPath = path.join(workDir, 'clips.txt')
  const concatList = clipPaths.map((clipPath) => `file '${escapeConcatPath(path.resolve(clipPath))}'`).join('\n')
  fs.writeFileSync(concatListPath, `${concatList}\n`, 'utf8')

  try {
    const ffmpeg = resolveFfmpegPath()
    await run(ffmpeg, [
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
      clipCount: clipPaths.length,
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}
