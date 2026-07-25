import type { SmartTourStructuredBriefing } from './structured-briefing.ts'

export const SMART_TOUR_CAPTION_RENDER_PREFIX = 'creatomate:'
const RENDER_API = 'https://api.creatomate.com/v2/renders'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonRecord = Record<string, unknown>
type CaptionRenderStatus =
  | { status: 'processing' }
  | { status: 'completed'; url: string }
  | { status: 'failed'; errorMessage: string }

const cleanRenderId = (value: unknown) => {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!UUID_PATTERN.test(id)) throw new Error('smart_tour_caption_render_id_invalid')
  return id
}

export function encodeSmartTourCaptionRenderId(renderId: string) {
  return `${SMART_TOUR_CAPTION_RENDER_PREFIX}${cleanRenderId(renderId)}`
}

export function decodeSmartTourCaptionRenderId(value: string) {
  if (!value.startsWith(SMART_TOUR_CAPTION_RENDER_PREFIX)) return null
  return cleanRenderId(value.slice(SMART_TOUR_CAPTION_RENDER_PREFIX.length))
}

export function hasDeterministicSmartTourText(briefing: SmartTourStructuredBriefing) {
  return briefing.legendas.ativas && briefing.cenas.some(scene => Boolean(scene.legenda))
}

export function parseSmartTourStructuredBriefing(value: unknown): SmartTourStructuredBriefing {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid')
    const briefing = parsed as SmartTourStructuredBriefing
    if (briefing.versao !== 'smart-tour-structured-briefing-v1' || !Array.isArray(briefing.cenas)) throw new Error('invalid')
    if (briefing.cenas.length !== briefing.configuracoes?.quantidadeImagens) throw new Error('invalid')
    return briefing
  } catch {
    throw new Error('smart_tour_caption_briefing_invalid')
  }
}

export function buildSmartTourCaptionRenderScript(videoUrl: string, briefing: SmartTourStructuredBriefing) {
  if (!/^https:\/\//i.test(videoUrl)) throw new Error('smart_tour_caption_video_url_invalid')
  const duration = briefing.configuracoes.duracaoSegundos
  const sceneDuration = duration / Math.max(1, briefing.cenas.length)
  const captionElements = briefing.cenas.flatMap((scene, index) => {
    if (!scene.legenda) return []
    const isClosing = scene.tipo === 'encerramento'
    return [{
      name: `Smart-Tour-Caption-${scene.numero}`,
      type: 'text',
      track: 2,
      time: index * sceneDuration,
      duration: sceneDuration,
      x: '50%',
      y: isClosing ? '79%' : '82%',
      width: '88%',
      height: isClosing ? '18%' : '14%',
      x_alignment: '50%',
      y_alignment: '50%',
      text: scene.legenda,
      fill_color: '#ffffff',
      font_family: 'Inter',
      font_weight: 700,
      font_size: isClosing ? '5.8 vmin' : '4.8 vmin',
      line_height: '112%',
      text_wrap: true,
      background_color: isClosing ? 'rgba(5, 30, 18, 0.94)' : 'rgba(5, 30, 18, 0.86)',
      background_x_padding: '16%',
      background_y_padding: '16%',
      background_border_radius: '18%',
    }]
  })

  return {
    output_format: 'mp4',
    width: 720,
    height: 1280,
    frame_rate: 24,
    duration,
    elements: [
      {
        name: 'Gemini-Generated-Video',
        type: 'video',
        track: 1,
        time: 0,
        duration,
        source: videoUrl,
        fit: 'cover',
        volume: '100%',
      },
      ...captionElements,
    ],
  }
}

async function creatomateFetch(apiKey: string, path: string, init: RequestInit = {}) {
  if (!apiKey) throw new Error('smart_tour_caption_missing_environment')
  const response = await fetch(`${RENDER_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const body = await response.json().catch(() => null) as JsonRecord | JsonRecord[] | null
  if (!response.ok) throw new Error(`smart_tour_caption_api_failed:${response.status}`)
  return body
}

export async function startSmartTourCaptionRender(apiKey: string, videoUrl: string, briefing: SmartTourStructuredBriefing) {
  const body = await creatomateFetch(apiKey, '', {
    method: 'POST',
    body: JSON.stringify(buildSmartTourCaptionRenderScript(videoUrl, briefing)),
  })
  const render = Array.isArray(body) ? body[0] : body
  return { renderId: cleanRenderId(render?.id) }
}

export async function checkSmartTourCaptionRender(apiKey: string, renderId: string): Promise<CaptionRenderStatus> {
  const body = await creatomateFetch(apiKey, `/${encodeURIComponent(cleanRenderId(renderId))}`, { method: 'GET' })
  const render = Array.isArray(body) ? body[0] : body
  const status = String(render?.status || '').toLowerCase()
  if (['planned', 'waiting', 'transcribing', 'rendering'].includes(status)) return { status: 'processing' }
  if (status === 'succeeded' && typeof render?.url === 'string' && /^https:\/\//i.test(render.url)) {
    return { status: 'completed', url: render.url }
  }
  return { status: 'failed', errorMessage: String(render?.error_message || `smart_tour_caption_${status || 'unknown'}`).slice(0, 400) }
}

export async function downloadSmartTourCaptionRender(url: string) {
  if (!/^https:\/\//i.test(url)) throw new Error('smart_tour_caption_video_url_invalid')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`smart_tour_caption_download_failed:${response.status}`)
  return { videoBytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'video/mp4' }
}
