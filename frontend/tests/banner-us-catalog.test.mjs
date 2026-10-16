import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

let vite
let filterHeroNextCatalogOptions
let filterHeroNextCatalogGroups
let getHeroNextRentalGuaranteeOptions

test.before(async () => {
  vite = await createServer({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://project.example.test'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
    },
  })
  ;({ filterHeroNextCatalogOptions, filterHeroNextCatalogGroups, getHeroNextRentalGuaranteeOptions } = await vite.ssrLoadModule('/src/pages/HeroNext.jsx'))
})

test.after(async () => vite?.close())

const brazilOnly = ['Minha Casa Minha Vida', 'Usa FGTS', 'Subsídio do governo', 'Parcelamento durante a obra', 'Próximo à CPTM/trem', 'Seguro-fiança', 'Título de capitalização']

test('US Banner catalog excludes Brazilian-only choices while BR preserves them', () => {
  const us = filterHeroNextCatalogOptions(brazilOnly, 'US')
  assert.deepEqual(us, [])
  assert.deepEqual(filterHeroNextCatalogOptions(brazilOnly, 'BR'), brazilOnly)
})

test('US Banner removes Brazilian-only values from grouped option catalogs', () => {
  const groups = [{ title: 'Commercial terms', options: ['Financing available', 'Usa FGTS', 'Subsídio do governo'] }, { title: 'Location', options: ['Near a park', 'Próximo à CPTM/trem'] }]
  assert.deepEqual(filterHeroNextCatalogGroups(groups, 'US'), [
    { title: 'Commercial terms', options: ['Financing available'] },
    { title: 'Location', options: ['Near a park'] },
  ])
  assert.deepEqual(filterHeroNextCatalogGroups(groups, 'BR'), groups)
})

test('the live Banner flow applies the US catalog filter before rendering options', () => {
  const source = readFileSync(new URL('../src/pages/HeroNext.jsx', import.meta.url), 'utf8')
  assert.match(source, /options: filterHeroNextCatalogOptions\(question\.options, market\)/)
  assert.match(source, /groups: filterHeroNextCatalogGroups\(question\.groups, market\)/)
  assert.match(source, /HERO_NEXT_US_EXCLUDED_SYSTEM_VALUES\.has\(normalizeComparable\(value\)\)/)
})

test('US Banner keeps only compatible rental guarantee choices while BR retains its catalog', () => {
  assert.deepEqual(getHeroNextRentalGuaranteeOptions('US').map(({ id }) => id), ['fiador', 'caucao', 'a_combinar', 'nao_informar'])
  assert.deepEqual(getHeroNextRentalGuaranteeOptions('BR').map(({ id }) => id), ['seguro_fianca', 'fiador', 'caucao', 'titulo_capitalizacao', 'a_combinar', 'nao_informar'])
})
