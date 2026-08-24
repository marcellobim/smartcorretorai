import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const economy = read('src/lib/smart-tokens.js')
const hook = read('src/hooks/useSmartTokens.js')
const estimate = read('src/components/economy/SmartTokenEstimate.jsx')
const sidebar = read('src/components/layout/Sidebar.jsx')
const textCampaign = read('src/pages/TextCampaign.jsx')
const quickBanners = read('src/pages/NovaCampanha.jsx')
const realEstateBanner = read('src/pages/HeroNext.jsx')
const carousel = read('src/pages/SmartCarrossel.jsx')
const smartTour = read('src/pages/SmartTourAI.jsx')
const virtualStaging = read('src/pages/VirtualStaging.jsx')
const studio = read('src/pages/StudioHero.jsx')

test('keeps the approved frontend preview costs in one display-only map', () => {
  assert.match(economy, /textCampaign:\s*25/)
  assert.match(economy, /quickBannerItem:\s*45/)
  assert.match(economy, /realEstateBannerItem:\s*75/)
  assert.match(economy, /smartCarousel:\s*100/)
  assert.match(economy, /veoVideo:\s*120/)
  assert.match(economy, /geminiVideo:\s*325/)
  assert.doesNotMatch(economy, /fetch\(|supabase|provider|R\$/)
})

test('reuses profiles saldo_creditos and reloadProfile without a parallel balance backend', () => {
  assert.match(economy, /'saldo_creditos'[\s\S]*'smart_tokens_saldo'/)
  assert.match(hook, /const \{ user, reloadProfile \} = useAuth\(\)/)
  assert.match(hook, /refreshBalance = useCallback\(\(\) => reloadProfile\(\)/)
  assert.doesNotMatch(`${hook}\n${estimate}`, /from\(['"]profiles|rest\/v1\/profiles|fetch\(/)
})

test('shows an integer ST balance in Sidebar with no percentage or BRL equivalent', () => {
  assert.match(sidebar, /getSmartTokenBalance\(\{ saldo_creditos: profile\?\.saldo_creditos \}\)/)
  assert.match(sidebar, /formatSmartTokens\(balance\).*ST/s)
  assert.doesNotMatch(sidebar, /%|porcentagem|R\$/)
})

test('uses one combined wallet while retaining the legacy trial display guard', () => {
  assert.match(economy, /trial_ends_at/)
  assert.match(sidebar, /showBalance = balance !== null && \(!trial \|\| balance > 0\)/)
  assert.match(estimate, /if \(trial\) return null/)
})

test('renders a compact insufficient-balance warning and existing recharge route', () => {
  assert.match(estimate, /balance < normalizedCost/)
  assert.match(estimate, /Você precisa de mais Smart Tokens para esta criação/)
  assert.match(estimate, /to="\/planos"/)
  assert.match(economy, /INSUFFICIENT_SMART_TOKENS/)
  assert.doesNotMatch(estimate, /required_tokens|available_tokens|JSON/)
})

test('turns the server trial allowlist rejection into a clear commercial next step', () => {
  assert.match(economy, /TRIAL_PRODUCT_NOT_ALLOWED/)
  assert.match(economy, /Este produto não está incluído no teste grátis/)
  assert.match(economy, /adicione Smart Tokens em Planos/)
})

test('quotes Textos 25, Carrossel 100, Veo 120 and Gemini 325 at the final CTA', () => {
  assert.match(textCampaign, /cost=\{SMART_TOKEN_COSTS\.textCampaign\}/)
  assert.match(textCampaign, /Google Ads incluído/)
  assert.match(carousel, /cost=\{SMART_TOKEN_COSTS\.smartCarousel\}/)
  assert.match(smartTour, /cost=\{SMART_TOKEN_COSTS\.geminiVideo\}/)
  assert.match(virtualStaging, /cost=\{SMART_TOKEN_COSTS\.geminiVideo\}/)
  assert.equal((studio.match(/cost=\{SMART_TOKEN_COSTS\.veoVideo\}/g) || []).length, 2)
})

test('updates Banners Rápidos and Banner Imobiliário previews from the live selection', () => {
  assert.match(quickBanners, /selectedCatalogItems\.length \* SMART_TOKEN_COSTS\.quickBannerItem/)
  assert.match(quickBanners, /entrega selecionada/)
  assert.match(realEstateBanner, /\(totalPieceCount \|\| 0\) \* SMART_TOKEN_COSTS\.realEstateBannerItem/)
  assert.match(realEstateBanner, /formatPieceCount\(totalPieceCount \|\| 0\)/)
})

test('refetches the real profile balance after terminal success or failure paths', () => {
  for (const source of [textCampaign, quickBanners, realEstateBanner, carousel, smartTour, virtualStaging, studio]) {
    assert.match(source, /reloadProfile|refreshBalance/)
  }
  assert.match(carousel, /void refreshBalance\(\)/)
  assert.match(smartTour, /void reloadProfile\(\)/)
  assert.match(virtualStaging, /void reloadProfile\(\)/)
  assert.match(studio, /void reloadProfile\(\)/)
})
