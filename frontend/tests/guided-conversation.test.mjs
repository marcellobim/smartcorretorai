import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { appendConversationTurn, createConversationTurn, truncateConversationAt } from '../src/components/conversation/conversationFlow.js'
import { getSmartTourNextQuestion, shouldAskProfessionalIdentity } from '../src/config/smartTourConversation.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const hook = read('src/hooks/useGuidedConversation.js')
const sharedUi = read('src/components/conversation/GuidedConversation.jsx')
const conversationPrimitives = read('src/components/conversation/ConversationPrimitives.jsx')
const smartTour = read('src/pages/SmartTourAI.jsx')
const smartTourForm = read('src/config/smartTourForm.js')
const smartCarousel = read('src/pages/SmartCarrossel.jsx')

test('supports Venda and Locação with purpose-specific confirmations', () => {
  for (const value of ['Venda', 'Locação']) assert.ok(smartTour.includes(value) && smartCarousel.includes(value))
  assert.match(smartTour, /divulgar a locação/)
  assert.match(smartCarousel, /apoiar a venda/)
  assert.match(smartTour, /getSmartTourStageOptions\(property\.purpose, STAGES\)/)
  assert.match(smartTourForm, /SMART_TOUR_RENTAL_STAGES = Object\.freeze\(\['Pronto para morar', 'Disponível já', 'Vago'\]\)/)
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
  assert.match(sharedUi, /BRAND\.name\} está digitando/)
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
  assert.equal(getSmartTourNextQuestion({ questionId: 'highlights' }), 'presenter')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'none' }), 'presenter_speech_mode')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'female' }), 'presenter_speech_mode')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'male' }), 'presenter_speech_mode')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'automatic' }), 'narration')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'custom' }), 'presenter_custom_speech')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_custom_speech' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'narration', answerId: 'disabled' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions', answerId: 'disabled' }), 'professional_identity')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta_enabled', answerId: 'yes' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta_enabled', answerId: 'no' }), 'review')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta' }), 'phone')
  assert.equal(getSmartTourNextQuestion({ questionId: 'phone' }), 'review')
})

test('asks CTA yes or no and omits phone when CTA is disabled', () => {
  assert.match(smartTour, /\['cta_enabled', 4, 'Deseja uma chamada para ação no final do vídeo\?'\]/)
  assert.match(smartTour, /includeProfessionalPhone: videoCtaEnabled && includePhone === true/)
  assert.match(smartTour, /phone:videoCtaEnabled && includePhone \? phone : ''/)
  assert.match(smartTour, /O vídeo terminará naturalmente na última cena, sem chamada final/)
})

test('offers the independent presentation choices in the existing chat', () => {
  for (const question of ['Deseja um apresentador virtual durante o vídeo?', 'Deseja narração durante o vídeo?', 'Deseja uma chamada para ação no final do vídeo?']) assert.ok(smartTour.includes(question))
  assert.match(smartTour, /smartTour\.captions\.question/)
  assert.match(smartTour, /smartTour\.professionalIdentity\.question/)
  for (const explanation of ['Um corretor ou corretora virtual poderá apresentar', 'Uma narração em português do Brasil', 'Ao final do vídeo poderá ser exibido um convite para contato']) assert.ok(smartTour.includes(explanation))
  assert.match(smartTour, /\{id:'female',label:'Corretora'\},\{id:'male',label:'Corretor'\},\{id:'none',label:'Nenhum'\}/)
  assert.match(smartTour, /presenterGender: '', presenterSpeechMode: 'automatic', presenterCustomSpeech: '', narration: '', captions: ''/)
  assert.match(smartTour, /setGeneration\(current => \(\{ \.\.\.current, \[field\]: value \}\)\)/)
})

test('supports literal custom Corretor Virtual speech with a 25-word client limit', () => {
  for (const copy of [
    'Como deseja definir a narração?',
    'Usar sugestão da SNETIA',
    'Escrever minha própria fala',
    'Escreva sua narração',
    'O vídeo tem 10 segundos. Escreva até 25 palavras para manter uma fala natural.',
    'Reduza a fala para no máximo 25 palavras.',
  ]) assert.ok(smartTour.includes(copy))
  assert.match(smartTour, /value=\{generation\.presenterCustomSpeech\}/)
  assert.match(smartTour, /presenterCustomSpeech: event\.target\.value/)
  assert.match(smartTour, /wordCount < 1 \|\| wordCount > 25/)
  assert.match(smartTour, /\{wordCount\} \/ 25 palavras/)
  assert.match(smartTour, /presenterSpeechMode === 'custom' \? 'enabled'/)
  assert.match(smartTour, /presenterSpeechMode === 'custom' \? 'Sim \(implícita\)'/)
})

test('custom presenter speech preserves property data and continues to captions, professional identity and CTA', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'custom' }), 'presenter_custom_speech')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_custom_speech' }), 'captions')
  assert.ok(smartTour.indexOf("['highlights'") < smartTour.indexOf("['presenter_speech_mode'"))
  assert.match(smartTour, /const applyCustomPresenterVideoChoices = \(\) => \{[\s\S]*?narration: 'enabled'[\s\S]*?\}/)
  assert.match(smartTour, /cont\(invalid, generation\.presenterCustomSpeech, 'captions', applyCustomPresenterVideoChoices\)/)
  assert.doesNotMatch(smartTour, /captions: presenterSpeechMode === 'custom' \? 'disabled'/)
  assert.match(smartTour, /const videoCtaEnabled = ctaEnabled === true/)
  const customChoices = smartTour.match(/const applyCustomPresenterVideoChoices = \(\) => \{([\s\S]*?)\n  \}/)?.[1] || ''
  assert.doesNotMatch(customChoices, /setProperty|property|highlights|captions|cta|professionalIdentity|display_name|creci|license/)
  assert.doesNotMatch(smartTour, /presenterSpeechMode === 'custom' \? \(canAskProfessionalIdentity/)
  assert.match(smartTour, /const draft = \{ activeInputFlow, property, generation, ctaEnabled, cta, includePhone, showProfessionalIdentity/)
})

test('automatic presenter speech and no presenter keep the current narration, highlights and CTA path', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter', answerId: 'none' }), 'presenter_speech_mode')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'automatic' }), 'narration')
  assert.equal(getSmartTourNextQuestion({ questionId: 'narration', answerId: 'enabled' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions', answerId: 'enabled' }), 'professional_identity')
})

test('asks professional identity only with on-screen captions and a formatted identity', () => {
  assert.equal(shouldAskProfessionalIdentity({ captions: 'enabled', identity: 'Riccieri — CRECI F 12345/SC' }), true)
  assert.equal(shouldAskProfessionalIdentity({ captions: 'disabled', identity: 'Riccieri — CRECI F 12345/SC' }), false)
  assert.equal(shouldAskProfessionalIdentity({ captions: 'enabled', identity: '' }), false)
  assert.match(smartTour, /showSummary=\{false\}/)
})

test('removes staging and furniture questions from the active Smart Tour chat', () => {
  assert.doesNotMatch(smartTour, /id === 'staging'|id === 'furniture'|Como deseja mostrar o resultado|Mobiliar com IA|virtual_staging/)
  assert.match(smartTour, /furniture: 'original', stagingPresentation: 'final_only'/)
})

test('rebuilds coherently when changing Venda to Locação', () => {
  const turns = ['images', 'purpose', 'stage', 'type'].map(questionId => ({ questionId }))
  const edited = truncateConversationAt(turns, 'purpose')
  assert.deepEqual(edited.history.map(item => item.questionId), ['images'])
  assert.deepEqual(edited.removed.map(item => item.questionId), ['purpose', 'stage', 'type'])
})

test('rebuilds coherently when changing an independent presentation choice', () => {
  const turns = ['images', 'purpose', 'stage', 'type', 'facts', 'location', 'commercial', 'highlights', 'presenter', 'narration', 'captions'].map(questionId => ({ questionId }))
  const edited = truncateConversationAt(turns, 'presenter')
  assert.equal(edited.history.at(-1).questionId, 'highlights')
  assert.deepEqual(edited.removed.map(item => item.questionId), ['presenter', 'narration', 'captions'])
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
  assert.match(conversationPrimitives, /max-w-\[88%\][\s\S]*?sm:max-w-\[78%\]/)
  assert.doesNotMatch(sharedUi, /min-w-\[390px\]/)
})
