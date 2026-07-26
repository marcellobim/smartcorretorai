import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartTourCaptionRenderScript,
  buildSmartTourStructuredBriefing,
  decodeSmartTourCaptionRenderId,
  encodeSmartTourCaptionRenderId,
  hasDeterministicSmartTourText,
  parseSmartTourStructuredBriefing,
} from '../index.ts'

const briefing = buildSmartTourStructuredBriefing({
  generation: { mode: 'guided_tour', presenterGender: 'male', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' },
  property: {
    purpose: 'sale', type: 'Apartamento', state: 'SP', city: 'São Paulo', district: 'Moema',
    bedrooms: '3', suites: '2', parkingSpaces: '3', area: '198', stage: 'Pronto para morar',
    price: 'R$ 2.850.000', condominium: 'R$ 1.200', iptu: 'R$ 650',
    highlights: ['Piscina', 'Varanda gourmet'], description: '',
  },
  selectedCta: 'Agende sua visita',
  phone: '(11) 99999-9999',
  imagePaths: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'],
  language: 'pt-BR',
})

test('deterministic compositor applies every active caption literally and once', () => {
  const script = buildSmartTourCaptionRenderScript('https://example.com/gemini.mp4', briefing)
  assert.equal(script.width, 720)
  assert.equal(script.height, 1280)
  assert.equal(script.duration, 10)
  assert.equal(script.elements[0].type, 'video')
  assert.equal(script.elements[0].source, 'https://example.com/gemini.mp4')
  assert.equal(script.elements[0].volume, '100%')
  const captions = script.elements.slice(1)
  assert.equal(captions.length, 5)
  assert.deepEqual(captions.map(element => element.text), [...briefing.timeline.legendas.map(block => block.texto), briefing.timeline.cta.texto])
  assert.deepEqual(captions.map(element => element.time), [0, 2, 4, 6, 8])
  assert.ok(captions.every(element => element.duration === 2 && element.track === 2))
  assert.equal(captions.at(-1)?.text, 'Agende sua visita\n(11) 99999-9999')
})

test('deterministic text timeline always renders five blocks for every image count', () => {
  for (const imageCount of [1, 2, 3, 4, 5]) {
    const timedBriefing = buildSmartTourStructuredBriefing({
      generation: { mode: 'guided_tour', presenterGender: 'female', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' },
      property: {
        purpose: 'sale', type: 'Apartamento', state: 'SP', city: 'São Paulo', district: 'Moema',
        bedrooms: '3', suites: '2', parkingSpaces: '3', area: '198', stage: 'Pronto para morar',
        price: 'R$ 2.850.000', condominium: 'R$ 1.200', iptu: 'R$ 650',
        highlights: ['Próximo ao metrô', 'Piscina', 'Varanda gourmet'], description: '',
      },
      selectedCta: 'Agende sua visita',
      phone: '(11) 99999-9999',
      imagePaths: Array.from({ length: imageCount }, (_, index) => `${index + 1}.jpg`),
      language: 'pt-BR',
    })
    const script = buildSmartTourCaptionRenderScript('https://example.com/gemini.mp4', timedBriefing)
    const captions = script.elements.slice(1)
    assert.equal(timedBriefing.cenas.length, imageCount)
    assert.equal(captions.length, 5)
    assert.deepEqual(captions.map(element => element.time), [0, 2, 4, 6, 8])
    assert.deepEqual(captions.map(element => element.duration), [2, 2, 2, 2, 2])
    assert.equal(captions.at(-1)?.text, 'Agende sua visita\n(11) 99999-9999')
  }
})

test('structured briefing is validated before deterministic rendering', () => {
  assert.equal(parseSmartTourStructuredBriefing(JSON.stringify(briefing)).cta.telefone, '(11) 99999-9999')
  assert.equal(hasDeterministicSmartTourText(briefing), true)
  assert.throws(() => parseSmartTourStructuredBriefing('{}'), /smart_tour_caption_briefing_invalid/)
})

test('jobs created before the temporal contract retain the legacy scene fallback', () => {
  const legacy = structuredClone(briefing) as typeof briefing & { timeline?: typeof briefing.timeline }
  delete legacy.timeline
  const parsed = parseSmartTourStructuredBriefing(JSON.stringify(legacy))
  const script = buildSmartTourCaptionRenderScript('https://example.com/gemini.mp4', parsed)
  assert.equal(script.elements.slice(1).length, 5)
  assert.deepEqual(script.elements.slice(1).map(element => element.time), [0, 2, 4, 6, 8])
})

test('caption render identifiers cannot be confused with Gemini interaction identifiers', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000'
  assert.equal(encodeSmartTourCaptionRenderId(id), `creatomate:${id}`)
  assert.equal(decodeSmartTourCaptionRenderId(`creatomate:${id}`), id)
  assert.equal(decodeSmartTourCaptionRenderId('v1_gemini-interaction'), null)
})
