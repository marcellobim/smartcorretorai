import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSmartTourStructuredBriefing, validateSmartTourRequest } from '../index.ts'

const base = { clientRequestId: '123e4567-e89b-12d3-a456-426614174000', imagePaths: ['u/1.jpg'], imageOrder: ['u/1.jpg'], property: { purpose: 'sale', type: 'us_condo', city: 'Miami', district: 'Brickell', highlights: ['us_near_downtown'] }, generation: { mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled' }, selectedCta: '' }

test('locale and market contract preserves supported values and safely falls back for legacy or invalid requests', () => {
  const pair = (value: { language: string; market: string }) => ({ language: value.language, market: value.market })
  assert.deepEqual(pair(validateSmartTourRequest({ ...base, language: 'pt-BR', market: 'BR' })), { language: 'pt-BR', market: 'BR' })
  assert.deepEqual(pair(validateSmartTourRequest({ ...base, language: 'en-US', market: 'US' })), { language: 'en-US', market: 'US' })
  assert.deepEqual(pair(validateSmartTourRequest(base)), { language: 'pt-BR', market: 'BR' })
  assert.equal(validateSmartTourRequest({ ...base, language: 'invalid', market: 'invalid' }).language, 'pt-BR')
  assert.equal(validateSmartTourRequest({ ...base, language: 'invalid', market: 'invalid' }).market, 'BR')
})

test('EN-US briefing uses English provider instructions and captions while PT-BR remains legacy', () => {
  const en = buildSmartTourStructuredBriefing({ generation: { ...base.generation, language: 'en-US' }, property: base.property, selectedCta: '', imagePaths: base.imagePaths, language: 'en-US' })
  const pt = buildSmartTourStructuredBriefing({ generation: { ...base.generation, language: 'pt-BR' }, property: { ...base.property, type: 'Apartamento', highlights: ['Varanda'] }, selectedCta: '', imagePaths: base.imagePaths, language: 'pt-BR' })
  assert.match(JSON.stringify(en), /For Sale/)
  assert.match(en.tarefa, /PRIMARY MISSION/)
  assert.doesNotMatch(JSON.stringify(en), /Você|Não inventar|Criar e exibir/)
  assert.match(JSON.stringify(pt), /Venda|À venda/)
  assert.match(pt.tarefa, /MISSÃO PRINCIPAL/)
})
