import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(frontendRoot, relativePath), 'utf8')

const banner = read('src/pages/HeroNext.jsx')
const showcase = read('src/components/hero/HeroShowcase.jsx')
const location = read('src/components/location/SmartCarouselCitySelect.jsx')

test('uses the shared product design system throughout the Banner Imobiliário interface', () => {
  assert.match(banner, /ProductButton, ProductCard, ProductHero, ProductSteps, SMART_UI/)
  assert.match(banner, /<main className=\{SMART_UI\.page\}>/)
  assert.match(banner, /<ProductHero[\s\S]*?id="banner-imobiliario-title"/)
  assert.match(banner, /<ProductCard(?:\s|>)/)
  assert.match(banner, /<ProductSteps[\s\S]*?steps=\{BANNER_CREATION_STEPS\}[\s\S]*?activeStep=\{BANNER_STEP_BY_PHASE\[phase\]\}/)
  assert.match(banner, /const BANNER_CREATION_STEPS = \[[\s\S]*?Objetivo[\s\S]*?Formatos[\s\S]*?Revisão[\s\S]*?Imagens[\s\S]*?Criação[\s\S]*?\]/)
  assert.match(banner, /const BANNER_STEP_BY_PHASE = \{[\s\S]*?goal: 1,[\s\S]*?chat: 1,[\s\S]*?values: 1,[\s\S]*?destination: 2,[\s\S]*?ideas: 2,[\s\S]*?prompt: 3,[\s\S]*?images: 4,[\s\S]*?processing: 5,[\s\S]*?\}/)
})

test('preserves Banner actions while migrating controls to ProductButton', () => {
  assert.match(banner, /actions=\{<ProductButton[^>]*onClick=\{startCampaign\}>Começar minha campanha<\/ProductButton>\}/)
  assert.match(banner, /<ProductButton[^>]*onClick=\{\(\) => commitAnswer\(currentQuestion\.id, textDraft\)\}[^>]*disabled=\{!textDraft\.trim\(\)\}/)
  assert.match(banner, /<ProductButton[^>]*onClick=\{goToDestinationStep\}[^>]*disabled=\{goal === 'sale' \? !saleValueReady : !rentValueReady\}/)
  assert.match(banner, /<ProductButton[^>]*onClick=\{\(\) => setPhase\('images'\)\}[^>]*disabled=\{!effectivePrompt\.trim\(\)\}/)
  assert.match(banner, /<ProductButton[^>]*onClick=\{handleGenerate\}[^>]*disabled=\{!canGenerate \|\| \(guestMode && guestConsumed\)\}[^>]*loading=\{generationLoading\}/)
})

test('keeps HeroShowcase actions and keyboard navigation with shared components', () => {
  assert.match(showcase, /ProductButton, ProductCard, SMART_UI/)
  assert.match(showcase, /<ProductCard[\s\S]*?aria-labelledby="hero-showcase-title"/)
  assert.match(showcase, /onClick=\{\(event\) => onOpen\(example, event\.currentTarget\)\}/)
  assert.match(showcase, /const startCampaign = \(\) => \{[\s\S]*?onStart\(\)/)
  assert.match(showcase, /<ProductButton[^>]*onClick=\{startCampaign\}/)
  assert.match(showcase, /onClick=\{\(\) => moveLightbox\(-1\)\}/)
  assert.match(showcase, /onClick=\{\(\) => moveLightbox\(1\)\}/)
  assert.match(showcase, /event\.key === 'Escape'[\s\S]*?event\.key === 'ArrowLeft'[\s\S]*?event\.key === 'ArrowRight'/)
})

test('keeps the multi-format campaign delivery presentation unchanged', () => {
  assert.match(banner, /phase === 'result'[\s\S]*?<CampaignPackage/)
  assert.doesNotMatch(banner, /<CampaignPackage[\s\S]*?mediaPresentation="mobile"/)
  assert.match(showcase, /className="block h-auto w-full object-contain/)
  assert.match(showcase, /max-h-\[calc\(100dvh-2rem\)\][^\n]*object-contain/)
})

test('standardizes only the Banner location controls without replacing its conversation flow', () => {
  assert.match(read('src/components/design-system/ProductButton.jsx'), /aria-busy=\{loading \? true : ariaBusy\}/)
  assert.match(location, /export function SmartLocationSelect/)
  assert.match(banner, /SmartLocationSelect, SmartLocationTextInput/)
  assert.match(banner, /if \(currentQuestion\.id === 'city' && market === 'BR'\)[\s\S]*?ariaLabel="Estado"[\s\S]*?setCityUf\(nextUf\)[\s\S]*?setCitySelection\(''\)/)
  assert.match(banner, /ariaLabel="Cidade"[\s\S]*?disabled=\{!cityUf \|\| citiesLoading\}[\s\S]*?if \(nextCity\) commitAnswer\(currentQuestion\.id, nextCity\)/)
  assert.match(banner, /\['neighborhood', 'neighborhoods'\]\.includes\(currentQuestion\.id\)[\s\S]*?<SmartLocationTextInput/)
  assert.match(banner, /placeholder=\{currentQuestion\.placeholder\}/)
  assert.match(banner, /city: answers\.city \|\| ''[\s\S]*?district: answers\.neighborhood \|\| answers\.neighborhoods \|\| ''/)
  assert.match(banner, /getStatesForMarket\('US'\)/)
  assert.match(banner, /getCountiesByState\(state\)/)
})

test('presents the Banner conversation with the approved shared visual grammar while preserving its own engine', () => {
  assert.match(banner, /ConversationAssistantBubble, ConversationHeader, ConversationUserBubble, ConversationQuestionCard/)
  assert.match(banner, /phase === 'chat'[\s\S]*?<section data-smart-conversation className="mt-6 overflow-visible">/)
  assert.match(banner, /<ConversationQuestionCard[\s\S]*?label=\{`\$\{Math\.min\(chatIndex \+ 1, chatFlow\.length\)\} de \$\{chatFlow\.length\}`\}[\s\S]*?title=\{currentQuestion\.question\}/)
  assert.match(banner, /<UserBubble actions=\{<button[\s\S]*?goToQuestion\(index\)[\s\S]*?>Editar<\/button>\}/)
  assert.match(banner, /const commitAnswer[\s\S]*?setChatIndex\(nextMissingIndex\)[\s\S]*?const goToQuestion/)
  assert.match(banner, /activeQuestionRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/)
  assert.doesNotMatch(banner, /import GuidedConversation|<GuidedConversation/)
})
