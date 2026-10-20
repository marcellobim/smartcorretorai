import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const auth = read('../src/lib/auth-context.jsx')
const app = read('../src/App.jsx')
const login = read('../src/pages/LoginPage.jsx')
const register = read('../src/pages/RegisterPage.jsx')
const forgot = read('../src/pages/ForgotPasswordPage.jsx')
const reset = read('../src/pages/ResetPasswordPage.jsx')
const sidebar = read('../src/components/layout/Sidebar.jsx')
const ptBr = read('../src/i18n/messages/pt-BR.js')

test('password recovery routes exist and use a fixed same-origin callback', () => {
  assert.match(app, /path="\/esqueci-senha"/)
  assert.match(app, /path="\/redefinir-senha"/)
  assert.match(forgot, /resetPasswordForEmail\(email/)
  assert.match(forgot, /redirectTo: `\$\{window\.location\.origin\}\/redefinir-senha`/)
  assert.doesNotMatch(forgot, /location\.search|redirectTo.*email/)
})

test('recovery avoids account enumeration and globally revokes sessions after reset', () => {
  assert.match(forgot, /t\('forgotPassword\.confirmation'\)/)
  assert.match(ptBr, /confirmation: 'Se existir uma conta para este e-mail/)
  assert.doesNotMatch(forgot, /Usuário não encontrado|não existe|já cadastrado/i)
  assert.match(forgot, /catch \{[\s\S]*resposta pública não revela[\s\S]*finally \{[\s\S]*setSent\(true\)/)
  assert.match(reset, /event === 'PASSWORD_RECOVERY'/)
  assert.match(reset, /minLength: \{ value: 12/)
  assert.match(reset, /signOut\(\{ scope: 'global' \}\)/)
  assert.doesNotMatch(reset, /console\.|access_token|refresh_token/)
})

test('logout is fail-closed and the UI does not pretend success on failure', () => {
  const remote = auth.indexOf("supabase.auth.signOut({ scope: 'global' })")
  const local = auth.indexOf('setAuthUser(null)', remote)
  assert.ok(remote >= 0 && local > remote)
  assert.match(auth, /data\?\.session/)
  assert.doesNotMatch(auth, /sign out failed/)
  assert.match(sidebar, /await logout\(\)/)
  assert.match(sidebar, /Não foi possível encerrar sua sessão/)
})

test('public auth errors do not disclose registration state or raw provider errors', () => {
  assert.doesNotMatch(register, /Este email já está cadastrado|User already registered/)
  assert.match(register, /t\('register\.messages\.genericError'\)/)
  assert.match(ptBr, /genericError: 'Não foi possível enviar o link de acesso/)
  assert.match(login, /catch \{[\s\S]*setShowResendButton\(true\)[\s\S]*toast\.error\(t\('login\.errors\.generic'\)\)/)
  assert.match(login, /catch \{[\s\S]*resposta pública não revela[\s\S]*finally \{[\s\S]*toast\.success\(t\('login\.errors\.resendGeneric'\)\)/)
  assert.doesNotMatch(login, /Email not confirmed|Invalid login credentials|err\.message|Email não confirmado/)
})

test('email-link registration intentionally gives the same safe confirmation to new and existing identities', () => {
  assert.match(register, /await signInWithEmailLink\(/)
  assert.match(register, /toast\.success\(t\('register\.messages\.linkSent'\)\)/)
  assert.doesNotMatch(register, /identities|já está cadastrado|conta criada/i)
})

test('real signup errors keep the generic non-enumerating failure message', () => {
  assert.match(register, /\} catch \{\r?\n      toast\.error\(t\('register\.messages\.genericError'\)\)/)
  assert.doesNotMatch(register, /error\?\.message|err\.message/)
})
