import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(path.join(root, file), 'utf8')
const page = read('src/pages/HeroNext.jsx')

test('Real Estate Banner enters directly in the form and does not restore its intro showcase', () => {
  assert.match(page, /restoredBannerDraft\.phase === 'intro' \? 'goal'/)
  assert.doesNotMatch(page, /<ProductHero|<ProductSteps|<HeroShowcase/)
  assert.doesNotMatch(page, /BANNER_CREATION_STEPS|BANNER_STEP_BY_PHASE/)
  assert.doesNotMatch(page, /title: 'Objetivo'[\s\S]*title: 'Formatos'[\s\S]*title: 'Revisão'[\s\S]*title: 'Imagens'[\s\S]*title: 'Criação'/)
  assert.match(page, /setPhase\('goal'\)/)
  assert.match(page, /phase === 'goal'[\s\S]*?<AssistantBubble>\{b\('chooseGoal'\)\}<\/AssistantBubble>[\s\S]*?GOALS\.map/)
})

test('Banner market controls keep BR and US location paths and localize fixed UI through messages', () => {
  assert.match(page, /market === 'US'/)
  assert.match(page, /getStatesForMarket\('US'\)/)
  assert.match(page, /getStatesForMarket\('BR'\)/)
  assert.match(page, /Header title=\{b\('productName'\)\}/)
  assert.match(page, /questionCount/)
  for (const locale of ['en-US.js', 'pt-BR.js']) {
    const messages = read(`src/i18n/messages/${locale}`)
    assert.match(messages, /productName: /)
    assert.match(messages, /questionCount: /)
  }
})

test('Banner header, return action, compact counter, and initial goals are localized by market', () => {
  const english = read('src/i18n/messages/en-US.js')
  const portuguese = read('src/i18n/messages/pt-BR.js')
  assert.match(english, /productName: 'Real Estate Banners'/)
  assert.match(english, /productDescription: 'Turn property photos and details into professional banners ready to promote\.'/)
  assert.match(english, /backHome: 'Back to Home'/)
  assert.match(english, /questionCount: '\{current\} of \{total\}'/)
  assert.match(english, /goalDescriptions: Object\.freeze\(\{ sale: 'Promote a property for sale\.'/)
  assert.match(portuguese, /productName: 'Banner Imobiliário'/)
  assert.match(portuguese, /questionCount: 'Pergunta \{current\} de \{total\}'/)
  assert.match(page, /Header title=\{b\('productName'\)\} subtitle=\{b\('productDescription'\)\}/)
  assert.match(page, /\{guestMode \? b\('learnPlatform'\) : b\('backHome'\)\}/)
  assert.match(page, /b\('questionCount'\)\.replace\('\{current\}'/)
  assert.match(page, /b\(`goalDescriptions\.\$\{item\.id\}`\) \|\| b\('goalDescriptionFallback'\)/)
})

test('Banner prompt and new campaign copy use market semantics without rewriting stored campaigns', () => {
  assert.match(page, /function buildHeroNextCampaignCopy\(goal, answers, valueCondition, market = 'BR'\)[\s\S]*?market !== 'US'\) return buildPublicationPackage\(buildHeroNextCopyInput\(goal, answers, valueCondition\)\)/)
  assert.match(page, /const buildHumanPrompt = \(goal, answers, destinations, valueCondition, creativeIdeaCount = 1, market = 'BR'\)[\s\S]*?if \(market === 'US'\)/)
  assert.match(page, /ussinglefamilyhome: 'Single-family home'/)
  assert.match(page, /bathroom', 'bathrooms'/)
  assert.match(page, /parking space', 'parking spaces'/)
  assert.match(page, /sqft/)
  assert.match(page, /USD \$\$\{new Intl\.NumberFormat\('en-US'/)
  assert.match(page, /CTA: \$\{cta\}/)
  assert.match(page, /Array\.isArray\(generationResult\.campaignCopy\) && generationResult\.campaignCopy\.length > 0[\s\S]*?\? generationResult\.campaignCopy/)
  assert.match(page, /buildHeroNextCampaignCopy\(goal, answers, valueCondition, market\)/)
  assert.match(page, /buildHumanPrompt\(goal, answers, selectedDestination \? \[selectedDestination\] : \[\], valueCondition, creativeIdeaCount, market\)/)
})
