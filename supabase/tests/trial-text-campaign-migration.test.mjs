import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = relative => readFileSync(join(root, relative), 'utf8')
const migration = read('supabase/migrations/20260823030000_create_confirmed_email_text_campaign_trial.sql')
const catalog = read('supabase/functions/_shared/economic-catalog.ts')
const register = read('frontend/src/pages/RegisterPage.jsx')
const landing = read('frontend/src/pages/LandingPage.jsx')
const terms = read('frontend/src/pages/TermosDeUso.jsx')

const functionSection = name => {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
  const next = migration.indexOf('CREATE OR REPLACE FUNCTION public.', start + 1)
  return migration.slice(start, next === -1 ? migration.length : next)
}

test('grant is server-owned, confirmation-gated, fixed at 25 ST and replay-safe', () => {
  const grant = functionSection('grant_confirmed_email_trial')
  assert.match(grant, /NEW\.email_confirmed_at IS NULL/)
  assert.match(grant, /TG_OP = 'UPDATE' AND OLD\.email_confirmed_at IS NOT NULL/)
  assert.match(grant, /NEW\.id, 'trial', 25, 25, NULL, 'active'/)
  assert.match(grant, /trial:signup-text-campaign:v1/)
  assert.match(grant, /ON CONFLICT DO NOTHING/)
  assert.match(migration, /CREATE UNIQUE INDEX credit_lots_one_trial_per_user_idx[\s\S]*WHERE source = 'trial'/)
  assert.match(migration, /AFTER INSERT ON auth\.users/)
  assert.match(migration, /AFTER UPDATE OF email_confirmed_at ON auth\.users/)
  assert.doesNotMatch(grant, /p_user_id|p_amount|auth\.uid\(\)/)
})

test('trial allowlist is positive and exact while confirmed Stripe lots unlock it', () => {
  const reserve = functionSection('reserve_credits_from_lots')
  assert.match(reserve, /p_amount = 25[\s\S]*product_code' = 'text_campaign'[\s\S]*variant' = 'standard'[\s\S]*smart_token_cost' = '25'/)
  assert.match(reserve, /cl\.source = 'subscription' AND cl\.stripe_invoice_id IS NOT NULL/)
  assert.match(reserve, /cl\.source = 'purchase' AND cl\.stripe_checkout_session_id IS NOT NULL/)
  assert.match(reserve, /cl\.hidden_from_ui = FALSE[\s\S]*cl\.source = 'trial' AND \(v_paid_account OR v_trial_allowed\)/)
  assert.match(reserve, /RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED'/)
  assert.doesNotMatch(reserve, /trialEligible|allow_all|NOT IN/)
})

test('non-trial lots keep the existing private FEFO transaction path', () => {
  const reserve = functionSection('reserve_credits_from_lots')
  assert.match(reserve, /FROM public\.profiles p[\s\S]*WHERE p\.id = p_user_id[\s\S]*FOR UPDATE/)
  assert.match(reserve, /ORDER BY cl\.expires_at ASC NULLS LAST, cl\.created_at ASC, cl\.id ASC/)
  assert.match(reserve, /INSERT INTO public\.credit_reservation_allocations/)
  assert.match(reserve, /PERFORM public\.sync_credit_balance_cache_from_lots\(p_user_id\)/)
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.reserve_credits_from_lots[\s\S]*PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_credits_from_lots[\s\S]*TO service_role/)
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.grant_stripe_credit_lot/)
})

test('current reservation callers identify the allowlisted product exactly or fail closed', () => {
  const sql = [
    read('supabase/migrations/20260817040000_create_gemini_video_economy.sql'),
    read('supabase/migrations/20260817050000_create_veo_video_economy.sql'),
    read('supabase/migrations/20260817060000_create_smart_carousel_economy.sql'),
    read('supabase/migrations/20260820040000_create_virtual_staging_image_economy.sql'),
  ].join('\n')
  const typescript = [
    read('supabase/functions/generate-text-campaign/economy.ts'),
    read('supabase/functions/gerar-banners/economy.ts'),
    read('supabase/functions/gerar-hero-ia/economy.ts'),
  ].join('\n')
  assert.match(sql, /jsonb_build_object\([\s\S]*?'product_code',\s*p_product_code/i)
  assert.match(sql, /jsonb_build_object\([\s\S]*?'product_code',\s*'smart_carousel'/i)
  assert.match(sql, /jsonb_build_object\('product_code',\s*'virtual_staging',\s*'variant',\s*'image'/i)
  assert.doesNotMatch(sql, /'product_code',\s*'text_campaign'/i)
  assert.match(typescript, /product_code:\s*input\.quote\.productCode,\s*variant:\s*input\.quote\.variant/)
  assert.match(typescript, /product_code:\s*QUICK_BANNERS_PRODUCT_CODE[\s\S]*variant:\s*QUICK_BANNERS_UNIT_VARIANT/)
  assert.match(typescript, /product_code:\s*REAL_ESTATE_BANNER_PRODUCT_CODE[\s\S]*variant:\s*REAL_ESTATE_BANNER_UNIT_VARIANT/)
})

test('Gemini and Veo cannot be reached before their economic claim', () => {
  const gemini = read('supabase/functions/smart-tour-generate/index.ts')
  const veo = read('supabase/functions/criar-video-ia/index.ts')
  const geminiClaim = gemini.indexOf('await claimGeminiVideoEconomy')
  const geminiProvider = gemini.indexOf('await generateSmartTourDynamicNarration', geminiClaim)
  const veoClaim = veo.indexOf('await claimVeoVideoEconomy')
  const veoProvider = veo.indexOf('await startVeoVideo', veoClaim)
  assert.ok(geminiClaim > 0 && geminiProvider > geminiClaim)
  assert.ok(veoClaim > 0 && veoProvider > veoClaim)
})

test('catalog keeps exactly the three approved trial-eligible SKUs at canonical costs', () => {
  assert.match(catalog, /sku\('text_campaign', 'standard', 25, 'openai_text', true, \{\}, true\)/)
  assert.match(catalog, /sku\('quick_banners', 'item', 45, 'composite', true,/)
  assert.match(catalog, /sku\('smart_carousel', 'standard', 100, 'composite', true,/)
  assert.deepEqual(catalog.match(/sku\('[^']+', '[^']+', \d+, '[^']+', true,/g), [
    "sku('text_campaign', 'standard', 25, 'openai_text', true,",
    "sku('quick_banners', 'item', 45, 'composite', true,",
    "sku('smart_carousel', 'standard', 100, 'composite', true,",
  ])
})

test('public and legal copy describe the current benefit without the internal BRL ceiling', () => {
  const copy = `${register}\n${landing}\n${terms}`
  assert.match(register, /200 Smart Tokens após confirmar seu e-mail, sem cartão/)
  assert.match(landing, /200 Smart Tokens, sem cartão, para experimentar recursos selecionados/)
  assert.doesNotMatch(landing, /grátis por tempo limitado|gratuitamente por tempo limitado/i)
  assert.match(terms, /200 Smart Tokens[\s\S]*recursos selecionados/)
  assert.match(terms, /copiados, baixados e utilizados normalmente/)
  assert.match(terms, /START:<\/strong> 6\.350 Smart Tokens/)
  assert.match(terms, /PRO:<\/strong> 10\.850 Smart Tokens/)
  assert.match(terms, /ELITE:<\/strong> 26\.350 Smart Tokens/)
  assert.doesNotMatch(copy, /R\$\s*5(?:[,\.]00)?/i)
})
