import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const element = React.createElement
const signedVideoUrl = 'https://media.example.test/video.mp4?token=temporary-secret'
const signedImageUrl = 'https://media.example.test/photo.jpg?token=temporary-secret'
let vite
let SharePublishActions
let networksModule
let shareModule

class FakeFile {
  constructor(parts, name, options = {}) {
    this.parts = parts
    this.name = name
    this.type = options.type || ''
    this.lastModified = options.lastModified
  }
}

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;[
    { default: SharePublishActions },
    networksModule,
    shareModule,
  ] = await Promise.all([
    vite.ssrLoadModule('/src/components/share/SharePublishActions.jsx'),
    vite.ssrLoadModule('/src/config/sharePublishNetworks.js'),
    vite.ssrLoadModule('/src/lib/share-publish.js'),
  ])
})

after(async () => {
  await vite?.close()
})

const makeResponse = ({ status = 200, type = 'image/jpeg', body = 'media' } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  blob: async () => new Blob([body], { type }),
})

const renderPanel = media => renderToStaticMarkup(element(SharePublishActions, {
  media,
  shareTitle: 'Imóvel em destaque',
  shareText: 'Conheça este imóvel.',
  hashtags: ['SmartCorretorAI', '#Imóveis'],
  cta: 'Fale com o corretor.',
  defaultExpanded: true,
}))

test('declares only the five fixed official destinations with recognizable brand marks', () => {
  const { SHARE_PUBLISH_NETWORKS, SHARE_PUBLISH_NETWORK_IDS } = networksModule
  assert.deepEqual(SHARE_PUBLISH_NETWORK_IDS, ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp'])
  assert.equal(SHARE_PUBLISH_NETWORKS.length, 5)
  for (const network of SHARE_PUBLISH_NETWORKS) {
    assert.match(network.openUrl, /^https:\/\//)
    assert.ok(network.label)
    assert.match(network.iconSrc, /^\/brand-icons\/[a-z]+\.(?:ico|png|svg|webp)$/)
    assert.match(network.officialAssetUrl, /^https:\/\/(?:static\.cdninstagram\.com|static\.xx\.fbcdn\.net|www\.tiktok\.com|www\.youtube\.com|static\.whatsapp\.net)\//)
    assert.match(network.officialGuidelinesUrl, /^https:\/\//)
    assert.match(network.iconSha256, /^[a-f0-9]{64}$/)
    assert.ok(['image', 'video'].some(type => network.mediaTypes.includes(type)))
  }
})

test('uses exact unmodified official assets verified by their documented SHA-256', async () => {
  for (const network of networksModule.SHARE_PUBLISH_NETWORKS) {
    const assetPath = path.join(frontendRoot, 'public', network.iconSrc.replace(/^\//, ''))
    const bytes = await fs.readFile(assetPath)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), network.iconSha256, network.label)
  }
})

test('renders accessible fixed-network actions and never sends the signed media URL', () => {
  const markup = renderPanel([{ url: signedVideoUrl, filename: 'tour.mp4', mimeType: 'video/mp4' }])
  for (const label of ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'WhatsApp']) {
    assert.match(markup, new RegExp(`aria-label="Abrir ${label}`))
    assert.match(markup, new RegExp(`>${label}<`))
  }
  assert.match(markup, /target="_blank"/)
  assert.match(markup, /rel="noopener noreferrer"/)
  assert.doesNotMatch(markup, /media\.example\.test/)
  assert.doesNotMatch(markup, /temporary-secret/)
})

test('keeps download and copy available independently from Web Share', () => {
  const markup = renderPanel([{ url: signedImageUrl, filename: 'fachada.jpg', mimeType: 'image/jpeg' }])
  assert.match(markup, />Baixar mídia</)
  assert.match(markup, />Copiar legenda</)
  assert.match(markup, /aria-live="polite"/)
  assert.match(markup, /O compartilhamento de arquivos não está disponível/)
})

test('filters YouTube for images while retaining all image-compatible networks', () => {
  const markup = renderPanel([{ url: signedImageUrl, filename: 'fachada.jpg', mimeType: 'image/jpeg' }])
  for (const label of ['Instagram', 'Facebook', 'TikTok', 'WhatsApp']) assert.match(markup, new RegExp(`>${label}<`))
  assert.doesNotMatch(markup, />YouTube</)
})

test('normalizes MP4, JPG and multiple image inputs without changing source URLs or filenames', () => {
  const source = [
    { url: signedVideoUrl, filename: 'original.mp4', mimeType: 'video/mp4' },
    { url: signedImageUrl, filename: 'original.jpg', mimeType: 'image/jpeg' },
    { url: 'https://media.example.test/second.png', filename: 'second.png' },
  ]
  const normalized = shareModule.normalizeShareMedia(source)
  assert.deepEqual(normalized.map(item => item.type), ['video', 'image', 'image'])
  assert.deepEqual(normalized.map(item => item.filename), ['original.mp4', 'original.jpg', 'second.png'])
  assert.equal(normalized[0].url, signedVideoUrl)
})

test('supports the legacy single download contract and preserves its original values', async () => {
  const normalized = shareModule.normalizeShareMedia([], {
    downloadUrl: signedVideoUrl,
    downloadName: 'arquivo-original.mp4',
    mimeType: 'video/mp4',
  })
  let received
  await shareModule.downloadShareMedia(normalized[0], { onDownload: item => { received = item } })
  assert.equal(received.url, signedVideoUrl)
  assert.equal(received.filename, 'arquivo-original.mp4')
})

test('composes existing caption, CTA and unique normalized hashtags without generating content', () => {
  const text = shareModule.composeShareText({
    shareText: 'Texto já aprovado.',
    cta: 'Fale com o corretor.',
    hashtags: ['Imóveis', '#SmartCorretorAI', '#Imóveis'],
  })
  assert.equal(text, 'Texto já aprovado.\n\nFale com o corretor.\n\n#Imóveis #SmartCorretorAI')
})

test('prepares one MP4 or several JPG files entirely in memory', async () => {
  const media = shareModule.normalizeShareMedia([
    { url: signedVideoUrl, filename: 'tour.mp4', mimeType: 'video/mp4' },
    { url: signedImageUrl, filename: 'foto-1.jpg', mimeType: 'image/jpeg' },
    { url: 'https://media.example.test/foto-2.jpg', filename: 'foto-2.jpg', mimeType: 'image/jpeg' },
  ])
  const result = await shareModule.prepareShareFiles(media, {
    fetchRef: async itemUrl => makeResponse({ type: itemUrl.endsWith('.mp4?token=temporary-secret') ? 'video/mp4' : 'image/jpeg' }),
    FileCtor: FakeFile,
    now: () => 123,
  })
  assert.deepEqual(result.files.map(file => file.name), ['tour.mp4', 'foto-1.jpg', 'foto-2.jpg'])
  assert.equal(result.failures.length, 0)
  assert.ok(result.files.every(file => file.lastModified === 123))
})

test('detects full, individual and unavailable file sharing at runtime', () => {
  const files = [new FakeFile([], 'a.jpg'), new FakeFile([], 'b.jpg')]
  const full = shareModule.getFileShareCapabilities(files, { share() {}, canShare: ({ files: candidate }) => candidate.length <= 2 })
  assert.equal(full.all, true)
  assert.deepEqual(full.individual, [true, true])

  const individual = shareModule.getFileShareCapabilities(files, { share() {}, canShare: ({ files: candidate }) => candidate.length === 1 })
  assert.equal(individual.all, false)
  assert.deepEqual(individual.individual, [true, true])

  assert.deepEqual(shareModule.getFileShareCapabilities(files, {}), { available: false, all: false, individual: [false, false] })
})

test('shares files, title and text only after an explicit share call', async () => {
  const files = [new FakeFile([], 'tour.mp4', { type: 'video/mp4' })]
  let payload
  const navigatorRef = {
    canShare: ({ files: candidate }) => candidate.length === 1,
    share: async nextPayload => { payload = nextPayload },
  }
  assert.equal(await shareModule.sharePreparedFiles({ files, title: 'Título', text: 'Legenda' }, navigatorRef), 'shared')
  assert.equal(payload.files, files)
  assert.equal(payload.title, 'Título')
  assert.equal(payload.text, 'Legenda')
})

test('treats user cancellation as a recoverable outcome and rejects unsupported sharing', async () => {
  const files = [new FakeFile([], 'foto.jpg')]
  const cancelledNavigator = {
    canShare: () => true,
    share: async () => { throw new DOMException('cancelled', 'AbortError') },
  }
  assert.equal(await shareModule.sharePreparedFiles({ files }, cancelledNavigator), 'cancelled')
  assert.equal(await shareModule.sharePreparedFiles({ files }, { canShare: () => false, share() {} }), 'unsupported')
})

test('classifies expired URLs, network failures and partial multiple-file failures', async () => {
  const item = shareModule.normalizeShareMedia([{ url: signedImageUrl, filename: 'foto.jpg', mimeType: 'image/jpeg' }])[0]
  await assert.rejects(
    shareModule.fetchShareMediaBlob(item, { fetchRef: async () => makeResponse({ status: 403 }) }),
    error => error.code === 'share_media_expired' && error.status === 403,
  )
  await assert.rejects(
    shareModule.fetchShareMediaBlob(item, { fetchRef: async () => { throw new Error('offline') } }),
    error => error.code === 'share_media_fetch_failed',
  )

  const media = shareModule.normalizeShareMedia([
    item,
    { url: 'https://media.example.test/ok.jpg', filename: 'ok.jpg', mimeType: 'image/jpeg' },
  ])
  const result = await shareModule.prepareShareFiles(media, {
    fetchRef: async url => url.includes('temporary-secret') ? makeResponse({ status: 410 }) : makeResponse(),
    FileCtor: FakeFile,
  })
  assert.equal(result.files.length, 1)
  assert.equal(result.failures.length, 1)
})

test('can renew an expired media URL without increasing retention', async () => {
  const item = shareModule.normalizeShareMedia([{ url: signedImageUrl, filename: 'foto.jpg', mimeType: 'image/jpeg' }])[0]
  let renewalCalls = 0
  const result = await shareModule.prepareShareFiles([item], {
    fetchRef: async url => url.includes('temporary-secret') ? makeResponse({ status: 403 }) : makeResponse(),
    renewMediaUrl: async () => {
      renewalCalls += 1
      return 'https://media.example.test/renewed.jpg'
    },
    FileCtor: FakeFile,
  })
  assert.equal(renewalCalls, 1)
  assert.equal(result.files.length, 1)
  assert.equal(result.failures.length, 0)
})

test('copies the existing legend through a mocked clipboard', async () => {
  let copied = ''
  const mode = await shareModule.copyShareText('Legenda pronta', {
    navigatorRef: { clipboard: { writeText: async value => { copied = value } } },
  })
  assert.equal(mode, 'clipboard')
  assert.equal(copied, 'Legenda pronta')
})

test('announces the visible Copiado feedback through the polite live region', async () => {
  const source = await fs.readFile(path.join(frontendRoot, 'src/components/share/SharePublishActions.jsx'), 'utf8')
  assert.match(source, /announce\('Copiado'\)/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /feedback === 'Copiado'/)
})

test('reports a recoverable copy failure when clipboard access is denied', async () => {
  await assert.rejects(
    shareModule.copyShareText('Legenda pronta', {
      navigatorRef: { clipboard: { writeText: async () => { throw new Error('denied') } } },
      documentRef: null,
    }),
    error => error.code === 'clipboard_failed',
  )
})

test('opens only allowlisted official HTTPS destinations with noopener and no media URL', () => {
  const opened = []
  const windowRef = {
    open: (url, target, features) => {
      opened.push({ url, target, features })
      return { opener: 'unsafe' }
    },
  }
  for (const id of networksModule.SHARE_PUBLISH_NETWORK_IDS) {
    const url = shareModule.openOfficialNetwork(id, { shareText: 'Legenda pronta', windowRef })
    assert.match(url, /^https:\/\//)
    assert.doesNotMatch(url, /media\.example\.test|temporary-secret/)
  }
  assert.equal(shareModule.openOfficialNetwork('arbitrary-network', { windowRef }), '')
  assert.ok(opened.every(call => call.target === '_blank' && call.features === 'noopener,noreferrer'))
})

test('does not add credentials, persistence, providers or retention behavior to the V1 foundation', async () => {
  const productionFiles = [
    'src/components/share/SharePublishActions.jsx',
    'src/components/share/SocialNetworkIcon.jsx',
    'src/config/sharePublishNetworks.js',
    'src/lib/share-publish.js',
  ]
  const source = (await Promise.all(productionFiles.map(file => fs.readFile(path.join(frontendRoot, file), 'utf8')))).join('\n')
  assert.doesNotMatch(source, /iconPath|<path\b/)
  for (const forbidden of [
    /localStorage/i,
    /sessionStorage/i,
    /client_secret/i,
    /app_secret/i,
    /access_token/i,
    /refresh_token/i,
    /password/i,
    /bearer/i,
    /api[_-]?key/i,
    /oauth/i,
    /instagram\.com\/.*api/i,
    /facebook\.com\/.*api/i,
    /openai/i,
    /supabase/i,
  ]) assert.doesNotMatch(source, forbidden)
})
