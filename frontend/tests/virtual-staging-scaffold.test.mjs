import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const readBuffer = relativePath => readFileSync(path.join(repositoryRoot, relativePath))

test('registers Virtual Staging as an independent protected product route', () => {
  const app = read('frontend/src/App.jsx')
  const layout = read('frontend/src/components/layout/AppLayout.jsx')

  assert.match(app, /import VirtualStaging from ['"]\.\/pages\/VirtualStaging['"]/)
  assert.match(app, /<Route path="\/virtual-staging" element=\{<VirtualStaging \/>\} \/>/)
  assert.match(layout, /location\.pathname === '\/virtual-staging'/)
})

test('places Virtual Staging beside Banners Rapidos and keeps Smart Tokens only in the sidebar', () => {
  const dashboard = read('frontend/src/pages/Dashboard.jsx')
  const sidebar = read('frontend/src/components/layout/Sidebar.jsx')
  const catalog = dashboard.slice(dashboard.indexOf('const mainActions'), dashboard.indexOf('const statusLabel'))
  const bannersPosition = catalog.indexOf("id: 'banners-rapidos'")
  const stagingPosition = catalog.indexOf("id: 'virtual-staging'")

  assert.ok(bannersPosition >= 0 && stagingPosition > bannersPosition)
  assert.match(catalog, /id: 'virtual-staging'[\s\S]*?title: 'Virtual Staging'[\s\S]*?to: '\/virtual-staging'[\s\S]*?label: 'Criar projeto'/)
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
    /smartcorretorai:virtual-staging:active-job/,
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
  assert.match(status, /\.eq\('mode', 'virtual_staging_gemini_omni'\)/)
  assert.match(status, /virtual-staging-gemini\.mp4/)
  assert.match(status, /virtual-staging\.mp4/)

  assert.match(originalGenerator, /\.\.\/_shared\/smart-tour\/index\.ts/)
  assert.match(originalGenerator, /mode:'smart_tour_gemini_omni'/)
  assert.doesNotMatch(originalGenerator, /virtual-staging/)
  assert.doesNotMatch(originalStatus, /virtual-staging/)
})

test('duplicates the homologated prompt and validation core byte for byte', () => {
  const files = [
    'build-prompt.ts',
    'caption-compositor.ts',
    'index.ts',
    'professional-phone.ts',
    'structured-briefing.ts',
    'types.ts',
    'validation.ts',
  ]

  for (const file of files) {
    assert.deepEqual(
      readBuffer(`supabase/functions/_shared/virtual-staging/${file}`),
      readBuffer(`supabase/functions/_shared/smart-tour/${file}`),
      `${file} must remain an exact architectural copy`,
    )
  }
})

test('does not expose future module implementations in this scaffold', () => {
  const staging = read('frontend/src/pages/VirtualStaging.jsx')
  for (const futureModule of ['Pessoas no Imóvel', 'Renovar Ambientes', 'Apresentação pelo Corretor']) {
    assert.doesNotMatch(staging, new RegExp(futureModule))
  }
})
