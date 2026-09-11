import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { validateListingXrayModelOutput } from './contract.ts'
import { makeModelOutputFixture } from './fixtures/model-output-fixtures.ts'

// Real provider shape captured once; free text was not persisted. Reconstruct
// only validation-relevant values, using neutral strings of the captured length.
const diagnostic = JSON.parse(readFileSync(new URL('./fixtures/description-diagnostic-20260911.json', import.meta.url), 'utf8'))
function replayValue(shape: any): any {
  if (shape.type === 'null') return null
  if (shape.type === 'string') return shape.value ?? 'x'.repeat(shape.cleanLength)
  if (shape.type === 'boolean' || shape.type === 'number') return shape.value
  if (shape.type === 'array') return shape.items.map(replayValue)
  if (shape.type === 'object') return Object.fromEntries(Object.entries(shape.fields).map(([key, value]) => [key, replayValue(value)]))
  throw new Error('unsupported_diagnostic_shape')
}
function capturedModel(): any {
  const model = makeModelOutputFixture()
  model.listing!.description = replayValue(diagnostic.description)
  model.listing!.description_completeness = replayValue(diagnostic.completeness)
  return model
}

test('replay: missing, unevaluated description with empty merit is normalized', () => {
  const model = capturedModel()
  const before = structuredClone(model)
  const result = validateListingXrayModelOutput(model)
  assert.deepEqual(model, before, 'normalization must not mutate provider input')
  assert.deepEqual(result.listing!.description, { ...before.listing.description, what_works: 'Descrição não encontrada no material enviado; não foi possível avaliar seus pontos positivos.' })
  assert.equal(result.listing!.description.evaluated, false)
  assert.equal(result.listing!.description_completeness.state, 'NOT_FOUND')
})

test('current valid descriptions remain unchanged, including already explained unevaluated descriptions', () => {
  for (const kind of ['excellent', 'append', 'replace', 'typo'] as const) {
    const model = makeModelOutputFixture(kind)
    assert.deepEqual(validateListingXrayModelOutput(model).listing!.description, model.listing!.description)
  }
  const model = capturedModel()
  model.listing.description.what_works = 'Descrição ausente; seção não avaliada.'
  assert.deepEqual(validateListingXrayModelOutput(model).listing!.description, model.listing.description)
})

test('missing and malformed descriptions or required content remain rejected', () => {
  for (const value of [undefined, null, '', 'texto arbitrário', [], 0, false, {}, { what_works: '' }]) {
    const model = capturedModel(); model.listing.description = value
    assert.throws(() => validateListingXrayModelOutput(model), /invalid_description/)
  }
  for (const field of ['analysis', 'what_works', 'components', 'evaluated', 'suggestion_mode', 'issue_codes']) {
    const model = capturedModel(); delete model.listing.description[field]
    assert.throws(() => validateListingXrayModelOutput(model), /invalid_description/)
  }
  for (const value of [null, [], {}, 0]) {
    const model = capturedModel(); model.listing.description.what_works = value
    assert.throws(() => validateListingXrayModelOutput(model), /invalid_description/)
  }
})

test('empty merit is accepted only in the observed unevaluated and no-suggestion case', () => {
  for (const change of [
    (m: any) => { m.listing.description.evaluated = true },
    (m: any) => { m.listing.description_completeness = { state: 'COMPLETE', evidence: null } },
    (m: any) => { m.listing.description_completeness = { state: 'PARTIAL', evidence: 'Trecho parcial.' } },
    (m: any) => { m.listing.description.components.clarity = 1 },
    (m: any) => { m.listing.description.analysis = '' },
    (m: any) => { m.listing.description.analysis = 'x'.repeat(3001) },
    (m: any) => { m.listing.description.suggestion_mode = 'append'; m.listing.description.suggestion = 'Melhore'; m.listing.description.copy_text = 'Texto'; m.listing.description.issue_codes = ['improvement']; m.listing.description.what_can_improve = 'Ajuste'; m.listing.description.how_to_improve = 'Acrescente' },
    (m: any) => { m.listing.description.extra = 'arbitrário' },
    (m: any) => { m.listing.description.components.extra = 0 },
    (m: any) => { m.listing.description.components.clarity = -1 },
    (m: any) => { m.listing.description.components.clarity = 6 },
    (m: any) => { m.listing.description.issue_codes = ['contradiction'] },
    (m: any) => { m.listing.description.copy_text = 'contradiction' },
  ]) {
    const model = capturedModel(); change(model)
    assert.throws(() => validateListingXrayModelOutput(model), /invalid_description/)
  }
})

test('other sections and top-level fields keep their validation', () => {
  for (const [field, error] of [['title', 'invalid_title'], ['information', 'invalid_information'], ['persuasion', 'invalid_persuasion'], ['attraction', 'invalid_attraction']] as const) {
    const model = capturedModel(); model.listing[field].what_works = ''
    assert.throws(() => validateListingXrayModelOutput(model), new RegExp(error))
  }
  const model = capturedModel(); model.summary = ''
  assert.throws(() => validateListingXrayModelOutput(model), /invalid_summary/)
  const social = makeModelOutputFixture('social'); social.social!.hook.analysis = ''
  assert.throws(() => validateListingXrayModelOutput(social), /invalid_social_hook/)
})
