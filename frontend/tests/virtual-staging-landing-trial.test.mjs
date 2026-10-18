import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const landing = read('../src/pages/LandingPage.jsx')
const app = read('../src/App.jsx')
const page = read('../src/pages/VirtualStaging.jsx')
const entry = read('../src/pages/VirtualStagingTrialEntry.jsx')
const trial = read('../src/lib/virtual-staging-trial.js')

test('Landing sends the Virtual Staging free CTA through the dedicated trial entry', () => {
  assert.match(landing, /to="\/testar-virtual-staging"/)
  assert.match(landing, /virtual_staging_trial_entry/)
  assert.match(app, /path="\/testar-virtual-staging" element=\{<VirtualStagingTrialEntry \/>\}/)
  assert.match(entry, /virtualStagingTrialPath\(\)/)
  assert.match(entry, /preserveVirtualStagingTrialReturn\(\)/)
  assert.match(trial, /landing-virtual-staging/)
})

test('Landing trial enters only Virtual Staging and never presents the other Snetia Space journeys', () => {
  assert.match(page, /if \(trialMode\) return FURNISH_RENOVATE_JOURNEY_ID/)
  assert.match(page, /title=\{trialMode \? VIRTUAL_STAGING_PRODUCT_DESCRIPTOR : VIRTUAL_STAGING_PRODUCT_NAME\}/)
  assert.match(page, /!trialMode && <ProductCard ref=\{modulesRef\}/)
  assert.match(page, /trialMode \? getFurnishRenovateTransformationOptions\(locale\)\.filter\(option => option\.id === 'furnish'\)/)
  assert.match(page, /trialMode \? 1 : FURNISH_RENOVATE_MAX_IMAGES/)
  assert.match(page, /landing_trial: trialMode/)
  assert.match(page, /chooseAnotherButton = trialMode \? null/)
})

test('a spent trial provides a localized route to Plans without changing paid routes', () => {
  assert.match(page, /trialAlreadyUsed/)
  assert.match(page, /navigateToPlans: \(\) => navigate\('\/planos'\)/)
  assert.match(read('../src/i18n/messages/en-US.js'), /View Plans and Smart Tokens/)
  assert.match(read('../src/i18n/messages/pt-BR.js'), /Ver planos e Smart Tokens/)
})

test('trial return survives login without replacing the normal authenticated route', () => {
  assert.match(trial, /VIRTUAL_STAGING_TRIAL_RETURN_KEY/)
  assert.match(trial, /takeVirtualStagingTrialReturn/)
  assert.match(read('../src/lib/smart-tour-auth-recovery.js'), /takeVirtualStagingTrialReturn\(storage\)/)
  assert.match(app, /path="\/virtual-staging"/)
})
