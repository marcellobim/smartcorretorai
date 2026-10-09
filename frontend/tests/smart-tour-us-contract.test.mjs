import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')
const form = readFileSync(new URL('../src/config/smartTourForm.js', import.meta.url), 'utf8')

test('US facts use bathrooms and sqft without silently reusing suites', () => {
  assert.match(form, /field === 'suites' \? 'bathrooms'/)
  assert.match(source, /const areaUnit = market === 'US' \? 'sqft' : 'm²'/)
  assert.match(source, /bathrooms: ''/)
  assert.match(source, /suites: '', condominium: '', iptu: '', district: ''/)
})

test('US location uses the shared County-to-City query with optional validated ZIP', () => {
  assert.match(source, /getUsCitiesByCounty\(property\.state, property\.county/)
  assert.match(source, /cities\.includes\(property\.city\)/)
  assert.match(source, /\(!zipCode \|\| isValidUsZipCode\(zipCode\)\)/)
  assert.match(source, /setPropertyField\('county', value\); setPropertyField\('city', ''\); setPropertyField\('zipCode', ''\); setPropertyField\('neighborhoodCommunity', ''\)/)
  assert.match(source, /cityStatus === 'error'/)
})

test('only the final explicit handler invokes smart-tour-generate and recovery is read-only by default', () => {
  const invocations = [...source.matchAll(/supabase\.functions\.invoke\('smart-tour-generate'/g)]
  assert.equal(invocations.length, 2) // photo flow plus frozen short-video branch
  assert.match(source, /setRecoverableJob\(activeJob\)/)
  assert.doesNotMatch(source, /setActiveInputFlow\(activeJob\.inputFlow\)[\s\S]{0,180}poll\(activeJob\.jobId\)/)
  assert.match(source, /onClick=\{\(\) => \{ setStatus\('generating'\);[\s\S]{0,140}poll\(recoverableJob\.jobId\)/)
  assert.match(source, /generationLockRef\.current \|\| authRequired/)
})

test('the Real Estate Video step band is absent and US examples with embedded Portuguese are withheld', () => {
  assert.doesNotMatch(source, /<ProductSteps/)
  assert.match(source, /const examples = market === 'US' \? \[\] : visibleExamples/)
  assert.match(source, /usAssetsPending/)
})
