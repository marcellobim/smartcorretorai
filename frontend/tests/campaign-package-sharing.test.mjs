import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const element = React.createElement
const signedVideoUrl = 'https://media.example.test/result.mp4?token=signed-value'
const signedImageUrl = 'https://media.example.test/result.jpg?token=signed-value'
let vite
let CampaignPackage
let buildCampaignPackage
let buildCampaignPackageShareProps

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;[
    { CampaignPackage },
    { buildCampaignPackage },
    { buildCampaignPackageShareProps },
  ] = await Promise.all([
    vite.ssrLoadModule('/src/components/campaign/CampaignPackage.jsx'),
    vite.ssrLoadModule('/src/components/campaign/buildCampaignPackage.js'),
    vite.ssrLoadModule('/src/components/campaign/campaignPackageShare.js'),
  ])
})

after(async () => {
  await vite?.close()
})

const videoData = {
  sourceProduct: 'Vídeo Imobiliário',
  mediaType: 'video',
  previewUrl: signedVideoUrl,
  downloadUrl: signedVideoUrl,
  downloadName: 'video-original.mp4',
  purpose: 'sale',
  propertyType: 'Apartamento',
  city: 'Goiânia',
  cta: 'Agende sua visita',
  phone: '(62) 99999-0000',
  contactAuthorized: true,
  existingTexts: {
    instagram: { label: 'Instagram', text: 'Apartamento em Goiânia pronto para divulgação.' },
    hashtags: '#Apartamento #Goiania #SmartCorretorAI',
  },
}

const renderPackage = props => renderToStaticMarkup(element(CampaignPackage, { data: videoData, ...props }))

test('keeps the existing CampaignPackage render opt-in and inert by default', () => {
  const withoutProp = renderPackage()
  const explicitlyDisabled = renderPackage({ sharePublish: { enabled: false } })
  assert.doesNotMatch(withoutProp, /Compartilhar \/ Publicar/)
  assert.doesNotMatch(explicitlyDisabled, /Compartilhar \/ Publicar/)
  assert.match(withoutProp, />Baixar vídeo<\/button>/)
  assert.match(explicitlyDisabled, />Baixar vídeo<\/button>/)
})

test('renders SharePublishActions only when explicitly enabled and preserves download', () => {
  const markup = renderPackage({ sharePublish: { enabled: true } })
  assert.match(markup, /Compartilhar \/ Publicar/)
  assert.match(markup, />Baixar mídia<\/button>/)
  assert.match(markup, />Baixar vídeo<\/button>/)
})

test('derives MP4 media, original filename and existing campaign copy', () => {
  const campaign = buildCampaignPackage(videoData)
  const props = buildCampaignPackageShareProps(campaign, { enabled: true })
  assert.equal(props.media.length, 1)
  assert.equal(props.media[0].url, signedVideoUrl)
  assert.equal(props.media[0].filename, 'video-original.mp4')
  assert.equal(props.media[0].mimeType, 'video/mp4')
  assert.match(props.shareText, /Apartamento em Goiânia/)
  assert.match(String(props.hashtags), /#SmartCorretorAI/)
  assert.match(props.cta, /Agende sua visita/)
  assert.match(props.cta, /\(62\) 99999-0000/)
})

test('never includes unauthorized phone and never places signed media URLs in shared text', () => {
  const campaign = buildCampaignPackage({ ...videoData, contactAuthorized: false })
  const props = buildCampaignPackageShareProps(campaign, {
    enabled: true,
    shareTitle: `Título ${signedVideoUrl}`,
    shareText: `Legenda ${signedVideoUrl}`,
    cta: `CTA ${signedVideoUrl}`,
    hashtags: [`#Imoveis`, signedVideoUrl],
  })
  assert.doesNotMatch([props.shareTitle, props.shareText, props.cta, ...props.hashtags].join(' '), /media\.example\.test|signed-value/)
  assert.doesNotMatch(props.cta, /99999-0000/)
})

test('supports one or multiple ready images and excludes unfinished media', () => {
  const campaign = buildCampaignPackage({
    sourceProduct: 'Banner Imobiliário',
    mediaType: 'images',
    files: [
      { id: 'one', name: 'arte-1.jpg', status: 'completed', downloadUrl: signedImageUrl },
      { id: 'two', name: 'arte-2.png', status: 'succeeded', downloadUrl: 'https://media.example.test/result-2.png' },
      { id: 'three', name: 'arte-3.jpg', status: 'processing', downloadUrl: 'https://media.example.test/result-3.jpg' },
    ],
  })
  const props = buildCampaignPackageShareProps(campaign, { enabled: true })
  assert.deepEqual(props.media.map(item => item.filename), ['arte-1.jpg', 'arte-2.png'])
  assert.deepEqual(props.media.map(item => item.mimeType), ['image/jpeg', 'image/png'])
})

test('allows explicit media and network subsets without accepting arbitrary network URLs', () => {
  const campaign = buildCampaignPackage(videoData)
  const props = buildCampaignPackageShareProps(campaign, {
    enabled: true,
    media: [{ url: signedImageUrl, filename: 'foto.jpg', mimeType: 'image/jpeg' }],
    hashtags: ['#Imoveis'],
    supportedNetworks: ['instagram', 'whatsapp', 'arbitrary-network'],
  })
  assert.equal(props.media[0].url, signedImageUrl)
  assert.deepEqual(props.hashtags, ['#Imoveis'])
  assert.deepEqual(props.supportedNetworks, ['instagram', 'whatsapp', 'arbitrary-network'])
})

test('preserves player protection and default/mobile presentations with opt-in active', () => {
  const protectedMarkup = renderPackage({ sharePublish: { enabled: true }, protectVideoDownload: true, mediaPresentation: 'mobile' })
  assert.match(protectedMarkup, /controls[Ll]ist="nodownload noremoteplayback"/)
  assert.match(protectedMarkup, /disable[Pp]icture[Ii]n[Pp]icture=""/)
  assert.match(protectedMarkup, /aspect-\[9\/16\]/)
  assert.match(protectedMarkup, /smart-presentation-media/)

  const defaultMarkup = renderPackage({ sharePublish: { enabled: true } })
  assert.match(defaultMarkup, /object-contain/)
  assert.doesNotMatch(defaultMarkup, /controls[Ll]ist=/)
})

test('keeps existing callbacks and download implementation while adding no provider or persistence', async () => {
  const source = await readFile(path.join(frontendRoot, 'src/components/campaign/CampaignPackage.jsx'), 'utf8')
  const helper = await readFile(path.join(frontendRoot, 'src/components/campaign/campaignPackageShare.js'), 'utf8')
  assert.match(source, /onCreateNew/)
  assert.match(source, /onRefreshMedia/)
  assert.match(source, /onOpenImage/)
  assert.match(source, /downloadFileFromPrivateUrl/)
  assert.match(source, /sharePublish\?\.onDownload/)
  for (const forbidden of [/localStorage/i, /sessionStorage/i, /openai/i, /gemini/i, /veo/i, /creatomate/i, /supabase/i, /oauth/i, /access_token/i]) {
    assert.doesNotMatch(`${source}\n${helper}`, forbidden)
  }
})
