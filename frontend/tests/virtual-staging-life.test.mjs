import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingNextQuestion } from '../src/config/virtualStagingConversation.js'
import {
  buildLifeInPropertyGenerationPayload,
  getLifeSceneLabel,
  LIFE_IN_PROPERTY_JOURNEY_ID,
  LIFE_SCENE_OPTIONS,
} from '../src/config/virtualStagingLife.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const page = read('src/pages/VirtualStaging.jsx')
const smartTour = read('src/pages/SmartTourAI.jsx')

test('Vida no Imovel has the nine approved single-choice profiles', () => {
  assert.deepEqual(LIFE_SCENE_OPTIONS, [
    { id: 'young', label: 'Jovens' },
    { id: 'young_dog', label: 'Jovens com cachorro' },
    { id: 'young_cat', label: 'Jovens com gato' },
    { id: 'adult', label: 'Adultos' },
    { id: 'adult_dog', label: 'Adultos com cachorro' },
    { id: 'adult_cat', label: 'Adultos com gato' },
    { id: 'senior', label: 'Idosos' },
    { id: 'senior_dog', label: 'Idosos com cachorro' },
    { id: 'senior_cat', label: 'Idosos com gato' },
  ])
  assert.equal(getLifeSceneLabel('adult_dog'), 'Adultos com cachorro')
  assert.match(page, /const \[lifeScene, setLifeScene\] = useState\(''\)/)
  assert.match(page, /choices\(LIFE_SCENE_OPTIONS, lifeScene/)
  assert.doesNotMatch(page, /setLifeScene\(current => \[/)
})

test('branches only Vida no Imovel after highlights and makes CTA mandatory', () => {
  const next = questionId => getVirtualStagingNextQuestion({ questionId, journeyId: LIFE_IN_PROPERTY_JOURNEY_ID })

  assert.equal(next('highlights'), 'life_scene')
  assert.equal(next('life_scene'), 'captions')
  assert.equal(next('captions'), 'cta')
  assert.equal(next('cta'), 'phone')
  assert.equal(next('phone'), 'review')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'furnish-renovate' }), 'presenter')
  assert.match(page, /\['life_scene', 3, 'Quem deseja incluir para valorizar ainda mais a apresentação do seu imóvel\?'\]/)
  assert.match(page, /\['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo\?'\]/)
  assert.match(page, /\['cta', 4, 'Qual chamada deseja usar no final\?'\]/)
  assert.match(page, /const selectedCta = isLifeInProperty \|\| ctaEnabled === true \? cta : ''/)
})

test('builds the Vida no Imovel JSON without presenter semantics', () => {
  const payload = buildLifeInPropertyGenerationPayload({ lifeScene: 'adult_dog', captions: 'disabled' })

  assert.deepEqual(payload, {
    mode: 'narrated_tour',
    narration: 'enabled',
    captions: 'disabled',
    furniture: 'original',
    stagingPresentation: 'final_only',
    language: 'pt-BR',
    life_scene: 'adult_dog',
  })
  assert.equal('presenterGender' in payload, false)
  assert.equal(buildLifeInPropertyGenerationPayload({ lifeScene: 'invalid', captions: 'enabled' }).life_scene, '')
  assert.match(page, /buildLifeInPropertyGenerationPayload\(\{ lifeScene, captions: generation\.captions \}\)/)
})

test('shows the selected life profile in summary and review', () => {
  assert.match(page, /Vida no imóvel: \$\{getLifeSceneLabel\(lifeScene\)\}/)
  assert.match(page, /label: 'Vida no imóvel', value: getLifeSceneLabel\(lifeScene\)/)
  assert.match(page, /life_scene: 'Vida no imóvel'/)
})

test('keeps the homologated Video Imobiliario questions unchanged', () => {
  for (const question of [
    'Deseja um apresentador virtual durante o vídeo?',
    'Deseja narração durante o vídeo?',
    'Deseja destacar algumas informações importantes durante o vídeo?',
    'Deseja uma chamada para ação no final do vídeo?',
  ]) assert.ok(smartTour.includes(question), question)
  assert.doesNotMatch(smartTour, /life_scene|LIFE_SCENE_OPTIONS|Vida no imóvel/)
})
