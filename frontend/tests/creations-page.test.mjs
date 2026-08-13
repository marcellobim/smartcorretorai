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
const smartTour = read('src/pages/SmartTourAI.jsx')
const campaignPackage = read('src/components/campaign/CampaignPackage.jsx')

test('keeps the existing route and sidebar link while rendering the real page', () => {
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

test('loads only the safe creation list fields and contains no visual mocks', () => {
  assert.match(page, /CREATION_SELECT = 'id,product_key,title,delivery_kind,completed_at,expires_at'/)
  assert.match(page, /supabase[\s\S]*?\.from\('creations'\)[\s\S]*?\.select\(CREATION_SELECT\)[\s\S]*?\.order\('completed_at', \{ ascending: false \}\)/)
  assert.doesNotMatch(page, /result_manifest|CREATION_VISUAL_MOCKS|Apartamento em Moema|estado=vazio|useSearchParams/)
})

test('keeps cards concise with dates and a real prepare-download-confirm action', () => {
  assert.match(page, /<dt[^>]*>Criado<\/dt>/)
  assert.match(page, /<dt[^>]*>Expira<\/dt>/)
  assert.match(page, /<ProductButton type="button" variant="secondary"[^>]*onClick=\{\(\) => onDownload\(creation\)\}/)
  assert.match(page, /<ProductButton[^>]*>[\s\S]*?Baixar\s*<\/ProductButton>/)
  assert.match(page, /body: \{ action: 'prepare', creation_id: creation\.id \}/)
  assert.match(page, /prepared\.delivery_kind === 'file'/)
  assert.match(page, /downloadFileFromPrivateUrl\(prepared\.download\.url, prepared\.download\.name\)/)
  assert.match(page, /startTextDownload\(formatCompleteTextCampaign\(campaign\), prepared\.download\.name\)/)
  assert.match(page, /body: \{ action: 'confirm', creation_id: creation\.id \}/)
  assert.match(page, /setCreations\(current => current\.filter\(item => item\.id !== creation\.id\)\)/)
  assert.match(page, /toast\.success\('Criação baixada e removida da sua central\.'\)/)
  assert.doesNotMatch(page, /storage\.from|downloadCampaign|downloadAll/)
})

test('maps Video Imobiliário with its approved visual tone and no extra card affordances', () => {
  assert.match(page, /video_imobiliario:[\s\S]*?label: 'Vídeo Imobiliário'[\s\S]*?icon: Video[\s\S]*?tone: 'violet'/)
  assert.match(page, /violet:[\s\S]*?bg-violet-500[\s\S]*?bg-violet-100 text-violet-700/)
  assert.doesNotMatch(page, /<video|thumbnail|Visualizar/)
})

test('withdraws Video Imobiliário from its original result through the same prepare-confirm contract', () => {
  assert.match(smartTour, /body: \{ action: 'prepare', creation_id: result\.creationId \}/)
  assert.match(smartTour, /prepared\.delivery_kind !== 'file'/)
  assert.match(smartTour, /downloadFileFromPrivateUrl\(prepared\.download\.url, prepared\.download\.name \|\| filename\)/)
  assert.match(smartTour, /body: \{ action: 'confirm', creation_id: result\.creationId \}/)
  assert.match(smartTour, /onWithdrawDownload=\{isShortVideoResult \? undefined : withdrawVideoImobiliario\}/)
  assert.match(campaignPackage, /typeof onWithdrawDownload === 'function'[\s\S]*?key === 'video'[\s\S]*?url === campaign\.downloadUrl[\s\S]*?await onWithdrawDownload\(filename\)/)
})

test('removes every legacy campaign affordance from the active page', () => {
  assert.doesNotMatch(page, /Campanhas Geradas|Baixar todos|Baixar campanha|Concluído|Instagram|Facebook|WhatsApp|<Search|Visualizar|Excluir/)
  assert.match(legacyPage, /Campanhas Geradas/)
  assert.doesNotMatch(app, /<PacotesGerados \/>/)
})

test('provides the modern empty state from the real query result', () => {
  assert.match(page, /creations\.length > 0/)
  assert.match(page, /Você ainda não tem criações disponíveis\./)
  assert.match(page, /Quando você criar um novo material, ele aparecerá aqui temporariamente para download\./)
  assert.match(page, /to="\/dashboard"[\s\S]*Criar novo material/)
})

test('keeps failed prepare or confirm attempts visible and reports errors without fake success', () => {
  const removalIndex = page.indexOf('setCreations(current => current.filter')
  const confirmIndex = page.indexOf("body: { action: 'confirm'")
  assert.ok(confirmIndex > -1 && removalIndex > confirmIndex)
  assert.match(page, /if \(confirmError \|\| !confirmed\?\.ok \|\| !confirmed\.confirmed\)/)
  assert.match(page, /catch \(error\) \{[\s\S]*toast\.error/)
})

test('uses the current design system and a responsive overflow-safe grid', () => {
  assert.match(page, /ProductButton, ProductCard, SMART_UI/)
  assert.match(page, /data-creations-grid[\s\S]*grid-cols-1[\s\S]*lg:grid-cols-2/)
  assert.match(page, /max-w-6xl min-w-0 px-smart-page/)
  assert.match(page, /flex min-w-0 flex-col overflow-hidden/)
  assert.match(page, /break-words/)
  assert.doesNotMatch(page, /CampaignCard|Modal/)
})
