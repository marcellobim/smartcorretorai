import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SMART_TOUR_EXAMPLES } from '../src/config/smartTour.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')

test('centralizes exactly the four approved Smart Tour families in order', () => {
  assert.deepEqual(SMART_TOUR_EXAMPLES.map(example => example.id), [
    'animate-images',
    'campaign-video',
    'narrated-video',
    'virtual-agent',
  ])
  assert.deepEqual(SMART_TOUR_EXAMPLES.map(example => example.title), [
    'Animar Imagens',
    'Vídeo para Campanha',
    'Vídeo Narrado',
    'Corretor Virtual',
  ])
  for (const example of SMART_TOUR_EXAMPLES) {
    assert.equal(typeof example.title, 'string')
    assert.equal(typeof example.description, 'string')
    assert.match(example.video, /^\/demos-videos\/.+\.mp4(?:\.mp4)?$/)
    assert.equal(existsSync(path.join(frontendRoot, 'public', example.video)), true)
    for (const field of ['hasNarration', 'hasTexts', 'hasPresenter', 'hasFurniture']) {
      assert.equal(typeof example[field], 'boolean')
    }
    assert.equal(example.placeholder, false)
  }
})

test('keeps showcase playback silent and inline while enabling modal controls', () => {
  assert.match(page, /autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline[\s\S]*?controls=\{false\}/)
  assert.match(page, /role="dialog"/)
  assert.match(page, /event\.key === 'Escape'/)
  assert.match(page, /Demonstração anterior/)
  assert.match(page, /Próxima demonstração/)
  assert.match(page, /controlsList="nodownload noremoteplayback"/)
  assert.match(page, /Ver exemplo/)
  assert.match(page, /event\.target === event\.currentTarget/)
  assert.match(page, /disablePictureInPicture/)
  assert.match(page, /onContextMenu=\{event => event\.preventDefault\(\)\}/)
  assert.doesNotMatch(page, /target="_blank"/)
})

test('uses a contained mobile carousel without page-wide horizontal overflow', () => {
  assert.match(page, /overflow-x-auto overscroll-x-contain/)
  assert.match(page, /auto-cols-\[minmax\(240px,82vw\)\]/)
  assert.match(page, /lg:grid-flow-row lg:grid-cols-4 lg:overflow-visible/)
  assert.match(page, /object-contain/)
})

test('uses the approved commercial-video communication and guide', () => {
  for (const text of [
    'Transforme as fotos dos seus imóveis em comerciais profissionais.',
    'Gere vídeos prontos para anúncios, redes sociais e atendimento. Escolha apenas o resultado que deseja. O SmartCorretorAI faz o restante.',
    'Escolha o resultado que você deseja',
    'Como criar o vídeo que você deseja',
    'Essas são apenas combinações recomendadas. Você pode criar qualquer combinação durante a criação do vídeo.',
  ]) assert.ok(page.includes(text))
  assert.doesNotMatch(page, />Smart Tour AI</)
  assert.doesNotMatch(page, /Quatro formas de apresentar seu imóvel/)
})

test('uses the approved visible name for the animated-photo option without changing its technical configuration', () => {
  assert.ok(page.includes("title: 'Fotos em Movimento'"))
  assert.ok(page.includes('Transforme suas fotos em uma apresentação dinâmica, com movimentos suaves e novos ângulos, preservando o imóvel como protagonista.'))
  assert.equal(SMART_TOUR_EXAMPLES[0].title, 'Animar Imagens')
  assert.equal(SMART_TOUR_EXAMPLES[0].video, '/demos-videos/animar-imagens.mp4')
})
