import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const page = read('src/pages/Creations.jsx')
const legacyPage = read('src/pages/PacotesGerados.jsx')
const app = read('src/App.jsx')
const sidebar = read('src/components/layout/Sidebar.jsx')

const expectedProducts = [
  ['Vídeo Imobiliário', 'Apartamento em Moema'],
  ['Banner Imobiliário', 'Lançamento Vila Mariana'],
  ['Studio IA — Comercial Imobiliário', 'Casa em Alphaville'],
  ['Virtual Staging', 'Apartamento Vila Madalena'],
  ['Banners Rápidos', 'Lançamento Zona Sul'],
  ['Campanha de Textos', 'Apartamento Vila Guimercindo'],
]

test('keeps the existing route and sidebar link while rendering the new visual page', () => {
  assert.match(app, /import Creations from '\.\/pages\/Creations'/)
  assert.match(app, /path="\/pacotes-gerados" element=\{<Creations \/>\}/)
  assert.match(sidebar, /to: '\/pacotes-gerados'[\s\S]*?label: 'Criações'/)
  assert.match(page, /<Header title="Criações" subtitle="Baixe e guarde os materiais que você criou\." \/>/)
})

test('explains the temporary 24-hour availability without a countdown', () => {
  assert.match(page, /Baixe suas criações para guardá-las\. Elas ficam disponíveis temporariamente por até 24 horas\./)
  assert.match(page, /Após o download ou a data de expiração indicada, a criação é removida do SmartCorretorAI\./)
  assert.doesNotMatch(page, /countdown|tempo restante|\d+h \d+m|setInterval/i)
})

test('renders exactly the six approved local visual mocks', () => {
  for (const [product, title] of expectedProducts) {
    assert.ok(page.includes(`product: '${product}'`), product)
    assert.ok(page.includes(`title: '${title}'`), title)
  }
  assert.equal((page.match(/id: '/g) || []).length, expectedProducts.length)
  assert.doesNotMatch(page, /useCampaigns|supabase|creation-download|public\.creations|fetch\(|axios/i)
})

test('keeps cards concise with dates and a visual-only download action', () => {
  assert.match(page, /<dt[^>]*>Criado<\/dt>/)
  assert.match(page, /<dt[^>]*>Expira<\/dt>/)
  assert.match(page, /<ProductButton type="button" variant="secondary"/)
  assert.match(page, />\s*Baixar\s*<\/ProductButton>/)
  assert.doesNotMatch(page, /href=|URL\.createObjectURL|Blob\(|storage\.from|downloadCampaign|downloadAll/)
})

test('removes every legacy campaign affordance from the active page', () => {
  assert.doesNotMatch(page, /Campanhas Geradas|Baixar todos|Baixar campanha|Concluído|Instagram|Facebook|WhatsApp|<Search|Visualizar|Excluir/)
  assert.match(legacyPage, /Campanhas Geradas/)
  assert.doesNotMatch(app, /<PacotesGerados \/>/)
})

test('provides a modern empty state through an isolated local visual query', () => {
  assert.match(page, /searchParams\.get\('estado'\) === 'vazio'/)
  assert.match(page, /Você ainda não tem criações disponíveis\./)
  assert.match(page, /Quando você criar um novo material, ele aparecerá aqui temporariamente para download\./)
  assert.match(page, /to="\/dashboard"[\s\S]*Criar novo material/)
})

test('uses the current design system and a responsive overflow-safe grid', () => {
  assert.match(page, /ProductButton, ProductCard, SMART_UI/)
  assert.match(page, /data-creations-grid[\s\S]*grid-cols-1[\s\S]*lg:grid-cols-2/)
  assert.match(page, /max-w-6xl min-w-0 px-smart-page/)
  assert.match(page, /flex min-w-0 flex-col overflow-hidden/)
  assert.match(page, /break-words/)
  assert.doesNotMatch(page, /CampaignCard|Modal/)
})
