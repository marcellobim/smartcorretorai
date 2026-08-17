import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const indexSource = readFileSync(path.join(root, 'index.ts'), 'utf8')
const frontendSource = readFileSync(path.resolve(root, '../../../frontend/src/pages/HeroNext.jsx'), 'utf8')
const migrationSource = readFileSync(path.resolve(root, '../../migrations/20260817030000_create_real_estate_banner_economy.sql'), 'utf8')
const financialP0Source = readFileSync(path.resolve(root, '../../migrations/20260815010000_harden_current_credit_rpcs.sql'), 'utf8')
const adminP0Source = readFileSync(path.resolve(root, '../../migrations/20260816030000_harden_admin_authorization.sql'), 'utf8')

test('frontend prepares one complete batch before starting parallel paid pieces', () => {
  const prepareIndex = frontendSource.indexOf("action: 'prepare_batch'")
  const parallelIndex = frontendSource.indexOf('await Promise.all(jobRequests.map')
  assert.ok(prepareIndex > 0)
  assert.ok(parallelIndex > prepareIndex)
  assert.match(frontendSource, /selected_format_count: selectedDestinations\.length/)
  assert.match(frontendSource, /creation_options: creativeIdeaCount/)
  assert.match(frontendSource, /economic_claim_token: economicContext\.claimToken/)
  assert.doesNotMatch(frontendSource.slice(prepareIndex, parallelIndex), /unit_cost\s*:|smart_tokens\s*:|price\s*:|margin\s*:/i)
})

test('provider start requires an atomically claimed economic item and uses provider idempotency', () => {
  const claimIndex = indexSource.indexOf('await economy.claimItem')
  const providerIndex = indexSource.indexOf('await createHeroNextBackgroundResponse', claimIndex)
  assert.ok(claimIndex > 0)
  assert.ok(providerIndex > claimIndex)
  assert.match(indexSource, /Idempotency-Key/)
  assert.match(indexSource, /`real-estate-banner:\$\{economicItemId\}`/)
  assert.match(indexSource, /credit_amount: 75/)
  assert.match(indexSource, /credit_status: 'reserved'/)
})

test('migration keeps all economic tables private and RPCs service-role only', () => {
  for (const table of ['real_estate_banner_requests', 'real_estate_banner_items', 'real_estate_banner_item_allocations']) {
    assert.match(migrationSource, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    assert.match(migrationSource, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC,anon,authenticated`))
    assert.match(migrationSource, new RegExp(`GRANT ALL ON TABLE public\\.${table} TO service_role`))
  }
  assert.doesNotMatch(migrationSource, /GRANT EXECUTE[^;]+TO (?:anon|authenticated)/i)
  assert.match(migrationSource, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
})

test('migration enforces 75 ST, total reservation, item slices, terminal pro rata and retries', () => {
  assert.match(migrationSource, /unit_cost BIGINT NOT NULL DEFAULT 75 CHECK \(unit_cost = 75\)/)
  assert.match(migrationSource, /item_count = selected_format_count \* creation_options/)
  assert.match(migrationSource, /smart_tokens_quoted = item_count \* unit_cost/)
  assert.match(migrationSource, /v_reservation\.amount<>v_request\.smart_tokens_quoted/)
  assert.match(migrationSource, /CREATE TABLE public\.real_estate_banner_item_allocations/)
  assert.match(migrationSource, /v_consumed:=v_completed\*75; v_refunded:=v_failed\*75/)
  assert.match(migrationSource, /retry_of_item_id/)
  assert.match(migrationSource, /i\.status='failed'/)
  assert.match(migrationSource, /IF v_request\.status IN \('completed','failed'\) THEN RETURN NEXT v_request/)
})

test('terminal delivery records usage without authority bypasses or secrets', () => {
  assert.match(indexSource, /input_tokens:/)
  assert.match(indexSource, /output_tokens:/)
  assert.match(indexSource, /reasoning_tokens:/)
  assert.match(migrationSource, /provider_usage/)
  assert.doesNotMatch(indexSource, /user_metadata\.role|profiles\.role|ADMIN_EMAIL|@gmail\.com/i)
  assert.doesNotMatch(migrationSource, /user_metadata|profiles\.role|@gmail\.com/i)
})

test('preserves the seven financial P0 RPCs as service-role only', () => {
  for (const name of [
    'add_credits', 'consume_credits', 'reserve_credits', 'consume_reserved_credits',
    'cancel_credit_reservation', 'get_credit_balance', 'expire_user_credits',
  ]) {
    assert.match(financialP0Source, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}\\(`))
    assert.match(financialP0Source, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]+?\\)\\s+TO service_role;`))
  }
})

test('preserves Admin authority and the protected profiles column allowlist', () => {
  assert.match(adminP0Source, /FROM public\.admin_users AS admins/)
  assert.match(adminP0Source, /REVOKE ALL PRIVILEGES ON TABLE public\.admin_users[\s\S]*?FROM PUBLIC, anon, authenticated/)
  assert.match(adminP0Source, /GRANT ALL PRIVILEGES ON TABLE public\.admin_users TO service_role/)
  assert.match(adminP0Source, /REVOKE INSERT, UPDATE ON TABLE public\.profiles[\s\S]*?FROM PUBLIC, anon, authenticated/)
  assert.match(adminP0Source, /GRANT UPDATE \([\s\S]*?nome,[\s\S]*?email,[\s\S]*?creci,[\s\S]*?estado,[\s\S]*?telefone,[\s\S]*?whatsapp,[\s\S]*?imobiliaria,[\s\S]*?avatar_url,[\s\S]*?logo_url[\s\S]*?\) ON public\.profiles TO authenticated/)
  const updateColumns = adminP0Source.match(/GRANT UPDATE \(([\s\S]*?)\) ON public\.profiles TO authenticated/)?.[1] || ''
  assert.ok(updateColumns)
  assert.doesNotMatch(updateColumns, /\b(?:role|plano|saldo_creditos|stripe_customer_id|enterprise_owner_id)\b/)
})
