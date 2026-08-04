import type { ShortVideosStructuredBriefing } from './structured-briefing.ts'
import type { SmartTourCaptionPlan } from './caption-compositor.ts'

export const SHORT_VIDEOS_NO_GENERATED_TEXT_RULE = 'Não gerar, desenhar, inventar ou sobrepor qualquer texto, legenda, título, número, telefone, CTA, logotipo textual ou caractere no vídeo.'

export function buildShortVideosCleanGeminiPrompt(briefing: ShortVideosStructuredBriefing) {
  const narration = briefing.configuracoes.narracaoAtiva
    ? briefing.timeline.narracao.map(block => block.texto).filter(Boolean).join(' ').trim()
    : ''
  return JSON.stringify({
    versao: 'short-videos-clean-gemini-prompt-v1',
    tarefa: briefing.tarefa,
    configuracoes: {
      formato: briefing.configuracoes.formato,
      duracaoSegundos: briefing.configuracoes.duracaoSegundos,
      idioma: briefing.configuracoes.idioma,
      narracaoAtiva: briefing.configuracoes.narracaoAtiva,
    },
    edicaoVisual: {
      fonte: 'usar somente o vídeo original recebido',
      objetivo: 'Selecionar os melhores trechos e criar cortes, ritmo, movimento e composição visual para um Short imobiliário limpo.',
      preservarTextosFisicosOriginais: true,
      removerTextosFisicosOriginais: false,
    },
    narracaoSomenteAudio: narration,
    regrasObrigatorias: [
      SHORT_VIDEOS_NO_GENERATED_TEXT_RULE,
      'A narração, quando fornecida, é somente áudio e nunca deve ser desenhada, legendada ou convertida em caracteres visuais.',
      'Não criar placas artificiais, títulos, legendas, hashtags, marcas d’água ou telas de CTA.',
      'Preservar textos reais que já existam fisicamente no imóvel ou na gravação original.',
      'Manter o áudio e a narração conforme o comportamento atual; não adicionar música.',
    ],
    regrasPreservacao: briefing.regrasPreservacao,
  })
}

const quantity = (value: string, singular: string, plural: string) => {
  const cleaned = String(value || '').trim()
  if (!cleaned || Number(cleaned) === 0) return ''
  return `${cleaned} ${cleaned === '1' ? singular : plural}`
}

function objectiveDetails(briefing: ShortVideosStructuredBriefing) {
  const property = briefing.imovel
  return [
    quantity(property.dormitorios, 'dormitório', 'dormitórios'),
    quantity(property.suites, 'suíte', 'suítes'),
    quantity(property.vagas, 'vaga', 'vagas'),
    property.area ? `${property.area}${/m(?:²|2)$/i.test(property.area) ? '' : ' m²'}` : '',
    property.tipo,
    property.preco,
    property.estadoDoImovel,
    ...property.destaques,
  ].filter(Boolean).slice(0, 3)
}

export function buildShortVideosCaptionPlan(briefing: ShortVideosStructuredBriefing): SmartTourCaptionPlan {
  const blocks: SmartTourCaptionPlan['blocks'] = []
  const opening = briefing.timeline.legendas[0]?.texto.trim() || ''
  if (opening) blocks.push({ bloco: 1, inicioSegundos: 0.4, fimSegundos: 2.8, texto: opening, isClosing: false })

  if (briefing.configuracoes.legendasAtivas) {
    const details = objectiveDetails(briefing)
    if (details.length) blocks.push({ bloco: 2, inicioSegundos: 3.2, fimSegundos: 6, texto: details.join(' • '), isClosing: false })
  }

  const ctaText = [briefing.cta.titulo, briefing.cta.telefone].filter(Boolean).join('\n')
  if (ctaText) blocks.push({ bloco: 3, inicioSegundos: 8, fimSegundos: 10, texto: ctaText, isClosing: true })

  return { durationSeconds: 10, blocks }
}

type Mp4Track = {
  handler: string
  codec: string
  durationSeconds: number
  width: number
  height: number
  fps: number
}

type Box = { type: string; start: number; dataStart: number; end: number }

const readType = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4))
const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

function boxesIn(bytes: Uint8Array, start: number, end: number): Box[] {
  const view = viewOf(bytes)
  const boxes: Box[] = []
  let offset = start
  while (offset + 8 <= end) {
    let size = view.getUint32(offset)
    const type = readType(bytes, offset + 4)
    let header = 8
    if (size === 1) {
      if (offset + 16 > end) break
      const large = Number(view.getBigUint64(offset + 8))
      if (!Number.isSafeInteger(large)) break
      size = large
      header = 16
    } else if (size === 0) {
      size = end - offset
    }
    if (size < header || offset + size > end) break
    boxes.push({ type, start: offset, dataStart: offset + header, end: offset + size })
    offset += size
  }
  return boxes
}

const child = (bytes: Uint8Array, box: Box, type: string) => boxesIn(bytes, box.dataStart, box.end).find(item => item.type === type)

function parseTrack(bytes: Uint8Array, track: Box): Mp4Track | null {
  const view = viewOf(bytes)
  const tkhd = child(bytes, track, 'tkhd')
  const mdia = child(bytes, track, 'mdia')
  if (!tkhd || !mdia) return null
  const hdlr = child(bytes, mdia, 'hdlr')
  const mdhd = child(bytes, mdia, 'mdhd')
  const minf = child(bytes, mdia, 'minf')
  const stbl = minf && child(bytes, minf, 'stbl')
  const stsd = stbl && child(bytes, stbl, 'stsd')
  const stts = stbl && child(bytes, stbl, 'stts')
  if (!hdlr || !mdhd || !stsd) return null

  const handler = readType(bytes, hdlr.dataStart + 8)
  const version = bytes[mdhd.dataStart]
  const timescaleOffset = mdhd.dataStart + (version === 1 ? 20 : 12)
  const durationOffset = mdhd.dataStart + (version === 1 ? 24 : 16)
  const timescale = view.getUint32(timescaleOffset)
  const duration = version === 1 ? Number(view.getBigUint64(durationOffset)) : view.getUint32(durationOffset)
  const durationSeconds = timescale ? duration / timescale : 0
  const codec = readType(bytes, stsd.dataStart + 12)
  const width = view.getUint32(tkhd.end - 8) / 65536
  const height = view.getUint32(tkhd.end - 4) / 65536
  let sampleCount = 0
  if (stts && stts.dataStart + 8 <= stts.end) {
    const entryCount = view.getUint32(stts.dataStart + 4)
    let offset = stts.dataStart + 8
    for (let index = 0; index < entryCount && offset + 8 <= stts.end; index += 1, offset += 8) sampleCount += view.getUint32(offset)
  }
  return { handler, codec, durationSeconds, width, height, fps: durationSeconds ? sampleCount / durationSeconds : 0 }
}

export function validateShortVideosFinalMp4(bytes: Uint8Array, contentType = 'video/mp4') {
  if (bytes.byteLength < 1024) throw new Error('short_video_final_mp4_empty')
  if (!/^(?:video\/mp4|application\/octet-stream)(?:;|$)/i.test(contentType)) throw new Error('short_video_final_mp4_content_type_invalid')
  const top = boxesIn(bytes, 0, bytes.byteLength)
  const ftyp = top.find(box => box.type === 'ftyp')
  const moov = top.find(box => box.type === 'moov')
  const mdat = top.find(box => box.type === 'mdat')
  if (!ftyp || !moov || !mdat) throw new Error('short_video_final_mp4_container_invalid')
  const tracks = boxesIn(bytes, moov.dataStart, moov.end).filter(box => box.type === 'trak').map(track => parseTrack(bytes, track)).filter(Boolean) as Mp4Track[]
  const video = tracks.find(track => track.handler === 'vide')
  const audio = tracks.find(track => track.handler === 'soun')
  if (!video || !['avc1', 'avc3'].includes(video.codec)) throw new Error('short_video_final_mp4_video_codec_invalid')
  if (video.width !== 720 || video.height !== 1280) throw new Error('short_video_final_mp4_dimensions_invalid')
  if (Math.abs(video.fps - 24) > 0.5) throw new Error('short_video_final_mp4_fps_invalid')
  if (video.durationSeconds < 9.5 || video.durationSeconds > 10.5) throw new Error('short_video_final_mp4_duration_invalid')
  if (audio && audio.codec !== 'mp4a') throw new Error('short_video_final_mp4_audio_codec_invalid')
  if (audio && Math.abs(audio.durationSeconds - video.durationSeconds) > 0.5) throw new Error('short_video_final_mp4_av_sync_invalid')
  return { container: 'mp4', videoCodec: video.codec, audioCodec: audio?.codec || null, width: video.width, height: video.height, fps: video.fps, durationSeconds: video.durationSeconds }
}
