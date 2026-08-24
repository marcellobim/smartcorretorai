import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = relative => readFileSync(join(root, relative), 'utf8')
const migration = read('supabase/migrations/20260823040000_expand_confirmed_email_trial_to_200_st.sql')
const previous = read('supabase/migrations/20260823030000_create_confirmed_email_text_campaign_trial.sql')
const catalog = read('supabase/functions/_shared/economic-catalog.ts')

const functionSection = name => {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
  const next = migration.indexOf('CREATE OR REPLACE FUNCTION public.', start + 1)
  return migration.slice(start, next === -1 ? migration.length : next)
}

test('is a forward-only migration that leaves the already-applied v1 migration intact', () => {
  assert.match(previous, /NEW\.id, 'trial', 25, 25/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.grant_confirmed_email_trial/)
  assert.doesNotMatch(migration, /UPDATE\s+public\.credit_lots\s+SET\s+original_amount/i)
  assert.doesNotMatch(migration, /remaining_amount\s*=\s*remaining_amount\s*\+\s*175/i)
  assert.doesNotMatch(migration, /metadata\s*=\s*[^;]*benefit_version/i)
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.credit_lots/i)
  assert.doesNotMatch(migration, /ALTER\s+TABLE\s+public\.credit_lots/i)
})

test('grants only future confirmed accounts one fixed 200 ST v2 lot', () => {
  const grant = functionSection('grant_confirmed_email_trial')
  assert.match(grant, /NEW\.email_confirmed_at IS NULL/)
  assert.match(grant, /TG_OP = 'UPDATE' AND OLD\.email_confirmed_at IS NOT NULL/)
  assert.match(grant, /NEW\.id, 'trial', 200, 200, NULL, 'active'/)
  assert.match(grant, /trial:signup-selected-products:v2/)
  assert.match(grant, /'benefit_version', 'v2'/)
  assert.match(grant, /'smart_tokens', 200/)
  assert.match(grant, /ON CONFLICT DO NOTHING/)
  assert.doesNotMatch(grant, /p_user_id|p_amount|auth\.uid\(\)/)
})

test('implements a positive allowlist with exact canonical tuple validation', () => {
  const reserve = functionSection('reserve_credits_from_lots')
  assert.match(reserve, /p_amount = 25[\s\S]*product_code' = 'text_campaign'[\s\S]*variant' = 'standard'[\s\S]*smart_token_cost' = '25'/)
  assert.match(reserve, /product_code' = 'quick_banners'[\s\S]*variant' = 'item'[\s\S]*unit_cost' = '45'[\s\S]*item_count'[\s\S]*p_amount = \(p_metadata ->> 'item_count'\)::BIGINT \* 45/)
  assert.match(reserve, /p_amount = 100[\s\S]*product_code' = 'smart_carousel'[\s\S]*image_count'[\s\S]*catalog_version/)
  assert.match(reserve, /RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED'/)
  assert.doesNotMatch(reserve, /NOT IN|allow_all|providerCategory/)
})

test('preserves the paid-account transition and the existing FEFO transaction path', () => {
  const reserve = functionSection('reserve_credits_from_lots')
  assert.match(reserve, /cl\.source = 'subscription' AND cl\.stripe_invoice_id IS NOT NULL/)
  assert.match(reserve, /cl\.source = 'purchase' AND cl\.stripe_checkout_session_id IS NOT NULL/)
  assert.match(reserve, /FROM public\.profiles p[\s\S]*WHERE p\.id = p_user_id[\s\S]*FOR UPDATE/)
  assert.match(reserve, /ORDER BY cl\.expires_at ASC NULLS LAST, cl\.created_at ASC, cl\.id ASC/)
  assert.match(reserve, /INSERT INTO public\.credit_reservation_allocations/)
  assert.match(reserve, /PERFORM public\.sync_credit_balance_cache_from_lots\(p_user_id\)/)
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.grant_stripe_credit_lot/)
})

test('catalog source agrees with the exact trial allowlist and keeps Gemini, Veo and staging excluded', () => {
  const eligible = catalog.match(/sku\('[^']+', '[^']+', \d+, '[^']+', true,/g)
  assert.deepEqual(eligible, [
    "sku('text_campaign', 'standard', 25, 'openai_text', true,",
    "sku('quick_banners', 'item', 45, 'composite', true,",
    "sku('smart_carousel', 'standard', 100, 'composite', true,",
  ])
  for (const product of ['real_estate_video', 'real_estate_commercial', 'creative_video', 'virtual_staging', 'real_estate_banner']) {
    assert.match(catalog, new RegExp(`sku\\('${product}',[^\\n]+ false,`))
  }
})

test('keeps financial RPCs private and adds no Stripe, price or plan mutation', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.grant_confirmed_email_trial\(\) FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.reserve_credits_from_lots[\s\S]*PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_credits_from_lots[\s\S]*TO service_role/)
  assert.doesNotMatch(migration, /stripe_prices|MONTHLY_PLAN_GRANTS|PURCHASE_GRANTS|price_id|unit_amount/)
})
