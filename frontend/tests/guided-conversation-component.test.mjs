import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const element = React.createElement
let vite
let GuidedConversation
let getConversationScrollBehavior
let CONVERSATION_PHASE

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const [conversationModule, flowModule] = await Promise.all([
    vite.ssrLoadModule('/src/components/conversation/GuidedConversation.jsx'),
    vite.ssrLoadModule('/src/components/conversation/conversationFlow.js'),
  ])
  GuidedConversation = conversationModule.default
  getConversationScrollBehavior = conversationModule.getConversationScrollBehavior
  CONVERSATION_PHASE = flowModule.CONVERSATION_PHASE
})

after(async () => {
  await vite?.close()
})

const history = [{
  questionId: 'purpose',
  question: 'Qual é a finalidade?',
  answer: 'Venda',
  confirmation: 'Vamos preparar a apresentação para venda.',
}]

function renderConversation(props = {}) {
  return renderToStaticMarkup(element(GuidedConversation, {
    history,
    phase: CONVERSATION_PHASE.QUESTION,
    questionId: 'type',
    question: 'Qual é o tipo do imóvel?',
    questionNumber: 2,
    totalQuestions: 4,
    onEdit: () => {},
    summaryItems: [{ id: 'purpose', label: 'Finalidade: Venda' }],
    ...props,
  }, element('button', { type: 'button' }, 'Selecionar apartamento')))
}

test('renders the legacy conversation with its emerald default', () => {
  const markup = renderConversation()
  assert.match(markup, /^<section[^>]*data-smart-conversation="true"/)
  assert.match(markup, /overflow-hidden/)
  assert.match(markup, /text-emerald-700/)
  assert.match(markup, /Pergunta 2 de 4/)
  assert.match(markup, /Selecionar apartamento/)
  assert.match(markup, /aria-live="polite"/)
})

test('renders the design-system conversation with its primary default', () => {
  const markup = renderConversation({ designSystem: true })
  assert.match(markup, /overflow-visible/)
  assert.match(markup, /text-primary-700/)
  assert.match(markup, /bg-primary-50/)
  assert.match(markup, /Pergunta 2 de 4/)
})

test('honors explicit emerald and primary accents', () => {
  const emeraldMarkup = renderConversation({ designSystem: true, accent: 'emerald' })
  assert.match(emeraldMarkup, /text-emerald-700/)
  assert.match(emeraldMarkup, /bg-emerald-50/)

  const primaryMarkup = renderConversation({ accent: 'primary' })
  assert.match(primaryMarkup, /text-primary-700/)
  assert.match(primaryMarkup, /border-primary-100 bg-primary-50\/70 text-primary-950/)
  assert.doesNotMatch(primaryMarkup, /(?:bg|text|border)-emerald-/)
})

test('renders history, answer, confirmation and summary without changing edit semantics', () => {
  const markup = renderConversation({ editDisabled: true })
  assert.match(markup, /Qual é a finalidade\?/)
  assert.match(markup, />Venda</)
  assert.match(markup, /Vamos preparar a apresentação para venda\./)
  assert.match(markup, /Resumo da apresentação/)
  assert.match(markup, /Finalidade: Venda/)
  assert.match(markup, /Voltar e corrigir/)
  assert.ok((markup.match(/disabled=""/g) || []).length >= 2)
})

test('renders the typing status with its accessible label', () => {
  const markup = renderConversation({
    history: [],
    phase: CONVERSATION_PHASE.TYPING,
    designSystem: true,
  })
  assert.match(markup, /aria-label="SmartCorretorAI está digitando"/)
  assert.match(markup, /animate-spin/)
  assert.match(markup, /animate-pulse/)
})

test('selects deterministic scroll behavior for reduced motion', () => {
  assert.equal(getConversationScrollBehavior(() => ({ matches: true })), 'auto')
  assert.equal(getConversationScrollBehavior(() => ({ matches: false })), 'smooth')
  assert.equal(getConversationScrollBehavior(null), 'smooth')
  assert.equal(getConversationScrollBehavior(() => { throw new Error('matchMedia unavailable') }), 'smooth')
})
