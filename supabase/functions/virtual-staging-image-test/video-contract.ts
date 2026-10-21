export const SMART_SPACE_VIDEO_CONTRACT_VERSION = 5
export const SMART_SPACE_VIDEO_WIDTH = 720
export const SMART_SPACE_VIDEO_HEIGHT = 1280
export const SMART_SPACE_VIDEO_FRAME_RATE = 25
export const SMART_SPACE_VIDEO_MIME = 'video/mp4'
export const SMART_SPACE_VIDEO_RENDERER = 'creatomate-renderscript'

type StoredStage = { kind?: unknown; label?: unknown; output_path?: unknown }
type StoredResult = {
  action?: unknown
  delivery_status?: unknown
  input_path?: unknown
  stages?: unknown
}

export type SmartSpaceVideoScene = {
  kind: string
  label: string
  storagePath: string
}

export type SmartSpaceVideoPlan = {
  version: 5
  action: string
  durationSeconds: number
  scenes: SmartSpaceVideoScene[]
  marketing: SmartSpaceVideoMarketing
}

export type SmartSpaceVideoMarketing = {
  locale: 'pt-BR' | 'en-US'
  caption: string
  cta: string
  professionalIdentity: string
  phone: string
}

const LABELS: Record<string, string> = {
  original: 'Antes',
  furnish: 'Depois',
  empty_or_nearly_empty: 'Depois',
  remove_furniture: 'Espaço livre',
  free_space: 'Espaço livre',
  new_decoration: 'Nova decoração',
  clear_area: 'Depois',
}

function cleanPath(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const cleanMarketingText = (value: unknown, maximum: number) => typeof value === 'string'
  ? value.trim().replace(/\s{3,}/g, ' ').slice(0, maximum)
  : ''

export function normalizeSmartSpaceVideoMarketing(value: unknown): SmartSpaceVideoMarketing {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    locale: source.locale === 'en-US' ? 'en-US' : 'pt-BR',
    caption: cleanMarketingText(source.caption, 480),
    cta: cleanMarketingText(source.cta, 140),
    professionalIdentity: cleanMarketingText(source.professionalIdentity, 180),
    phone: cleanMarketingText(source.phone, 40),
  }
}

export function buildSmartSpaceVideoPlan(result: StoredResult, marketing: unknown = {}): SmartSpaceVideoPlan | null {
  if (!result || result.delivery_status !== 'completed') return null
  const inputPath = cleanPath(result.input_path)
  const stages = Array.isArray(result.stages) ? result.stages as StoredStage[] : []
  if (!inputPath || ![1, 2].includes(stages.length)) return null

  const scenes: SmartSpaceVideoScene[] = [{ kind: 'original', label: 'Antes', storagePath: inputPath }]
  for (const stage of stages) {
    const storagePath = cleanPath(stage?.output_path)
    if (!storagePath) return null
    const kind = typeof stage.kind === 'string' ? stage.kind : 'result'
    scenes.push({
      kind,
      label: typeof stage.label === 'string' && stage.label.trim() ? stage.label.trim() : LABELS[kind] || 'Depois',
      storagePath,
    })
  }

  return {
    version: SMART_SPACE_VIDEO_CONTRACT_VERSION,
    action: typeof result.action === 'string' ? result.action : '',
    durationSeconds: scenes.length === 3 ? 8 : 6,
    scenes,
    marketing: normalizeSmartSpaceVideoMarketing(marketing),
  }
}

/** A concise campaign video: original and final transformation for every image. */
export function buildSmartSpaceConsolidatedVideoPlan(items: Array<Record<string, unknown>>, marketing: unknown = {}): SmartSpaceVideoPlan | null {
  if (!Array.isArray(items) || items.length < 1 || items.length > 5) return null
  const scenes: SmartSpaceVideoScene[] = []
  // A settled batch can contain failed or partial items. The campaign video is
  // a delivery convenience, so it includes every complete transformation and
  // never prevents those completed results from being delivered.
  const completedItems = items.filter(item => item?.status === 'completed'
    && item?.stage_state === 'completed'
    && item?.result && typeof item.result === 'object'
    && (item.result as StoredResult).delivery_status === 'completed')
  if (!completedItems.length) return null
  for (const item of completedItems.sort((left, right) => Number(left.item_index) - Number(right.item_index))) {
    const result = item?.result && typeof item.result === 'object' ? item.result as StoredResult : null
    if (!result || result.delivery_status !== 'completed') continue
    const inputPath = cleanPath(result.input_path)
    const stages = Array.isArray(result.stages) ? result.stages as StoredStage[] : []
    const finalStage = stages.at(-1)
    const finalPath = cleanPath(finalStage?.output_path)
    if (!inputPath || !finalPath) return null
    const number = Number(item.item_index) + 1
    scenes.push(
      { kind: `original-${number}`, label: 'Before', storagePath: inputPath },
      { kind: `result-${number}`, label: 'After', storagePath: finalPath },
    )
  }
  return {
    version: SMART_SPACE_VIDEO_CONTRACT_VERSION,
    action: 'consolidated_transformation',
    durationSeconds: scenes.length * 2.5,
    scenes,
    marketing: normalizeSmartSpaceVideoMarketing(marketing),
  }
}

export function smartSpaceVideoIdempotencyKey(itemId: string, plan: SmartSpaceVideoPlan) {
  const safeItemId = String(itemId || '').trim()
  if (!safeItemId) throw new Error('smart_space_video_item_id_missing')
  return `smart-space-video:${safeItemId}:v${plan.version}`
}

export function buildSmartSpaceRenderScript(plan: SmartSpaceVideoPlan, sourceUrls: string[]) {
  if (sourceUrls.length !== plan.scenes.length || sourceUrls.some(url => !/^https:\/\//i.test(url))) {
    throw new Error('smart_space_video_sources_invalid')
  }
  const sceneDuration = plan.durationSeconds / plan.scenes.length
  const elements: Record<string, unknown>[] = []

  plan.scenes.forEach((scene, index) => {
    const time = index * sceneDuration
    const transition = [{ time: 0, duration: index === 0 ? 0.3 : 0.45, easing: 'cubic-in-out', type: 'fade', ...(index > 0 ? { transition: true } : {}) }]
    // A blurred version of the same image fills a vertical frame without
    // shrinking the uncropped original into a small card. The foreground stays
    // contain-fit, centered, and fully visible for the Before → After read.
    elements.push({
      type: 'image',
      track: 1,
      time,
      duration: sceneDuration,
      source: sourceUrls[index],
      fit: 'cover',
      x: '50%',
      y: '50%',
      width: '110%',
      height: '110%',
      blur: '5 vmin',
      opacity: '72%',
      animations: transition,
    })
    elements.push({
      type: 'image',
      track: 2,
      time,
      duration: sceneDuration,
      source: sourceUrls[index],
      fit: 'contain',
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      animations: transition,
    })
  })

  const textElements: Record<string, unknown>[] = []
  const addText = (name: string, text: string, time: number, duration: number, y: string, fontSize: string, emphasis = false) => {
    if (!text) return
    textElements.push({
      name,
      type: 'text',
      track: 3,
      z_index: 10,
      time,
      duration,
      x: '50%',
      y,
      width: '88%',
      height: emphasis ? '14%' : '11%',
      x_alignment: '50%',
      y_alignment: '50%',
      text,
      fill_color: '#ffffff',
      font_family: 'Inter',
      font_weight: 700,
      font_size: fontSize,
      line_height: '112%',
      text_wrap: true,
      background_color: emphasis ? 'rgba(5, 30, 18, 0.94)' : 'rgba(5, 30, 18, 0.82)',
      background_x_padding: '14%',
      background_y_padding: '14%',
      background_border_radius: '18%',
      animations: [{ duration: 0.3, easing: 'quadratic-out', type: 'fade' }],
    })
  }
  const closingDuration = Math.min(2.5, plan.durationSeconds)
  const closingTime = Math.max(0, plan.durationSeconds - closingDuration)
  const locale = plan.marketing.locale
  const sceneLabel = (kind: string) => {
    if (kind.startsWith('original')) return locale === 'en-US' ? 'Before' : 'Antes'
    if (kind.includes('free_space')) return locale === 'en-US' ? 'Clear space' : 'Espaço livre'
    return locale === 'en-US' ? 'After' : 'Depois'
  }
  plan.scenes.forEach((scene, index) => addText(`Transformation-Step-${index + 1}`, sceneLabel(scene.kind), index * sceneDuration, Math.min(1.15, sceneDuration), '9%', '3.7 vmin', true))
  // Keep the optional caption in a safe lower area while the imagery changes.
  // The closing card then has dedicated space for CTA, identity, and phone.
  addText('Campaign-Caption', plan.marketing.caption, 0, closingTime, '84%', '4.2 vmin')
  addText('Campaign-CTA', plan.marketing.cta, closingTime, closingDuration, '67%', '5.2 vmin', true)
  addText('Professional-Identity', plan.marketing.professionalIdentity, closingTime, closingDuration, plan.marketing.phone ? '79%' : '84%', '3.7 vmin')
  addText('Professional-Phone', plan.marketing.phone, closingTime, closingDuration, '89%', '3.7 vmin')

  return {
    output_format: 'mp4',
    width: SMART_SPACE_VIDEO_WIDTH,
    height: SMART_SPACE_VIDEO_HEIGHT,
    frame_rate: SMART_SPACE_VIDEO_FRAME_RATE,
    duration: plan.durationSeconds,
    background_color: '#0f172a',
    elements: [...elements, ...textElements],
  }
}

export function estimateSmartSpaceCreatomateCredits(plan: SmartSpaceVideoPlan) {
  return Math.max(1, Math.ceil((SMART_SPACE_VIDEO_WIDTH * SMART_SPACE_VIDEO_HEIGHT * SMART_SPACE_VIDEO_FRAME_RATE * plan.durationSeconds) / 100_000_000))
}
