import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')
let vite
let getConversationScrollBehavior

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const conversationModule = await vite.ssrLoadModule('/src/components/conversation/GuidedConversation.jsx')
  getConversationScrollBehavior = conversationModule.getConversationScrollBehavior
})

after(async () => {
  await vite?.close()
})

test('uses only the consolidated Design System APIs for the Smart Tour visual hierarchy', () => {
  assert.match(page, /import \{ ProductButton, ProductCard, ProductHero, ProductSectionHeading, ProductSteps \} from '\.\.\/components\/design-system'/)
  assert.match(page, /<ProductHero[\s\S]*?productName="Vídeo Imobiliário"/)
  assert.match(page, /<ProductCard(?:\s|>)/)
  assert.match(page, /<ProductSectionHeading(?:\s|>)/)
  assert.match(page, /<ProductSteps steps=\{\[[\s\S]*?Fotos[\s\S]*?Imóvel[\s\S]*?Estilo[\s\S]*?Revisão[\s\S]*?Criar[\s\S]*?activeStep=\{visualStep\}/)
  assert.match(page, /<GuidedConversation[\s\S]*?designSystem[\s\S]*?eyebrow=\{isShortVideos/)
})

test('keeps the approved photo flow and guards the frozen Short Videos entry point', () => {
  assert.match(page, /\{activeInputFlow && <div id="smart-tour-creation"/)
  assert.match(page, /onSelectImages=\{\(\) => selectInputFlow\('images'\)\}/)
  assert.match(page, /onSelectShortVideos=\{\(\) => selectInputFlow\(SHORT_VIDEOS_MODULE_ID\)\}/)
  assert.match(page, /shortVideosVisible=\{SHORT_VIDEOS_VISIBLE\}/)
  assert.match(page, /<ProductButton type="button" onClick=\{onSelectImages\}/)
  assert.match(page, /\{shortVideosVisible && <ProductCard[\s\S]*?<ProductButton type="button" onClick=\{onSelectShortVideos\}/)
})

test('scrolls to the creation flow while honoring reduced motion safely', () => {
  assert.match(page, /requestAnimationFrame\(\(\) => document\.getElementById\('smart-tour-creation'\)\?\.scrollIntoView\(\{ behavior: getConversationScrollBehavior\(\), block: 'start' \}\)\)/)
  assert.equal(getConversationScrollBehavior(() => ({ matches: true })), 'auto')
  assert.equal(getConversationScrollBehavior(() => ({ matches: false })), 'smooth')
  assert.equal(getConversationScrollBehavior(null), 'smooth')
  assert.equal(getConversationScrollBehavior(() => { throw new Error('matchMedia unavailable') }), 'smooth')
})

test('uses the mobile media standard and responsive cards throughout the showcase', () => {
  assert.match(page, /function SmartTourShowcase\(\)[\s\S]*?<ProductCard as="article"/)
  assert.match(page, /function SmartTourShowcase\(\)[\s\S]*?<ProductButton[\s\S]*?>\s*<PlayCircle[\s\S]*?Ver exemplo/)
  assert.match(page, /mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5/)
  assert.match(page, /smart-phone-media absolute inset-0 bg-black/)
  assert.match(page, /smart-presentation-media bg-black/)
  assert.match(page, /aspect-\[9\/16\]/)
})

test('preserves showcase navigation, keyboard controls and open-close callbacks', () => {
  assert.match(page, /onClick=\{\(\) => setActiveIndex\(exampleIndex\)\}/)
  assert.match(page, /const close = \(\) => \{[\s\S]*?modalVideoRef\.current\?\.pause\(\)[\s\S]*?setActiveIndex\(null\)/)
  assert.match(page, /const showPrevious = \(\) => setActiveIndex/)
  assert.match(page, /const showNext = \(\) => setActiveIndex/)
  assert.match(page, /event\.key === 'Escape'[\s\S]*?event\.key === 'ArrowLeft'[\s\S]*?event\.key === 'ArrowRight'/)
  assert.match(page, /onClick=\{showPrevious\}/)
  assert.match(page, /onClick=\{showNext\}/)
  assert.match(page, /onClick=\{close\}/)
})

test('preserves creation, retry, reset and conversation callbacks after button migration', () => {
  assert.match(page, /const cont = [\s\S]*?<ProductButton[\s\S]*?answerQuestion/)
  assert.match(page, /<ProductButton type="button" disabled=\{\['uploading','generating'\]\.includes\(status\)\} onClick=\{createTour\}/)
  assert.match(page, /status === 'error' \? 'Tentar novamente' : 'Confirmar e criar vídeo'/)
  assert.match(page, /<ProductButton type="button" variant="secondary" disabled=\{\['uploading','generating'\]\.includes\(status\)\} onClick=\{resetCreation\}/)
  assert.match(page, /onEdit=\{editConversationAnswer\}/)
  assert.match(page, /editDisabled=\{\['uploading', 'generating'\]\.includes\(status\)\}/)
})
