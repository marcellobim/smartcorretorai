import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const settings = read('src/pages/Configuracoes.jsx')

const tabsSource = settings.match(/const tabs = \[([\s\S]*?)\n\]/)?.[1] || ''
const updatePayload = settings.match(/const profileUpdate = \{([\s\S]*?)\n\s*\}/)?.[1] || ''

test('exposes only the three approved Configurações areas', () => {
  assert.equal((tabsSource.match(/id:/g) || []).length, 3)
  assert.match(tabsSource, /id: 'cadastro', label: 'Cadastro'/)
  assert.match(tabsSource, /id: 'acesso', label: 'Acesso e Senha'/)
  assert.match(tabsSource, /id: 'plano', label: 'Plano e Assinatura'/)
  assert.doesNotMatch(tabsSource, /Redes Sociais|Notificações|Perfil e Marca/)
})

test('keeps the approved professional Cadastro fields and media', () => {
  for (const field of ['nome', 'display_name', 'creci', 'telefone', 'whatsapp', 'imobiliaria']) assert.match(settings, new RegExp(`regPerfil\\('${field}`), field)
  assert.match(settings, /label=\{t\('profile\.email'\)\}/)
  assert.doesNotMatch(settings, /label="(?:Instagram|Facebook|LinkedIn|Site)"/)
  assert.doesNotMatch(settings, /Material concluído|Dicas semanais|Novidades da plataforma|Salvar preferências/)
})

test('saves only real profile columns used by Cadastro', () => {
  for (const field of ['nome', 'email', 'creci', 'estado', 'whatsapp', 'imobiliaria', 'avatar_url', 'logo_url']) {
    assert.match(updatePayload, new RegExp(`\\b${field}\\b`), field)
  }
  assert.doesNotMatch(updatePayload, /\b(?:facebook|linkedin|instagram|site)\b/)
  assert.match(settings, /normalizePhone\(data\.telefone, market\)/)
  assert.match(settings, /normalizePhone\(data\.whatsapp, market\)/)
  assert.match(settings, /formatPhone\(event\.target\.value, market\)/)
})

test('keeps Brazilian CRECI fields and US license fields independently in Settings', () => {
  assert.match(settings, /license_number: user\?\.license_number \|\| ''/)
  assert.match(settings, /license_state: user\?\.license_state \|\| ''/)
  assert.match(settings, /license_number: data\.license_number \|\| null/)
  assert.match(settings, /license_state: data\.license_state/)
  assert.match(settings, /regPerfil\('creci'/)
  assert.match(settings, /regPerfil\('estado'/)
  assert.match(settings, /regPerfil\('license_number'/)
  assert.match(settings, /regPerfil\('license_state'/)
})

test('shows the real access email and requires current password before changing it', () => {
  assert.match(settings, /accessEmail = session\?\.user\?\.email/)
  assert.match(settings, /label=\{copy\.loginEmail\}[\s\S]*readOnly/)
  assert.match(settings, /label=\{copy\.newPassword\}/)
  assert.match(settings, /label=\{copy\.confirmPassword\}/)
  assert.match(settings, /label=\{copy\.currentPassword\}/)
  assert.match(settings, /regSenha\('senha_atual'/)
  assert.match(settings, /signInWithPassword\(\{[\s\S]*password: data\.senha_atual/)
  assert.match(settings, /signOut\(\{ scope: 'global' \}\)/)
})

test('renders password validation and Auth errors visibly', () => {
  assert.match(settings, /setPasswordError\('confirmar_senha'[\s\S]*copy\.passwordsMismatch/)
  assert.match(settings, /minLength: \{ value: 12, message: copy\.passwordMin \}/)
  assert.match(settings, /setPasswordError\('root', \{ type: 'auth', message \}\)/)
  assert.match(settings, /role="alert"[\s\S]*passwordErrors\.root\.message/)
})

test('shows Stripe subscription management only for active plan profiles', () => {
  assert.match(settings, /\{copy\.currentPlan\}: \{user\?\.plano \|\| 'Starter'\}/)
  assert.match(settings, /ACTIVE_SUBSCRIPTION_PLANS = new Set\(\['start', 'pro', 'elite', 'imobiliaria'\]\)/)
  assert.match(settings, /hasActiveSubscription && \([\s\S]*?copy\.manage/)
  assert.match(settings, /functions\.invoke\('stripe-customer-portal'\)/)
  assert.match(settings, /copy\.manageDescription/)
  assert.doesNotMatch(settings, /functions\.invoke\('stripe-customer-portal',[\s\S]{0,120}customer/i)
  assert.doesNotMatch(settings, /STRIPE_SECRET_KEY|customer_id/)
  assert.match(settings, /to="\/planos"/)
})
