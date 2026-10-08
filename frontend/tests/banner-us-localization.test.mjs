import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../src/pages/HeroNext.jsx', import.meta.url), 'utf8')
const labels = readFileSync(new URL('../src/i18n/messages/en-US.js', import.meta.url), 'utf8')

test('US Banner keeps distinct profile categories and localizes system choices', () => {
  for (const pair of ["'Econômico': 'Affordable'", "'Alto padrão': 'High-end'", "'Luxo': 'Luxury'", "'Sobrado': 'Townhouse'", "'Em obras': 'Under Construction'"]) assert.ok(labels.includes(pair), pair)
})

test('US Banner renders answered catalog values through the active market labels and supports retry', () => {
  assert.match(page, /formatAnswer\(answers\[question\.id\], optionLabel\)/)
  assert.match(page, /setUsCitiesAttempt\(value => value \+ 1\)/)
  assert.match(page, /retryCities/)
  assert.match(page, /noCities/)
})
