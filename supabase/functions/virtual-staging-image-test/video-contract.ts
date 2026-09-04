export const SMART_SPACE_VIDEO_CONTRACT_VERSION = 4
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
  version: 4
  action: string
  durationSeconds: number
  scenes: SmartSpaceVideoScene[]
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

export function buildSmartSpaceVideoPlan(result: StoredResult): SmartSpaceVideoPlan | null {
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
    // A single centered cover layer fills the vertical canvas without distortion.
    elements.push({
      type: 'image',
      track: 1,
      time,
      duration: sceneDuration,
      source: sourceUrls[index],
      fit: 'cover',
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      animations: transition,
    })
  })

  return {
    output_format: 'mp4',
    width: SMART_SPACE_VIDEO_WIDTH,
    height: SMART_SPACE_VIDEO_HEIGHT,
    frame_rate: SMART_SPACE_VIDEO_FRAME_RATE,
    duration: plan.durationSeconds,
    elements,
  }
}

export function estimateSmartSpaceCreatomateCredits(plan: SmartSpaceVideoPlan) {
  return Math.max(1, Math.ceil((SMART_SPACE_VIDEO_WIDTH * SMART_SPACE_VIDEO_HEIGHT * SMART_SPACE_VIDEO_FRAME_RATE * plan.durationSeconds) / 100_000_000))
}
