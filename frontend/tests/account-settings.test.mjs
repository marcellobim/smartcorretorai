import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const settings = read('src/pages/Configuracoes.jsx')

const tabsSource = settings.match(/const tabs = \[([\s\S]*?)\n\]/)?.[1] || ''
const updatePayload = settings.match(/\.from\('profiles'\)\s*\.update\(\{([\s\S]*?)\n\s*\}\)\s*\.eq\('id'/)?.[1] || ''

test('exposes only the three approved Configurações areas', () => {
  assert.equal((tabsSource.match(/id:/g) || []).length, 3)
  assert.match(tabsSource, /id: 'cadastro', label: 'Cadastro'/)
  assert.match(tabsSource, /id: 'acesso', label: 'Acesso e Senha'/)
  assert.match(tabsSource, /id: 'plano', label: 'Plano e Assinatura'/)
  assert.doesNotMatch(tabsSource, /Redes Sociais|Notificações|Perfil e Marca/)
})

test('keeps the approved professional Cadastro fields and media', () => {
  for (const label of [
    'Nome profissional',
    'Telefone / WhatsApp',
    'E-mail profissional',
    'CRECI',
    'Imobiliária / empresa',
    'Foto profissional',
    'Logo da empresa',
  ]) assert.ok(settings.includes(label), label)

  assert.match(settings, /E-mail profissional[\s\S]*Não é o e-mail de acesso\/login/)
  assert.doesNotMatch(settings, /label="(?:Instagram|Facebook|LinkedIn|Site)"/)
  assert.doesNotMatch(settings, /Material concluído|Dicas semanais|Novidades da plataforma|Salvar preferências/)
})

test('saves only real profile columns used by Cadastro', () => {
  for (const field of ['nome', 'email', 'creci', 'estado', 'whatsapp', 'imobiliaria', 'avatar_url', 'logo_url']) {
    assert.match(updatePayload, new RegExp(`\\b${field}\\b`), field)
  }
  assert.doesNotMatch(updatePayload, /\b(?:facebook|linkedin|instagram|site)\b/)
  assert.match(updatePayload, /whatsapp: formatBrazilianPhone\(data\.whatsapp \|\| user\?\.telefone \|\| ''\)/)
})

test('shows the real access email and requires current password before changing it', () => {
  assert.match(settings, /accessEmail = session\?\.user\?\.email/)
  assert.match(settings, /label="E-mail de acesso\/login"[\s\S]*readOnly/)
  assert.match(settings, /label="Nova senha"/)
  assert.match(settings, /label="Confirmar nova senha"/)
  assert.match(settings, /label="Senha atual"/)
  assert.match(settings, /regSenha\('senha_atual'/)
  assert.match(settings, /signInWithPassword\(\{[\s\S]*password: data\.senha_atual/)
  assert.match(settings, /signOut\(\{ scope: 'global' \}\)/)
})

test('renders password validation and Auth errors visibly', () => {
  assert.match(settings, /setPasswordError\('confirmar_senha'[\s\S]*As senhas não conferem/)
  assert.match(settings, /minLength: \{ value: 12, message: 'Use pelo menos 12 caracteres\.'/)
  assert.match(settings, /setPasswordError\('root', \{ type: 'auth', message \}\)/)
  assert.match(settings, /role="alert"[\s\S]*passwordErrors\.root\.message/)
})

test('shows Stripe subscription management only for active plan profiles', () => {
  assert.match(settings, /Plano atual: \{user\?\.plano \|\| 'Starter'\}/)
  assert.match(settings, /ACTIVE_SUBSCRIPTION_PLANS = new Set\(\['start', 'pro', 'elite', 'imobiliaria'\]\)/)
  assert.match(settings, /hasActiveSubscription && \([\s\S]*?Gerenciar assinatura/)
  assert.match(settings, /functions\.invoke\('stripe-customer-portal'\)/)
  assert.match(settings, /Altere sua forma de pagamento ou cancele sua assinatura\./)
  assert.doesNotMatch(settings, /functions\.invoke\('stripe-customer-portal',[\s\S]{0,120}customer/i)
  assert.doesNotMatch(settings, /STRIPE_SECRET_KEY|customer_id/)
  assert.match(settings, /to="\/planos"/)
})
