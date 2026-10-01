import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const carousel = readFileSync(path.join(frontendRoot, 'src/pages/SmartCarrossel.jsx'), 'utf8')

test('uses the shared Design System and the four approved visual steps', () => {
  assert.match(carousel, /import \{[\s\S]*?ProductButton,[\s\S]*?ProductCard,[\s\S]*?ProductHero,[\s\S]*?ProductSectionHeading,[\s\S]*?ProductSteps,[\s\S]*?SMART_UI,[\s\S]*?\} from '\.\.\/components\/design-system'/)
  assert.match(carousel, /<ProductHero[\s\S]*?productName=\{copy\.productName\}[\s\S]*?headline=\{copy\.headline\}/)
  assert.match(carousel, /<ProductCard(?:\s|>)/)
  assert.match(carousel, /<ProductButton(?:\s|>)/)
  assert.match(carousel, /const SMART_CAROUSEL_STEPS = \[[\s\S]*?Fotos[\s\S]*?Informações[\s\S]*?Criar apresentação[\s\S]*?Preview[\s\S]*?\]/)
  assert.match(carousel, /<ProductSteps[\s\S]*?steps=\{copy\.steps\.map\([\s\S]*?activeStep=\{currentStep\}[\s\S]*?accent="emerald"/)
})

test('presents the hero and generated campaign in the shared mobile format', () => {
  assert.match(carousel, /SMART_CAROUSEL_HERO_VIDEO = '\/showcase\/smartcarrossel\/showcase-carrossel\.mp4'/)
  assert.match(carousel, /function SmartCarouselHeroPhone\(\)[\s\S]*?aspect-\[9\/16\][\s\S]*?<video[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline/)
  assert.match(carousel, /className="smart-phone-media pointer-events-none absolute inset-0 select-none"/)
  assert.match(carousel, /<CampaignPackage[\s\S]*?mediaPresentation="mobile"/)
})

test('keeps the shared conversation and State, City and neighborhood contracts', () => {
  assert.match(carousel, /<GuidedConversation[\s\S]*?designSystem[\s\S]*?accent="emerald"/)
  assert.match(carousel, /<SmartCarouselStateSelect value=\{uf\}[\s\S]*?setter: setUf[\s\S]*?setCity\(''\)/)
  assert.match(carousel, /<SmartCarouselCitySelect uf=\{uf\} value=\{city\}[\s\S]*?setter: setCity/)
  assert.match(carousel, /const normalizedDistrict = normalizeDistrictName\(district\)/)
  assert.match(carousel, /<SmartLocationTextInput value=\{district\} onChange=\{\(event\) => setDistrict\(event\.target\.value\)\}/)
  assert.match(carousel, /setter: setDistrict, value: normalizedDistrict, answer: normalizedDistrict, nextStep: 10/)
  assert.match(carousel, /district: normalizedDistrict/)
  assert.match(carousel, /\[9, normalizedDistrict\]/)
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
