import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGeminiOmniInlineRequestBody } from '../../geminiOmniClient.ts'
import { buildSmartTourCaptionRenderScript } from '../caption-compositor.ts'
import { buildSmartTourStructuredBriefing, buildVirtualSpaceProviderBriefing } from '../structured-briefing.ts'

const property = {
  purpose: 'sale', type: 'Apartamento', stage: 'Pronto para morar', state: 'SP', city: 'São Paulo', district: 'Moema',
  bedrooms: '3', suites: '1', parkingSpaces: '2', area: '120', price: 'R$ 1.800.000', condominium: '', iptu: '',
  highlights: ['Iluminação natural', 'Varanda gourmet'], description: '',
}
const images = ['owner/request/1.jpg', 'owner/request/2.jpg', 'owner/request/3.jpg']
const generation = { mode: 'narrated_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR', life_scene: 'adult' } as const

const lifeBriefing = () => buildSmartTourStructuredBriefing({
  generation, property, selectedCta: 'Agende sua visita', phone: '', imagePaths: images, language: 'pt-BR',
})

test('Vida no Imóvel entrega texto visual somente ao compositor determinístico', () => {
  const delivery = lifeBriefing()
  const provider = buildVirtualSpaceProviderBriefing(delivery)
  const payload = buildGeminiOmniInlineRequestBody(JSON.stringify(provider), [{ type: 'image', data: 'image-1', mime_type: 'image/jpeg' }], '9:16')
  const effectiveProviderBriefing = JSON.parse(String(payload.input.at(-1)?.text || 'null'))
  const rendered = buildSmartTourCaptionRenderScript('https://storage.example.test/video.mp4', delivery)
  const renderedTexts = rendered.elements.filter(element => element.type === 'text').map(element => String(element.text))

  assert.deepEqual(delivery.timeline.legendas.map(block => block.texto), [
    'À VENDA', 'Pronto para morar', 'Moema, São Paulo', 'Iluminação natural', 'R$ 1.800.000',
  ])
  assert.deepEqual(renderedTexts, [...delivery.timeline.legendas.map(block => block.texto), 'Agende sua visita'])
  assert.equal(new Set(renderedTexts.map(text => text.toLocaleLowerCase('pt-BR'))).size, renderedTexts.length)
  assert.ok(provider.timeline.legendas.every(block => block.texto === ''))
  assert.equal(provider.timeline.cta.texto, '')
  assert.ok(provider.cenas.every(scene => scene.legenda === ''))
  assert.deepEqual(provider.legendas, { ativas: false })
  assert.deepEqual(provider.cta, { titulo: '', telefone: '' })
  assert.ok(effectiveProviderBriefing.timeline.legendas.every((block: { texto: string }) => block.texto === ''))
  assert.equal(effectiveProviderBriefing.timeline.cta.texto, '')
  assert.ok(effectiveProviderBriefing.cenas.every((scene: { legenda: string }) => scene.legenda === ''))
  const nativeTextRule = String(provider.regrasObrigatorias.find(rule => rule.codigo === 'vida_no_imovel_sem_texto_nativo')?.valor)
  for (const forbidden of ['letras', 'palavras', 'legendas', 'preços', 'placas', 'logotipos', 'texto visual']) {
    assert.match(nativeTextRule, new RegExp(forbidden, 'iu'))
  }
})

test('sanitização visual preserva áudio, duração, imagens, pessoas e movimentos do Vida no Imóvel', () => {
  const delivery = lifeBriefing()
  const provider = buildVirtualSpaceProviderBriefing(delivery)
  assert.deepEqual(provider.timeline.narracao, delivery.timeline.narracao)
  assert.equal(provider.configuracoes.narracaoAtiva, delivery.configuracoes.narracaoAtiva)
  assert.equal(provider.configuracoes.duracaoSegundos, 10)
  assert.deepEqual(provider.sequenciaDasImagens, delivery.sequenciaDasImagens)
  assert.deepEqual(provider.movimentosDesejados, delivery.movimentosDesejados)
  assert.deepEqual(provider.vidaNoImovel, delivery.vidaNoImovel)
  assert.deepEqual(provider.apresentador, delivery.apresentador)
  assert.deepEqual(provider.musica, delivery.musica)
})

test('Apresentação pelo Corretor mantém exatamente o briefing aprovado', () => {
  const broker = buildSmartTourStructuredBriefing({
    generation: { ...generation, life_scene: undefined }, property, selectedCta: 'Agende sua visita', phone: '', imagePaths: images,
    language: 'pt-BR', presenterReference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: 'owner/request/presenter.jpg' },
  })
  assert.equal(broker.vidaNoImovel, undefined)
  assert.strictEqual(buildVirtualSpaceProviderBriefing(broker), broker)
})

test('gerador mantém provider, custo, recovery e compositor e sanitiza somente a chamada ao provider', () => {
  const source = readFileSync(new URL('../../../virtual-staging-generate/index.ts', import.meta.url), 'utf8')
  assert.match(source, /const prompt = buildSmartTourVideoPrompt\(briefing\)/)
  assert.match(source, /const providerPrompt = buildSmartTourVideoPrompt\(buildVirtualSpaceProviderBriefing\(briefing\)\)/)
  assert.match(source, /prompt_final:prompt/)
  assert.match(source, /generateGeminiOmniVideoInline\(\{[\s\S]*prompt:providerPrompt/)
  assert.match(source, /startSmartTourCaptionRender\(creatomateKey,videoUrl,briefing\)/)
  assert.match(source, /generateGeminiOmniVideoInline/)
  assert.match(source, /tokens_reserved:325/)
})
