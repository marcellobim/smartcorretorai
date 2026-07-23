import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

function filesBelow(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath)
  return readdirSync(absolutePath).flatMap(name => {
    const child = path.join(absolutePath, name)
    const relativeChild = path.relative(repositoryRoot, child)
    return statSync(child).isDirectory() ? filesBelow(relativeChild) : [relativeChild]
  })
}

test('keeps every baseline route and adds an isolated Smart Tour route', () => {
  const app = read('frontend/src/App.jsx')
  const expectedRoutes = ['/', '/home-frankenstein', '/home-opus', '/planos', '/termos', '/privacidade', '/login', '/cadastro', '/admin', '/dashboard', '/hero', '/studio-hero', '/studio-galeria', '/smart-carrossel', '/transformar-video', '/nova-campanha', '/pacotes-gerados', '/configuracoes']
  for (const route of expectedRoutes) assert.match(app, new RegExp(`path=["']${route.replace('/', '\\/')}["']`), `missing route ${route}`)
  assert.match(app, /import SmartTourAI from ['"]\.\/pages\/SmartTourAI['"]/)
  assert.match(app, /path="\/smart-tour-ai" element=\{<SmartTourAI \/>\}/)
})

test('places Smart Tour first in the Dashboard product grid and keeps token purchase out of it', () => {
  const dashboard = read('frontend/src/pages/Dashboard.jsx')
  const catalog = dashboard.slice(dashboard.indexOf('const mainActions'), dashboard.indexOf('const statusLabel'))
  const ids = ['smart-tour-ai', 'hero-ia', 'studio-hero', 'banners-rapidos']
  const positions = ids.map(id => catalog.indexOf(`id: '${id}'`))
  assert.ok(positions.every(position => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  assert.match(catalog, /id: 'smart-tour-ai'[\s\S]*?title: 'Smart Tour AI'[\s\S]*?to: '\/smart-tour-ai'[\s\S]*?label: 'Criar Smart Tour'/)
  assert.match(dashboard, /id: 'studio-hero'[\s\S]*?to: '\/studio-hero'/)
  assert.match(dashboard, /id: 'banners-rapidos'[\s\S]*?to: '\/nova-campanha'/)
  assert.doesNotMatch(catalog, /smart-tokens|Adicionar Smart Tokens|to: '\/planos'/)
  assert.match(dashboard, /<Link to=\{action\.to\}[\s\S]*?\{content\}[\s\S]*?<\/Link>/)
})

test('places Smart Tour first without changing existing Studio Hero options', () => {
  const studio = read('frontend/src/pages/StudioHero.jsx')
  const catalog = studio.slice(studio.indexOf('const STUDIO_CREATION_MODES'), studio.indexOf('const STUDIO_MODE_EXAMPLES'))
  const ids = ['smart_tour', 'cinematic', 'free_ai', 'smart_carousel', 'improve_video']
  const positions = ids.map(id => catalog.indexOf(`id: '${id}'`))
  assert.ok(positions.every(position => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  assert.match(studio, /mode\.id === 'smart_tour'[\s\S]*?navigate\('\/smart-tour-ai'\)/)
  assert.match(studio, /mode\.id === 'smart_carousel'[\s\S]*?navigate\('\/smart-carrossel'\)/)
  assert.match(studio, /setStudioMode\(mode\.id\)[\s\S]*?resetFlow\(mode\.id\)/)
  assert.match(studio, /className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"/)
  assert.doesNotMatch(studio, /xl:grid-cols-5/)
  assert.match(studio, /improve_video: \{ enabled: false \}/)
  assert.match(studio, /VISIBLE_STUDIO_CREATION_MODES\.map/)
  assert.match(studio, /VISIBLE_STUDIO_MODE_EXAMPLES\.map/)
  assert.match(studio, /Transforme até 6 fotos em uma apresentação imobiliária profissional/)
  for (const benefit of ['📸 Até 6 fotos do imóvel', '🎥 Apresentação profissional do imóvel', '👤 Corretor(a) virtual opcional', '🎙️ Narração profissional', '🛋️ Sugestões de decoração para ambientes vazios com IA', '📱 Campanha pronta para divulgação']) {
    assert.ok(studio.includes(benefit))
  }
  assert.match(studio, /onClick=\{\(\) => selectStudioMode\(mode\)\}[\s\S]*?cursor-pointer/)
  assert.doesNotMatch(studio, /const isSmartCarousel/)
  const examples = studio.slice(studio.indexOf('const STUDIO_MODE_EXAMPLES'), studio.indexOf('const STUDIO_POSSIBILITY_EXAMPLES'))
  const examplePositions = ids.map(id => examples.indexOf(`id: '${id}'`))
  assert.ok(examplePositions.every(position => position >= 0))
  assert.deepEqual([...examplePositions].sort((a, b) => a - b), examplePositions)
})

test('uses only the isolated Gemini Omni client for Smart Tour generation', () => {
  const generator = read('supabase/functions/smart-tour-generate/index.ts')
  const status = read('supabase/functions/smart-tour-status/index.ts')
  assert.match(generator, /geminiOmniClient\.ts/)
  assert.match(status, /geminiOmniClient\.ts/)
  const smartTourFiles = [
    'frontend/src/pages/SmartTourAI.jsx',
    'frontend/src/config/smartTour.js',
    'frontend/src/components/campaign/buildSmartTourCampaignPackage.js',
    'supabase/functions/_shared/geminiOmniClient.ts',
    ...filesBelow('supabase/functions/_shared/smart-tour'),
    ...filesBelow('supabase/functions/smart-tour-generate'),
    ...filesBelow('supabase/functions/smart-tour-status'),
  ]
  for (const file of smartTourFiles) {
    assert.doesNotMatch(read(file), /veoClient|startVeo|checkVeo/, `legacy client reference in ${file}`)
  }
})
