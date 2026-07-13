import { escapeFfmpegFilterPath } from './sanitize.ts'

export type CommercialTypographyLayout = {
  lines: string[]
}

export type CommercialTypographyFilterInput = {
  layout: CommercialTypographyLayout
  lineFiles: string[]
  fontFile: string
  startSeconds: number
  endSeconds: number
}

const ACCENT_BLUE = '0x61D6FF'
const BLUE_LINE_MAX_WIDTH = 930

function normalizeLine(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

function blueLineFontSize(text: string) {
  const characters = Array.from(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  const widthUnits = characters.reduce((total, character) => {
    if (character === ' ') return total + 0.35
    if (character === 'I') return total + 0.35
    if (character === 'M' || character === 'W') return total + 0.95
    return total + 0.65
  }, 0)
  return Math.min(124, Math.max(62, Math.floor(BLUE_LINE_MAX_WIDTH / Math.max(1, widthUnits))))
}

export function createCommercialTypographyLayout(value: string | string[]): CommercialTypographyLayout {
  const providedLines = Array.isArray(value) ? value : String(value || '').split(/\r?\n/)
  return {
    lines: providedLines.map(normalizeLine).filter(Boolean).slice(0, 2),
  }
}

function alphaExpression(startSeconds: number, endSeconds: number) {
  const fadeInEnd = Math.min(endSeconds, startSeconds + 0.38)
  const fadeOutStart = Math.max(startSeconds, endSeconds - 0.38)
  return `if(lt(t\\,${startSeconds.toFixed(2)})\\,0\\,if(lt(t\\,${fadeInEnd.toFixed(2)})\\,(t-${startSeconds.toFixed(2)})/${Math.max(0.01, fadeInEnd - startSeconds).toFixed(2)}\\,if(lt(t\\,${fadeOutStart.toFixed(2)})\\,1\\,max(0\\,(${endSeconds.toFixed(2)}-t)/${Math.max(0.01, endSeconds - fadeOutStart).toFixed(2)}))))`
}

function slideExpression(input: {
  startSeconds: number
  endSeconds: number
  targetX: number
  direction: 'left' | 'right'
}) {
  const enterDurationSeconds = input.direction === 'left' ? 0.46 : 0.52
  const exitDurationSeconds = input.direction === 'left' ? 0.42 : 0.36
  const enterEnd = Math.min(input.endSeconds, input.startSeconds + enterDurationSeconds)
  const exitStart = Math.max(input.startSeconds, input.endSeconds - exitDurationSeconds)
  const enterDuration = Math.max(0.01, enterEnd - input.startSeconds).toFixed(2)
  const exitDuration = Math.max(0.01, input.endSeconds - exitStart).toFixed(2)

  if (input.direction === 'left') {
    return `if(lt(t\\,${enterEnd.toFixed(2)})\\,-tw-60+((t-${input.startSeconds.toFixed(2)})/${enterDuration})*(tw+${input.targetX + 60})\\,if(lt(t\\,${exitStart.toFixed(2)})\\,${input.targetX}\\,${input.targetX}-((t-${exitStart.toFixed(2)})/${exitDuration})*(tw+${input.targetX + 60})))`
  }

  return `if(lt(t\\,${enterEnd.toFixed(2)})\\,w+60-((t-${input.startSeconds.toFixed(2)})/${enterDuration})*(w-tw-${input.targetX})\\,if(lt(t\\,${exitStart.toFixed(2)})\\,${input.targetX}\\,${input.targetX}+((t-${exitStart.toFixed(2)})/${exitDuration})*(w+60)))`
}

function buildWhiteLine(input: {
  textFile: string
  fontFile: string
  x: string
  alpha: string
  enable: string
}) {
  return [
    `drawtext=fontfile='${escapeFfmpegFilterPath(input.fontFile)}'`,
    `textfile='${escapeFfmpegFilterPath(input.textFile)}'`,
    'fontcolor=white',
    'fontsize=106',
    'borderw=5',
    'bordercolor=black@0.78',
    'shadowx=8',
    'shadowy=10',
    'shadowcolor=black@0.55',
    `x='${input.x}'`,
    'y=1250',
    `alpha='${input.alpha}'`,
    input.enable,
  ].join(':')
}

function buildBlueLine(input: {
  textFile: string
  text: string
  fontFile: string
  x: string
  alpha: string
  enable: string
}) {
  return [
    `drawtext=fontfile='${escapeFfmpegFilterPath(input.fontFile)}'`,
    `textfile='${escapeFfmpegFilterPath(input.textFile)}'`,
    'fontcolor=0x101010',
    `fontsize=${blueLineFontSize(input.text)}`,
    'box=1',
    `boxcolor=${ACCENT_BLUE}@0.96`,
    'boxborderw=18',
    'borderw=0',
    `x='${input.x}'`,
    'y=1395',
    `alpha='${input.alpha}'`,
    input.enable,
  ].join(':')
}

export function buildCommercialTypographyFilters(input: CommercialTypographyFilterInput) {
  const start = Math.max(0, input.startSeconds)
  const end = Math.max(start + 0.1, input.endSeconds)
  const enable = `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
  const alpha = alphaExpression(start, end)
  const lines = input.layout.lines.slice(0, 2)
  const files = input.lineFiles.slice(0, lines.length)
  if (!lines.length || !files.length) return []

  const firstX = slideExpression({ startSeconds: start, endSeconds: end, targetX: 82, direction: 'left' })
  const secondX = slideExpression({ startSeconds: start, endSeconds: end, targetX: 132, direction: 'right' })
  const filters = lines.length > 1 && files[1]
    ? [
        buildWhiteLine({ textFile: files[0], fontFile: input.fontFile, x: firstX, alpha, enable }),
        buildBlueLine({ textFile: files[1], text: lines[1], fontFile: input.fontFile, x: secondX, alpha, enable }),
      ]
    : [buildBlueLine({ textFile: files[0], text: lines[0], fontFile: input.fontFile, x: secondX, alpha, enable })]

  filters.push(
    `drawbox=x=82:y=1571:w='min(640\\,max(0\\,(t-${(start + 0.28).toFixed(2)})*960))':h=8:color=white@0.96:t=fill:${enable}`,
  )

  return filters
}
