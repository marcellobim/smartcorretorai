import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const carousel = readFileSync(path.join(frontendRoot, 'src/pages/SmartCarrossel.jsx'), 'utf8')

test('uses the shared Design System without an intermediate step rail', () => {
  assert.match(carousel, /import \{[\s\S]*?ProductButton,[\s\S]*?ProductCard,[\s\S]*?ProductHero,[\s\S]*?ProductSectionHeading,[\s\S]*?SMART_UI,[\s\S]*?\} from '\.\.\/components\/design-system'/)
  assert.match(carousel, /<ProductHero[\s\S]*?productName=\{copy\.productName\}[\s\S]*?headline=\{copy\.headline\}/)
  assert.match(carousel, /<ProductCard(?:\s|>)/)
  assert.match(carousel, /<ProductButton(?:\s|>)/)
  assert.doesNotMatch(carousel, /<ProductSteps/)
})

test('presents the hero and generated campaign in the shared mobile format', () => {
  assert.match(carousel, /SMART_CAROUSEL_HERO_VIDEO = '\/showcase\/smartcarrossel\/showcase-carrossel\.mp4'/)
  assert.match(carousel, /function SmartCarouselHeroPhone\(\)[\s\S]*?aspect-\[9\/16\][\s\S]*?<video[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline/)
  assert.match(carousel, /className="smart-phone-media pointer-events-none absolute inset-0 select-none"/)
  assert.match(carousel, /<CampaignPackage[\s\S]*?mediaPresentation="mobile"/)
})

test('keeps BR location and uses the shared structured US location control', () => {
  assert.match(carousel, /<GuidedConversation[\s\S]*?designSystem[\s\S]*?accent="emerald"/)
  assert.match(carousel, /<StudioUsLocation value=\{\{ state: uf, county, city, zipCode, neighborhoodCommunity \}\}/)
  assert.match(carousel, /<SmartCarouselCitySelect uf=\{uf\} value=\{city\}[\s\S]*?setter: setCity/)
  assert.match(carousel, /const normalizedDistrict = normalizeDistrictName\(district\)/)
  assert.match(carousel, /<SmartLocationTextInput value=\{district\} onChange=\{\(event\) => setDistrict\(event\.target\.value\)\}/)
  assert.match(carousel, /setter: setDistrict, value: normalizedDistrict, answer: normalizedDistrict, nextStep: 10/)
  assert.match(carousel, /district: normalizedDistrict/)
  assert.match(carousel, /formattedLocation/)
})

test('preserves upload controls, loading lock and retry callbacks', () => {
  assert.match(carousel, /SMART_CAROUSEL_MIN_IMAGES = 5/)
  assert.match(carousel, /SMART_CAROUSEL_MAX_IMAGES = 20/)
  assert.match(carousel, /onDrop=\{\(event\) => \{ event\.preventDefault\(\); setIsDragActive\(false\); addPhotos\(event\.dataTransfer\.files\) \}\}/)
  assert.match(carousel, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); inputRef\.current\?\.click\(\) \}\}/)
  assert.match(carousel, /loading=\{isGenerating\}[\s\S]*?disabled=\{isGenerating \|\| !hasMinimumImages\}[\s\S]*?onClick=\{createPresentation\}/)
  assert.match(carousel, /onClick=\{receipt \|\| activeJobId \? resumeStatus : createPresentation\}/)
})

test('preserves generation, polling, receipt and download contracts', () => {
  assert.match(carousel, /SMART_CAROUSEL_FUNCTION = 'smart-carousel-creatomate'/)
  assert.match(carousel, /action: 'create'[\s\S]*?job_id: jobId[\s\S]*?image_paths: uploaded\.imagePaths[\s\S]*?cta_path: uploaded\.ctaPath[\s\S]*?answers: confirmedAnswers/)
  assert.match(carousel, /isValidSmartCarouselReceipt\(data\.receipt\)[\s\S]*?setReceipt\(data\.receipt\)[\s\S]*?pollRenderStatus\(data\.receipt \|\| '', jobId\)/)
  assert.match(carousel, /const resumeStatus = \(\) => \{[\s\S]*?pollRenderStatus\(receipt, activeJobId\)/)
  assert.match(carousel, /previewUrl: videoUrl,[\s\S]*?downloadUrl: videoUrl,[\s\S]*?downloadName: 'smart-carrossel-apresentacao\.mp4'/)
})
