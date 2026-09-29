import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ptBR from '../src/i18n/messages/pt-BR.js'
import enUS from '../src/i18n/messages/en-US.js'
import { getLifeSceneLabel } from '../src/config/virtualStagingLife.js'

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

test('Smart Space retains the legacy confirmation and review-label paths', () => {
  assert.match(page, /if \(journeyId === FURNISH_RENOVATE_JOURNEY_ID\) \{\s+if \(id === 'images'\) return 'Ótimo! As fotografias serão usadas na ordem escolhida\.'/)
  assert.match(page, /item\.displayLabel \|\| reviewLabel\(item\.id\)/)
})
