import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let CampaignPackage
let BannerPublishDialog

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  ;({ CampaignPackage } = await vite.ssrLoadModule('/src/components/campaign/CampaignPackage.jsx'))
  ;({ default: BannerPublishDialog } = await vite.ssrLoadModule('/src/components/campaign/BannerPublishDialog.jsx'))
})

after(async () => vite?.close())

const data = {
  sourceProduct: 'Banner Imobiliário',
  sourceType: 'banner_imobiliario',
  sourceId: 'creation-a',
  mediaType: 'images',
  files: [1, 2, 3].map(number => ({ id: `asset-${number}`, assetId: `asset-${number}`, optionId: `banner-caption-option-${number}`, optionNumber: number, name: `Arte ${number}`, status: 'Concluída', previewUrl: `https://preview.invalid/${number}.jpg`, downloadUrl: `https://preview.invalid/${number}.jpg` })),
  existingTexts: [1, 2, 3].map(number => ({ id: `banner-caption-option-${number}`, label: `Instagram/Facebook Texto ${number}`, text: `Legenda exata ${number}` })),
}

test('render do Banner adiciona Publicar ao lado de cada um dos três textos e nenhum outro produto recebe o opt-in', () => {
  const banner = renderToStaticMarkup(createElement(CampaignPackage, { data, bannerPublish: { enabled: true } }))
  const other = renderToStaticMarkup(createElement(CampaignPackage, { data: { ...data, sourceProduct: 'Outro produto' }, bannerPublish: { enabled: true } }))
  assert.equal((banner.match(/>Publicar<\/button>/g) || []).length, 3)
  assert.equal((other.match(/>Publicar<\/button>/g) || []).length, 0)
})

test('confirmação renderiza a mídia e o caption snapshot exatos sem executar publicação', () => {
  const markup = renderToStaticMarkup(createElement(BannerPublishDialog, {
    intent: { optionLabel: 'Texto 2', captionSnapshot: 'Legenda exata 2', mediaName: 'Arte 2', mediaPreviewUrl: 'https://preview.invalid/2.jpg' },
  }))
  assert.match(markup, /Texto 2/)
  assert.match(markup, /Legenda exata 2/)
  assert.match(markup, /https:\/\/preview\.invalid\/2\.jpg/)
  assert.match(markup, /Publicar agora/)
  assert.match(markup, /Cancelar/)
})
