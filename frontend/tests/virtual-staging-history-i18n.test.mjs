import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ptBR from '../src/i18n/messages/pt-BR.js'
import enUS from '../src/i18n/messages/en-US.js'
import { getLifeSceneLabel } from '../src/config/virtualStagingLife.js'
import { getVirtualStagingHighlightGroupLabel } from '../src/config/virtualStagingHighlightLabels.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/VirtualStaging.jsx'), 'utf8')
const lifeConfig = readFileSync(path.join(frontendRoot, 'src/config/virtualStagingLife.js'), 'utf8')

test('Life and Broker history, review, measures, phone, highlights, and BR district use localized presentation keys', () => {
  for (const messages of [ptBR, enUS]) {
    assert.ok(messages.virtualStaging.history.default)
    assert.ok(messages.virtualStaging.history.phoneProfessional)
    assert.ok(messages.virtualStaging.history.phoneNone)
    assert.ok(messages.virtualStaging.highlights.instruction)
    assert.ok(messages.virtualStaging.highlights.none)
    assert.ok(messages.virtualStaging.review.presenter_reference)
    assert.ok(messages.virtualStaging.review.life_scene)
  }
  assert.match(page, /virtualStaging\.history\.\$\{key\}/)
  assert.match(page, /virtualStaging\.measures\.bedrooms/)
  assert.match(page, /virtualStaging\.highlights\.instruction/)
  assert.match(page, /virtualStaging\.highlights\.none/)
  assert.match(page, /placeholder=\{t\('virtualStaging\.location\.neighborhood'\)\}/)
})

test('localized life-scene presentation leaves the persisted scene ID unchanged', () => {
  const lifeScene = 'adult_dog'
  assert.equal(getLifeSceneLabel(lifeScene, { t: () => 'Adults with a dog' }), 'Adults with a dog')
  assert.equal(lifeScene, 'adult_dog')
  assert.match(lifeConfig, /life_scene: LIFE_SCENE_IDS\.has\(lifeScene\) \? lifeScene : ''/)
})

test('Smart Space uses localized confirmation and review-label paths', () => {
  assert.match(page, /if \(journeyId === FURNISH_RENOVATE_JOURNEY_ID\) \{\s+if \(id === 'images'\) return getFurnishRenovateCopy\(locale\)\.imagesConfirmation/)
  assert.ok(enUS.virtualStaging.smartSpace.before)
  assert.ok(enUS.virtualStaging.smartSpace.delivery.transformed)
  assert.match(page, /item\.displayLabel \|\| reviewLabel\(item\.id\)/)
})

test('the three Smart Space modules hide intermediate chrome and keep US system copy in English', () => {
  const smartSpaceConfirmation = page.slice(page.indexOf('function virtualStagingConfirmation'), page.indexOf('async function downloadFurnishRenovateResult'))
  const journey = page.slice(page.indexOf('function VirtualStagingJourney'), page.indexOf('function VirtualSpaceHeroVisual'))
  assert.match(smartSpaceConfirmation, /locale === 'en-US'/)
  assert.match(smartSpaceConfirmation, /Great choice\. The transformation has been selected\./)
  assert.match(smartSpaceConfirmation, /Your choice has been saved\./)
  assert.doesNotMatch(smartSpaceConfirmation, /Perfeito! Informação registrada\./)
  assert.match(journey, /showHeader=\{false\}/)
  assert.match(journey, /showSummary=\{false\}/)
  assert.doesNotMatch(journey, /<ProductSteps|journeySteps|summaryItems=/)
  assert.match(journey, /Final review|review=\{question\[0\] === 'review'\}/)
  assert.ok(enUS.virtualStaging.history.default.includes('Perfect!'))
  assert.ok(enUS.virtualStaging.ui.restoreDraft.includes('Draft restored'))
  assert.ok(enUS.virtualStaging.lifeBroker.uploading.includes('Uploading'))
  assert.ok(enUS.virtualStaging.lifeBroker.recoveryFailed.includes('could not be recovered'))
})

test('Life and Broker journey chrome, review values, demos, and result actions use presentation labels', () => {
  for (const messages of [ptBR, enUS]) {
    assert.ok(messages.virtualStaging.photos.one)
    assert.ok(messages.virtualStaging.photos.many)
    assert.ok(messages.virtualStaging.steps.photos)
    assert.ok(messages.virtualStaging.steps.reference)
    assert.ok(messages.virtualStaging.journey.life.title)
    assert.ok(messages.virtualStaging.journey.broker.title)
    assert.ok(messages.virtualStaging.demo.close)
  }
  assert.equal(getVirtualStagingHighlightGroupLabel('Localização', { locale: 'en-US' }), 'Location')
  assert.equal(getVirtualStagingHighlightGroupLabel('Localização'), 'Localização')
  assert.match(page, /createNewLabel=\{t\('virtualStaging\.lifeBroker\.newProject'\)\}/)
  assert.match(page, /getVirtualStagingOptionLabel\(property\.stage, t\)/)
  assert.match(page, /getVirtualStagingOptionLabel\(property\.type, t\)/)
  assert.match(page, /getVirtualStagingOptionLabel\(cta, t\)/)
  assert.match(page, /getVirtualStagingHighlightGroupLabel\(group\.title, \{ locale \}\)/)
  assert.match(page, /virtualStaging\.journey\.chooseAnother/)
  assert.match(page, /virtualStaging\.demo\.expanded/)
})
