import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/pages/LandingPage.jsx')
const app = read('../src/App.jsx')
const page = read('../src/pages/VirtualStaging.jsx')
const entry = read('../src/pages/VirtualStagingTrialEntry.jsx')
const migration = read('../../supabase/migrations/20261019010000_unify_free_account_smart_tokens.sql')

test('Landing sends Virtual Staging free CTA to secure signup and then the normal product', () => {
  assert.match(landing, /authEntryPath\('\/cadastro', 'virtual_staging'\)/)
  assert.match(entry, /authEntryPath\('\/cadastro', 'virtual_staging'\)/)
  assert.match(entry, /user \? '\/virtual-staging'/)
  assert.match(app, /path="\/virtual-staging"/)
})

test('Virtual Staging keeps its normal modules, transformations, and 1-5 image limit', () => {
  assert.match(page, /getFurnishRenovateTransformationOptions\(locale\)/)
  assert.match(page, /FURNISH_RENOVATE_MAX_IMAGES/)
  assert.match(page, /VirtualStagingModules selectedJourneyId/)
  assert.doesNotMatch(page, /landing_trial:/)
  assert.doesNotMatch(page, /trialMode/)
})

test('the free-account migration removes product allowlists but preserves the normal Virtual Staging contract', () => {
  assert.match(migration, /cl\.hidden_from_ui = FALSE OR cl\.source = 'trial'/)
  assert.doesNotMatch(migration, /TRIAL_PRODUCT_NOT_ALLOWED/)
  assert.match(migration, /p_image_count NOT BETWEEN 1 AND 5/)
  assert.match(migration, /remove_and_redecorate.*THEN 60 ELSE 30/s)
  assert.match(migration, /DROP TRIGGER IF EXISTS claim_virtual_staging_trial_use_on_prepare/)
})
