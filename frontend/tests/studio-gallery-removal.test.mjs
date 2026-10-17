import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')

test('removes the Studio example gallery route, navigation and secondary showcase', () => {
  const app = read('src/App.jsx')
  const layout = read('src/components/layout/AppLayout.jsx')
  const analytics = read('src/lib/analytics.js')
  const studio = read('src/pages/StudioHero.jsx')

  assert.doesNotMatch(app, /StudioGallery|studio-galeria/)
  assert.doesNotMatch(layout, /studio-galeria/)
  assert.doesNotMatch(analytics, /studio-galeria/)
  assert.doesNotMatch(studio, /StudioGalleryInvitation|StudioPossibilitiesShowcase|STUDIO_POSSIBILITY_EXAMPLES|studio-galeria/)
})

test('keeps the three main AI Studio module cards and their existing previews', () => {
  const studio = read('src/pages/StudioHero.jsx')

  for (const id of ['cinematic', 'free_ai', 'smart_carousel']) {
    assert.match(studio, new RegExp(`id: '${id}'`))
  }
  assert.match(studio, /VISIBLE_STUDIO_MODE_EXAMPLES\.map/)
  for (const asset of [
    'showcase/smart-studio-gallery/venda1lapa.mp4',
    'showcase/studio/showcase-captacao-venda.mp4',
    'showcase/smartcarrossel/showcase-carrossel.mp4',
  ]) {
    assert.ok(existsSync(path.join(frontendRoot, 'public', asset)), `main preview remains available: ${asset}`)
  }
})
