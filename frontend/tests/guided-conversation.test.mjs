import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { appendConversationTurn, createConversationTurn, truncateConversationAt } from '../src/components/conversation/conversationFlow.js'
import { getSmartTourNextQuestion } from '../src/config/smartTourConversation.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const hook = read('src/hooks/useGuidedConversation.js')
const sharedUi = read('src/components/conversation/GuidedConversation.jsx')
const smartTour = read('src/pages/SmartTourAI.jsx')
const smartCarousel = read('src/pages/SmartCarrossel.jsx')

test('supports Venda and Locação with purpose-specific confirmations', () => {
  for (const value of ['Venda', 'Locação']) assert.ok(smartTour.includes(value) && smartCarousel.includes(value))
  assert.match(smartTour, /divulgar a locação/)
  assert.match(smartCarousel, /apoiar a venda/)
  assert.match(smartTour, /property\.purpose === 'rent' \? \['Pronto para mudar'\]/)
  assert.match(smartTour, /Valor da locação/)
})

test('adds the user answer and specific confirmation to the history', () => {
  const first = createConversationTurn({ questionId: 'purpose', question: 'Finalidade?', answer: 'Locação', confirmation: 'Vamos divulgar a locação.' })
  assert.deepEqual(appendConversationTurn([], first), [first])
  assert.match(sharedUi, /turn\.answer/)
  assert.match(sharedUi, /turn\.confirmation/)
})

test('shows confirmation before typing and only then advances', () => {
  const confirmationIndex = hook.indexOf('setPhase(CONVERSATION_PHASE.CONFIRMATION)')
  const typingIndex = hook.indexOf('setPhase(CONVERSATION_PHASE.TYPING)')
  const advanceIndex = hook.indexOf('setActiveQuestionId(nextQuestionId)')
  assert.ok(confirmationIndex >= 0 && confirmationIndex < typingIndex && typingIndex < advanceIndex)
  assert.match(sharedUi, /SmartCorretorAI está digitando/)
})

test('keeps only one active question and blocks duplicate submissions', () => {
  assert.match(sharedUi, /phase === CONVERSATION_PHASE\.QUESTION/)
  assert.match(hook, /if \(lockedRef\.current \|\| phase !== CONVERSATION_PHASE\.QUESTION/)
  assert.match(hook, /lockedRef\.current = true/)
})

test('edits an earlier answer and removes all dependent turns', () => {
  const history = ['purpose', 'stage', 'type', 'mode'].map(questionId => ({ questionId }))
  const result = truncateConversationAt(history, 'stage')
  assert.deepEqual(result.history.map(item => item.questionId), ['purpose'])
  assert.deepEqual(result.removed.map(item => item.questionId), ['stage', 'type', 'mode'])
  assert.match(sharedUi, /Voltar e corrigir/)
})

test('updates the lateral summary through the same edit action', () => {
  assert.match(sharedUi, /Resumo da apresentação/)
  assert.match(sharedUi, /summaryItems\.map/)
  assert.match(sharedUi, /onClick=\{\(\) => onEdit\(item\.id\)\}/)
})

test('keeps all Smart Tour conditional paths coherent through review', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'guided_tour' }), 'presenter')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', mode: 'guided_tour' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'narrated_tour' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'smart_staging' }), 'staging')
  assert.equal(getSmartTourNextQuestion({ questionId: 'staging', mode: 'smart_staging' }), 'presenter')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'none', mode: 'smart_staging' }), 'narration')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions', mode: 'smart_staging' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'cinematic_tour' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions', mode: 'cinematic_tour' }), 'furniture')
  assert.equal(getSmartTourNextQuestion({ questionId: 'furniture', answerId: 'original', mode: 'cinematic_tour' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta', answerId: 'none' }), 'review')
  assert.equal(getSmartTourNextQuestion({ questionId: 'phone' }), 'review')
})

test('reuses the CTA question to offer a clean ending without asking for a phone', () => {
  assert.match(smartTour, /\{ id: 'none', label: 'Sem CTA' \}/)
  assert.match(smartTour, /cta \|\| 'none'/)
  assert.match(smartTour, /includeProfessionalPhone: Boolean\(cta\) && includePhone === true/)
  assert.match(smartTour, /phone:cta && includePhone \? phone : ''/)
  assert.match(smartTour, /O vídeo terminará naturalmente na última cena, sem chamada final/)
})

test('completes Venda with Corretora Virtual path', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'guided_tour' }), 'presenter')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'female', mode: 'guided_tour' }), 'cta')
})

test('completes Locação with Narração path', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'narrated_tour' }), 'cta')
  assert.match(smartTour, /property\.purpose === 'rent'/)
})

test('completes Venda with Sugestão de Decoração path', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'smart_staging' }), 'staging')
  assert.equal(getSmartTourNextQuestion({ questionId: 'staging', answerId: 'final_only', mode: 'smart_staging' }), 'presenter')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'female', mode: 'smart_staging' }), 'narration')
  assert.match(smartTour, /generation\.mode === 'smart_staging' \? \[\{id:'none',label:'Sem apresentador'\}/)
})

test('completes Locação with Apresentação Dinâmica path', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'cinematic_tour' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions', answerId: 'disabled', mode: 'cinematic_tour' }), 'furniture')
  assert.equal(getSmartTourNextQuestion({ questionId: 'furniture', answerId: 'original', mode: 'cinematic_tour' }), 'cta')
})

test('rebuilds coherently when changing Venda to Locação', () => {
  const turns = ['images', 'purpose', 'stage', 'type'].map(questionId => ({ questionId }))
  const edited = truncateConversationAt(turns, 'purpose')
  assert.deepEqual(edited.history.map(item => item.questionId), ['images'])
  assert.deepEqual(edited.removed.map(item => item.questionId), ['purpose', 'stage', 'type'])
})

test('rebuilds coherently when changing the presentation type', () => {
  const turns = ['images', 'purpose', 'stage', 'type', 'facts', 'location', 'commercial', 'highlights', 'mode', 'presenter', 'cta'].map(questionId => ({ questionId }))
  const edited = truncateConversationAt(turns, 'mode')
  assert.equal(edited.history.at(-1).questionId, 'highlights')
  assert.deepEqual(edited.removed.map(item => item.questionId), ['mode', 'presenter', 'cta'])
})

test('shares the approved engine without changing product generation integrations', () => {
  for (const source of [smartTour, smartCarousel]) {
    assert.match(source, /GuidedConversation/)
    assert.match(source, /useGuidedConversation/)
  }
  assert.match(smartTour, /smart-tour-generate/)
  assert.match(smartTour, /smart-tour-status/)
  assert.match(smartCarousel, /smart-carousel-creatomate/)
  assert.match(smartCarousel, /pollRenderStatus/)
})

test('preserves desktop and 390px layouts without page-wide horizontal overflow', () => {
  assert.match(sharedUi, /p-4 sm:p-6 lg:grid-cols-\[minmax\(0,1fr\)_300px\] lg:p-8/)
  assert.match(sharedUi, /max-w-\[88%\][\s\S]*?sm:max-w-\[78%\]/)
  assert.doesNotMatch(sharedUi, /min-w-\[390px\]/)
})
