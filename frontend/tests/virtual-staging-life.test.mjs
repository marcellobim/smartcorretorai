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
  LIFE_RENTAL_STAGE_OPTIONS,
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
  assert.equal(LIFE_SCENE_OPTIONS.some(({ label }) => /nenhum|sem pessoas|não incluir pessoas/i.test(label)), false)
  assert.match(page, /const \[lifeScene, setLifeScene\] = useState\(\(\) => restoredJourneyDraft\.lifeScene \|\| ''\)/)
  assert.match(page, /choices\(LIFE_SCENE_OPTIONS\.map\(option => \(\{ \.\.\.option, label: t\(`virtualStaging\.lifeScene\.\$\{option\.id\}`\) \}\)\), lifeScene/)
  assert.doesNotMatch(page, /setLifeScene\(current => \[/)
})

test('keeps Vida no Imovel CTA mandatory while broker CTA remains independent', () => {
  const next = questionId => getVirtualStagingNextQuestion({ questionId, journeyId: LIFE_IN_PROPERTY_JOURNEY_ID })

  const sequence = ['images']
  while (sequence.at(-1) !== 'review') sequence.push(next(sequence.at(-1)))

  assert.deepEqual(sequence, [
    'images',
    'purpose',
    'stage',
    'type',
    'facts',
    'location',
    'commercial',
    'highlights',
    'life_scene',
    'captions',
    'cta',
    'phone',
    'review',
  ])
  assert.equal(sequence.includes('presenter'), false)
  assert.equal(sequence.includes('narration'), false)
  assert.equal(sequence.includes('cta_enabled'), false)

  assert.equal(next('highlights'), 'life_scene')
  assert.equal(next('life_scene'), 'captions')
  assert.equal(next('captions'), 'cta')
  assert.equal(next('cta'), 'phone')
  assert.equal(next('phone'), 'review')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'furnish-renovate' }), 'review')
  assert.match(page, /\['life_scene', 3, 'Quem deseja incluir para valorizar ainda mais a apresentação do seu imóvel\?'\]/)
  assert.match(page, /\['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo\?'\]/)
  assert.match(page, /\['cta', 4, 'Qual chamada deseja usar no final\?'\]/)
  assert.match(page, /const selectedCta = isLifeInProperty \|\| ctaEnabled === true \? cta : ''/)
  assert.match(page, /const includeProfessionalPhone = includePhone === true/)
})

test('keeps the approved rental states shared by Virtual Staging and Video Imobiliario', () => {
  assert.deepEqual(LIFE_RENTAL_STAGE_OPTIONS, ['Pronto para morar', 'Disponível já', 'Vago'])
  assert.match(page, /property\.purpose === 'rent' \? LIFE_RENTAL_STAGE_OPTIONS : STAGES/)
  assert.doesNotMatch(page, /Pronto para mudar/)
  assert.match(smartTour, /getSmartTourStageOptions\(property\.purpose, STAGES\)/)
})

test('uses the official Vida no Imovel demo with the homologated protected modal', () => {
  assert.match(page, /activeDemo\.demoVideo/)
  assert.match(page, />Ver exemplo</)
  assert.match(page, /role="dialog"/)
  assert.match(page, /event\.key === 'Escape'/)
  assert.match(page, /event\.target === event\.currentTarget/)
  assert.match(page, /autoPlay playsInline controls preload="metadata"/)
  assert.match(page, /controlsList="nodownload noremoteplayback"/)
  assert.match(page, /disablePictureInPicture/)
  assert.match(page, /onContextMenu=\{event => event\.preventDefault\(\)\}/)
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
  assert.match(page, /buildLifeInPropertyGenerationPayload\(\{ lifeScene, captions: generation\.captions, language: draftLocale \}\)/)
})

test('shows the selected life profile in summary and review', () => {
  assert.match(page, /getLifeSceneLabel\(lifeScene, \{ t \}\)/)
  assert.match(page, /virtualStaging\.lifeBroker\.life/)
  assert.match(page, /virtualStaging\.review\.\$\{id\}/)
  assert.equal(getLifeSceneLabel('adult_dog', { t: key => key === 'virtualStaging.lifeScene.adult_dog' ? 'Adults with a dog' : '' }), 'Adults with a dog')
})

test('keeps the homologated Video Imobiliario questions unchanged', () => {
  for (const question of [
    'Envie até 5 fotos na ordem em que deseja apresentá-las.',
    'Qual é a finalidade do imóvel?',
    'Qual é o estado atual do imóvel?',
    'Que tipo de imóvel vamos apresentar?',
    'Quais são as principais medidas?',
    'Onde fica o imóvel?',
    'Quais informações comerciais deseja incluir?',
    'Quais são os principais destaques?',
    'Deseja destacar algumas informações importantes durante o vídeo?',
    'Qual chamada deseja usar no final?',
    'Deseja divulgar seu telefone profissional?',
  ]) {
    assert.ok(page.includes(question), `Virtual Staging: ${question}`)
    assert.ok(smartTour.includes(question) || smartTour.includes('smartTour.questions.'), `Vídeo Imobiliário: ${question}`)
  }
  for (const question of [
    'Deseja um apresentador virtual durante o vídeo?',
    'Deseja narração durante o vídeo?',
    'Deseja destacar algumas informações importantes durante o vídeo?',
    'Deseja uma chamada para ação no final do vídeo?',
  ]) assert.ok(smartTour.includes(question) || smartTour.includes('smartTour.questions.'), question)
  assert.doesNotMatch(smartTour, /life_scene|LIFE_SCENE_OPTIONS|Vida no imóvel/)
})
