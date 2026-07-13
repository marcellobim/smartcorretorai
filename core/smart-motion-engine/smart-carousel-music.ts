import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SMART_CAROUSEL_MUSIC_STYLES = ['Moderna', 'Calma', 'Sofisticada', 'Animada', 'Instrumental'] as const
export type SmartCarouselMusicStyle = typeof SMART_CAROUSEL_MUSIC_STYLES[number]

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY = path.join(__dirname, 'assets', 'music')
const FALLBACK_STYLE: SmartCarouselMusicStyle = 'Instrumental'
const STYLE_TRACK_FILES: Record<SmartCarouselMusicStyle, string> = {
  Moderna: 'instrumental.m4a',
  Calma: 'instrumental.m4a',
  Sofisticada: 'instrumental.m4a',
  Animada: 'instrumental.m4a',
  Instrumental: 'instrumental.m4a',
}

type ResolverOptions = {
  isReadableFile?: (filePath: string) => boolean
}

function styleKey(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function normalizeStyle(value: unknown): SmartCarouselMusicStyle | undefined {
  const requested = styleKey(value)
  return SMART_CAROUSEL_MUSIC_STYLES.find((style) => styleKey(style) === requested)
}

function isInsideDirectory(filePath: string, directory: string) {
  const relative = path.relative(directory, filePath)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function defaultIsReadableFile(filePath: string) {
  try {
    const assetsDirectory = fs.realpathSync(SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY)
    const realFile = fs.realpathSync(filePath)
    const stat = fs.statSync(realFile)
    return isInsideDirectory(realFile, assetsDirectory) && stat.isFile() && stat.size > 0
  } catch {
    return false
  }
}

function resolveStylePath(style: SmartCarouselMusicStyle, isReadableFile: (filePath: string) => boolean) {
  const candidate = path.resolve(SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY, STYLE_TRACK_FILES[style])
  if (!isInsideDirectory(candidate, SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY)) return undefined
  if (!['.m4a', '.mp3', '.wav', '.aac'].includes(path.extname(candidate).toLowerCase())) return undefined
  return isReadableFile(candidate) ? candidate : undefined
}

export function resolveSmartCarouselMusic(value: unknown, options: ResolverOptions = {}) {
  const requestedStyle = normalizeStyle(value)
  const selectedStyle = requestedStyle || FALLBACK_STYLE
  const isReadableFile = options.isReadableFile || defaultIsReadableFile
  const selectedPath = resolveStylePath(selectedStyle, isReadableFile)

  if (selectedPath) {
    return {
      requestedStyle: String(value || ''),
      resolvedStyle: selectedStyle,
      musicPath: selectedPath,
      usedFallback: !requestedStyle,
    }
  }

  const fallbackPath = selectedStyle === FALLBACK_STYLE
    ? undefined
    : resolveStylePath(FALLBACK_STYLE, isReadableFile)
  return {
    requestedStyle: String(value || ''),
    resolvedStyle: FALLBACK_STYLE,
    musicPath: fallbackPath,
    usedFallback: true,
  }
}
