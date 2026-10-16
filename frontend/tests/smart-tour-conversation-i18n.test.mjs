import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const page = read('pages/SmartTourAI.jsx')
const enUS = read('i18n/messages/en-US.js')
const ptBR = read('i18n/messages/pt-BR.js')

test('Real Estate Video supplies localized guided-conversation header copy', () => {
  assert.match(page, /<GuidedConversation[\s\S]*?title=\{t\('smartTour\.conversation\.title'\)\}/)
  assert.match(page, /<GuidedConversation[\s\S]*?description=\{t\('smartTour\.conversation\.description'\)\}/)
  assert.match(enUS, /conversation: Object\.freeze\(\{ title: 'Chat with AI', description: 'One question at a time to create your presentation\.' \}\)/)
  assert.match(ptBR, /conversation: Object\.freeze\(\{ title: 'Converse com a IA', description: 'Uma pergunta por vez para construir sua apresentação\.' \}\)/)
})

test('the US guided-conversation header does not depend on GuidedConversation PT-BR defaults', () => {
  const smartTourConversation = page.slice(page.indexOf('<GuidedConversation'), page.indexOf('</GuidedConversation>'))
  assert.match(smartTourConversation, /title=\{t\('smartTour\.conversation\.title'\)\}/)
  assert.match(smartTourConversation, /description=\{t\('smartTour\.conversation\.description'\)\}/)
})
