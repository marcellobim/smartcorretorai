import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Render the real Home and router. Only the account-dependent header is stubbed.
const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import { renderToString } from 'react-dom/server.browser'; import { MemoryRouter } from 'react-router-dom'; import Dashboard from './src/pages/Dashboard.jsx'; export const render = url => renderToString(<MemoryRouter initialEntries={[url]}><Dashboard /></MemoryRouter>);`,
    resolveDir: root, loader: 'jsx',
  },
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'account-header', setup(builder) {
    builder.onResolve({ filter: /components\/layout\/Header$/ }, () => ({ path: 'header', namespace: 'test' }))
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export default function Header(){return null}', loader: 'js' }))
  } }],
})
const { render } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const ids = (html, attribute) => [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(match => match[1])

test('Home renders exactly four groups and no individual product cards', () => {
  const html = render('/dashboard')
  assert.deepEqual(ids(html, 'data-home-group'), ['video', 'imagem', 'texto', 'analisar'])
  assert.deepEqual(ids(html, 'data-home-product'), [])
  for (const label of ['VÍDEO', 'IMAGEM', 'TEXTO', 'ANALISAR']) assert.ok(html.includes(label))
  assert.match(html, /href="\/dashboard\?grupo=video"/)
  assert.match(html, /href="\/dashboard\?grupo=imagem"/)
  assert.match(html, /href="\/campanha-de-textos"/)
  assert.match(html, /href="\/raio-x-anuncio"/)
})

test('VÍDEO renders its three existing entries and leaves Short Videos absent', () => {
  const html = render('/dashboard?grupo=video')
  assert.deepEqual(ids(html, 'data-home-product'), ['smart-tour-ai', 'comercial-imobiliario', 'video-criativo'])
  assert.deepEqual(ids(html, 'data-home-group'), [])
  assert.match(html, /href="\/smart-tour-ai"/)
  assert.equal((html.match(/href="\/studio-hero"/g) || []).length, 2)
  assert.equal((html.match(/>Studio IA<\/p>/g) || []).length, 2)
  assert.doesNotMatch(html, /Short Videos/)
  assert.match(html, /href="\/dashboard"[^>]*>[\s\S]*Voltar aos grupos/)
})

test('IMAGEM renders four products with their unchanged routes', () => {
  const html = render('/dashboard?grupo=imagem')
  assert.deepEqual(ids(html, 'data-home-product'), ['hero-ia', 'smart-space', 'banners-rapidos', 'smart-carrossel'])
  for (const route of ['/hero', '/virtual-staging', '/nova-campanha', '/smart-carrossel']) assert.ok(html.includes(`href="${route}"`))
})

test('unknown group returns to four choices and all destinations remain registered', () => {
  assert.equal(ids(render('/dashboard?grupo=unknown'), 'data-home-group').length, 4)
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  for (const route of ['/smart-tour-ai', '/studio-hero', '/hero', '/virtual-staging', '/nova-campanha', '/smart-carrossel', '/campanha-de-textos', '/raio-x-anuncio']) assert.ok(app.includes(`path="${route}"`), route)
})
