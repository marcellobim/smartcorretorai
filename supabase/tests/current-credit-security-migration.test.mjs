import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const repositoryDir = resolve(testDir, '..', '..')
const migration = readFileSync(
  join(repositoryDir, 'supabase/migrations/20260815010000_harden_current_credit_rpcs.sql'),
  'utf8',
)
const creditLotsFoundation = read('supabase/migrations/20260816010000_create_credit_lots_foundation.sql')
const veoEconomyMigration = read('supabase/migrations/20260817050000_create_veo_video_economy.sql')
const veoCreator = read('supabase/functions/criar-video-ia/index.ts')
const veoEconomyHelper = read('supabase/functions/_shared/veo-video-economy.ts')
const economicCatalog = read('supabase/functions/_shared/economic-catalog.ts')

const rpcSignatures = [
  'add_credits\\(UUID, BIGINT, TEXT, TEXT, JSONB, TIMESTAMPTZ\\)',
  'consume_credits\\(UUID, BIGINT, TEXT, JSONB\\)',
  'reserve_credits\\(UUID, BIGINT, TEXT, UUID, TEXT, JSONB\\)',
  'consume_reserved_credits\\(UUID, TEXT, TEXT, JSONB\\)',
  'cancel_credit_reservation\\(UUID, TEXT, TEXT\\)',
  'get_credit_balance\\(UUID\\)',
  'expire_user_credits\\(UUID\\)',
]

function read(relativePath) {
  return readFileSync(join(repositoryDir, relativePath), 'utf8')
}

function sourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

test('all current credit RPCs revoke browser execution and grant only service_role', () => {
  for (const signature of rpcSignatures) {
    assert.match(
      migration,
      new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${signature}\\s+FROM PUBLIC, anon, authenticated;`),
    )
    assert.match(
      migration,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature}\\s+TO service_role;`),
    )
  }

  const executeGrants = migration.match(/GRANT EXECUTE ON FUNCTION[\s\S]*?;/g) || []
  assert.equal(executeGrants.length, rpcSignatures.length)
  assert.ok(executeGrants.every((statement) => /TO service_role;/.test(statement)))
  assert.ok(executeGrants.every((statement) => !/TO (?:anon|authenticated)/.test(statement)))
})

test('all SECURITY DEFINER credit RPCs receive an empty fixed search_path', () => {
  assert.match(migration, /FUNCTION public\.get_credit_balance\(p_user_id UUID\)[\s\S]*?SET search_path = ''/)

  for (const signature of rpcSignatures.filter((signature) => !signature.startsWith('get_credit_balance'))) {
    assert.match(
      migration,
      new RegExp(`ALTER FUNCTION public\\.${signature}\\s+SET search_path = '';`),
    )
  }
})

test('get_credit_balance fails closed for NULL, anon, authenticated and foreign UUID callers', () => {
  const balanceFunction = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.get_credit_balance'),
    migration.indexOf('-- The remaining functions'),
  )

  assert.match(balanceFunction, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(balanceFunction, /ERRCODE = '42501'/)
  assert.match(balanceFunction, /PERFORM public\.expire_user_credits\(p_user_id\)/)
  assert.doesNotMatch(balanceFunction, /auth\.uid\(\) IS NOT NULL AND/)
})

test('subscriptions drops the public write policy and permits authenticated self-read only', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Service role gerencia assinaturas"/)
  assert.match(migration, /DROP POLICY IF EXISTS "subscriptions_self"/)
  assert.match(migration, /FOR SELECT\s+TO authenticated\s+USING \(auth\.uid\(\) = user_id\)/)
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.subscriptions\s+FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT SELECT ON TABLE public\.subscriptions TO authenticated/)
  assert.match(migration, /GRANT ALL PRIVILEGES ON TABLE public\.subscriptions TO service_role/)
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE|ALL PRIVILEGES)[^;]*authenticated/)
})

test('the browser application has no direct caller for current credit RPCs', () => {
  const frontendRoot = join(repositoryDir, 'frontend/src')
  const frontendSource = sourceFiles(frontendRoot).map((path) => readFileSync(path, 'utf8')).join('\n')

  for (const rpc of [
    'add_credits',
    'consume_credits',
    'reserve_credits',
    'consume_reserved_credits',
    'cancel_credit_reservation',
    'get_credit_balance',
    'expire_user_credits',
  ]) {
    assert.doesNotMatch(frontendSource, new RegExp(`rpc\\(['\"]${rpc}['\"]`))
  }
})

test('all real reservation callers use service-role Edge clients and retain retry keys', () => {
  const callers = {
    'supabase/functions/gerar-banners/index.ts': ['reserve_credits', 'cancel_credit_reservation'],
    'supabase/functions/get-render-status/index.ts': ['consume_reserved_credits', 'cancel_credit_reservation'],
    'supabase/functions/get-video-job-status/index.ts': ['consume_reserved_credits', 'cancel_credit_reservation'],
  }

  for (const [path, rpcs] of Object.entries(callers)) {
    const source = read(path)
    assert.match(source, /Deno\.env\.get\(['\"]SUPABASE_SERVICE_ROLE_KEY['\"]\)/)
    assert.match(source, /createClient\([^\n]*SERVICE_ROLE_KEY|createClient\(SUPABASE_URL, SERVICE_ROLE_KEY/)
    for (const rpc of rpcs) assert.match(source, new RegExp(`rpc\\(['\"]${rpc}['\"]`))
  }

  assert.match(read('supabase/functions/gerar-banners/index.ts'), /p_idempotency_key:/)
  assert.match(read('supabase/functions/get-render-status/index.ts'), /p_idempotency_key:/)
  assert.match(read('supabase/functions/get-video-job-status/index.ts'), /p_idempotency_key:/)

  assert.match(veoCreator, /Deno\.env\.get\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/)
  assert.match(
    veoCreator,
    /claimVeoVideoEconomy[\s\S]*from ['"]\.\.\/_shared\/veo-video-economy\.ts['"]/,
  )
  assert.match(veoCreator, /settleVeoVideoEconomy/)
  const claimAt = veoCreator.indexOf('await claimVeoVideoEconomy')
  const providerAt = veoCreator.indexOf('await startVeoVideo')
  assert.ok(claimAt > 0 && providerAt > claimAt)
  const beforeProvider = veoCreator.slice(claimAt, providerAt)
  assert.match(beforeProvider, /economyClaim\.status === 'insufficient'[\s\S]*INSUFFICIENT_SMART_TOKENS[\s\S]*402/)
  assert.match(beforeProvider, /!economyClaim\.executionClaimed[\s\S]*return jsonResponse/)

  assert.match(veoEconomyHelper, /quoteEconomicSku\(productCode, 'standard'\)/)
  assert.match(veoEconomyHelper, /sku\.smartTokenCost !== 120/)
  assert.match(economicCatalog, /sku\('real_estate_commercial', 'standard', 120, 'veo_video'/)
  assert.match(economicCatalog, /sku\('creative_video', 'standard', 120, 'veo_video'/)
  assert.match(veoEconomyMigration, /v_balance < 120[\s\S]*execution_claimed[\s\S]*false/i)
  assert.match(veoEconomyMigration, /reserve_credits_from_lots\([\s\S]*p_user_id, 120/)
  assert.match(creditLotsFoundation, /ORDER BY cl\.expires_at ASC NULLS LAST, cl\.created_at ASC, cl\.id ASC/)
  assert.match(veoEconomyMigration, /consume_reserved_credits_from_lots/)
  assert.match(veoEconomyMigration, /cancel_credit_reservation_from_lots/)
  assert.match(veoEconomyMigration, /revoke all on function public\.claim_veo_video_economy_request[\s\S]*from public, anon, authenticated/i)
  assert.match(veoEconomyMigration, /grant execute on function public\.settle_veo_video_economy_request[\s\S]*to service_role/i)
})
