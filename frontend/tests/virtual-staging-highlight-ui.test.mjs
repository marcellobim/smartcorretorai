import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingHighlightGroups } from '../src/config/virtualStagingForm.js'
import {
  VIRTUAL_STAGING_HIGHLIGHT_LABELS,
  getVirtualStagingHighlightLabel,
  isVirtualStagingHighlightAvailableForMarket,
} from '../src/config/virtualStagingHighlightLabels.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/VirtualStaging.jsx'), 'utf8')

test('highlight labels are localized while their legacy values remain the identifiers', () => {
  const value = 'Varanda gourmet'

  assert.equal(getVirtualStagingHighlightLabel(value, { locale: 'pt-BR', market: 'BR' }), 'Varanda gourmet')
  assert.equal(getVirtualStagingHighlightLabel(value, { locale: 'en-US', market: 'US' }), 'Gourmet balcony')
  assert.equal(VIRTUAL_STAGING_HIGHLIGHT_LABELS[value].ptBR, value)
  assert.equal(VIRTUAL_STAGING_HIGHLIGHT_LABELS[value].enUS, 'Gourmet balcony')
  assert.match(page, /onClick=\{\(\) => toggleHighlight\(item\)\}/)
  assert.match(page, /getVirtualStagingHighlightLabel\(item, \{ locale, market \}\)/)
})

test('Vida no Imóvel and Apresentação pelo Corretor share the localized catalog without changing filters, order, or limits', () => {
  const groups = getVirtualStagingHighlightGroups('Apartamento')
  const availableGroups = groups
    .map(group => ({ ...group, items: group.items.filter(item => isVirtualStagingHighlightAvailableForMarket(item, 'US')) }))
    .filter(group => group.items.length)

  assert.deepEqual(availableGroups.map(group => group.title), groups.map(group => group.title))
  assert.deepEqual(availableGroups.flatMap(group => group.items), groups.flatMap(group => group.items))
  assert.match(page, /getVirtualStagingHighlightGroups\(property\.type\)\.map\(group => \(\{ \.\.\.group, items: group\.items\.filter\(item => isVirtualStagingHighlightAvailableForMarket\(item, market\)\) \}\)\)\.filter\(group => group\.items\.length\)/)
  assert.match(page, /property\.highlights\.length >= 10/)
})

test('selected, historical, and review presentation resolve labels without changing draft or payload values', () => {
  const selected = ['Varanda gourmet', 'Vista livre']
  const localized = selected.map(value => getVirtualStagingHighlightLabel(value, { locale: 'en-US', market: 'US' }))

  assert.deepEqual(selected, ['Varanda gourmet', 'Vista livre'])
  assert.deepEqual(localized, ['Gourmet balcony', 'Unobstructed view'])
  assert.match(page, /const selectedHighlightLabels = property\.highlights/)
  assert.match(page, /\.map\(value => getVirtualStagingHighlightLabel\(value, \{ locale: draftLocale, market: draftMarket \}\)\)/)
  assert.match(page, /const selectedLabels = property\.highlights\.map\(value => getVirtualStagingHighlightLabel\(value, \{ locale, market \}\)\)\.join\(' · '\)/)
  assert.match(page, /highlights: \[\]/)
})
