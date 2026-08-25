import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const auth = read('../src/lib/auth-context.jsx')
const app = read('../src/App.jsx')
const mfaGate = read('../src/components/auth/AdminMfaGate.jsx')
const sidebar = read('../src/components/layout/Sidebar.jsx')
const dashboard = read('../src/pages/AdminDashboard.jsx')
const api = read('../src/lib/admin-api.js')
const adminRuntime = read('../../supabase/functions/admin-api/runtime.ts')
const smartTourGenerate = read('../../supabase/functions/smart-tour-generate/index.ts')
const virtualStagingImage = read('../../supabase/functions/virtual-staging-image-test/index.ts')

const executableExtensions = new Set(['.js', '.jsx', '.ts', '.tsx'])
const activeCodeRoots = [
  fileURLToPath(new URL('../src/', import.meta.url)),
  fileURLToPath(new URL('../../supabase/functions/', import.meta.url)),
]

function listActiveCodeFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : listActiveCodeFiles(path)
    if (!executableExtensions.has(extname(entry.name)) || /\.test\.[cm]?[jt]sx?$/.test(entry.name)) return []
    return [path]
  })
}

const forbiddenAdminEmailPatterns = [
  { name: 'ADMIN_EMAIL constant', pattern: /\bADMIN_EMAILS?\b/ },
  {
    name: 'email literal grants identity-dependent behavior',
    pattern: /(?:\b(?:user|profile|account|authUser|sessionUser)\??\.email|\b(?:profileEmail|accountEmail|email))\s*={2,3}\s*['"`][^'"`\r\n]+@/i,
  },
  {
    name: 'reversed email literal grants identity-dependent behavior',
    pattern: /['"`][^'"`\r\n]+@[^'"`\r\n]+['"`]\s*={2,3}\s*(?:\b(?:user|profile|account|authUser|sessionUser)\??\.email|\b(?:profileEmail|accountEmail|email))/i,
  },
]

test('active executable code has no Admin authorization fallback by email', () => {
  const violations = activeCodeRoots.flatMap(listActiveCodeFiles).flatMap(path => {
    const source = readFileSync(path, 'utf8')
    return forbiddenAdminEmailPatterns
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => `${path}: ${name}`)
  })

  assert.deepEqual(violations, [])
})

test('frontend Admin state comes only from the protected self-status RPC', () => {
  assert.match(auth, /fetchAdminStatusDirect/)
  assert.match(auth, /rest\/v1\/rpc\/is_authorized_admin/)
  assert.match(auth, /const isAdmin = adminAuthorized/)
  assert.doesNotMatch(auth, /user_metadata\?*\.role|\bADMIN_EMAILS?\b/)
})

test('AdminRoute and Sidebar use trusted presentation state', () => {
  assert.match(app, /const \{ user, loading, isAdmin, onboardingState \} = useAuthStore\(\)/)
  assert.match(app, /if \(!isAdmin\) return <Navigate to="\/dashboard" replace \/>/)
  assert.match(app, /<AdminMfaGate>\{children\}<\/AdminMfaGate>/)
  assert.match(sidebar, /const \{ user, profile, logout, isAdmin \} = useAuth\(\)/)
  assert.match(sidebar, /\{isAdmin && \(/)
  assert.doesNotMatch(`${app}\n${sidebar}`, /user\?*\.role/)
})

test('Admin route requires a real TOTP challenge and AAL2', () => {
  assert.match(mfaGate, /mfa\.getAuthenticatorAssuranceLevel\(\)/)
  assert.match(mfaGate, /mfa\.listFactors\(\)/)
  assert.match(mfaGate, /mfa\.enroll\(\{[\s\S]*factorType: 'totp'/)
  assert.match(mfaGate, /mfa\.challenge\(\{ factorId: factor\.id \}\)/)
  assert.match(mfaGate, /mfa\.verify\(\{/)
  assert.match(mfaGate, /currentLevel !== 'aal2'/)
  assert.doesNotMatch(mfaGate, /user_metadata|localStorage|role\s*===\s*['"]admin/)
})

test('Admin dashboard uses only the protected paginated backend', () => {
  assert.match(api, /supabase\.functions\.invoke\('admin-api'/)
  assert.match(dashboard, /adminRequest\('overview'/)
  assert.match(dashboard, /adminRequest\('list_clients'/)
  assert.match(dashboard, /adminRequest\('get_client'/)
  assert.match(dashboard, /adminRequest\('add_smart_tokens'/)
  assert.match(dashboard, /Página \{pagination\.page\} de \{pagination\.totalPages\}/)
  assert.doesNotMatch(dashboard, /\.from\('profiles'\)|value=\{selectedUser\.user\.role/)
  assert.doesNotMatch(dashboard, /update_user_plan|Ajustar Créditos|Deletar Usuário/)
})

test('client operations separate purchased and subscription ST without exposing Stripe IDs', () => {
  assert.match(dashboard, /ST de assinatura/)
  assert.match(dashboard, /ST extras comprados/)
  assert.match(dashboard, /Valor bruto de catálogo/)
  assert.match(dashboard, /Última geração/)
  assert.match(dashboard, /Métricas de login e permanência ainda não são capturadas/)
  assert.doesNotMatch(dashboard, /stripe_customer_id|creditos_avulsos|add_credits/)
})

test('admin support grant sends only bounded operational input to protected backend', () => {
  assert.match(dashboard, /userId: clientDetail\.client\.id/)
  assert.match(dashboard, /amount: Number\(grantAmount\)/)
  assert.match(dashboard, /reason: grantReason/)
  assert.match(dashboard, /requestId: grantRequestId/)
  assert.match(dashboard, /max="10000"/)
  assert.doesNotMatch(dashboard, /max="1000000"/)
  assert.doesNotMatch(dashboard, /\.from\('credit_lots'\)|saldo_creditos\s*:/)
})

test('Admin dashboard has no placeholder business metrics or legacy packages', () => {
  assert.doesNotMatch(dashboard, /Usuários Online|Últimos 5 min|avulso5|avulso10|Pacote 5 Créditos|Pacote 10 Créditos/)
  assert.doesNotMatch(dashboard, /mrr:\s*0|today:\s*0|year:\s*0|totalCampaigns:\s*0/)
  assert.match(dashboard, /não é receita real/)
  assert.match(dashboard, /Custos reais por provider\/modelo ainda não possuem cobertura consistente/)
})

test('legacy or unavailable admin backend cannot leave the page blank', () => {
  assert.match(dashboard, /isOperationalOverview\(response\)/)
  assert.match(dashboard, /admin_overview_contract_mismatch/)
  assert.match(dashboard, /<AdminUnavailable section=/)
  assert.match(dashboard, /a ausência da migration não interrompe a renderização/i)
  assert.match(dashboard, /Clientes temporariamente indisponíveis/)
  assert.match(dashboard, /Requer atenção/)
})

test('Produtos exposes exactly the official module hierarchy without invented Google Ads split', () => {
  for (const label of ['Fotos em Movimento', 'Legendas na Tela', 'Narração Profissional', 'Corretor Virtual IA', 'Short Videos', 'Comercial Imobiliário', 'Vídeo Criativo', 'Carrossel de Anúncios', 'Virtual Staging', 'Vida no Imóvel', 'Apresentação pelo Corretor']) {
    assert.match(adminRuntime, new RegExp(label))
  }
  assert.match(dashboard, /Provider/)
  assert.match(dashboard, /Modelo\/Motor/)
  assert.doesNotMatch(dashboard, /módulo Google Ads|module.*google_ads/i)
})

test('new ambiguous flows persist only safe module telemetry in existing private structures', () => {
  assert.match(smartTourGenerate, /captions:input\.generation\.captions === 'enabled'/)
  assert.match(smartTourGenerate, /presenter:\['female','male'\]\.includes\(input\.generation\.presenterGender\)/)
  assert.match(adminRuntime, /table: 'virtual_staging_image_items'/)
  assert.match(adminRuntime, /tokenColumn: 'smart_tokens_consumed'/)
  assert.doesNotMatch(virtualStagingImage, /reserve_credits|consume_reserved_credits/)
})
