import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const tracker = read('../src/lib/account-analytics.js')
const hook = read('../src/hooks/useAccountAnalytics.js')
const routes = read('../src/App.jsx')
const auth = read('../src/lib/auth-context.jsx')
const admin = read('../src/pages/AdminDashboard.jsx')

test('tracking payload has no PII, user id or arbitrary metadata', () => {
  assert.match(tracker, /p_event_type: eventType, p_product_id: productId, p_step_id: stepId/)
  assert.doesNotMatch(tracker, /p_user_id|email|phone|telefone|prompt|metadata|property_data/i)
  assert.match(tracker, /catch \{\s*return false\s*\}/)
})

test('first login uses the authenticated token and does not block auth resolution', () => {
  assert.match(auth, /void trackAccountAnalyticsEvent\(\{[\s\S]*eventType: 'first_login'[\s\S]*accessToken: newSession\?\.access_token/)
})

test('all active generation products are wrapped with account-scoped product tracking', () => {
  for (const constant of ['RAIO_X', 'VIDEO_IMOBILIARIO', 'BANNER_IMOBILIARIO', 'STUDIO_IA', 'SMART_CARROSSEL', 'SMART_SPACE', 'BANNERS_RAPIDOS', 'CAMPANHA_TEXTOS']) {
    assert.match(routes, new RegExp(`productId=\\{PRODUCTS\\.${constant}\\}`))
  }
  assert.doesNotMatch(routes, /SHORT_VIDEOS|productId=\{PRODUCTS\.[^}]*SHORT/)
})

test('flow milestones are deduplicated in-memory and tracking failures never block product behavior', () => {
  assert.match(hook, /reachedSteps = useRef\(new Set\(\)\)/)
  assert.match(hook, /void trackAccountAnalyticsEvent/)
  assert.match(hook, /trackGenerationClicked/)
})

test('every active product records generation clicks without awaiting tracking', () => {
  const pages = ['RaioXAnuncio', 'SmartTourAI', 'HeroNext', 'StudioHero', 'SmartCarrossel', 'VirtualStaging', 'NovaCampanha', 'TextCampaign']
  for (const page of pages) {
    const source = read(`../src/pages/${page}.jsx`)
    assert.match(source, /useAccountAnalytics\(/, `${page} must use account analytics`)
    assert.match(source, /trackGenerationClicked\(\)/, `${page} must record a generation click`)
  }
})

test('Admin exposes the three compact columns, timeline, funnel and legacy fallback', () => {
  assert.match(admin, />Último login</)
  assert.match(admin, />Última atividade</)
  assert.match(admin, />Último produto</)
  assert.match(admin, /Atividade recente/)
  assert.match(admin, /Funil do cliente/)
  assert.match(admin, /Sem dados anteriores de navegação/)
  assert.match(admin, /client\.accountAnalyticsAvailable[\s\S]*?'Indisponível'/)
})

test('Short Videos remains frozen', () => {
  const shortVideos = read('../src/config/shortVideos.js')
  assert.match(shortVideos, /SHORT_VIDEOS_VISIBLE = false/)
})
