import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const studio = readFileSync(path.join(frontendRoot, 'src/pages/StudioHero.jsx'), 'utf8')
const location = readFileSync(path.join(frontendRoot, 'src/components/location/SmartCarouselCitySelect.jsx'), 'utf8')
const helperSource = studio
  .slice(studio.indexOf('function formatDisplayText'), studio.indexOf('function getDisplayLocation'))
  .replaceAll('export function', 'function')
const studioModule = Function(`${helperSource}; return { getEffectiveStudioCity, changeStudioStateLocation, changeStudioSelectedCity, changeStudioManualCity }`)()

test('keeps all 27 states and the shared State, City and editable neighborhood flow', () => {
  const stateList = location.slice(
    location.indexOf('export const SMART_CAROUSEL_STATE_OPTIONS'),
    location.indexOf('const LOCATION_CONTROL_CLASSES'),
  )
  const states = [...stateList.matchAll(/'([A-Z]{2})'/g)].map(([, uf]) => uf)
  assert.equal(states.length, 27)
  assert.equal(new Set(states).size, 27)
  assert.match(studio, /<SmartCarouselStateSelect[\s\S]*?value=\{answers\.uf\}/)
  assert.match(studio, /<SmartCarouselCitySelect[\s\S]*?uf=\{answers\.uf\}[\s\S]*?value=\{answers\.city\}/)
  assert.match(studio, /<SmartLocationTextInput[\s\S]*?ariaLabel=\{isCapture \? t\('virtualStaging\.location\.community'\) : t\('virtualStaging\.location\.neighborhood'\)\}[\s\S]*?value=\{answers\.district\}/)
})

test('resets dependent fields when State or selected City changes', () => {
  const previous = { uf: 'SP', city: 'Campinas', cityOther: '', district: 'Cambuí', captureHasDistrict: 'yes', cta: 'Saiba mais', imageCount: 3, objective: 'sale' }
  assert.deepEqual(studioModule.changeStudioStateLocation(previous, 'RJ'), {
    ...previous,
    uf: 'RJ',
    city: '',
    cityOther: '',
    district: '',
    captureHasDistrict: '',
    cta: '',
    imageCount: 1,
  })
  assert.deepEqual(studioModule.changeStudioSelectedCity(previous, 'Santos'), {
    ...previous,
    city: 'Santos',
    cityOther: '',
    district: '',
    captureHasDistrict: '',
    cta: '',
    imageCount: 1,
  })
})

test('uses one effective City and preserves legacy cityOther in manual mode', () => {
  assert.equal(studioModule.getEffectiveStudioCity({ city: 'Campinas', cityOther: '' }), 'Campinas')
  assert.equal(studioModule.getEffectiveStudioCity({ city: '', cityOther: 'são josé dos campos' }), 'São José dos Campos')
  assert.equal(studioModule.getEffectiveStudioCity({ city: 'Campinas', cityOther: 'santos' }), 'Santos')

  const manual = studioModule.changeStudioManualCity({ city: 'Campinas', cityOther: '', district: 'Centro', captureHasDistrict: 'yes', cta: 'Visite', imageCount: 3 }, 'são josé dos campos')
  assert.equal(manual.city, '')
  assert.equal(manual.cityOther, 'São José dos Campos')
  assert.equal(manual.district, '')
  assert.equal(manual.captureHasDistrict, '')
  assert.equal(studioModule.getEffectiveStudioCity(manual), 'São José dos Campos')
})

test('offers an accessible manual fallback without replacing the normal IBGE flow', () => {
  assert.match(studio, /const usesManualCity = manualCityMode \|\| Boolean\(formatDisplayText\(answers\.cityOther\)\)/)
  assert.match(studio, /Não encontrou sua cidade\? Digite manualmente\./)
  assert.match(studio, /aria-label=\{t\('studio\.location\.typeCity'\)\}/)
  assert.match(studio, /ariaLabel="Cidade manual"/)
  assert.match(studio, /aria-label=\{t\('studio\.location\.backToCities'\)\}/)
  assert.match(studio, /setManualCityMode\(true\)[\s\S]*?changeStudioManualCity\(\{ \.\.\.current, city: '' \}, current\.cityOther\)/)
  assert.match(studio, /setManualCityMode\(false\)[\s\S]*?changeStudioSelectedCity\(current, ''\)/)
})

test('keeps the fallback available even when the IBGE selector cannot provide a City', () => {
  const cityBlock = studio.slice(studio.indexOf('{answers.uf && ('), studio.indexOf('{cityValue && isCapture'))
  assert.match(cityBlock, /<SmartCarouselCitySelect/)
  assert.match(cityBlock, /Não encontrou sua cidade\? Digite manualmente\./)
  assert.doesNotMatch(cityBlock, /onLoadError|citiesError|fetch\(/)
})

test('uses the effective City once in summary, payload and result delivery', () => {
  assert.match(studio, /const cityValue = getEffectiveStudioCity\(answers\)/)
  assert.match(studio, /city: cityValue,[\s\S]*?district: districtValue,[\s\S]*?location: displayLocation/)
  assert.match(studio, /<StudioChecklist[\s\S]*?cityValue=\{cityValue\}/)
  assert.match(studio, /<ResultPanel[\s\S]*?cityValue=\{cityValue\}/)
  assert.match(studio, /disabled=\{!answers\.uf \|\| !cityValue/)
})
