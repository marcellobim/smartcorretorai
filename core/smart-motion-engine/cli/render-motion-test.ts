#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSmartMotion } from '../renderer.ts'
import type { SmartMotionInput, SmartVisualModelId } from '../schema.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const engineRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(engineRoot, '..', '..')
const pocRoot = path.join(repoRoot, 'experiments', 'slideshow-poc')
const outputDir = path.join(engineRoot, 'output')
const visualModelRuns: Array<{ id: SmartVisualModelId; slug: string }> = [
  { id: 'clean_showcase', slug: 'clean-showcase' },
  { id: 'social_impact', slug: 'social-impact' },
  { id: 'luxury_soft', slug: 'luxury-soft' },
  { id: 'rental_direct', slug: 'rental-direct' },
]

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function buildDefaultInput(visualModelId: SmartVisualModelId, slug: string): SmartMotionInput {
  const preferredSlides = path.join(pocRoot, 'input', 'alto-padrao-01', 'slides.json')
  const fallbackSlides = path.join(pocRoot, 'input', 'slides.json')
  const slidesFile = fs.existsSync(preferredSlides) ? preferredSlides : fallbackSlides
  const imagesDir = slidesFile.includes(`${path.sep}alto-padrao-01${path.sep}`)
    ? path.join(pocRoot, 'input', 'alto-padrao-01', 'images')
    : path.join(pocRoot, 'input', 'images')
  const config = loadJson(slidesFile)
  const slides = Array.isArray(config.slides) ? config.slides : []
  const selectedSlides = slides.slice(0, 6)

  return {
    outputType: 'motion_video',
    visualModelId,
    outputPath: path.join(outputDir, `${slug}.mp4`),
    reportPath: path.join(outputDir, `${slug}-report.json`),
    musicPath: path.join(pocRoot, 'input', 'audio', 'music.mp3'),
    cta: config.cta || 'Agende sua visita',
    ctaEnabled: true,
    captionsEnabled: true,
    scenes: selectedSlides.map((slide: Record<string, unknown>, index: number) => ({
      imagePath: path.join(imagesDir, String(slide.image || '')),
      caption: String(slide.caption || ''),
    })),
  }
}

function buildInputFromFile(inputPath: string): SmartMotionInput {
  const absoluteInput = path.resolve(process.cwd(), inputPath)
  const payload = loadJson(absoluteInput)
  const inputDir = path.dirname(absoluteInput)
  const resolveMaybeRelative = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return value
    return path.isAbsolute(value) ? value : path.resolve(inputDir, value)
  }

  return {
    ...payload,
    outputType: payload.outputType || 'motion_video',
    outputPath: payload.outputPath ? String(resolveMaybeRelative(payload.outputPath)) : path.join(outputDir, 'test-motion.mp4'),
    reportPath: payload.reportPath ? String(resolveMaybeRelative(payload.reportPath)) : path.join(outputDir, 'test-motion-report.json'),
    musicPath: payload.musicPath ? String(resolveMaybeRelative(payload.musicPath)) : undefined,
    scenes: Array.isArray(payload.scenes)
      ? payload.scenes.map((scene: Record<string, unknown>) => ({
          ...scene,
          imagePath: String(resolveMaybeRelative(scene.imagePath)),
        }))
      : [],
  }
}

async function main() {
  const results = []

  if (process.argv[2]) {
    const result = await renderSmartMotion(buildInputFromFile(process.argv[2]))
    results.push(result.report)
  } else {
    for (const model of visualModelRuns) {
      const result = await renderSmartMotion(buildDefaultInput(model.id, model.slug))
      results.push(result.report)
    }
  }

  console.log(JSON.stringify({
    ok: true,
    outputs: results.map((report) => ({
      visualModelId: report.visualModelId,
      outputPath: report.outputPath,
      reportPath: report.reportPath,
      durationSeconds: report.durationSeconds,
      width: report.width,
      height: report.height,
      fps: report.fps,
      musicApplied: report.musicApplied,
      warnings: report.warnings,
    })),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
