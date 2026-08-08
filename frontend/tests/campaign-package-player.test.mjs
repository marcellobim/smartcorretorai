import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const componentPath = path.join(frontendRoot, 'src/components/campaign/CampaignPackage.jsx')
const element = React.createElement
let vite
let CampaignPackage
let blockVideoContextMenu
let getVideoDownloadTelemetry

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;({
    CampaignPackage,
    blockVideoContextMenu,
    getVideoDownloadTelemetry,
  } = await vite.ssrLoadModule('/src/components/campaign/CampaignPackage.jsx'))
})

after(async () => {
  await vite?.close()
})

const videoData = {
  sourceProduct: 'Teste',
  mediaType: 'video',
  previewUrl: 'https://example.test/preview.mp4',
  downloadUrl: 'https://example.test/download.mp4',
}

const renderPackage = (props = {}, data = videoData) => renderToStaticMarkup(
  element(CampaignPackage, { data, ...props }),
)

test('keeps the legacy presentation and player controls as defaults', () => {
  const markup = renderPackage()

  assert.match(markup, /bg-slate-950[^"']*p-2/)
  assert.match(markup, /max-h-\[680px\][^"']*object-contain/)
  assert.doesNotMatch(markup, /aspect-\[9\/16\]/)
  assert.doesNotMatch(markup, /smart-presentation-media/)
  assert.doesNotMatch(markup, /controls[Ll]ist=/)
  assert.doesNotMatch(markup, /disable[Pp]icture[Ii]n[Pp]icture=/)
})

test('renders the mobile video presentation in a centered 9:16 frame', () => {
  const markup = renderPackage({ mediaPresentation: 'mobile' })

  assert.match(markup, /aspect-\[9\/16\]/)
  assert.match(markup, /max-h-\[680px\]/)
  assert.match(markup, /max-w-\[383px\]/)
  assert.match(markup, /mx-auto/)
  assert.match(markup, /smart-presentation-media/)
  assert.doesNotMatch(markup, /max-h-\[680px\][^"']*object-contain/)
})

test('protects only the native player interface when requested', async () => {
  const protectedMarkup = renderPackage({ protectVideoDownload: true })
  const defaultMarkup = renderPackage()

  assert.match(protectedMarkup, /controls[Ll]ist="nodownload noremoteplayback"/)
  assert.match(protectedMarkup, /disable[Pp]icture[Ii]n[Pp]icture=""/)
  assert.doesNotMatch(defaultMarkup, /controls[Ll]ist=/)
  assert.doesNotMatch(defaultMarkup, /disable[Pp]icture[Ii]n[Pp]icture=/)

  let prevented = false
  blockVideoContextMenu({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)

  const source = await readFile(componentPath, 'utf8')
  assert.match(source, /onContextMenu=\{protectDownload \? blockVideoContextMenu : undefined\}/)
})

test('keeps the explicit authorized download available with player protection', () => {
  const markup = renderPackage({ protectVideoDownload: true })

  assert.match(markup, />Baixar vídeo<\/button>/)
  assert.match(markup, /controls[Ll]ist="nodownload noremoteplayback"/)
})

test('does not apply the mobile video presentation to image campaigns', () => {
  const markup = renderPackage({ mediaPresentation: 'mobile', protectVideoDownload: true }, {
    sourceProduct: 'Teste',
    mediaType: 'images',
    files: [{
      id: 'image-1',
      name: 'Imagem pronta',
      type: 'image',
      status: 'completed',
      downloadUrl: 'https://example.test/image.jpg',
    }],
  })

  assert.match(markup, /<img[^>]*object-contain/)
  assert.doesNotMatch(markup, /smart-presentation-media/)
  assert.doesNotMatch(markup, /aspect-\[9\/16\]/)
  assert.match(markup, />Baixar<\/button>/)
})

test('reports player controls and explicit delivery download independently', () => {
  assert.deepEqual(getVideoDownloadTelemetry({
    src: 'https://example.test/video.mp4',
    downloadUrl: 'https://example.test/video.mp4',
    protectDownload: true,
  }), {
    player_download_control_enabled: false,
    explicit_download_available: true,
    same_source_as_download: true,
  })

  assert.deepEqual(getVideoDownloadTelemetry({
    src: 'https://example.test/preview.mp4',
    downloadUrl: 'https://example.test/download.mp4',
  }), {
    player_download_control_enabled: true,
    explicit_download_available: true,
    same_source_as_download: false,
  })

  assert.deepEqual(getVideoDownloadTelemetry({ src: 'https://example.test/preview.mp4' }), {
    player_download_control_enabled: true,
    explicit_download_available: false,
    same_source_as_download: false,
  })
})
