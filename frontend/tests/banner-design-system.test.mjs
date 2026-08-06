import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(frontendRoot, relativePath), 'utf8')

const banner = read('src/pages/HeroNext.jsx')
const location = read('src/components/location/SmartCarouselCitySelect.jsx')
test('standardizes only the Banner location controls without replacing its conversation flow', () => {
  assert.match(location, /export function SmartLocationSelect/)
  assert.match(banner, /SmartLocationSelect, SmartLocationTextInput/)
  assert.match(banner, /if \(currentQuestion\.id === 'city'\)[\s\S]*?ariaLabel="Estado"[\s\S]*?setCityUf\(nextUf\)[\s\S]*?setCitySelection\(''\)/)
  assert.match(banner, /ariaLabel="Cidade"[\s\S]*?disabled=\{!cityUf \|\| citiesLoading\}[\s\S]*?if \(nextCity\) commitAnswer\(currentQuestion\.id, nextCity\)/)
  assert.match(banner, /\['neighborhood', 'neighborhoods'\]\.includes\(currentQuestion\.id\)[\s\S]*?<SmartLocationTextInput/)
  assert.match(banner, /placeholder=\{currentQuestion\.placeholder\}/)
  assert.match(banner, /city: answers\.city \|\| ''[\s\S]*?district: answers\.neighborhood \|\| answers\.neighborhoods \|\| ''/)
})

test('presents the Banner conversation with the approved shared visual grammar while preserving its own engine', () => {
  assert.match(banner, /ConversationAssistantBubble, ConversationHeader, ConversationUserBubble, ConversationQuestionCard/)
  assert.match(banner, /phase === 'chat'[\s\S]*?<section data-smart-conversation className="mt-6 overflow-visible">/)
  assert.match(banner, /<ConversationQuestionCard[\s\S]*?label=\{`\$\{Math\.min\(chatIndex \+ 1, chatFlow\.length\)\} de \$\{chatFlow\.length\}`\}[\s\S]*?title=\{currentQuestion\.question\}/)
  assert.match(banner, /<UserBubble actions=\{<button[\s\S]*?goToQuestion\(index\)[\s\S]*?>Editar<\/button>\}/)
  assert.match(banner, /const startConversationSequence[\s\S]*?const commitAnswer[\s\S]*?const goToQuestion/)
  assert.match(banner, /activeQuestionRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/)
  assert.doesNotMatch(banner, /import GuidedConversation|<GuidedConversation/)
})
