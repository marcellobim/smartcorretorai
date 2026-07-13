import { escapeFfmpegFilterPath } from './sanitize.ts'

export type CommercialTypographyLayout = {
  focus: string
  support: string
  focusFirst: boolean
  accentEligible: boolean
}

export type CommercialTypographyFilterInput = {
  layout: CommercialTypographyLayout
  focusFile: string
  supportFile?: string
  fontFile: string
  startSeconds: number
  endSeconds: number
  useAccent: boolean
  placement?: 'standard' | 'cta'
}

const ACCENT_BLUE = '0x61D6FF'
const OBJECTIVES = ['PARA LOCAÇÃO', 'À VENDA']
const CTA_WORDS = new Set(['AGENDE', 'FALE', 'CONHECA', 'RECEBA', 'SOLICITE'])
const FEATURE_WORDS = new Set([
  'AREA',
  'DORMITORIO',
  'DORMITORIOS',
  'FINANCIAMENTO',
  'GOURMET',
  'LAZER',
  'METRO',
  'SUITE',
  'SUITES',
  'VAGA',
  'VAGAS',
  'VARANDA',
])

function comparisonKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
}

function normalizeMessage(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

export function createCommercialTypographyLayout(value: string): CommercialTypographyLayout {
  const message = normalizeMessage(value)
  if (!message) return { focus: '', support: '', focusFirst: true, accentEligible: false }

  for (const objective of OBJECTIVES) {
    const index = message.indexOf(objective)
    if (index >= 0) {
      const support = `${message.slice(0, index)} ${message.slice(index + objective.length)}`.replace(/\s+/g, ' ').trim()
      return {
        focus: objective,
        support,
        focusFirst: index === 0,
        accentEligible: true,
      }
    }
  }

  const words = message.split(' ').filter(Boolean)
  const first = words[0]
  const support = words.slice(1).join(' ')
  const numeric = /^\d+(?:[.,]\d+)?\+?$/.test(first)
  const firstKey = comparisonKey(first)
  const singleWord = words.length === 1 && message.length <= 18

  if (!numeric && !CTA_WORDS.has(firstKey) && !FEATURE_WORDS.has(firstKey)) {
    const featureIndex = words.findIndex((word) => FEATURE_WORDS.has(comparisonKey(word)))
    if (featureIndex > 0) {
      return {
        focus: words[featureIndex],
        support: words.filter((_, index) => index !== featureIndex).join(' '),
        focusFirst: false,
        accentEligible: true,
      }
    }
  }

  return {
    focus: first,
    support,
    focusFirst: true,
    accentEligible: numeric || CTA_WORDS.has(firstKey) || FEATURE_WORDS.has(firstKey) || singleWord,
  }
}

function alphaExpression(startSeconds: number, endSeconds: number) {
  const fadeInEnd = Math.min(endSeconds, startSeconds + 0.30)
  const fadeOutStart = Math.max(startSeconds, endSeconds - 0.30)
  return `if(lt(t\\,${startSeconds.toFixed(2)})\\,0\\,if(lt(t\\,${fadeInEnd.toFixed(2)})\\,(t-${startSeconds.toFixed(2)})/${Math.max(0.01, fadeInEnd - startSeconds).toFixed(2)}\\,if(lt(t\\,${fadeOutStart.toFixed(2)})\\,1\\,max(0\\,(${endSeconds.toFixed(2)}-t)/${Math.max(0.01, endSeconds - fadeOutStart).toFixed(2)}))))`
}

function slideExpression(input: {
  startSeconds: number
  endSeconds: number
  targetX: number
  direction: 'left' | 'right'
}) {
  const enterEnd = Math.min(input.endSeconds, input.startSeconds + (input.direction === 'left' ? 0.46 : 0.52))
  const exitStart = Math.max(input.startSeconds, input.endSeconds - (input.direction === 'left' ? 0.42 : 0.36))
  const enterDuration = Math.max(0.01, enterEnd - input.startSeconds).toFixed(2)
  const exitDuration = Math.max(0.01, input.endSeconds - exitStart).toFixed(2)

  if (input.direction === 'left') {
    return `if(lt(t\\,${enterEnd.toFixed(2)})\\,-tw-60+((t-${input.startSeconds.toFixed(2)})/${enterDuration})*(tw+${input.targetX + 60})\\,if(lt(t\\,${exitStart.toFixed(2)})\\,${input.targetX}\\,${input.targetX}-((t-${exitStart.toFixed(2)})/${exitDuration})*(tw+${input.targetX + 60})))`
  }

  return `if(lt(t\\,${enterEnd.toFixed(2)})\\,w+60-((t-${input.startSeconds.toFixed(2)})/${enterDuration})*(w-tw-${input.targetX})\\,if(lt(t\\,${exitStart.toFixed(2)})\\,${input.targetX}\\,${input.targetX}+((t-${exitStart.toFixed(2)})/${exitDuration})*(w+60)))`
}

function buildLine(input: {
  textFile: string
  fontFile: string
  fontSize: number
  isFocus: boolean
  useAccent: boolean
  x: string
  y: string
  alpha: string
  enable: string
}) {
  const base = [
    `drawtext=fontfile='${escapeFfmpegFilterPath(input.fontFile)}'`,
    `textfile='${escapeFfmpegFilterPath(input.textFile)}'`,
    `fontcolor=${input.isFocus && input.useAccent ? '0x101010' : 'white'}`,
    `fontsize=${input.fontSize}`,
    'line_spacing=4',
  ]

  if (input.isFocus && input.useAccent) {
    base.push(`box=1`, `boxcolor=${ACCENT_BLUE}@0.96`, 'boxborderw=18')
  } else {
    base.push(
      `borderw=${input.isFocus ? 4 : 3}`,
      'bordercolor=black@0.72',
      'shadowx=3',
      'shadowy=4',
      'shadowcolor=black@0.42',
    )
  }

  base.push(`x='${input.x}'`, `y=${input.y}`, `alpha='${input.alpha}'`, input.enable)
  return base.join(':')
}

export function buildCommercialTypographyFilters(input: CommercialTypographyFilterInput) {
  const start = Math.max(0, input.startSeconds)
  const end = Math.max(start + 0.1, input.endSeconds)
  const enable = `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
  const alpha = alphaExpression(start, end)
  const hasSupport = Boolean(input.layout.support && input.supportFile)
  const cta = input.placement === 'cta'
  const firstY = hasSupport ? (cta ? 'h-650' : 'h-540') : (cta ? 'h-500' : 'h-430')
  const secondY = cta ? 'h-430' : 'h-365'
  const underlineY = cta ? 'h-150' : 'h-205'
  const focusSize = input.layout.focus.length > 12 ? 94 : 108
  const supportSize = input.layout.support.length > 28 ? 62 : input.layout.support.length > 18 ? 72 : 82
  const useAccent = input.useAccent && input.layout.accentEligible
  const firstIsFocus = input.layout.focusFirst || !hasSupport
  const firstFile = firstIsFocus ? input.focusFile : input.supportFile!
  const secondFile = firstIsFocus ? input.supportFile : input.focusFile
  const filters = [
    buildLine({
      textFile: firstFile,
      fontFile: input.fontFile,
      fontSize: firstIsFocus ? focusSize : supportSize,
      isFocus: firstIsFocus,
      useAccent,
      x: slideExpression({ startSeconds: start, endSeconds: end, targetX: 82, direction: 'left' }),
      y: firstY,
      alpha,
      enable,
    }),
  ]

  if (hasSupport && secondFile) {
    filters.push(buildLine({
      textFile: secondFile,
      fontFile: input.fontFile,
      fontSize: firstIsFocus ? supportSize : focusSize,
      isFocus: !firstIsFocus,
      useAccent,
      x: slideExpression({ startSeconds: start, endSeconds: end, targetX: 132, direction: 'right' }),
      y: secondY,
      alpha,
      enable,
    }))
  }

  const lineStart = Math.min(end, start + 0.28)
  const lineEnd = Math.min(end, lineStart + 0.70)
  const lineDuration = Math.max(0.01, lineEnd - lineStart).toFixed(2)
  filters.push(
    `drawbox=x=82:y=${underlineY}:w='if(lt(t\\,${lineStart.toFixed(2)})\\,0\\,min(620\\,((t-${lineStart.toFixed(2)})/${lineDuration})*620))':h=7:color=white@0.90:t=fill:${enable}`,
  )

  return filters
}
