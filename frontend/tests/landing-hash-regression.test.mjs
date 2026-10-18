import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
  plugins: [{
    name: 'landing-hash-regression-mocks',
    enforce: 'pre',
    resolveId(id) {
      if (id.includes('FirstCreationEntry')) return '\0landing-hash-first-creation'
      if (id.includes('auth-context')) return '\0landing-hash-auth'
      if (id.includes('AnalyticsProvider')) return '\0landing-hash-analytics'
      return null
    },
    load(id) {
      if (id === '\0landing-hash-first-creation') return 'export default function FirstCreationEntry(){return null}'
      if (id === '\0landing-hash-auth') return 'export const useOptionalAuth=()=>null'
      if (id === '\0landing-hash-analytics') return 'export const useAnalytics=()=>({trackEvent:()=>{},trackCta:()=>{},openCookiePreferences:()=>{}})'
      return null
    },
  }],
})
const [{ default: LandingPage }, { LocaleContext }, { getMessage }, { MARKET_CONFIG }] = await Promise.all([
  vite.ssrLoadModule('/src/pages/LandingPage.jsx'),
  vite.ssrLoadModule('/src/i18n/LocaleProvider.jsx'),
  vite.ssrLoadModule('/src/i18n/messages.js'),
  vite.ssrLoadModule('/src/i18n/locale-config.js'),
])

function renderLanding(market) {
  const { locale, currency, units } = MARKET_CONFIG[market]
  const localeContext = {
    market,
    locale,
    currency,
    units,
    t: key => getMessage(key, locale),
    setLocale: () => {},
    setMarket: () => {},
  }
  return renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/#conheca-a-plataforma'] },
      React.createElement(LocaleContext.Provider, { value: localeContext }, React.createElement(LandingPage)),
    ),
  )
}

test('Landing renders direct hash reload state in BR and US without undefined list entries or mixed Hero copy', async () => {
  const originalConsoleError = console.error
  console.error = (...args) => {
    if (String(args[0]).includes('useLayoutEffect does nothing on the server')) return
    originalConsoleError(...args)
  }
  try {
    for (const [market, expectedCopy, heroCopy, otherMarketHeroCopy] of [
      ['BR', 'Criações em vídeo', 'Crie marketing imobiliário pronto para publicar.', 'Create real estate marketing that’s ready to publish.'],
      ['US', 'Video creations', 'Create real estate marketing that’s ready to publish.', 'Crie marketing imobiliário pronto para publicar.'],
    ]) {
      for (const viewport of ['desktop', 'mobile']) {
        const html = renderLanding(market)
        assert.match(html, /id="conheca-a-plataforma"/)
        assert.match(html, new RegExp(expectedCopy))
        assert.match(html, new RegExp(heroCopy))
        assert.doesNotMatch(html, new RegExp(otherMarketHeroCopy))
        assert.doesNotMatch(html, /undefined/)

        const reloadedHtml = renderLanding(market)
        assert.equal(reloadedHtml.includes(expectedCopy), true, `${market} ${viewport} reload keeps the delivery section rendered`)
      }
    }
  } finally {
    console.error = originalConsoleError
    await vite.close()
  }
})
