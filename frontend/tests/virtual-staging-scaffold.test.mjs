import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingJourney, getVirtualStagingJourneySessionKey, VIRTUAL_STAGING_JOURNEYS } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const readBuffer = relativePath => readFileSync(path.join(repositoryRoot, relativePath))

test('registers Virtual Space on the preserved Virtual Staging technical route', () => {
  const app = read('frontend/src/App.jsx')
  const layout = read('frontend/src/components/layout/AppLayout.jsx')

  assert.match(app, /import VirtualStaging from ['"]\.\/pages\/VirtualStaging['"]/)
  assert.match(app, /<Route path="\/virtual-staging" element=\{<VirtualStaging \/>\} \/>/)
  assert.match(layout, /location\.pathname === '\/virtual-staging'/)
})

test('places Virtual Space before Banners Rapidos and keeps Smart Tokens only in the sidebar', () => {
  const dashboard = read('frontend/src/pages/Dashboard.jsx')
  const sidebar = read('frontend/src/components/layout/Sidebar.jsx')
  const catalog = dashboard.slice(dashboard.indexOf('const mainActions'), dashboard.indexOf('const statusLabel'))
  const bannersPosition = catalog.indexOf("id: 'banners-rapidos'")
  const stagingPosition = catalog.indexOf("id: 'virtual-staging'")

  assert.ok(stagingPosition >= 0 && bannersPosition > stagingPosition)
  assert.match(catalog, /id: 'virtual-staging'[\s\S]*?title: 'Virtual Space'[\s\S]*?to: '\/virtual-staging'[\s\S]*?label: 'Criar projeto'/)
  assert.doesNotMatch(catalog, /Smart Tokens|smart-tokens|to: '\/planos'/)
  assert.match(sidebar, /to: '\/planos'[\s\S]*?label: 'Smart Tokens'/)
  assert.match(sidebar, />Smart Tokens</)
})

test('copies the complete Video Imobiliario frontend flow under its own namespace', () => {
  const staging = read('frontend/src/pages/VirtualStaging.jsx')
  const tour = read('frontend/src/pages/SmartTourAI.jsx')

  for (const contract of [
    /buildVirtualStagingCampaignPackage/,
    /virtualStagingConversation/,
    /virtualStagingForm/,
    /<GuidedConversation/,
    /<CampaignPackage/,
    /functions\.invoke\('virtual-staging-generate'/,
    /functions\.invoke\('virtual-staging-status'/,
    /getVirtualStagingJourneySessionKey\(journey\.id\)/,
    /\/virtual-staging\/\$\{requestId\}/,
  ]) assert.match(staging, contract)

  assert.doesNotMatch(staging, /functions\.invoke\('smart-tour-(?:generate|status)'/)
  assert.doesNotMatch(staging, /from ['"].*smartTour/)
  assert.match(tour, /functions\.invoke\('smart-tour-generate'/)
  assert.match(tour, /functions\.invoke\('smart-tour-status'/)
  assert.doesNotMatch(tour, /virtual-staging/)
})

test('creates isolated generation and polling functions without changing the existing contracts', () => {
  const generator = read('supabase/functions/virtual-staging-generate/index.ts')
  const status = read('supabase/functions/virtual-staging-status/index.ts')
  const originalGenerator = read('supabase/functions/smart-tour-generate/index.ts')
  const originalStatus = read('supabase/functions/smart-tour-status/index.ts')

  assert.match(generator, /\.\.\/_shared\/virtual-staging\/index\.ts/)
  assert.match(generator, /mode:'virtual_staging_gemini_omni'/)
  assert.match(generator, /\/virtual-staging\/\$\{input\.clientRequestId\}/)
  assert.match(generator, /buildSmartTourStructuredBriefing\(\{generation:input\.generation/)
  assert.match(generator, /invalid_life_scene:'A opção de Vida no Imóvel é inválida\.'/)
  assert.match(status, /\.eq\('mode', 'virtual_staging_gemini_omni'\)/)
  assert.match(status, /virtual-staging-gemini\.mp4/)
  assert.match(status, /virtual-staging\.mp4/)

  assert.match(originalGenerator, /\.\.\/_shared\/smart-tour\/index\.ts/)
  assert.match(originalGenerator, /mode:'smart_tour_gemini_omni'/)
  assert.doesNotMatch(originalGenerator, /life_scene|invalid_life_scene/)
  assert.doesNotMatch(originalGenerator, /virtual-staging/)
  assert.doesNotMatch(originalStatus, /virtual-staging/)
})

test('keeps the homologated shared utility unchanged outside the isolated module extensions', () => {
  const files = ['professional-phone.ts']

  for (const file of files) {
    assert.deepEqual(
      readBuffer(`supabase/functions/_shared/virtual-staging/${file}`),
      readBuffer(`supabase/functions/_shared/smart-tour/${file}`),
      `${file} must remain an exact architectural copy`,
    )
  }

  const virtualIndex = read('supabase/functions/_shared/virtual-staging/index.ts')
  const smartTourIndex = read('supabase/functions/_shared/smart-tour/index.ts')
  for (const sharedExport of smartTourIndex.trim().split(/\r?\n/)) assert.ok(virtualIndex.includes(sharedExport), `${sharedExport} must remain exported`)
  assert.doesNotMatch(virtualIndex, /reimagine-prompt|buildReimaginePrompt/)

  const originalTypes = read('supabase/functions/_shared/smart-tour/types.ts')
  const originalValidation = read('supabase/functions/_shared/smart-tour/validation.ts')
  const originalBriefing = read('supabase/functions/_shared/smart-tour/structured-briefing.ts')
  const originalCompositor = read('supabase/functions/_shared/smart-tour/caption-compositor.ts')
  const virtualCompositor = read('supabase/functions/_shared/virtual-staging/caption-compositor.ts')
  assert.doesNotMatch(originalTypes, /LifeScene|life_scene/)
  assert.doesNotMatch(originalValidation, /LIFE_SCENES|invalid_life_scene|life_scene/)
  assert.doesNotMatch(originalBriefing, /vidaNoImovel|lifeScene/)
  assert.doesNotMatch(originalCompositor, /vidaNoImovel|expectedCaptionCount/)
  assert.match(virtualCompositor, /briefing\.vidaNoImovel \|\| briefing\.referenciaApresentador \? 5 : 4/)
})

test('exposes exactly the three approved Virtual Space modules in order', () => {
  assert.deepEqual(VIRTUAL_STAGING_JOURNEYS.map(journey => journey.id), [
    'furnish-renovate',
    'life-in-property',
    'broker-presentation',
  ])
  assert.deepEqual(VIRTUAL_STAGING_JOURNEYS.map(journey => journey.title), [
    'Virtual Staging',
    'Vida no Imóvel',
    'Apresentação pelo Corretor',
  ])
  assert.deepEqual(VIRTUAL_STAGING_JOURNEYS.map(journey => journey.description), [
    'Transforme fotos de ambientes vazios, quase vazios ou já mobiliados em novas apresentações visuais criadas por inteligência artificial.',
    'Crie cenas naturais com pessoas utilizando os ambientes e torne a apresentação mais envolvente.',
    'Utilize sua própria imagem para apresentar o imóvel de forma profissional e personalizada.',
  ])
  assert.deepEqual(VIRTUAL_STAGING_JOURNEYS.map(journey => journey.demoAssetStatus), [undefined, 'official', 'official'])
  assert.equal(getVirtualStagingJourney('furnish-renovate')?.demoVideo, undefined)
  assert.equal(getVirtualStagingJourney('life-in-property')?.demoVideo, '/demos-videos/vida-no-imovel.mp4')
  assert.equal(getVirtualStagingJourney('life-in-property')?.title, 'Vida no Imóvel')
  assert.equal(getVirtualStagingJourney('broker-presentation')?.demoVideo, '/demos-videos/apresentacao-pelo-proprio-corretor.mp4')
  assert.equal(getVirtualStagingJourney('unknown'), null)
})

test('opens one keyed journey at a time and isolates every active job namespace', () => {
  const staging = read('frontend/src/pages/VirtualStaging.jsx')
  const sessionKeys = VIRTUAL_STAGING_JOURNEYS.map(journey => getVirtualStagingJourneySessionKey(journey.id))

  assert.equal(new Set(sessionKeys).size, 3)
  assert.match(staging, /const recoveredJourneyId = getRecoverableVirtualStagingJourneyId\(globalThis\.sessionStorage\)/)
  assert.match(staging, /return recoveredJourneyId === FURNISH_RENOVATE_JOURNEY_ID \? '' : recoveredJourneyId/)
  assert.match(staging, /const \[selectedJourneyId, setSelectedJourneyId\] = useState\(getInitialVirtualStagingJourneyId\)/)
  assert.match(staging, /selectedJourney && <div[\s\S]*?<VirtualStagingJourney[\s\S]*?key=\{selectedJourney\.id\}/)
  assert.match(staging, /onClick=\{\(\) => onSelect\(journey\.id\)\}/)
  assert.match(staging, /aria-pressed=\{isSelected\}/)
  assert.match(staging, /getVirtualStagingJourneySessionKey\(journey\.id\)/)
  assert.match(staging, />\s*Escolher outro módulo\s*</)
})

test('uses the approved Virtual Space identity and preserves its three modules', () => {
  const staging = read('frontend/src/pages/VirtualStaging.jsx')
  const tour = read('frontend/src/pages/SmartTourAI.jsx')

  assert.match(staging, /title="Virtual Space"/)
  assert.match(staging, /description="Transforme ambientes, mostre novas possibilidades e apresente seus imóveis de forma mais envolvente com inteligência artificial\."/)
  assert.match(staging, /Escolha como deseja apresentar seu imóvel/)
  assert.match(staging, /Agora, conte como deseja transformar seu imóvel/)
  assert.match(staging, /<VirtualStagingModules selectedJourneyId=\{selectedJourneyId\}/)
  assert.match(staging, /md:grid-cols-3/)
  assert.doesNotMatch(staging, /Como criar cada tipo de vídeo|VirtualStagingGuide|guideExamples|lg:grid-cols-4/)
  assert.doesNotMatch(staging, /Fotos em Movimento|Legendas na Tela|Narração Profissional|Corretor Virtual IA/)
  assert.match(tour, /Como criar cada tipo de vídeo/)
  assert.match(tour, /<SmartTourGuide \/>/)
})
