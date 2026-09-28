import type { ShortVideosStructuredBriefing, SmartTourStructuredBriefing } from './structured-briefing.ts'

export const SMART_TOUR_CAPTION_RENDER_PREFIX = 'creatomate:'
const RENDER_API = 'https://api.creatomate.com/v2/renders'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonRecord = Record<string, unknown>
type SmartTourComposableBriefing = SmartTourStructuredBriefing | ShortVideosStructuredBriefing
export type SmartTourCaptionPlan = {
  durationSeconds: 10
  blocks: Array<{ bloco: number; inicioSegundos: number; fimSegundos: number; texto: string; isClosing: boolean; isProfessionalIdentity?: boolean }>
}
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

export function hasDeterministicSmartTourText(briefing: SmartTourComposableBriefing) {
  const timedText = [
    ...(briefing.timeline?.legendas || []),
    ...(briefing.timeline?.cta ? [briefing.timeline.cta] : []),
    ...(briefing.timeline?.identificacaoProfissional ? [briefing.timeline.identificacaoProfissional] : []),
  ]
  return timedText.some(block => Boolean(block.texto)) || briefing.cenas.some(scene => Boolean(scene.legenda))
}

export function parseSmartTourStructuredBriefing(value: unknown): SmartTourComposableBriefing {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid')
    const briefing = parsed as SmartTourComposableBriefing
    if (!['smart-tour-structured-briefing-v1', 'short-videos-structured-briefing-v1'].includes(briefing.versao) || !Array.isArray(briefing.cenas)) throw new Error('invalid')
    if (briefing.versao === 'smart-tour-structured-briefing-v1' && briefing.cenas.length !== briefing.configuracoes?.quantidadeImagens) throw new Error('invalid')
    if (briefing.versao === 'short-videos-structured-briefing-v1' && (briefing.configuracoes?.quantidadeVideos !== 1 || briefing.cenas.length !== 1)) throw new Error('invalid')
    if (briefing.timeline) {
      const blocks = [...briefing.timeline.legendas, ...briefing.timeline.narracao, briefing.timeline.cta, ...(briefing.timeline.identificacaoProfissional ? [briefing.timeline.identificacaoProfissional] : [])]
      const validBlock = (block: { inicioSegundos: number; fimSegundos: number }) =>
        Number.isFinite(block.inicioSegundos) && Number.isFinite(block.fimSegundos) &&
        block.inicioSegundos >= 0 && block.fimSegundos > block.inicioSegundos && block.fimSegundos <= 10
      if (
        briefing.timeline.duracaoTotalSegundos !== 10 ||
        briefing.timeline.legendas.length !== 4 ||
        briefing.timeline.narracao.length !== 5 ||
        briefing.timeline.cta.inicioSegundos !== 8 ||
        briefing.timeline.cta.fimSegundos !== 10 ||
        !blocks.every(validBlock)
      ) throw new Error('invalid')
    }
    return briefing
  } catch {
    throw new Error('smart_tour_caption_briefing_invalid')
  }
}

export function buildSmartTourCaptionRenderScript(videoUrl: string, briefing: SmartTourComposableBriefing, controlledPlan?: SmartTourCaptionPlan) {
  if (!/^https:\/\//i.test(videoUrl)) throw new Error('smart_tour_caption_video_url_invalid')
  const duration = controlledPlan?.durationSeconds || briefing.configuracoes.duracaoSegundos
  const sceneDuration = duration / Math.max(1, briefing.cenas.length)
  const legacyTextBlocks = briefing.cenas.map((scene, index) => ({
    bloco: scene.numero,
    inicioSegundos: index * sceneDuration,
    fimSegundos: (index + 1) * sceneDuration,
    texto: scene.legenda,
    isClosing: scene.tipo === 'encerramento',
  }))
  const timedTextBlocks = controlledPlan?.blocks || (briefing.timeline
    ? [
        ...briefing.timeline.legendas.map(block => ({ ...block, isClosing: false })),
        { ...briefing.timeline.cta, isClosing: true },
        ...(briefing.timeline.identificacaoProfissional ? [{ ...briefing.timeline.identificacaoProfissional, isClosing: false, isProfessionalIdentity: true }] : []),
      ]
    : legacyTextBlocks)
  const captionElements = timedTextBlocks.flatMap(block => {
    if (!block.texto) return []
    const blockDuration = block.fimSegundos - block.inicioSegundos
    if (block.inicioSegundos < 0 || blockDuration <= 0 || block.fimSegundos > duration) throw new Error('smart_tour_caption_timeline_invalid')
    const isClosing = block.isClosing
    const isProfessionalIdentity = Boolean(block.isProfessionalIdentity)
    const isControlledClosing = Boolean(controlledPlan) && isClosing
    return [{
      name: isProfessionalIdentity ? 'Smart-Tour-Professional-Identity' : `Smart-Tour-Caption-${block.bloco}`,
      type: 'text',
      track: isProfessionalIdentity ? 3 : 2,
      time: block.inicioSegundos,
      duration: blockDuration,
      x: '50%',
      y: isProfessionalIdentity ? '16%' : isControlledClosing ? '50%' : isClosing ? '79%' : '82%',
      width: isProfessionalIdentity ? '74%' : '88%',
      height: isProfessionalIdentity ? '9%' : isControlledClosing ? '70%' : isClosing ? '18%' : '14%',
      x_alignment: '50%',
      y_alignment: '50%',
      text: block.texto,
      fill_color: '#ffffff',
      font_family: 'Inter',
      font_weight: isProfessionalIdentity ? 600 : 700,
      font_size: isProfessionalIdentity ? '3.1 vmin' : isClosing ? '5.8 vmin' : '4.8 vmin',
      line_height: '112%',
      text_wrap: true,
      background_color: isProfessionalIdentity ? 'rgba(5, 30, 18, 0.72)' : isClosing ? 'rgba(5, 30, 18, 0.94)' : 'rgba(5, 30, 18, 0.86)',
      background_x_padding: isProfessionalIdentity ? '9%' : '16%',
      background_y_padding: isProfessionalIdentity ? '8%' : '16%',
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

export async function startSmartTourCaptionRender(apiKey: string, videoUrl: string, briefing: SmartTourComposableBriefing, controlledPlan?: SmartTourCaptionPlan) {
  const body = await creatomateFetch(apiKey, '', {
    method: 'POST',
    body: JSON.stringify(buildSmartTourCaptionRenderScript(videoUrl, briefing, controlledPlan)),
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
