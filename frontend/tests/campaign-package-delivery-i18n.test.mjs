import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, before } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let vite
let CampaignPackage
let SharePublishActions
let LocaleContext
let getMessage

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://project.example.test'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
    },
    server: { middlewareMode: true },
  })
  ;[{ CampaignPackage }, { default: SharePublishActions }, { LocaleContext }, { getMessage }] = await Promise.all([
    vite.ssrLoadModule('/src/components/campaign/CampaignPackage.jsx'),
    vite.ssrLoadModule('/src/components/share/SharePublishActions.jsx'),
    vite.ssrLoadModule('/src/i18n/LocaleProvider.jsx'),
    vite.ssrLoadModule('/src/i18n/messages.js'),
  ])
})

after(async () => vite?.close())

const data = {
  sourceProduct: 'Smart Carousel',
  mediaType: 'video',
  previewUrl: 'https://media.example.test/carousel.mp4',
  downloadUrl: 'https://media.example.test/carousel.mp4',
  cta: 'Schedule a tour',
  contactAuthorized: true,
  phone: '(813) 555-0199',
  existingTexts: { instagram: { label: 'Instagram', text: 'Historic campaign copy remains unchanged.' } },
}

function render(locale) {
  return renderToStaticMarkup(createElement(
    LocaleContext.Provider,
    { value: { locale, market: locale === 'en-US' ? 'US' : 'BR', t: key => getMessage(key, locale) } },
    createElement(CampaignPackage, { data }),
  ))
}

test('shared post-generation delivery uses English UI for Smart Carousel in US without rewriting saved copy', () => {
  const markup = render('en-US')
  for (const text of ['Campaign Package', 'Your campaign is ready.', 'CTA and contact', 'Information used', 'CTA used', 'Copy CTA', 'Promotion tips', 'Next steps', 'Keep building results']) {
    assert.match(markup, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), text)
  }
  assert.doesNotMatch(markup, /CTA e contato|Informações utilizadas|CTA utilizado|Copiar CTA|Dicas para divulgar|Próximos passos|Sua campanha está pronta|Continue gerando resultados/)
  assert.match(markup, /Historic campaign copy remains unchanged\./)
})

test('shared post-generation delivery preserves Portuguese UI in Brazil', () => {
  const markup = render('pt-BR')
  for (const text of ['Pacote da Campanha', 'Sua campanha está pronta.', 'CTA e contato', 'Informações utilizadas', 'CTA utilizado', 'Copiar CTA', 'Dicas para divulgar', 'Próximos passos', 'Continue gerando resultados']) {
    assert.match(markup, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), text)
  }
})

test('all active delivery products use the shared localized CampaignPackage', async () => {
  for (const file of ['SmartCarrossel.jsx', 'SmartTourAI.jsx', 'StudioHero.jsx', 'VirtualStaging.jsx', 'HeroNext.jsx']) {
    const source = await readFile(path.join(frontendRoot, 'src/pages', file), 'utf8')
    assert.match(source, /<CampaignPackage/)
  }
})

test('shared post-generation sharing controls use the active locale', () => {
  const renderShare = locale => renderToStaticMarkup(createElement(
    LocaleContext.Provider,
    { value: { locale, market: locale === 'en-US' ? 'US' : 'BR', t: key => getMessage(key, locale) } },
    createElement(SharePublishActions, {
      defaultExpanded: true,
      media: [{ url: 'https://media.example.test/carousel.mp4', filename: 'carousel.mp4', mimeType: 'video/mp4' }],
    }),
  ))

  const us = renderShare('en-US')
  assert.match(us, /Share \/ Publish/)
  assert.match(us, /Download media/)
  assert.match(us, /aria-label="Open Instagram"/)
  assert.doesNotMatch(us, /Compartilhar \/ Publicar|Baixar mídia|Abrir Instagram|Baixe a mídia, copie a legenda/)

  const br = renderShare('pt-BR')
  assert.match(br, /Compartilhar \/ Publicar/)
  assert.match(br, /Baixar mídia/)
  assert.match(br, /aria-label="Abrir Instagram"/)
})
