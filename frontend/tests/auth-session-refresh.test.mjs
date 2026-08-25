import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUTH_SESSION_TRANSITION,
  blocksAuthenticatedTree,
  classifyAuthSessionTransition,
  readJwtAssuranceLevel,
} from '../src/lib/auth-session-policy.js'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const auth = read('../src/lib/auth-context.jsx')
const app = read('../src/App.jsx')
const mfaGate = read('../src/components/auth/AdminMfaGate.jsx')

const transition = (event, initialResolved, currentUserId, nextUserId) =>
  classifyAuthSessionTransition({ event, initialResolved, currentUserId, nextUserId })

test('initial auth remains blocking with or without a restored session', () => {
  for (const nextUserId of [null, 'user-a']) {
    const result = transition('INITIAL_SESSION', false, null, nextUserId)
    assert.equal(result, AUTH_SESSION_TRANSITION.INITIAL)
    assert.equal(blocksAuthenticatedTree(result), true)
  }
  assert.match(app, /if \(loading \|\| onboardingState === 'checking'\) return <RouteLoader \/>/)
})

test('TOKEN_REFRESHED for the same user preserves the mounted child and its React-like state', () => {
  const mountedChild = { mountId: Symbol('product'), state: { draft: 'preservado' } }
  const result = transition('TOKEN_REFRESHED', true, 'user-a', 'user-a')
  const childAfterTransition = blocksAuthenticatedTree(result) ? null : mountedChild

  assert.equal(result, AUTH_SESSION_TRANSITION.SILENT_REFRESH)
  assert.strictEqual(childAfterTransition, mountedChild)
  assert.equal(childAfterTransition.state.draft, 'preservado')
  assert.match(auth, /if \(blocksAuthenticatedTree\(transition\)\)/)
  assert.doesNotMatch(auth, /if \(sessionUser\) \{\s*setOnboardingState\('checking'\)/)
})

test('same-user refresh keeps the route while revalidating protected backend state', () => {
  assert.equal(blocksAuthenticatedTree(transition('TOKEN_REFRESHED', true, 'user-a', 'user-a')), false)
  assert.match(auth, /fetchAdminStatusDirect\(newSession\?\.access_token\)/)
  assert.match(auth, /fetchAuthOnboardingStateDirect\(newSession\?\.access_token\)/)
  assert.match(auth, /blockingTransition \|\| rejectInvalidSession\(error\) \? 'error' : null/)
  assert.match(auth, /trustedOnboardingState !== null/)
})

test('SIGNED_OUT and invalid refreshed sessions remove private access', () => {
  assert.equal(transition('SIGNED_OUT', true, 'user-a', null), AUTH_SESSION_TRANSITION.SIGNED_OUT)
  assert.equal(transition('TOKEN_REFRESHED', true, 'user-a', null), AUTH_SESSION_TRANSITION.SIGNED_OUT)
  assert.match(auth, /setAuthUser\(sessionUser\)/)
  assert.match(auth, /setOnboardingState\('not_authenticated'\)/)
  assert.match(auth, /transition === AUTH_SESSION_TRANSITION\.SIGNED_OUT/)
  assert.match(auth, /error\?\.status === 401 \|\| error\?\.status === 403/)
  assert.match(auth, /rejectInvalidSession\(error\) \? 'error' : null/)
  assert.match(app, /if \(!user\) return <Navigate to="\/login" replace \/>/)
})

test('a real user change blocks and clears inherited profile and authorization', () => {
  const result = transition('SIGNED_IN', true, 'user-a', 'user-b')
  assert.equal(result, AUTH_SESSION_TRANSITION.IDENTITY_CHANGE)
  assert.equal(blocksAuthenticatedTree(result), true)
  assert.match(auth, /setProfile\(null\)\s*setAdminAuthorized\(false\)\s*setOnboardingState\('checking'\)/)
  assert.match(auth, /resolution === authResolutionRef\.current/)
  assert.match(auth, /currentUserId: trustedUserIdRef\.current/)
})

test('onboarding and Admin remain backend-owned and fail closed', () => {
  assert.match(auth, /rest\/v1\/rpc\/get_auth_onboarding_state/)
  assert.match(auth, /rest\/v1\/rpc\/is_authorized_admin/)
  assert.match(app, /onboardingState === 'needs_acceptance'/)
  assert.match(app, /if \(!isAdmin\) return <Navigate to="\/dashboard" replace \/>/)
  assert.doesNotMatch(auth, /ADMIN_EMAILS?|user\??\.email\s*===/)
})

test('MFA remains authoritative and a refresh cannot preserve Admin after AAL2 loss', () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  assert.equal(readJwtAssuranceLevel(`x.${encode({ aal: 'aal2' })}.y`), 'aal2')
  assert.equal(readJwtAssuranceLevel(`x.${encode({ aal: 'aal1' })}.y`), 'aal1')
  assert.match(mfaGate, /getAuthenticatorAssuranceLevel\(\)/)
  assert.match(mfaGate, /currentLevel === 'aal2'/)
  assert.match(mfaGate, /refreshedAal === 'aal2'/)
  assert.match(mfaGate, /status === 'verified' && refreshedAal === 'aal2'/)
  assert.match(mfaGate, /\}, \[accessToken, refreshedAal\]\)/)
})

test('login and Turnstile contracts are untouched by the session refresh policy', () => {
  assert.doesNotMatch(`${auth}\n${mfaGate}`, /signInWithPassword\([\s\S]*captchaToken:\s*undefined/)
  assert.match(auth, /if \(!captchaToken\) throw new Error\('captcha_required'\)/)
  assert.match(auth, /options: \{ captchaToken \}/)
})
