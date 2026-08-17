import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8')
const migration = read('supabase/migrations/20260816030000_harden_admin_authorization.sql')
const seed = read('supabase/admin/seed-primary-admin.sql')
const helper = read('supabase/functions/_shared/admin-authorization.ts')
const adminApi = read('supabase/functions/admin-api/index.ts')
const authContext = read('frontend/src/lib/auth-context.jsx')
const app = read('frontend/src/App.jsx')
const sidebar = read('frontend/src/components/layout/Sidebar.jsx')
const studioHero = read('frontend/src/pages/StudioHero.jsx')
const adminDashboard = read('frontend/src/pages/AdminDashboard.jsx')
const settings = read('frontend/src/pages/Configuracoes.jsx')

const affectedFunctions = [
  'supabase/functions/gerar-banners/index.ts',
  'supabase/functions/criar-video-ia/index.ts',
  'supabase/functions/get-video-job-status/index.ts',
]

test('admin_users is the single protected server-side authority', () => {
  assert.match(migration, /CREATE TABLE public\.admin_users/)
  assert.match(migration, /user_id UUID PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE RESTRICT/)
  assert.match(migration, /ALTER TABLE public\.admin_users ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.admin_users[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT ALL PRIVILEGES ON TABLE public\.admin_users TO service_role/)
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*ON public\.admin_users/)
})

test('presentation RPC can inspect only the authenticated caller', () => {
  const rpc = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.is_authorized_admin'))
  assert.match(rpc, /RETURNS BOOLEAN[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/)
  assert.match(rpc, /admins\.user_id = auth\.uid\(\)/)
  assert.doesNotMatch(rpc, /\(p_user_id|user_metadata|profiles\.role|email\s*=/i)
  assert.match(rpc, /REVOKE EXECUTE ON FUNCTION public\.is_authorized_admin\(\)[\s\S]*FROM PUBLIC, anon/)
  assert.match(rpc, /GRANT EXECUTE ON FUNCTION public\.is_authorized_admin\(\)[\s\S]*TO authenticated, service_role/)
})

test('authenticated profile writes are column-scoped to Configuracoes', () => {
  const updateGrant = migration.match(/GRANT UPDATE \(([\s\S]*?)\) ON public\.profiles TO authenticated/)?.[1] || ''
  const insertGrant = migration.match(/GRANT INSERT \(([\s\S]*?)\) ON public\.profiles TO authenticated/)?.[1] || ''
  const allowed = ['nome', 'email', 'creci', 'estado', 'telefone', 'whatsapp', 'imobiliaria', 'avatar_url', 'logo_url']
  const privileged = [
    'role', 'plano', 'saldo_creditos', 'creditos_expiram_em', 'creditos_avulsos',
    'trial_ends_at', 'stripe_customer_id', 'enterprise_owner_id', 'senha_hash',
  ]

  assert.match(migration, /REVOKE INSERT, UPDATE ON TABLE public\.profiles[\s\S]*FROM PUBLIC, anon, authenticated/)
  for (const column of allowed) assert.match(updateGrant, new RegExp(`\\b${column}\\b`), column)
  assert.match(insertGrant, /\bid\b/)
  for (const column of privileged) {
    assert.doesNotMatch(updateGrant, new RegExp(`\\b${column}\\b`), column)
    assert.doesNotMatch(insertGrant, new RegExp(`\\b${column}\\b`), column)
  }

  const settingsPayload = settings.match(/\.from\('profiles'\)\s*\.update\(\{([\s\S]*?)\n\s*\}\)\s*\.eq\('id'/)?.[1] || ''
  for (const column of ['nome', 'email', 'creci', 'estado', 'whatsapp', 'imobiliaria', 'avatar_url', 'logo_url']) {
    assert.match(settingsPayload, new RegExp(`\\b${column}\\b`), column)
  }
})

test('metadata, profile roles and hardcoded email no longer grant Admin', () => {
  const activeSources = [authContext, app, sidebar, studioHero, adminDashboard, ...affectedFunctions.map(read)]
  for (const source of activeSources) {
    assert.doesNotMatch(source, /riccieri68@gmail\.com/i)
    assert.doesNotMatch(source, /user_metadata\?*\.role|user_metadata\[['"]role['"]\]/i)
    assert.doesNotMatch(source, /profile(?:Row)?\?*\.role/i)
  }
  assert.match(authContext, /rest\/v1\/rpc\/is_authorized_admin/)
  assert.match(authContext, /const isAdmin = adminAuthorized/)
  assert.match(app, /if \(!isAdmin\) return <Navigate/)
  assert.match(sidebar, /\{isAdmin && \(/)
  assert.match(studioHero, /getStudioHeroAccess\(user, isAdmin\)/)
})

test('all affected Edge Functions use the shared fail-closed helper', () => {
  assert.match(helper, /\.from\('admin_users'\)[\s\S]*\.eq\('user_id', userId\)/)
  assert.match(helper, /if \(error\) return false/)
  for (const file of affectedFunctions) {
    const source = read(file)
    assert.match(source, /import \{ isAuthorizedAdmin \} from '\.\.\/_shared\/admin-authorization\.ts'/)
    assert.match(source, /await isAuthorizedAdmin\(supabase, (?:authenticatedUserId|user\.id)\)/)
  }
})

test('admin-api authenticates and authorizes before dispatching any action', () => {
  const authPosition = adminApi.indexOf('await requireAuthorizedAdmin(supabase, user.id)')
  const bodyPosition = adminApi.indexOf('const body = await req.json()')
  assert.ok(authPosition > adminApi.indexOf('supabase.auth.getUser(token)'))
  assert.ok(bodyPosition > authPosition)
  assert.match(adminApi, /error instanceof AdminAuthorizationError[\s\S]*error\.status/)
  assert.doesNotMatch(adminApi, /user_metadata|profiles\.role|riccieri68@gmail\.com/i)
  assert.match(adminDashboard, /adminRequest\('overview'\)/)
  assert.doesNotMatch(adminDashboard, /from\('profiles'\)|\.role\s*===?\s*'admin'/)
})

test('primary admin provisioning is bound to one audited UUID only', () => {
  const ids = [...seed.matchAll(/'([0-9a-f-]{36})'::UUID/gi)].map(match => match[1])
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  assert.doesNotMatch(seed, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.match(seed, /INSERT INTO public\.admin_users \(user_id, created_by\)/)
})
