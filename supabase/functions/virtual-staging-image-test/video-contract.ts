export const SMART_SPACE_VIDEO_CONTRACT_VERSION = 2
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
  version: 2
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
    // The cover layer fills the vertical canvas with colors from the approved photo.
    // The contain layer remains untouched and fully visible above that ambient background.
    elements.push({
      type: 'image',
      track: 1,
      time,
      duration: sceneDuration,
      source: sourceUrls[index],
      fit: 'cover',
      x_scale: '112%',
      y_scale: '112%',
      blur_radius: 34,
      blur_mode: 'box-2',
      color_overlay: 'rgba(15,23,42,0.42)',
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
      y: '47%',
      width: '92%',
      height: '76%',
      border_radius: '2.2 vmin',
      shadow_color: 'rgba(2,6,23,0.48)',
      shadow_blur: '3.5 vmin',
      shadow_y: '1.2 vmin',
      animations: transition,
    })
    elements.push({
      type: 'text',
      track: 3,
      time,
      duration: sceneDuration,
      text: 'SMART SPACE',
      x: '50%',
      y: '8%',
      width: '70%',
      height: '4%',
      x_alignment: '50%',
      y_alignment: '50%',
      fill_color: '#a7f3d0',
      font_family: 'Inter',
      font_weight: '700',
      font_size: '2.6 vmin',
      animations: transition,
    })
    elements.push({
      type: 'text',
      track: 4,
      time,
      duration: sceneDuration,
      text: scene.label,
      x: '50%',
      y: '88%',
      width: '72%',
      height: '7%',
      x_alignment: '50%',
      y_alignment: '50%',
      fill_color: '#ffffff',
      font_family: 'Inter',
      font_weight: '700',
      font_size: '4.6 vmin',
      background_color: 'rgba(15,23,42,0.88)',
      background_x_padding: '11%',
      background_y_padding: '12%',
      background_border_radius: '28%',
      stroke_color: 'rgba(52,211,153,0.72)',
      stroke_width: '0.22 vmin',
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
