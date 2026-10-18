import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8')

test('Home starts directly with operational product choices', () => {
  assert.match(dashboard, /<Header title=\{t\('dashboard\.header\.title'\)\}/)
  assert.match(dashboard, /<section aria-labelledby="home-products-title">/)
  assert.match(dashboard, /t\('dashboard\.productsTitle'\)/)
  assert.match(dashboard, /data-home-product-grid/)
})

test('Home no longer renders the example carousel or institutional benefits strip', () => {
  const renderedHome = dashboard.slice(dashboard.indexOf('export default function Dashboard'), dashboard.indexOf('function HeroMediaShowcase'))
  assert.doesNotMatch(renderedHome, /HeroMediaShowcase/)
  assert.doesNotMatch(renderedHome, /data-home-hero/)
  assert.doesNotMatch(renderedHome, /data-home-benefits/)
  for (const copy of ['Agilidade com qualidade', 'Seguro e privado', 'Economia inteligente', 'Materiais prontos para divulgar']) assert.doesNotMatch(renderedHome, new RegExp(copy))
})

test('Home preserves operational product routes and grouping', () => {
  for (const route of ['/smart-tour-ai', '/hero', '/studio-hero', '/smart-carrossel', '/virtual-staging', '/campanha-de-textos']) assert.match(dashboard, new RegExp(`to: '${route}'`))
  assert.match(dashboard, /homeGroups/)
  assert.match(dashboard, /visibleProducts/)
})
