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
const banner = read('src/pages/HeroNext.jsx')
const campaignPackage = read('src/components/campaign/CampaignPackage.jsx')
const quickBanners = read('src/pages/NovaCampanha.jsx')
const virtualStaging = read('src/pages/VirtualStaging.jsx')
const studio = read('src/pages/StudioHero.jsx')

test('keeps the creations implementation inactive and outside launch navigation', () => {
  assert.doesNotMatch(app, /import Creations from '\.\/pages\/Creations'|path="\/pacotes-gerados"/)
  assert.doesNotMatch(sidebar, /to: '\/pacotes-gerados'|label: 'Criações'/)
  assert.doesNotMatch(quickBanners, /pacotes-gerados|Ver campanhas geradas/)
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
  assert.match(page, /body: \{ action: 'confirm', creation_id: creationId \}/)
  assert.match(page, /setCreations\(current => current\.filter\(item => item\.id !== creationId\)\)/)
  assert.match(page, /toast\.success\('Criação baixada e removida da sua central\.'\)/)
  assert.doesNotMatch(page, /storage\.from|downloadCampaign|downloadAll/)
})

test('maps Video Imobiliário with its approved visual tone and no extra card affordances', () => {
  assert.match(page, /video_imobiliario:[\s\S]*?label: 'Vídeo Imobiliário'[\s\S]*?icon: Video[\s\S]*?tone: 'violet'/)
  assert.match(page, /violet:[\s\S]*?bg-violet-500[\s\S]*?bg-violet-100 text-violet-700/)
  assert.doesNotMatch(page, /<video|thumbnail|Visualizar/)
})

test('maps Banner Imobiliário with its approved emerald tone and no extra card affordances', () => {
  assert.match(page, /banner_imobiliario:[\s\S]*?label: 'Banner Imobiliário'[\s\S]*?icon: Image[\s\S]*?tone: 'emerald'/)
  assert.match(page, /emerald:[\s\S]*?bg-emerald-500[\s\S]*?bg-emerald-100 text-emerald-700/)
  assert.doesNotMatch(page, /<img|thumbnail|Visualizar/)
})

test('downloads Video Imobiliário directly from its signed result URL', () => {
  assert.match(smartTour, /previewUrl: result\.signedVideoUrl, downloadUrl: result\.signedVideoUrl/)
  assert.doesNotMatch(smartTour, /creationId|creation-download|onWithdrawDownload|withdrawVideoImobiliario/)
  assert.match(campaignPackage, /await downloadFileFromPrivateUrl\(url, filename\)/)
})

test('downloads Banner Imobiliário directly from each signed image URL', () => {
  assert.match(banner, /await downloadImageFile\([\s\S]*?job\.imageUrl,[\s\S]*?smartcorretorai-hero-ia-/)
  assert.doesNotMatch(banner, /creationId|creation_id|creation-download|onWithdrawDownload|withdrawBannerImage/)
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

test('maps Banners Rápidos with its product identity and no extra card affordances', () => {
  assert.match(page, /banners_rapidos:[\s\S]*?label: 'Banners Rápidos'[\s\S]*?icon: Image[\s\S]*?tone: 'blue'/)
  assert.match(page, /blue:[\s\S]*?bg-blue-500[\s\S]*?bg-blue-100 text-blue-700/)
})

test('downloads Banners Rápidos from the Creatomate result and preserves URL renewal', () => {
  assert.match(quickBanners, /downloadFileFromPrivateUrl\(finalUrl, getRenderDownloadName\(render, index\)\)/)
  assert.match(quickBanners, /const renewedUrl = await renovarUrlRender\(render\)[\s\S]*downloadFileFromPrivateUrl\(renewedUrl/)
  assert.doesNotMatch(quickBanners, /creation_id|creation-download|onWithdrawDownload|SharePublishActions/)
})

test('maps Smart Space while preserving individual downloads on its original screen', () => {
  assert.match(page, /virtual_staging:[\s\S]*?label: 'Smart Space'[\s\S]*?icon: Image[\s\S]*?tone: 'cyan'/)
  assert.match(page, /cyan:[\s\S]*?bg-cyan-500[\s\S]*?bg-cyan-100 text-cyan-700/)
  assert.match(virtualStaging, /downloadFurnishRenovateResult[\s\S]*downloadFileFromPrivateUrl\(result\.afterUrl, fallbackName\)/)
  assert.doesNotMatch(virtualStaging, /creation_id|creationId|finalize_session|SharePublishActions|sharePublish\s*=/)
})

test('withdraws bundles through explicit per-file actions and confirms only after all succeeded', () => {
  assert.match(page, /prepared\.delivery_kind === 'bundle'/)
  assert.match(page, /Sua criação contém \{withdrawal\.files\.length\} imagens\./)
  assert.match(page, /withdrawal\.files\.map\(\(file, index\)/)
  assert.match(page, /downloadFileFromPrivateUrl\(file\.url, file\.name\)/)
  assert.match(page, /if \(downloadedIndexes\.length === bundleWithdrawal\.files\.length\)/)
  assert.match(page, /await confirmCreationWithdrawal\(bundleWithdrawal\.creationId\)/)
  assert.match(page, /catch \(error\) \{[\s\S]*toast\.error/)
  assert.doesNotMatch(page, /Promise\.all\(.*download|\.zip|JSZip/i)
})

test('maps Comercial Imobiliário and Vídeo Criativo as separate Studio products', () => {
  assert.match(page, /studio_comercial:[\s\S]*?label: 'Comercial Imobiliário'[\s\S]*?icon: Video[\s\S]*?tone: 'cyan'/)
  assert.match(page, /studio_video_criativo:[\s\S]*?label: 'Vídeo Criativo'[\s\S]*?icon: Video[\s\S]*?tone: 'violet'/)
  assert.doesNotMatch(page, /studio_carrossel:/)
  assert.doesNotMatch(page, /short_videos:/)
})

test('downloads Studio videos directly from the signed result URL', () => {
  assert.doesNotMatch(studio, /creationId|creation-download|onWithdrawDownload|withdrawStudioVideo/)
  assert.match(studio, /previewUrl: videoUrl/)
  assert.match(studio, /downloadUrl: videoUrl/)
})
