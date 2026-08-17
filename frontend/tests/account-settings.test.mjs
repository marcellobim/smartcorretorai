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

test('shows the real access email and only the new-password fields', () => {
  assert.match(settings, /accessEmail = session\?\.user\?\.email/)
  assert.match(settings, /label="E-mail de acesso\/login"[\s\S]*readOnly/)
  assert.match(settings, /label="Nova senha"/)
  assert.match(settings, /label="Confirmar nova senha"/)
  assert.doesNotMatch(settings, /label="Senha atual"|regSenha\('senha_atual'/)
})

test('renders password validation and Auth errors visibly', () => {
  assert.match(settings, /setPasswordError\('confirmar_senha'[\s\S]*As senhas não conferem/)
  assert.match(settings, /minLength: \{ value: 8, message: 'Use pelo menos 8 caracteres\.'/)
  assert.match(settings, /setPasswordError\('root', \{ type: 'auth', message \}\)/)
  assert.match(settings, /role="alert"[\s\S]*passwordErrors\.root\.message/)
})

test('keeps Plano e Assinatura factual without an inactive cancellation control', () => {
  assert.match(settings, /Plano atual: \{user\?\.plano \|\| 'Starter'\}/)
  assert.match(settings, /cancelamento pela conta ainda não está disponível nesta tela/)
  assert.match(settings, /to="\/planos"/)
  assert.doesNotMatch(settings, /<Button[^>]*>[\s\S]{0,80}Cancelar assinatura/)
})
