import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartTourStructuredBriefing,
  validateSmartTourRequest,
} from '../../supabase/functions/_shared/virtual-staging/index.ts'

const imagePaths = [
  'user/virtual-staging/00000000-0000-4000-8000-000000000001/01.jpg',
  'user/virtual-staging/00000000-0000-4000-8000-000000000001/02.jpg',
]
const base = {
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  module: 'furnish-renovate',
  property_images: { image_paths: imagePaths, image_order: imagePaths },
  transformationStyle: 'style-placeholder-1',
  language: 'pt-BR',
}
const commercialProperty = {
  purpose: 'rent', stage: 'Disponível já', type: 'Apartamento', bedrooms: '2', suites: '1', parkingSpaces: '1',
  area: '85', district: 'Moema', city: 'São Paulo', highlights: ['Lazer completo', 'Bairro valorizado', 'Varanda gourmet'],
}

test('backend accepts visual-only without fabricated commercial data', () => {
  const validated = validateSmartTourRequest({ ...base, videoMode: 'visual-only' })
  assert.equal(validated.module, 'furnish-renovate')
  assert.equal(validated.videoMode, 'visual-only')
  assert.equal(validated.transformationStyle, 'style-placeholder-1')
  assert.deepEqual(validated.property, { highlights: [] })
  assert.equal(validated.generation.presenterGender, 'none')
  assert.equal(validated.generation.narration, 'disabled')
  assert.equal(validated.generation.captions, 'disabled')
  assert.equal(validated.selectedCta, '')
  assert.equal(validated.includeProfessionalPhone, false)
})

test('backend accepts complete-transformation and preserves area and literal narrated CTA', () => {
  const validated = validateSmartTourRequest({ ...base, videoMode: 'complete-transformation', narrationEnabled: true, property: commercialProperty, narratedCta: 'Saiba mais' })
  assert.equal(validated.videoMode, 'complete-transformation')
  assert.equal(validated.narrationEnabled, true)
  assert.equal(validated.generation.narration, 'enabled')
  assert.equal(validated.generation.captions, 'disabled')
  assert.deepEqual(validated.property, commercialProperty)
  assert.equal(validated.narratedCta, 'Saiba mais')
  assert.equal(validated.selectedCta, '')
})

test('backend enforces one to four ordered property images for Module 1', () => {
  const one = ['user/virtual-staging/request/01.jpg']
  assert.equal(validateSmartTourRequest({ ...base, property_images: { image_paths: one, image_order: one }, videoMode: 'visual-only' }).imagePaths.length, 1)
  const four = Array.from({ length: 4 }, (_, index) => `user/virtual-staging/request/0${index + 1}.jpg`)
  assert.equal(validateSmartTourRequest({ ...base, property_images: { image_paths: four, image_order: four }, videoMode: 'visual-only' }).imagePaths.length, 4)
  const five = Array.from({ length: 5 }, (_, index) => `user/virtual-staging/request/0${index + 1}.jpg`)
  assert.throws(() => validateSmartTourRequest({ ...base, property_images: { image_paths: five, image_order: five }, videoMode: 'visual-only' }), /invalid_image_count/)
  assert.throws(() => validateSmartTourRequest({ ...base, property_images: { image_paths: imagePaths, image_order: [...imagePaths].reverse() }, videoMode: 'visual-only' }), /invalid_image_order/)
})

test('backend rejects presenter, visual outputs and invalid mode contracts', () => {
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'visual-only', presenter_reference: { enabled: true } }), /invalid_presenter_reference/)
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'visual-only', narrationEnabled: true }), /invalid_visual_only_context/)
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'visual-only', narratedCta: 'Saiba mais' }), /invalid_visual_only_context/)
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'visual-only', selectedCta: 'Agende sua visita' }), /invalid_furnish_output/)
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'complete-transformation', property: commercialProperty }), /invalid_complete_transformation/)
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'complete-transformation', narrationEnabled: true, property: commercialProperty, narratedCta: 'Texto livre' }), /invalid_complete_transformation/)
  assert.throws(() => validateSmartTourRequest({ ...base, videoMode: 'unknown' }), /invalid_video_mode/)
  assert.throws(() => validateSmartTourRequest({ ...base, transformationStyle: '', videoMode: 'visual-only' }), /invalid_transformation_style/)
})

test('briefing contract keeps Module 1 without presenter, people, captions, phone or visual CTA', () => {
  for (const request of [
    { ...base, videoMode: 'visual-only' },
    { ...base, videoMode: 'complete-transformation', narrationEnabled: true, property: commercialProperty, narratedCta: 'Saiba mais' },
  ]) {
    const validated = validateSmartTourRequest(request)
    const briefing = buildSmartTourStructuredBriefing({ generation: validated.generation, property: validated.property, selectedCta: validated.selectedCta, imagePaths: validated.imagePaths, language: validated.language })
    assert.deepEqual(briefing.apresentador, { tipo: 'nenhum', unicoHumanoAutorizado: false })
    assert.equal(briefing.configuracoes.legendasAtivas, false)
    assert.equal(briefing.configuracoes.ctaAtivo, false)
    assert.deepEqual(briefing.cta, { titulo: '', telefone: '' })
    assert.equal(briefing.regrasPreservacao.transformacoesPermitidas.some(value => /apresentador|corretor|corretora/i.test(value)), false)
    assert.match(String(briefing.regrasObrigatorias.find(rule => rule.codigo === 'sem_invencao')?.valor), /pessoas/)
  }
})
