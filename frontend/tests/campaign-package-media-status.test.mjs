import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { normalizeCampaignPackageInput } from '../src/components/campaign/buildCampaignPackage.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const campaignPackage = readFileSync(path.join(frontendRoot, 'src/components/campaign/CampaignPackage.jsx'), 'utf8')
const readyStatusesSource = campaignPackage.match(/const READY_MEDIA_STATUSES = new Set\(\[([^\]]+)\]\)/)?.[1] || ''
const readyStatuses = new Set([...readyStatusesSource.matchAll(/'([^']+)'/g)].map(([, status]) => status))
const normalizeStatus = value => String(value || 'planned').toLocaleLowerCase('pt-BR')
const resolveAssetUrl = file => readyStatuses.has(normalizeStatus(file.status)) ? (file.downloadUrl || file.url || '') : ''

test('Concluída with downloadUrl is treated as ready and reaches the image preview', () => {
  assert.equal(resolveAssetUrl({ status: 'Concluída', downloadUrl: 'https://example.test/banner.jpg' }), 'https://example.test/banner.jpg')
  assert.match(campaignPackage, /ready && assetUrl \? [\s\S]*?<ImagePreview src=\{assetUrl\}/)
})

test('completed with a URL remains ready', () => {
  assert.equal(resolveAssetUrl({ status: 'completed', downloadUrl: 'https://example.test/completed.jpg' }), 'https://example.test/completed.jpg')
})

test('succeeded with a URL remains ready', () => {
  assert.equal(resolveAssetUrl({ status: 'succeeded', downloadUrl: 'https://example.test/succeeded.jpg' }), 'https://example.test/succeeded.jpg')
})

test('a ready status without a URL cannot create an empty image', () => {
  assert.equal(resolveAssetUrl({ status: 'Concluída', downloadUrl: '' }), '')
  assert.match(campaignPackage, /\{ready && assetUrl \? [\s\S]*?<ImagePreview/)
})

test('processing remains outside the ready set and keeps the rendering placeholder', () => {
  assert.equal(resolveAssetUrl({ status: 'processing', downloadUrl: 'https://example.test/not-ready.jpg' }), '')
  assert.match(campaignPackage, /status === 'planned' \? 'Aguardando renderização' : 'Renderizando\.\.\.'/)
})

test('previewUrl and downloadUrl remain preserved by the campaign package normalizer', () => {
  const normalized = normalizeCampaignPackageInput({
    mediaType: 'images',
    files: [{
      id: 'banner-1',
      status: 'Concluída',
      previewUrl: 'https://example.test/preview.jpg',
      downloadUrl: 'https://example.test/download.jpg',
    }],
  })

  assert.equal(normalized.files[0].previewUrl, 'https://example.test/preview.jpg')
  assert.equal(normalized.files[0].downloadUrl, 'https://example.test/download.jpg')
})
