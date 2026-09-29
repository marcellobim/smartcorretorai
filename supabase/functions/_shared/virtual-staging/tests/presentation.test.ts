import test from 'node:test'
import assert from 'node:assert/strict'
import {
  presentCta,
  presentHighlight,
  presentLifeProfile,
  presentMetricLabel,
  presentPropertyType,
  presentPurpose,
  presentStage,
} from '../presentation.ts'
import { buildSmartTourStructuredBriefing } from '../structured-briefing.ts'

test('presentation mappings preserve PT-BR and provide EN-US labels', () => {
  assert.equal(presentPurpose('Venda'), 'Venda')
  assert.equal(presentPurpose('Venda', 'en-US'), 'For Sale')
  assert.equal(presentPurpose('Locação', 'en-US'), 'For Rent')
  assert.equal(presentPropertyType('Apartamento', 'en-US'), 'Apartment')
  assert.equal(presentPropertyType('Terreno / Lote', 'en-US'), 'Land / Lot')
  assert.equal(presentStage('Pronto para morar', 'en-US'), 'Move-in ready')
  assert.equal(presentStage('Disponível já', 'en-US'), 'Available now')
  assert.equal(presentCta('Agende sua visita', 'en-US'), 'Schedule a tour')
  assert.equal(presentLifeProfile('adult_dog'), 'adultos com cachorro')
  assert.equal(presentLifeProfile('adult_dog', 'en-US'), 'Adults with a dog')
  assert.equal(presentHighlight('Varanda gourmet', 'en-US'), 'Gourmet balcony')
  assert.equal(presentHighlight('Próximo ao metrô', 'en-US'), 'Near public transit')
  assert.equal(presentMetricLabel('bedrooms'), 'dormitórios')
  assert.equal(presentMetricLabel('parkingSpaces', 'en-US'), 'parking spaces')
  assert.equal(presentMetricLabel('area', 'en-US'), 'sq ft')
})

test('missing language and unknown values fall back safely to the original value', () => {
  assert.equal(presentPurpose('Venda', undefined), 'Venda')
  assert.equal(presentPropertyType('Tipo futuro', 'en-US'), 'Tipo futuro')
  assert.equal(presentStage('Estado futuro', 'en-US'), 'Estado futuro')
  assert.equal(presentCta('CTA futuro', 'en-US'), 'CTA futuro')
  assert.equal(presentHighlight('Diferencial futuro', 'en-US'), 'Diferencial futuro')
})

test('briefing adds presentation only for Life and Broker without changing internal values or custom speech', () => {
  const property = { purpose: 'sale', type: 'Apartamento', stage: 'Pronto para morar', bedrooms: '2', suites: '1', parkingSpaces: '1', area: '80', highlights: ['Varanda gourmet'] }
  const life = buildSmartTourStructuredBriefing({ generation: { mode: 'narrated_tour', language: 'en-US', life_scene: 'adult_dog', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'en-US' })
  assert.equal(life.imovel.finalidade, 'Venda')
  assert.equal(life.imovel.tipo, 'Apartamento')
  assert.deepEqual(life.apresentacao, { finalidade: 'For Sale', tipo: 'Apartment', estadoDoImovel: 'Move-in ready', metricas: { dormitorios: 'bedrooms', suites: 'suites', vagas: 'parking spaces', area: 'sq ft' }, diferenciais: ['Gourmet balcony'], cta: 'Schedule a tour', perfilVida: 'Adults with a dog' })

  const custom = buildSmartTourStructuredBriefing({ generation: { mode: 'guided_tour', language: 'en-US', presenterSpeechMode: 'custom', presenterCustomSpeech: 'This exact sentence remains literal.', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'en-US', presenterReference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: 'presenter.jpg' } })
  assert.equal(custom.timeline.narracao.map(block => block.texto).join(' '), 'This exact sentence remains literal.')
  assert.equal(custom.apresentacao?.cta, 'Schedule a tour')

  const smartSpace = buildSmartTourStructuredBriefing({ generation: { mode: 'guided_tour', language: 'pt-BR', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'female' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'pt-BR' })
  assert.equal(smartSpace.apresentacao, undefined)
})

test('Life and generated Broker localize deterministic captions while custom captions remain literal', () => {
  const property = { purpose: 'sale', type: 'Apartamento', stage: 'Pronto para morar', bedrooms: '2', suites: '1', parkingSpaces: '1', area: '80', district: 'Moema', city: 'São Paulo', price: '', highlights: ['Varanda gourmet', 'Vista livre'] }
  const lifePt = buildSmartTourStructuredBriefing({ generation: { mode: 'narrated_tour', language: 'pt-BR', life_scene: 'adult', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'pt-BR' })
  const lifeEn = buildSmartTourStructuredBriefing({ generation: { mode: 'narrated_tour', language: 'en-US', life_scene: 'adult', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'en-US' })
  assert.deepEqual(lifePt.timeline.legendas.map(block => block.texto), ['À VENDA', 'Pronto para morar', 'Moema, São Paulo', 'Varanda gourmet', 'Vista livre'])
  assert.deepEqual(lifeEn.timeline.legendas.map(block => block.texto), ['For Sale', 'Move-in ready', 'Moema, São Paulo', 'Gourmet balcony', 'Unobstructed view'])
  assert.equal(lifeEn.timeline.cta.texto, 'Schedule a tour')

  const brokerGenerated = buildSmartTourStructuredBriefing({ generation: { mode: 'guided_tour', language: 'en-US', presenterSpeechMode: 'generated', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: '', imagePaths: ['image.jpg'], language: 'en-US', presenterReference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: 'presenter.jpg' } })
  assert.deepEqual(brokerGenerated.timeline.legendas.map(block => block.texto), ['For Sale', 'Move-in ready', 'Moema, São Paulo', 'Gourmet balcony', 'Unobstructed view'])
  assert.equal(brokerGenerated.timeline.cta.texto, '')

  const customText = 'My exact words stay untouched in every caption block.'
  const brokerCustom = buildSmartTourStructuredBriefing({ generation: { mode: 'guided_tour', language: 'en-US', presenterSpeechMode: 'custom', presenterCustomSpeech: customText, narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'en-US', presenterReference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: 'presenter.jpg' } })
  assert.equal(brokerCustom.timeline.legendas.map(block => block.texto).join(' '), customText)
  assert.equal(brokerCustom.timeline.cta.texto, 'Agende sua visita')
})

test('Life narration preserves PT-BR and uses concise natural American English only for EN-US', () => {
  const property = { purpose: 'sale', type: 'Apartamento', stage: 'Pronto para morar', bedrooms: '2', suites: '1', parkingSpaces: '1', district: 'Moema', city: 'São Paulo', highlights: ['Varanda gourmet'] }
  const buildLife = language => buildSmartTourStructuredBriefing({ generation: { mode: 'narrated_tour', language, life_scene: 'adult_dog', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language })
  const pt = buildLife('pt-BR')
  const en = buildLife('en-US')

  assert.deepEqual(pt.timeline.narracao.map(block => block.texto), ['Apartamento à venda em Moema, São Paulo.', 'dois dormitórios, uma suíte e uma vaga.', 'Pronto para morar.', '', 'Agende sua visita.'])
  assert.deepEqual(en.timeline.narracao.map(block => block.texto), ['Apartment for sale in Moema, São Paulo.', '2 bedrooms, 1 suite and 1 parking space.', 'Move-in ready.', '', 'Schedule a tour.'])
  assert.match(en.regrasObrigatorias.find(rule => rule.codigo === 'vida_no_imovel_narracao_natural')?.valor || '', /natural American English/)
  assert.doesNotMatch(en.timeline.narracao.map(block => block.texto).join(' '), /à venda|dormitórios|Pronto para morar|Agende sua visita/i)
  assert.equal(en.vidaNoImovel?.life_scene, 'adult_dog')
  assert.equal(en.vidaNoImovel?.descricao, 'Adults with a dog')
})

test('Broker generated preserves PT-BR and localizes only EN-US narration without affecting custom, Life, or Smart Space', () => {
  const property = { purpose: 'sale', type: 'Apartamento', stage: 'Pronto para morar', bedrooms: '2', suites: '1', parkingSpaces: '1', district: 'Moema', city: 'São Paulo', highlights: ['Varanda gourmet'] }
  const reference = { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: 'presenter.jpg' } as const
  const buildBroker = (language: 'pt-BR' | 'en-US' | undefined, selectedCta = 'Agende sua visita') => buildSmartTourStructuredBriefing({
    generation: { mode: 'guided_tour', language, presenterSpeechMode: 'generated', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' },
    property, selectedCta, imagePaths: ['image.jpg'], language: language as 'pt-BR' | 'en-US', presenterReference: reference,
  })
  const pt = buildBroker('pt-BR')
  const en = buildBroker('en-US')
  const fallback = buildBroker(undefined)

  assert.deepEqual(pt.timeline.narracao.map(block => block.texto), ['Conheça este excelente apartamento à venda no bairro Moema, em São Paulo.', 'O imóvel possui dois dormitórios, uma suíte e uma vaga.', 'O imóvel está pronto para morar.', '', 'Agende sua visita.'])
  assert.deepEqual(pt.timeline.narracao.map(block => block.frase_id), ['LIFE_COMMERCIAL_OPENING', 'LIFE_PROPERTY_FACTS', 'LIFE_PROPERTY_STAGE', '', 'LIFE_FINAL_INVITATION'])
  assert.deepEqual(en.timeline.narracao.map(block => block.texto), ['Apartment for sale in Moema, São Paulo.', '2 bedrooms, 1 suite and 1 parking space.', 'Move-in ready.', 'Gourmet balcony.', 'Schedule a tour.'])
  assert.deepEqual(fallback.timeline.narracao.map(block => block.texto), pt.timeline.narracao.map(block => block.texto))
  assert.equal(fallback.configuracoes.idioma, 'pt-BR')
  assert.doesNotMatch(en.timeline.narracao.map(block => block.texto).join(' '), /à venda|dormitórios|Pronto para morar|Agende sua visita/i)
  assert.match(en.regrasObrigatorias.find(rule => rule.codigo === 'finalidade_narracao_apresentacao_corretor')?.valor || '', /natural American English/)
  assert.match(en.regrasObrigatorias.find(rule => rule.codigo === 'sequencia_narracao_apresentacao_corretor')?.valor || '', /localized CTA only when one was supplied/)
  assert.doesNotMatch(['finalidade_narracao_apresentacao_corretor', 'finalidade_legenda_apresentacao_corretor', 'sequencia_comercial_apresentacao_corretor', 'sequencia_narracao_apresentacao_corretor'].map(codigo => String(en.regrasObrigatorias.find(rule => rule.codigo === codigo)?.valor || '')).join(' '), /à venda|para locação|Português do Brasil/i)
  assert.equal(en.apresentacao?.finalidade, 'For Sale')
  assert.equal(en.apresentacao?.tipo, 'Apartment')
  assert.equal(en.apresentacao?.estadoDoImovel, 'Move-in ready')
  assert.deepEqual(en.apresentacao?.diferenciais, ['Gourmet balcony'])
  assert.equal(en.apresentacao?.cta, 'Schedule a tour')
  assert.equal(buildBroker('en-US', '').timeline.narracao[4].texto, '')

  for (const language of ['pt-BR', 'en-US'] as const) {
    const customText = 'Use these exact words without any added call to action.'
    const custom = buildSmartTourStructuredBriefing({ generation: { mode: 'guided_tour', language, presenterSpeechMode: 'custom', presenterCustomSpeech: customText, narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language, presenterReference: reference })
    assert.equal(custom.timeline.narracao.map(block => block.texto).join(' '), customText)
    assert.equal(custom.timeline.legendas.map(block => block.texto).join(' '), customText)
    assert.doesNotMatch(custom.timeline.narracao.map(block => block.texto).join(' '), /Schedule a tour|Agende sua visita/)
  }

  const life = buildSmartTourStructuredBriefing({ generation: { mode: 'narrated_tour', language: 'en-US', life_scene: 'adult', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'en-US' })
  assert.deepEqual(life.timeline.narracao.map(block => block.texto), ['Apartment for sale in Moema, São Paulo.', '2 bedrooms, 1 suite and 1 parking space.', 'Move-in ready.', '', 'Schedule a tour.'])
  const smartSpace = buildSmartTourStructuredBriefing({ generation: { mode: 'guided_tour', language: 'en-US', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', presenterGender: 'none' }, property, selectedCta: 'Agende sua visita', imagePaths: ['image.jpg'], language: 'en-US' })
  assert.equal(smartSpace.apresentacao, undefined)
})
