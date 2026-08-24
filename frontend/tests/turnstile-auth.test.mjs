import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const widget = read('../src/components/auth/TurnstileWidget.jsx')
const auth = read('../src/lib/auth-context.jsx')
const login = read('../src/pages/LoginPage.jsx')
const register = read('../src/pages/RegisterPage.jsx')
const forgot = read('../src/pages/ForgotPasswordPage.jsx')
const settings = read('../src/pages/Configuracoes.jsx')

test('Turnstile uses only the public Vite site-key variable and official explicit script', () => {
  assert.match(widget, /import\.meta\.env\.VITE_TURNSTILE_SITE_KEY/)
  assert.match(widget, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/)
  assert.match(widget, /sitekey: TURNSTILE_SITE_KEY/)
  assert.doesNotMatch(widget, /TURNSTILE_SECRET|secretKey|siteverify/)
  assert.doesNotMatch(widget, /sitekey:\s*['"][^'"]+['"]/)
})

test('token remains ephemeral and is renewed after use, expiry, timeout or error', () => {
  assert.match(widget, /'response-field': false/)
  assert.match(widget, /'expired-callback'/)
  assert.match(widget, /'timeout-callback'/)
  assert.match(widget, /'error-callback'/)
  assert.match(widget, /turnstileRef\.current\.reset\(widgetIdRef\.current\)/)
  assert.match(widget, /type="button" onClick=\{reset\}/)
  assert.doesNotMatch(widget, /localStorage|sessionStorage|console\.|location\.|URLSearchParams/)
})

test('missing site key fails closed and protected submits require a token', () => {
  assert.match(widget, /status.*'unavailable'/)
  assert.match(widget, /Configure VITE_TURNSTILE_SITE_KEY/)
  for (const source of [login, register, forgot, settings]) {
    assert.match(source, /if \(!(?:passwordCaptchaToken|captchaToken)\)/)
    assert.match(source, /disabled=\{!(?:passwordCaptchaToken|captchaToken)\}/)
  }
})

test('password login and signup send captchaToken through the installed Supabase contract', () => {
  assert.match(auth, /signInWithPassword\(\{[\s\S]*options: \{ captchaToken \}/)
  assert.match(auth, /signUp\(\{[\s\S]*options: \{[\s\S]*data: metadata,[\s\S]*captchaToken,[\s\S]*emailRedirectTo:/)
  assert.match(login, /signIn\(data\.email, data\.senha, captchaToken\)/)
  assert.match(register, /\}, captchaToken\)/)
})

test('recovery, confirmation resend and password reauthentication include captchaToken', () => {
  assert.match(forgot, /resetPasswordForEmail\(email, \{[\s\S]*captchaToken/)
  assert.match(login, /auth\.resend\(\{[\s\S]*options: \{ captchaToken \}/)
  assert.match(settings, /signInWithPassword\(\{[\s\S]*options: \{ captchaToken: passwordCaptchaToken \}/)
})

test('every protected attempt resets its widget without logging the token', () => {
  for (const source of [login, register, forgot, settings]) {
    assert.match(source, /captchaRef\.current\?\.reset\(\)|passwordCaptchaRef\.current\?\.reset\(\)/)
    assert.doesNotMatch(source, /console\.[a-z]+\([^)]*captcha|localStorage[^\n]*captcha|sessionStorage[^\n]*captcha/i)
  }
})
