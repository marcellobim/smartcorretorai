import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readSource = relativePath => readFile(path.join(frontendRoot, relativePath), 'utf8')
const optInPattern = /sharePublish=\{\{ enabled: true \}\}/g

test('keeps Smart Tour and Short Videos delivery without public sharing activation', async () => {
  const source = await readSource('src/pages/SmartTourAI.jsx')
  assert.equal(source.match(optInPattern)?.length || 0, 0)
  assert.match(source, /result\.inputFlow === SHORT_VIDEOS_MODULE_ID/)
  assert.match(source, /downloadName: isShortVideoResult \? 'short-smartcorretorai\.mp4' : 'smartcorretorai-apresentacao\.mp4'/)
  assert.match(source, /mediaPresentation=\{isShortVideoResult \? 'mobile' : 'default'\}/)
  assert.match(source, /protectVideoDownload=\{isShortVideoResult\}/)
  assert.match(source, /downloadUrl: result\.signedVideoUrl/)
  assert.doesNotMatch(source, /sharePublish\s*=/)
})

test('keeps both completed Studio video modes without public sharing activation', async () => {
  const source = await readSource('src/pages/StudioHero.jsx')
  assert.equal(source.match(optInPattern)?.length || 0, 0)
  assert.match(source, /sourceProduct: 'Studio Hero Cinematogr[aá]fico'/)
  assert.match(source, /downloadName: 'studio-hero-video\.mp4'/)
  assert.match(source, /sourceProduct: 'IA Livre'/)
  assert.match(source, /downloadName: 'studio-hero-ia-livre\.mp4'/)
  assert.doesNotMatch(source, /sharePublish\s*=/)
  assert.equal((source.match(/contactAuthorized: false/g) || []).length >= 2, true)
  assert.match(source, /existingTexts: deliveryTexts/)
})

test('keeps active Virtual Staging results without public sharing activation', async () => {
  const source = await readSource('src/pages/VirtualStaging.jsx')
  assert.equal(source.match(optInPattern)?.length || 0, 0)
  assert.match(source, /isLifeInProperty = journey\.id === LIFE_IN_PROPERTY_JOURNEY_ID/)
  assert.match(source, /isBrokerPresentation = journey\.id === BROKER_PRESENTATION_JOURNEY_ID/)
  assert.match(source, /if \(isFurnishRenovate && status === 'completed'[^\n]+FurnishRenovateDelivery/)
  assert.match(source, /if \(result\)\s*\{[\s\S]*?<CampaignPackage\s+data=\{\{[\s\S]*?mediaType: 'video'[\s\S]*?\}\}[\s\S]*?mediaPresentation="mobile"/)
  assert.doesNotMatch(source, /sharePublish\s*=|<SharePublishActions/)
  assert.match(source, /phone:requestBody\.includeProfessionalPhone \? phone : ''/)
})

test('keeps the five official video networks provided by the shared foundation', async () => {
  const source = await readSource('src/config/sharePublishNetworks.js')
  for (const network of ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp']) {
    assert.match(source, new RegExp(`id: '${network}'[\\s\\S]*?mediaTypes: Object\\.freeze\\(\\['image', 'video'\\]\\)`))
  }
})

test('keeps Text Campaign outside the sharing layer', async () => {
  const excludedPages = [
    'src/pages/TextCampaign.jsx',
  ]
  for (const page of excludedPages) {
    assert.doesNotMatch(await readSource(page), /sharePublish\s*=/, page)
  }
})

test('keeps the shared foundation inactive on every launch product surface', async () => {
  const sources = await Promise.all([
    'src/pages/SmartTourAI.jsx',
    'src/pages/StudioHero.jsx',
    'src/pages/VirtualStaging.jsx',
    'src/pages/HeroNext.jsx',
    'src/pages/NovaCampanha.jsx',
    'src/pages/SmartCarrossel.jsx',
  ].map(readSource))
  for (const source of sources) {
    assert.doesNotMatch(source, /sharePublish\s*=|<SharePublishActions/)
  }
  assert.match(await readSource('src/components/campaign/CampaignPackage.jsx'), /sharePublishProps[\s\S]*<SharePublishActions/)
})
