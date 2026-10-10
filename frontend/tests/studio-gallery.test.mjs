import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gallery = readFileSync(path.join(frontendRoot, 'src/pages/StudioGallery.jsx'), 'utf8')
const helperSource = gallery
  .slice(gallery.indexOf('export function getVideoSource'), gallery.indexOf('export default function StudioGallery'))
  .replace('export function', 'function')
const getVideoSource = Function(`const GALLERY_ROOT = '/showcase/smart-studio-gallery'; ${helperSource}; return getVideoSource`)()

test('uses only the shared Design System for the Studio Gallery hierarchy', () => {
  assert.match(gallery, /import \{ ProductButton, ProductCard, ProductHero, ProductSectionHeading, SMART_UI \} from '\.\.\/components\/design-system'/)
  assert.match(gallery, /<ProductHero[\s\S]*?productName=\{t\('studioGallery\.productName'\)\}[\s\S]*?headline=\{t\('studioGallery\.headline'\)\}/)
  assert.match(gallery, /<ProductSectionHeading[\s\S]*?title=\{section\.title\}/)
  assert.match(gallery, /<ProductCard[\s\S]*?as="button"/)
  assert.match(gallery, /<ProductButton[\s\S]*?onClick=\{\(\) => navigate\('\/studio-hero'\)\}/)
})

test('includes the Smart Carousel section without importing its page', () => {
  assert.match(gallery, /SMART_CAROUSEL_GALLERY_VIDEO = '\/showcase\/smartcarrossel\/showcase-carrossel\.mp4'/)
  assert.match(gallery, /id: 'smart-carousel'[\s\S]*?videos: \[SMART_CAROUSEL_GALLERY_VIDEO\]/)
  assert.doesNotMatch(gallery, /import .*SmartCarrossel/)
})

test('resolves relative gallery videos and absolute product assets safely', () => {
  assert.equal(getVideoSource('venda1lapa.mp4'), '/showcase/smart-studio-gallery/venda1lapa.mp4')
  assert.equal(getVideoSource('/showcase/smartcarrossel/showcase-carrossel.mp4'), '/showcase/smartcarrossel/showcase-carrossel.mp4')

  const videoReferences = [...gallery.matchAll(/'([^']+\.mp4)'/g)].map(([, source]) => source)
  assert.ok(videoReferences.length > 20)
  for (const source of videoReferences) {
    const publicPath = source.startsWith('/')
      ? path.join(frontendRoot, 'public', source.slice(1))
      : path.join(frontendRoot, 'public/showcase/smart-studio-gallery', source)
    assert.ok(existsSync(publicPath), `Asset ausente: ${source}`)
  }
})

test('keeps a responsive vertical grid without horizontal card overflow', () => {
  assert.match(gallery, /grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5/)
  assert.match(gallery, /className=\{`group min-w-0/)
  assert.match(gallery, /aspect-\[9\/16\]/)
  assert.match(gallery, /smart-phone-media absolute inset-0/)
  assert.match(gallery, /smart-presentation-media/)
  assert.match(gallery, /overflow-x-hidden/)
  assert.doesNotMatch(gallery, /min-w-\[/)
  assert.doesNotMatch(gallery, /translate-x-/)
})

test('opens and closes the modal with mouse and keyboard while preserving body scroll', () => {
  assert.match(gallery, /onClick=\{\(event\) => onOpen\(fileName, event\.currentTarget\)\}/)
  assert.match(gallery, /role="dialog"[\s\S]*?aria-modal="true"/)
  assert.match(gallery, /event\.target === event\.currentTarget\) closeModal\(\)/)
  assert.match(gallery, /event\.key === 'Escape'\) closeModal\(\)/)
  assert.match(gallery, /const previousOverflow = document\.body\.style\.overflow/)
  assert.match(gallery, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(gallery, /document\.body\.style\.overflow = previousOverflow/)
  assert.match(gallery, /window\.addEventListener\('keydown', handleKeyDown\)/)
  assert.match(gallery, /window\.removeEventListener\('keydown', handleKeyDown\)/)
})

test('manages initial focus, restores the trigger and resets video playback safely', () => {
  assert.match(gallery, /lastTriggerRef\.current = trigger[\s\S]*?setSelectedVideo\(video\)/)
  assert.match(gallery, /aria-label=\{t\('studioGallery\.closeVideo'\)\}[\s\S]*?autoFocus/)
  assert.match(gallery, /modalVideoRef\.current\.pause\(\)[\s\S]*?modalVideoRef\.current\.currentTime = 0/)
  assert.match(gallery, /setSelectedVideo\(null\)[\s\S]*?requestAnimationFrame\(\(\) => lastTriggerRef\.current\?\.focus\(\)\)/)
  assert.match(gallery, /aria-label=\{t\('studioGallery\.openExample'\)/)
})
