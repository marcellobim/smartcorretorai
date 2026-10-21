import assert from 'node:assert/strict'
import test from 'node:test'

import { clearProductDraft, readProductDraft, writeProductDraft } from '../src/lib/product-draft.js'
import {
  createStudioModeDraft,
  getStudioModeDraftProductKey,
  isStudioModeDraftMeaningful,
  restoreStudioModeDraft,
  STUDIO_MODE_DRAFT_SCHEMA_VERSION,
} from '../src/lib/studio-mode-draft.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(key) || null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const initialAnswers = Object.freeze({
  objective: '',
  propertyType: '',
  profile: '',
  city: '',
  differentials: [],
  cta: '',
  creativeMode: 'cinematic',
  professionalIdentity: { enabled: null, name_source: null, credential_source: null },
})

function read(storage, mode) {
  return readProductDraft(storage, {
    productKey: getStudioModeDraftProductKey(mode),
    schemaVersion: STUDIO_MODE_DRAFT_SCHEMA_VERSION,
    userId: 'studio-user',
  })
}

function write(storage, mode, data) {
  return writeProductDraft(storage, {
    productKey: getStudioModeDraftProductKey(mode),
    schemaVersion: STUDIO_MODE_DRAFT_SCHEMA_VERSION,
    userId: 'studio-user',
    data,
  })
}

function clear(storage, mode) {
  clearProductDraft(storage, {
    productKey: getStudioModeDraftProductKey(mode),
    schemaVersion: STUDIO_MODE_DRAFT_SCHEMA_VERSION,
  })
}

test('Commercial and Creative Video use independent draft keys and never restore each other’s answers', () => {
  const storage = new MemoryStorage()
  const commercial = createStudioModeDraft({
    answers: { ...initialAnswers, objective: 'sale', propertyType: 'CASA', profile: 'PRONTOS', city: 'Tampa' },
    step: 5,
    manualCityMode: false,
  })
  const creative = createStudioModeDraft({
    answers: { ...initialAnswers, objective: 'property_capture', propertyType: 'APARTAMENTO', visualStyle: 'MODERNO', creativeMode: 'free_ai' },
    step: 3,
    manualCityMode: true,
  })

  assert.notEqual(getStudioModeDraftProductKey('cinematic'), getStudioModeDraftProductKey('free_ai'))
  assert.equal(write(storage, 'cinematic', commercial), true)
  assert.equal(write(storage, 'free_ai', creative), true)

  const restoredCreative = restoreStudioModeDraft({ initialAnswers, mode: 'free_ai', storedDraft: read(storage, 'free_ai') })
  assert.equal(restoredCreative.answers.creativeMode, 'free_ai')
  assert.equal(restoredCreative.answers.objective, 'property_capture')
  assert.equal(restoredCreative.answers.profile, '')
  assert.equal(restoredCreative.answers.city, '')
  assert.equal(restoredCreative.step, 3)

  const restoredCommercial = restoreStudioModeDraft({ initialAnswers, mode: 'cinematic', storedDraft: read(storage, 'cinematic') })
  assert.equal(restoredCommercial.answers.creativeMode, 'cinematic')
  assert.equal(restoredCommercial.answers.objective, 'sale')
  assert.equal(restoredCommercial.answers.propertyType, 'CASA')
  assert.equal(restoredCommercial.answers.city, 'Tampa')
  assert.equal(restoredCommercial.step, 5)
})

test('Restart clears only the current mode draft and a refresh restores that mode cleanly', () => {
  const storage = new MemoryStorage()
  const commercial = createStudioModeDraft({ answers: { ...initialAnswers, objective: 'sale', propertyType: 'CASA' }, step: 4, manualCityMode: false })
  const creative = createStudioModeDraft({ answers: { ...initialAnswers, objective: 'rent', creativeMode: 'free_ai', visualStyle: 'MODERNO' }, step: 3, manualCityMode: false })
  write(storage, 'cinematic', commercial)
  write(storage, 'free_ai', creative)

  clear(storage, 'cinematic')
  const restartedCommercial = restoreStudioModeDraft({ initialAnswers, mode: 'cinematic', storedDraft: read(storage, 'cinematic') })
  assert.deepEqual(restartedCommercial, { answers: { ...initialAnswers, creativeMode: 'cinematic' }, step: 1, manualCityMode: false })
  assert.equal(read(storage, 'free_ai').answers.visualStyle, 'MODERNO')
})

test('mode draft persistence is market-neutral and stores no files or generation recovery state', () => {
  const draft = createStudioModeDraft({
    answers: { ...initialAnswers, objective: 'sale', city: 'Tampa', creativeMode: 'cinematic' },
    step: 2,
    manualCityMode: false,
  })

  assert.equal(isStudioModeDraftMeaningful(draft), true)
  assert.deepEqual(Object.keys(draft).sort(), ['answers', 'manualCityMode', 'step'])
  assert.equal('locale' in draft, false)
  assert.equal('market' in draft, false)
  assert.equal('files' in draft, false)
  assert.equal('jobId' in draft, false)
})
