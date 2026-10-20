import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { authCallbackUrl, authEntryPath, peekPostAuthDestination, postAuthPath, preservePostAuthDestination, readPostAuthDestination, takePostAuthDestination } from '../src/lib/post-auth-destination.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } }

test('post-auth destinations are allowlisted and never accept arbitrary paths', () => {
  assert.equal(postAuthPath('home'), '/dashboard')
  assert.equal(postAuthPath('real_estate_banner'), '/hero')
  assert.equal(postAuthPath('virtual_staging'), '/virtual-staging')
  assert.equal(readPostAuthDestination('?next=https://attacker.example'), 'home')
  assert.equal(readPostAuthDestination('?next=/admin'), 'home')
  assert.equal(authEntryPath('/cadastro', 'virtual_staging'), '/cadastro?next=virtual_staging')
  assert.equal(authCallbackUrl('real_estate_banner', 'https://snetia.com'), 'https://snetia.com/auth/callback?next=real_estate_banner')
})

test('post-auth destination is one-time and product specific', () => {
  const store = storage()
  preservePostAuthDestination('real_estate_banner', store)
  assert.equal(peekPostAuthDestination(store), '/hero')
  assert.equal(peekPostAuthDestination(store), '/hero')
  assert.equal(takePostAuthDestination(store), '/hero')
  assert.equal(takePostAuthDestination(store), null)
})

test('registration is limited to name, email, legal acceptance and Turnstile with magic-link authentication', () => {
  const register = read('../src/pages/RegisterPage.jsx')
  const auth = read('../src/lib/auth-context.jsx')
  assert.match(register, /signInWithEmailLink/)
  assert.match(auth, /shouldCreateUser: true/)
  assert.doesNotMatch(register, /register\('telefone'/)
  assert.doesNotMatch(register, /register\('whatsapp'/)
  assert.doesNotMatch(register, /register\('creci'/)
  assert.doesNotMatch(register, /register\('senha'/)
})

test('landing CTAs are account-entry shortcuts, not guest product trials', () => {
  const landing = read('../src/pages/LandingPage.jsx')
  assert.match(landing, /authEntryPath\('\/cadastro', 'real_estate_banner'\)/)
  assert.match(landing, /authEntryPath\('\/cadastro', 'virtual_staging'\)/)
  assert.doesNotMatch(landing, /to="\/criar-anuncio"/)
  assert.doesNotMatch(landing, /to="\/testar-virtual-staging"/)
})

test('professional details stay progressive and are saved only when a product needs them', () => {
  const phoneQuestion = read('../src/components/professional/ProfilePhoneQuestion.jsx')
  const banner = read('../src/pages/HeroNext.jsx')
  const virtualStaging = read('../src/pages/VirtualStaging.jsx')
  const smartTour = read('../src/pages/SmartTourAI.jsx')
  assert.match(phoneQuestion, /normalizePhone/)
  assert.match(phoneQuestion, /isPhoneCompatibleWithMarket/)
  assert.match(phoneQuestion, /onSaveProfile/)
  for (const source of [banner, virtualStaging, smartTour]) {
    assert.match(source, /<ProfilePhoneQuestion/)
    assert.match(source, /ProfessionalIdentityQuestion/)
  }
})

test('the new economy migration grants one confirmation-gated 400 ST balance and removes only product allowlists', () => {
  const migration = read('../../supabase/migrations/20261019010000_unify_free_account_smart_tokens.sql')
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reserve_credits_from_lots/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.grant_confirmed_email_trial\(\)/)
  assert.match(migration, /NEW\.id, 'trial', 400, 400, NULL, 'active'/)
  assert.match(migration, /'smart_tokens', 400/)
  assert.match(migration, /NEW\.email_confirmed_at IS NULL/)
  assert.match(migration, /TG_OP = 'UPDATE' AND OLD\.email_confirmed_at IS NOT NULL/)
  assert.match(migration, /ON CONFLICT DO NOTHING/)
  assert.match(migration, /cl\.hidden_from_ui = FALSE OR cl\.source = 'trial'/)
  assert.doesNotMatch(migration, /TRIAL_PRODUCT_NOT_ALLOWED|v_trial_allowed|v_paid_account/)
  assert.match(migration, /DROP TRIGGER IF EXISTS claim_virtual_staging_trial_use_on_prepare/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_credits_from_lots[\s\S]*TO service_role/)
})
