import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSmartTourRequest } from './validation.ts'

const requestId = '00000000-0000-4000-8000-000000000001'
const imagePath = `00000000-0000-4000-8000-000000000002/virtual-staging/${requestId}/01.jpg`
const presenterPath = `00000000-0000-4000-8000-000000000002/virtual-staging/${requestId}/presenter-reference.jpg`
const base = {
  clientRequestId: requestId,
  imagePaths: [imagePath],
  imageOrder: [imagePath],
  property: { type: 'apartamento' },
  selectedCta: 'Agende uma visita',
  includeProfessionalPhone: false,
  language: 'pt-BR',
}

test('accepts the homologated life-in-property journey and preserves its economic discriminator', () => {
  const result = validateSmartTourRequest({
    ...base,
    journeyId: 'life-in-property',
    generation: { mode: 'narrated_tour', life_scene: 'young', captions: 'enabled' },
  })
  assert.equal(result.journeyId, 'life-in-property')
  assert.equal(result.generation.life_scene, 'young')
  assert.equal(result.module, undefined)
})

test('accepts the homologated broker journey only with its complete presenter contract', () => {
  const result = validateSmartTourRequest({
    ...base,
    journeyId: 'broker-presentation',
    module: 'broker-presentation',
    generation: { mode: 'guided_tour', presenterGender: 'none', captions: 'enabled' },
    presenter_reference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: presenterPath },
    property_images: { image_paths: [imagePath], image_order: [imagePath] },
  })
  assert.equal(result.journeyId, 'broker-presentation')
  assert.equal(result.module, 'broker-presentation')
  assert.equal(result.presenter_reference?.image_path, presenterPath)
})

test('rejects missing, null, unknown and mismatched journeys before provider work', () => {
  const life = { ...base, generation: { mode: 'narrated_tour', life_scene: 'young' } }
  for (const journeyId of [undefined, null, '', 'legacy-video', 'furnish-renovate']) {
    assert.throws(() => validateSmartTourRequest({ ...life, journeyId }), /invalid_economic_product/)
  }
  assert.throws(() => validateSmartTourRequest({ ...life, journeyId: 'broker-presentation' }), /invalid_presenter_reference/)
})
