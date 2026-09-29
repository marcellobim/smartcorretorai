import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const banner = readFileSync(path.join(frontendRoot, 'src/pages/HeroNext.jsx'), 'utf8')

const sliceBetween = (start, end) => banner.slice(banner.indexOf(start), banner.indexOf(end, banner.indexOf(start)))
const flowIds = (name, nextName) => [...sliceBetween(`const ${name} = [`, `const ${nextName}`).matchAll(/\bid: '([^']+)'/g)].map((match) => match[1])

test('opens directly on the first real question without an introductory queue', () => {
  const resetForGoal = sliceBetween('const resetForGoal', 'const commitAnswer')
  assert.match(resetForGoal, /setChatIndex\(0\)[\s\S]*?setPhase\('chat'\)/)
  assert.doesNotMatch(resetForGoal, /setTimeout|setInterval|startConversationSequence|opening-/)
  assert.match(banner, /title=\{currentQuestion\.question\}/)
  assert.doesNotMatch(banner, /<AssistantBubble>Olá!<\/AssistantBubble>|Vou fazer algumas perguntas rápidas|Vamos começar pelo tipo do imóvel/)
})

test('advances from answer to the next question without generic confirmation or transition bubbles', () => {
  const commitAnswer = sliceBetween('const commitAnswer', 'const goToQuestion')
  assert.match(commitAnswer, /setAnswers\(updatedAnswers\)[\s\S]*?nextMissingIndex === -1[\s\S]*?setChatIndex\(nextMissingIndex\)/)
  assert.doesNotMatch(commitAnswer, /setTimeout|setInterval|confirmation|transition|ConversationQueue/)
  assert.doesNotMatch(banner, /CONVERSATION_CONFIRMATIONS|getConversationConfirmation|getConversationTransition/)
  assert.doesNotMatch(banner, /Perfeito\. Apartamento|<AssistantBubble>Excelente\.<\/AssistantBubble>|Já tenho todas as informações necessárias/)
})

test('preserves every guided-question id and its order', () => {
  assert.deepEqual(flowIds('SALE_CHAT_FLOW', 'RENT_CHAT_FLOW'), [
    'propertyType', 'profile', 'stage', 'city', 'neighborhood', 'bedrooms', 'suites', 'parking',
    'differentials', 'cta', 'contactPhoneChoice', 'contactPhone',
  ])
  assert.deepEqual(flowIds('RENT_CHAT_FLOW', 'PROPERTY_CAPTURE_SERVICES'), [
    'propertyType', 'city', 'neighborhood', 'bedrooms', 'suites', 'parking', 'area',
    'differentials', 'cta', 'contactPhoneChoice', 'contactPhone',
  ])
  assert.deepEqual(flowIds('PROPERTY_CAPTURE_CHAT_FLOW', 'BROKER_CAPTURE_CHAT_FLOW'), [
    'services', 'city', 'neighborhoods', 'propertyKinds', 'ownerAudience', 'marketExperience',
    'specialties', 'businessDifferentials', 'mainMessage', 'cta', 'contactPhoneChoice', 'contactPhone',
  ])
  assert.deepEqual(flowIds('BROKER_CAPTURE_CHAT_FLOW', 'PROCESSING_STEPS'), [
    'professionalProfile', 'city', 'neighborhoods', 'marketExperience', 'businessDifferentials',
    'mainMessage', 'cta', 'contactPhoneChoice', 'contactPhone',
  ])
})

test('keeps city required and makes only the broker-capture neighborhood optional', () => {
  const propertyCaptureFlow = sliceBetween('const PROPERTY_CAPTURE_CHAT_FLOW = [', 'const BROKER_CAPTURE_CHAT_FLOW')
  const brokerCaptureFlow = sliceBetween('const BROKER_CAPTURE_CHAT_FLOW = [', 'const PROCESSING_STEPS')
  const brokerCity = brokerCaptureFlow.slice(brokerCaptureFlow.indexOf("id: 'city'"), brokerCaptureFlow.indexOf("id: 'neighborhoods'"))
  const brokerNeighborhood = brokerCaptureFlow.slice(brokerCaptureFlow.indexOf("id: 'neighborhoods'"), brokerCaptureFlow.indexOf("id: 'marketExperience'"))
  const commitAnswer = sliceBetween('const commitAnswer', 'const goToQuestion')

  assert.doesNotMatch(brokerCity, /optional: true/)
  assert.match(brokerNeighborhood, /optional: true/)
  assert.match(brokerNeighborhood, /optionalLabel: 'Continuar somente com a cidade'/)
  assert.doesNotMatch(propertyCaptureFlow, /optionalLabel: 'Continuar somente com a cidade'/)
  assert.match(commitAnswer, /allowsEmpty = baseChatFlow\.find[\s\S]*?\.optional === true/)
  assert.match(commitAnswer, /if \(isEmpty\) delete updatedAnswers\[questionId\]/)
  assert.match(banner, /currentQuestion\.optionalLabel[\s\S]*?commitAnswer\(currentQuestion\.id, ''\)/)
  assert.match(banner, /answers\.city \? `Cidade: \$\{answers\.city\}` : ''[\s\S]*?answers\.neighborhoods \? `Regiões\/bairros: \$\{answers\.neighborhoods\}` : ''/)
})

test('adds the inclusive experience choice only to broker capture', () => {
  const experienceOptions = sliceBetween('const MARKET_EXPERIENCE_OPTIONS = [', 'const PROPERTY_CAPTURE_SPECIALTIES')
  const propertyCaptureFlow = sliceBetween('const PROPERTY_CAPTURE_CHAT_FLOW = [', 'const BROKER_CAPTURE_CHAT_FLOW')
  const brokerCaptureFlow = sliceBetween('const BROKER_CAPTURE_CHAT_FLOW = [', 'const PROCESSING_STEPS')

  assert.match(experienceOptions, /const BROKER_CAPTURE_EXPERIENCE_OPTIONS = \[[\s\S]*?\.\.\.MARKET_EXPERIENCE_OPTIONS,[\s\S]*?'Com ou sem experiência'/)
  assert.match(propertyCaptureFlow, /question: 'Qual sua experiência no mercado\?'[\s\S]*?options: MARKET_EXPERIENCE_OPTIONS/)
  assert.match(brokerCaptureFlow, /question: 'Qual experiência deseja priorizar\?'[\s\S]*?options: BROKER_CAPTURE_EXPERIENCE_OPTIONS/)
})

test('keeps history editing while removing the intermediate live summary', () => {
  assert.match(banner, /chatFlow\.slice\(0, chatIndex\)\.map\(\(question, index\)[\s\S]*?formatAnswer\(answers\[question\.id\]\)[\s\S]*?goToQuestion\(index\)/)
  assert.doesNotMatch(banner, /Resumo ao vivo|Sua campanha<\/h3>/)
  assert.match(banner, /b\('campaignSummary'\)[\s\S]*?chatFlow\.map\(\(question, index\)/)
  assert.match(banner, /const goToQuestion[\s\S]*?setChatIndex\(safeIndex\)[\s\S]*?setTextDraft[\s\S]*?setMultiDraft/)
})

test('keeps final generation and economic integration outside the conversation change', () => {
  assert.match(banner, /const handleGenerate = async \(\) =>/)
  assert.match(banner, /supabase\.functions\.invoke\('gerar-hero-ia'/)
  assert.match(banner, /phase === 'result'[\s\S]*?<CampaignPackage/)
  assert.match(banner, /const canGenerate = Boolean\([\s\S]*?!generationLoading/)
})

test('retains responsive mobile-first layout without a fixed-height conversation viewport', () => {
  const chat = sliceBetween("{phase === 'chat'", "{phase === 'values'")
  assert.match(chat, /<div className="min-w-0">/)
  assert.doesNotMatch(chat, /lg:sticky lg:top-6 lg:self-start/)
  assert.doesNotMatch(chat, /h-screen|min-h-screen|overflow-y-(?:auto|scroll)/)
  assert.doesNotMatch(chat, /conversationQueue|ConversationTypewriterText/)
})

test('isolated contract test uses only Node.js built-ins', () => {
  const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const imports = ownSource.match(/^import .*$/gm) || []
  assert.ok(imports.length > 0)
  assert.ok(imports.every((line) => line.includes("from 'node:")))
})
