import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildShortVideosCaptionPlan,
  buildShortVideosCleanGeminiPrompt,
  buildShortVideosStructuredBriefing,
  buildSmartTourCaptionRenderScript,
  formatSmartTourProfessionalPhone,
  SHORT_VIDEOS_NO_GENERATED_TEXT_RULE,
  validateShortVideosFinalMp4,
} from '../index.ts'

const generation = { mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' } as const

function briefing(overrides: Record<string, unknown> = {}) {
  return buildShortVideosStructuredBriefing({
    generation,
    property: {
      purpose: 'sale', type: 'Apartamento', city: 'Cabo Frio', district: 'Centro', bedrooms: '2', suites: '1',
      parkingSpaces: '1', area: '68', price: 'R$ 750.000', highlights: ['Varanda gourmet'],
      ...((overrides.property as Record<string, unknown>) || {}),
    },
    selectedCta: String(overrides.selectedCta ?? 'Agende sua visita'),
    phone: String(overrides.phone ?? '(22) 99999-9999'),
    videoPath: 'owned/short-videos/job/input.mp4',
    language: 'pt-BR',
  })
}

test('Short Videos sends Gemini an isolated clean-video contract and preserves the images product contract', () => {
  const source = briefing()
  const clean = JSON.parse(buildShortVideosCleanGeminiPrompt(source))
  assert.equal(clean.versao, 'short-videos-clean-gemini-prompt-v1')
  assert.ok(clean.regrasObrigatorias.includes(SHORT_VIDEOS_NO_GENERATED_TEXT_RULE))
  assert.match(JSON.stringify(clean), /sem palavras|qualquer texto|caractere/i)
  for (const forbiddenKey of ['imovel', 'cta', 'legendas', 'telefone', 'hashtags', 'sequenciaDosVideos']) assert.equal(forbiddenKey in clean, false, forbiddenKey)
  assert.equal(source.versao, 'short-videos-structured-briefing-v1')
})

test('controlled plan uses at most two structured information blocks and one exact final CTA', () => {
  const source = briefing({ selectedCta: 'Fale comigo no WhatsApp', phone: '(22) 98888-7777' })
  const plan = buildShortVideosCaptionPlan(source)
  const information = plan.blocks.filter(block => !block.isClosing)
  const closing = plan.blocks.filter(block => block.isClosing)
  assert.ok(information.length <= 2)
  assert.equal(closing.length, 1)
  assert.equal(closing[0].texto, 'Fale comigo no WhatsApp\n(22) 98888-7777')
  assert.equal(closing[0].inicioSegundos, 8)
  assert.equal(closing[0].fimSegundos, 10)
  assert.match(information[0].texto, /^À venda\nCentro • Cabo Frio$/)
  assert.equal(information[1].texto, '2 dormitórios • 1 suíte • 1 vaga')
  assert.doesNotMatch(plan.blocks.map(block => block.texto).join('\n'), /R\$ 750\.000|Varanda gourmet/)
})

test('controlled plan keeps professional identity visual and separate from the final CTA', () => {
  const source = briefing({ selectedCta: 'Fale comigo' })
  source.timeline.identificacaoProfissional.texto = 'Riccieri — CRECI F 12345/SC'
  const plan = buildShortVideosCaptionPlan(source)
  const identity = plan.blocks.find(block => block.isProfessionalIdentity)
  const cta = plan.blocks.find(block => block.isClosing)
  assert.deepEqual(identity, { bloco: 4, inicioSegundos: 6, fimSegundos: 8, texto: 'Riccieri — CRECI F 12345/SC', isClosing: false, isProfessionalIdentity: true })
  assert.equal(cta?.inicioSegundos, 8)
})

test('CTA stays literal, is not fixed, and missing phone never invents a number', () => {
  for (const selectedCta of ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']) {
    const plan = buildShortVideosCaptionPlan(briefing({ selectedCta, phone: '' }))
    const closing = plan.blocks.find(block => block.isClosing)
    assert.equal(closing?.texto, selectedCta)
    assert.doesNotMatch(closing?.texto || '', /\d/)
  }
})

test('professional phone follows the existing Brazilian formatter and omits +55', () => {
  assert.equal(formatSmartTourProfessionalPhone('+55 22 99999-8888'), '(22) 99999-8888')
  assert.equal(formatSmartTourProfessionalPhone('invalid'), '')
})

test('a location benefit appears only when it is a real selected structured highlight', () => {
  const without = briefing({ property: { bedrooms: '', suites: '', parkingSpaces: '', area: '', type: '', stage: '', price: '', highlights: [] } })
  const withBenefit = briefing({ property: { bedrooms: '', suites: '', parkingSpaces: '', area: '', type: '', stage: '', price: '', highlights: ['Próximo ao comércio'] } })
  assert.doesNotMatch(buildShortVideosCaptionPlan(without).blocks.map(block => block.texto).join('\n'), /Próximo ao comércio/)
  assert.match(buildShortVideosCaptionPlan(withBenefit).blocks.map(block => block.texto).join('\n'), /Próximo ao comércio/)
})

test('controlled render is 9:16 at 24 fps, preserves audio and keeps all text in safe areas', () => {
  const source = briefing()
  const plan = buildShortVideosCaptionPlan(source)
  const script = buildSmartTourCaptionRenderScript('https://example.com/clean.mp4', source, plan)
  assert.deepEqual({ width: script.width, height: script.height, frameRate: script.frame_rate, duration: script.duration }, { width: 720, height: 1280, frameRate: 24, duration: 10 })
  assert.equal(script.elements[0].volume, '100%')
  assert.equal(script.elements.filter(element => element.type === 'text').length, plan.blocks.length)
  for (const element of script.elements.filter(element => element.type === 'text')) {
    assert.equal(element.x, '50%')
    assert.equal(element.width, '88%')
    assert.ok(['50%', '82%'].includes(String(element.y)))
  }
  const closing = script.elements.filter(element => element.type === 'text').at(-1)
  assert.equal(closing?.time, 8)
  assert.equal(closing?.duration, 2)
  assert.equal(closing?.height, '70%')
})

const u32 = (value: number) => new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
const join = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}
const ascii = (value: string) => new TextEncoder().encode(value)
const box = (type: string, payload: Uint8Array) => join(u32(payload.length + 8), ascii(type), payload)

function track(handler: 'vide' | 'soun', codec: 'avc1' | 'mp4a', sampleCount: number) {
  const tkhdPayload = new Uint8Array(84)
  const tkhdView = new DataView(tkhdPayload.buffer)
  tkhdView.setUint32(76, handler === 'vide' ? 720 * 65536 : 0)
  tkhdView.setUint32(80, handler === 'vide' ? 1280 * 65536 : 0)
  const mdhdPayload = new Uint8Array(20)
  const mdhdView = new DataView(mdhdPayload.buffer)
  mdhdView.setUint32(12, 1000)
  mdhdView.setUint32(16, 10000)
  const hdlrPayload = join(new Uint8Array(8), ascii(handler))
  const stsdPayload = join(new Uint8Array(8), u32(16), ascii(codec))
  const sttsPayload = join(new Uint8Array(4), u32(1), u32(sampleCount), u32(handler === 'vide' ? 1000 / 24 : 1))
  return box('trak', join(box('tkhd', tkhdPayload), box('mdia', join(box('mdhd', mdhdPayload), box('hdlr', hdlrPayload), box('minf', box('stbl', join(box('stsd', stsdPayload), box('stts', sttsPayload))))))))
}

test('final MP4 validator rejects empty or malformed output before delivery', () => {
  assert.throws(() => validateShortVideosFinalMp4(new Uint8Array(0)), /empty/)
  assert.throws(() => validateShortVideosFinalMp4(new Uint8Array(2048)), /container/)
  const fakeMp4 = join(box('ftyp', ascii('isom')), box('moov', join(track('vide', 'avc1', 240), track('soun', 'mp4a', 480000))), box('mdat', new Uint8Array(2048)))
  const validated = validateShortVideosFinalMp4(fakeMp4)
  assert.equal(validated.container, 'mp4')
  assert.equal(validated.videoCodec, 'avc1')
  assert.equal(validated.audioCodec, 'mp4a')
  assert.equal(validated.width, 720)
  assert.equal(validated.height, 1280)
  assert.ok(Math.abs(validated.fps - 24) <= 0.5)
})
