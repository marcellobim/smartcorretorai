import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const componentPath = path.join(frontendRoot, 'src/components/location/SmartCarouselCitySelect.jsx')
const source = await readFile(componentPath, 'utf8')
const element = React.createElement
let vite
let SmartCarouselCitySelect
let SmartCarouselStateSelect
let SmartLocationTextInput
let SMART_CAROUSEL_STATE_OPTIONS
let fetchSmartCarouselCities

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const locationModule = await vite.ssrLoadModule('/src/components/location/SmartCarouselCitySelect.jsx')
  SmartCarouselCitySelect = locationModule.default
  SmartCarouselStateSelect = locationModule.SmartCarouselStateSelect
  SmartLocationTextInput = locationModule.SmartLocationTextInput
  SMART_CAROUSEL_STATE_OPTIONS = locationModule.SMART_CAROUSEL_STATE_OPTIONS
  fetchSmartCarouselCities = locationModule.fetchSmartCarouselCities
})

after(async () => {
  await vite?.close()
})

const render = (component, props) => renderToStaticMarkup(element(component, props))

test('exposes all 27 Brazilian states without duplicates', () => {
  assert.equal(SMART_CAROUSEL_STATE_OPTIONS.length, 27)
  assert.equal(new Set(SMART_CAROUSEL_STATE_OPTIONS).size, 27)
  for (const uf of ['AC', 'DF', 'RJ', 'SP', 'TO']) assert.ok(SMART_CAROUSEL_STATE_OPTIONS.includes(uf))
})

test('renders State with accessible labels and retrocompatible accents', () => {
  const baseProps = { value: 'SP', onChange: () => {} }
  const emerald = render(SmartCarouselStateSelect, baseProps)
  assert.match(emerald, /aria-label="Estado"/)
  assert.match(emerald, /border-emerald-100/)
  assert.match(emerald, /<option value="SP" selected="">SP<\/option>/)

  const primary = render(SmartCarouselStateSelect, { ...baseProps, accent: 'primary', ariaLabel: 'UF do imóvel' })
  assert.match(primary, /aria-label="UF do imóvel"/)
  assert.match(primary, /border-primary-100/)

  const cyan = render(SmartCarouselStateSelect, { ...baseProps, accent: 'cyan' })
  assert.match(cyan, /border-cyan-100/)

  const fallback = render(SmartCarouselStateSelect, { ...baseProps, accent: 'unknown' })
  assert.match(fallback, /border-emerald-100/)
})

test('renders City with its accessible label and existing disabled/loading contract', () => {
  const withoutState = render(SmartCarouselCitySelect, { uf: '', value: '', onChange: () => {} })
  assert.match(withoutState, /aria-label="Cidade"/)
  assert.match(withoutState, /disabled=""/)
  assert.match(withoutState, /Selecione a cidade/)
  assert.match(withoutState, /border-emerald-100/)

  const primary = render(SmartCarouselCitySelect, { uf: '', value: '', onChange: () => {}, accent: 'primary' })
  assert.match(primary, /border-primary-100/)
  const cyan = render(SmartCarouselCitySelect, { uf: '', value: '', onChange: () => {}, accent: 'cyan' })
  assert.match(cyan, /border-cyan-100/)
  const fallback = render(SmartCarouselCitySelect, { uf: '', value: '', onChange: () => {}, accent: 'unknown' })
  assert.match(fallback, /border-emerald-100/)

  assert.match(source, /setCitiesLoading\(true\)/)
  assert.match(source, /disabled=\{!uf \|\| citiesLoading\}/)
  assert.match(source, /citiesLoading \? 'Carregando cidades\.\.\.' : 'Selecione a cidade'/)
  assert.match(source, /if \(!uf\) \{[\s\S]*?setCities\(\[\]\)[\s\S]*?setCitiesLoading\(false\)/)
})

test('preserves the editable neighborhood input contract', () => {
  const markup = render(SmartLocationTextInput, {
    value: 'Moema',
    onChange: () => {},
    accent: 'cyan',
    placeholder: 'Digite o bairro',
  })
  assert.match(markup, /aria-label="Bairro"/)
  assert.match(markup, /value="Moema"/)
  assert.match(markup, /placeholder="Digite o bairro"/)
  assert.match(markup, /border-cyan-100/)
})

test('uses the official IBGE URL and maps only valid city names', async () => {
  let request
  const cities = await fetchSmartCarouselCities('SP', {
    signal: { name: 'test-signal' },
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { json: async () => [{ nome: 'São Paulo' }, { nome: '' }, {}, { nome: 'Campinas' }] }
    },
  })

  assert.equal(request.url, 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/SP/municipios?orderBy=nome')
  assert.deepEqual(request.options, { signal: { name: 'test-signal' } })
  assert.deepEqual(cities, ['São Paulo', 'Campinas'])

  const empty = await fetchSmartCarouselCities('RJ', {
    fetchImpl: async () => ({ json: async () => ({ unexpected: true }) }),
  })
  assert.deepEqual(empty, [])
})

test('preserves fetch errors for the existing component error handler', async () => {
  const networkError = new Error('offline')
  await assert.rejects(
    fetchSmartCarouselCities('PE', { fetchImpl: async () => { throw networkError } }),
    error => error === networkError,
  )
  assert.match(source, /\.catch\(\(error\) => \{[\s\S]*?error\?\.name !== 'AbortError'[\s\S]*?setCities\(\[\]\)/)
  assert.match(source, /if \(!controller\.signal\.aborted\) setCitiesLoading\(false\)/)
})

test('passes AbortController signals and cancels the previous UF request deterministically', async () => {
  const firstController = new AbortController()
  const abortableFetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    }, { once: true })
  })

  const staleRequest = fetchSmartCarouselCities('SP', {
    signal: firstController.signal,
    fetchImpl: abortableFetch,
  })
  firstController.abort()
  await assert.rejects(staleRequest, error => error.name === 'AbortError')

  const currentCities = await fetchSmartCarouselCities('RJ', {
    signal: new AbortController().signal,
    fetchImpl: async () => ({ json: async () => [{ nome: 'Niterói' }] }),
  })
  assert.deepEqual(currentCities, ['Niterói'])
  assert.match(source, /return \(\) => controller\.abort\(\)/)
})
