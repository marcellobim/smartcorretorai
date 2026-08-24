import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { providerTokenSafeStorage, stripProviderTokens } from '../src/lib/auth-storage.js'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const client = read('../src/lib/supabase.js')
const storage = read('../src/lib/auth-storage.js')
const auth = read('../src/lib/auth-context.jsx')
const app = read('../src/App.jsx')
const callback = read('../src/pages/AuthCallbackPage.jsx')
const legal = read('../src/pages/LegalOnboardingPage.jsx')
const login = read('../src/pages/LoginPage.jsx')
const register = read('../src/pages/RegisterPage.jsx')
const recovery = read('../src/pages/ResetPasswordPage.jsx')
const privacy = read('../src/pages/Privacidade.jsx')

test('Supabase Auth uses PKCE and a provider-token filtering storage adapter', () => {
  assert.match(client, /flowType: 'pkce'/)
  assert.match(client, /detectSessionInUrl: false/)
  assert.match(client, /storage: providerTokenSafeStorage/)
  const clean = stripProviderTokens({
    access_token: 'supabase-access',
    refresh_token: 'supabase-refresh',
    provider_token: 'google-access',
    nested: { provider_refresh_token: 'google-refresh', keep: true },
  })
  assert.deepEqual(clean, {
    access_token: 'supabase-access',
    refresh_token: 'supabase-refresh',
    nested: { keep: true },
  })
  assert.doesNotMatch(storage, /console\.|sessionStorage|location|URLSearchParams/)
})

test('storage purges provider credentials while preserving the Supabase session', () => {
  const values = new Map()
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
  }
  try {
    providerTokenSafeStorage.setItem('auth', JSON.stringify({ access_token: 'supabase', refresh_token: 'refresh', provider_token: 'google' }))
    assert.deepEqual(JSON.parse(providerTokenSafeStorage.getItem('auth')), { access_token: 'supabase', refresh_token: 'refresh' })
    values.set('legacy', JSON.stringify({ provider_refresh_token: 'legacy-google', user: { id: 'safe' } }))
    assert.deepEqual(JSON.parse(providerTokenSafeStorage.getItem('legacy')), { user: { id: 'safe' } })
    assert.doesNotMatch(values.get('legacy'), /legacy-google/)
  } finally {
    globalThis.window = previousWindow
  }
})

test('Google OAuth is fixed to the official provider, minimum scopes and callback', () => {
  assert.match(auth, /signInWithOAuth\(\{[\s\S]*provider: 'google'/)
  assert.match(auth, /redirectTo: `\$\{window\.location\.origin\}\/auth\/callback`/)
  assert.match(auth, /scopes: 'openid email profile'/)
  assert.doesNotMatch(auth, /access_type|offline|prompt:\s*'consent'|returnTo|redirect_uri/)
  assert.match(login, /<GoogleAuthButton/)
  assert.match(register, /<GoogleAuthButton/)
  assert.match(login, /Não foi possível entrar com Google[\s\S]*e-mail e senha/)
  assert.match(register, /Não foi possível entrar com Google[\s\S]*e-mail e senha/)
})

test('manual PKCE callbacks clear the code and never honor arbitrary destinations', () => {
  assert.match(app, /path="\/auth\/callback"/)
  assert.match(callback, /exchangeCodeForSession\(code\)/)
  assert.match(callback, /replaceState\(\{\}, document\.title, '\/auth\/callback'\)/)
  assert.match(recovery, /exchangeCodeForSession\(code\)/)
  assert.match(recovery, /replaceState\(\{\}, document\.title, '\/redefinir-senha'\)/)
  assert.doesNotMatch(callback, /returnTo|redirectTo|next=|location\.href\s*=/)
  assert.doesNotMatch(callback, /console\.|provider_token|provider_refresh_token/)
})

test('OAuth onboarding is routed through server-owned state and legal acceptance', () => {
  assert.match(app, /path="\/aceite-legal"/)
  assert.match(app, /onboardingState === 'needs_acceptance'/)
  assert.match(auth, /rpc\('accept_current_legal_documents'\)/)
  assert.match(legal, /Termos de Uso/)
  assert.match(legal, /Política de Privacidade/)
  assert.match(legal, /disabled=\{!accepted\}/)
  assert.doesNotMatch(legal, /accepted_at|terms_version|privacy_version|user_id/)
})

test('Admin Google sessions fail closed and the traditional MFA route remains present', () => {
  assert.match(callback, /state === 'admin_blocked'/)
  assert.match(callback, /unlinkIdentity\(googleIdentity\)/)
  assert.match(app, /<AdminMfaGate>/)
  assert.match(app, /if \(!isAdmin\)/)
})

test('provider tokens are neither retained in React state nor used by the application', () => {
  assert.match(auth, /stripProviderTokens\(newSession\)/)
  const sources = [auth, callback, legal, login, register]
  for (const source of sources) {
    assert.doesNotMatch(source, /\.provider_token|\.provider_refresh_token|\[['"]provider_token/)
    assert.doesNotMatch(source, /console\.[a-z]+\([^)]*(?:token|session)/i)
  }
})

test('privacy text distinguishes OAuth, Analytics and AI providers without broad Google access', () => {
  assert.match(privacy, /Google OAuth/)
  assert.match(privacy, /sem acesso a Gmail, Drive, contatos ou Calendar/)
  assert.match(privacy, /distinto do Google Analytics 4/)
  assert.match(privacy, /Gemini ou Veo/)
})
