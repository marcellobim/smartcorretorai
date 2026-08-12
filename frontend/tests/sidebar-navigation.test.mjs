import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const sidebar = read('src/components/layout/Sidebar.jsx')
const layout = read('src/components/layout/AppLayout.jsx')
const header = read('src/components/layout/Header.jsx')
const brandMark = read('src/components/brand/BrandMark.jsx')

test('uses the official SmartCorretorAI mark and signature without changing product icons', () => {
  assert.match(sidebar, /<BrandMark size=\{36\} decorative \/>/)
  assert.match(sidebar, /Inteligência que vende\./)
  assert.doesNotMatch(sidebar, /Marketing com IA|<Zap/)
  assert.match(sidebar, /icon: Sparkles, label: 'Studio IA'/)
  assert.match(brandMark, /smartcorretorai-symbol-\$\{sourceSize\}\.png/)
  assert.match(brandMark, /aria-hidden=\{decorative \|\| undefined\}/)
})

test('organizes the sidebar in the approved section order', () => {
  const principal = sidebar.indexOf("label: 'Principal'")
  const create = sidebar.indexOf("label: 'Criar'")
  const account = sidebar.indexOf('Conta')
  const administration = sidebar.indexOf('Administração')

  assert.ok(principal >= 0)
  assert.ok(create > principal)
  assert.ok(account > create)
  assert.ok(administration > account)
})

test('keeps the six approved products in the same order as Home', () => {
  const expectedProducts = [
    ["'/smart-tour-ai'", "'Vídeo Imobiliário'"],
    ["'/hero'", "'Banner Imobiliário'"],
    ["'/studio-hero'", "'Studio IA'"],
    ["'/virtual-staging'", "'Virtual Space'"],
    ["'/nova-campanha'", "'Banners Rápidos'"],
    ["'/campanha-de-textos'", "'Campanha de Textos'"],
  ]

  let previousPosition = -1
  for (const [route, label] of expectedProducts) {
    const position = sidebar.indexOf(`to: ${route}`)
    assert.ok(position > previousPosition, `${label} must keep the approved order`)
    assert.ok(sidebar.indexOf(`label: ${label}`, position) > position)
    previousPosition = position
  }
})

test('uses the approved account names and conditional administration section', () => {
  assert.match(sidebar, /label: 'Perfil Profissional'/)
  assert.match(sidebar, /label: 'Configurações'/)
  assert.match(sidebar, /user\?\.role === 'admin'/)
  assert.match(sidebar, />\s*Administração\s*</)
})

test('shows only real Smart Tokens data in one compact account link', () => {
  assert.match(sidebar, /const smartTokensItem = \{ to: '\/planos', label: 'Smart Tokens' \}/)
  assert.match(sidebar, /balance !== null/)
  assert.match(sidebar, /disponíveis/)
  assert.match(sidebar, /min-h-11 items-center gap-3 rounded-xl px-3 py-2/)
  assert.doesNotMatch(sidebar, /Ver plano e saldo|Próximo ciclo|Renovação|style=\{\{ width:|rounded-xl border px-3 py-2\.5/)
})

test('keeps the desktop shell fixed and scrolls only the navigation area', () => {
  assert.match(sidebar, /h-dvh w-64 flex-col overflow-hidden/)
  assert.match(sidebar, /flex-1[^"]*overflow-y-auto/)
  assert.match(layout, /sticky top-0 hidden h-dvh w-64 shrink-0 lg:block/)
})

test('provides one responsive drawer across standard and custom product headers', () => {
  assert.match(header, /aria-label="Abrir menu"/)
  assert.match(header, /openMobileMenu/)
  assert.match(layout, /role="dialog"/)
  assert.match(layout, /aria-modal="true"/)
  assert.match(layout, /event\.key === 'Escape'/)
  assert.match(layout, /<Sidebar mobile onClose=/)
  assert.match(layout, /usesStandaloneMobileMenuButton/)
})
