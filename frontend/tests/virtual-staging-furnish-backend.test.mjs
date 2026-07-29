import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildReimaginePrompt, REIMAGINE_BASE_PROMPT, validateSmartTourRequest } from '../../supabase/functions/_shared/virtual-staging/index.ts'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const imagePaths = ['user/virtual-staging/request/01.jpg', 'user/virtual-staging/request/02.jpg']
const property = {
  purpose: 'rent', type: 'Apartamento', bedrooms: '2', suites: '1', parkingSpaces: '1', area: '85',
  state: 'SP', city: 'São Paulo', neighborhood: 'Limão',
  highlights: ['Varanda gourmet', 'Lazer completo', 'Vista livre'],
}
const base = {
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  module: 'furnish-renovate',
  property_images: { image_paths: imagePaths, image_order: imagePaths },
  property,
  language: 'pt-BR',
}

test('accepts the direct Reimagine AI contract and forces narration without presenter or captions', () => {
  const validated = validateSmartTourRequest(base)
  assert.equal(validated.module, 'furnish-renovate')
  assert.deepEqual(validated.imagePaths, imagePaths)
  assert.deepEqual(validated.imageOrder, imagePaths)
  assert.deepEqual(validated.property, property)
  assert.equal(validated.generation.presenterGender, 'none')
  assert.equal(validated.generation.narration, 'enabled')
  assert.equal(validated.generation.captions, 'disabled')
  assert.equal(validated.selectedCta, '')
  assert.equal(validated.includeProfessionalPhone, false)
})

test('accepts one to five ordered images and rejects zero, six and reordered images', () => {
  const withImages = count => {
    const paths = Array.from({ length: count }, (_, index) => `user/virtual-staging/request/${String(index + 1).padStart(2, '0')}.jpg`)
    return { ...base, property_images: { image_paths: paths, image_order: paths } }
  }
  assert.equal(validateSmartTourRequest(withImages(1)).imagePaths.length, 1)
  assert.equal(validateSmartTourRequest(withImages(5)).imagePaths.length, 5)
  assert.throws(() => validateSmartTourRequest(withImages(0)), /invalid_image_count/)
  assert.throws(() => validateSmartTourRequest(withImages(6)), /invalid_image_count/)
  assert.throws(() => validateSmartTourRequest({ ...base, property_images: { image_paths: imagePaths, image_order: [...imagePaths].reverse() } }), /invalid_image_order/)
})

test('accepts only the approved residential types', () => {
  for (const type of ['Apartamento', 'Casa', 'Sobrado', 'Studio', 'Loft', 'Cobertura', 'Kitnet']) {
    assert.equal(validateSmartTourRequest({ ...base, property: { ...property, type } }).property.type, type)
  }
  for (const type of ['Comercial', 'Terreno / Lote', 'Galpão', 'Escritório', 'Fazenda']) {
    assert.throws(() => validateSmartTourRequest({ ...base, property: { ...property, type } }), /invalid_furnish_property/)
  }
})

test('rejects more than three highlights instead of silently inventing or truncating context', () => {
  assert.throws(() => validateSmartTourRequest({ ...base, property: { ...property, highlights: [...property.highlights, 'Piscina'] } }), /invalid_furnish_highlights/)
})

test('rejects every removed top-level and property field from the old Module 1 contract', () => {
  for (const field of ['transformationStyle', 'videoMode', 'narrationEnabled', 'narratedCta', 'selectedCta', 'includeProfessionalPhone', 'phone', 'captions', 'cta']) {
    assert.throws(() => validateSmartTourRequest({ ...base, [field]: field === 'includeProfessionalPhone' ? false : 'legacy' }), /invalid_furnish_output/)
  }
  for (const field of ['stage', 'district', 'price', 'description']) {
    assert.throws(() => validateSmartTourRequest({ ...base, property: { ...property, [field]: 'legacy' } }), /invalid_furnish_property/)
  }
  assert.throws(() => validateSmartTourRequest({ ...base, generation: { mode: 'guided_tour' } }), /invalid_furnish_output/)
  assert.throws(() => validateSmartTourRequest({ ...base, presenter_reference: { enabled: true } }), /invalid_presenter_reference/)
})

test('requires a positive numeric area in square metres', () => {
  for (const area of ['', '0', '-1', '85.5', 'abc']) {
    assert.throws(() => validateSmartTourRequest({ ...base, property: { ...property, area } }), /invalid_furnish_area/)
  }
  assert.equal(validateSmartTourRequest({ ...base, property: { ...property, area: '120' } }).property.area, '120')
})

test('builds a short exclusive prompt with role, mission, narration and ordered dynamic data', () => {
  const prompt = buildReimaginePrompt(property, imagePaths)
  assert.match(REIMAGINE_BASE_PROMPT, /^Atue como um decorador de interiores\./)
  assert.match(prompt, /Nunca crie outro ambiente\./)
  assert.match(prompt, /decoração moderna, elegante, acolhedora/)
  assert.match(prompt, /narração CURTA em português do Brasil/)
  assert.match(prompt, /"finalidade": "Locação"/)
  assert.match(prompt, /"tipoDoImovel": "Apartamento"/)
  assert.match(prompt, /"areaMetrosQuadrados": "85"/)
  assert.match(prompt, /"estado": "SP"/)
  assert.match(prompt, /"bairro": "Limão"/)
  assert.match(prompt, /"cidade": "São Paulo"/)
  assert.ok(prompt.indexOf(imagePaths[0]) < prompt.indexOf(imagePaths[1]))
  assert.equal(prompt.length < 2500, true)
  assert.doesNotMatch(prompt, /MÓDULO CORRETOR|CENÁRIO PROTEGIDO|timeline|tela final|telefone/)
})

test('isolates the new prompt in virtual-staging-generate without changing Smart Tour or Modules 2 and 3', () => {
  const generator = read('supabase/functions/virtual-staging-generate/index.ts')
  assert.match(generator, /input\.module === 'furnish-renovate'/)
  assert.match(generator, /buildReimaginePrompt\(input\.property, input\.imageOrder\)/)
  assert.match(generator, /buildSmartTourVideoPrompt\(buildSmartTourStructuredBriefing/)
  assert.doesNotMatch(read('supabase/functions/smart-tour-generate/index.ts'), /buildReimaginePrompt|furnish-renovate/)
  assert.doesNotMatch(read('supabase/functions/_shared/smart-tour/build-prompt.ts'), /REIMAGINE_BASE_PROMPT|buildReimaginePrompt/)
})
