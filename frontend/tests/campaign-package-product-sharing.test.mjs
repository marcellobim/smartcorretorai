import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readSource = relativePath => readFile(path.join(frontendRoot, relativePath), 'utf8')
const optInPattern = /sharePublish=\{\{ enabled: true \}\}/g

test('enables sharing only for the final Smart Tour and Short Videos package', async () => {
  const source = await readSource('src/pages/SmartTourAI.jsx')
  assert.equal(source.match(optInPattern)?.length, 1)
  assert.match(source, /result\.inputFlow === SHORT_VIDEOS_MODULE_ID/)
  assert.match(source, /downloadName: isShortVideoResult \? 'short-smartcorretorai\.mp4' : 'smartcorretorai-apresentacao\.mp4'/)
  assert.match(source, /mediaPresentation=\{isShortVideoResult \? 'mobile' : 'default'\}/)
  assert.match(source, /protectVideoDownload=\{isShortVideoResult\}/)
  assert.match(source, /downloadUrl: result\.signedVideoUrl[^>]+sharePublish=\{\{ enabled: true \}\}/)
})

test('enables sharing for both completed Studio video modes without changing delivery data', async () => {
  const source = await readSource('src/pages/StudioHero.jsx')
  assert.equal(source.match(optInPattern)?.length, 2)
  assert.match(source, /sourceProduct: 'Studio Hero Cinematogr[aá]fico'/)
  assert.match(source, /downloadName: 'studio-hero-video\.mp4'/)
  assert.match(source, /sourceProduct: 'IA Livre'/)
  assert.match(source, /downloadName: 'studio-hero-ia-livre\.mp4'/)
  assert.equal((source.match(/mediaPresentation="mobile"\s+sharePublish=\{\{ enabled: true \}\}/g) || []).length, 2)
  assert.equal((source.match(/contactAuthorized: false/g) || []).length >= 2, true)
  assert.match(source, /existingTexts: deliveryTexts/)
})

test('enables sharing only for active Virtual Space video results', async () => {
  const source = await readSource('src/pages/VirtualStaging.jsx')
  assert.equal(source.match(optInPattern)?.length, 1)
  assert.match(source, /isLifeInProperty = journey\.id === LIFE_IN_PROPERTY_JOURNEY_ID/)
  assert.match(source, /isBrokerPresentation = journey\.id === BROKER_PRESENTATION_JOURNEY_ID/)
  assert.match(source, /if \(isFurnishRenovate && status === 'completed'[^\n]+FurnishRenovateDelivery/)
  assert.match(source, /if \(result\)[^\n]+mediaType: 'video'[^\n]+mediaPresentation="mobile" sharePublish=\{\{ enabled: true \}\}/)
  assert.match(source, /phone:requestBody\.includeProfessionalPhone \? phone : ''/)
})

test('keeps the five official video networks provided by the shared foundation', async () => {
  const source = await readSource('src/config/sharePublishNetworks.js')
  for (const network of ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp']) {
    assert.match(source, new RegExp(`id: '${network}'[\\s\\S]*?mediaTypes: Object\\.freeze\\(\\['image', 'video'\\]\\)`))
  }
})

test('does not activate excluded product results', async () => {
  const excludedPages = [
    'src/pages/SmartCarrossel.jsx',
    'src/pages/HeroNext.jsx',
    'src/pages/NovaCampanha.jsx',
    'src/pages/TextCampaign.jsx',
  ]
  for (const page of excludedPages) {
    assert.doesNotMatch(await readSource(page), /sharePublish\s*=/, page)
  }
})

test('adds no provider, backend, persistence or retention behavior', async () => {
  const sources = await Promise.all([
    'src/pages/SmartTourAI.jsx',
    'src/pages/StudioHero.jsx',
    'src/pages/VirtualStaging.jsx',
  ].map(readSource))
  const addedLines = sources
    .flatMap(source => source.split(/\r?\n/))
    .filter(line => line.includes('sharePublish={{ enabled: true }}'))
    .join('\n')
  assert.equal(addedLines.split('\n').length, 4)
  for (const forbidden of [/openai/i, /gemini/i, /veo/i, /creatomate/i, /oauth/i, /access_token/i, /localStorage/i, /sessionStorage/i]) {
    assert.doesNotMatch(addedLines, forbidden)
  }
})
