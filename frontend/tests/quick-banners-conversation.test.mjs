import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const quickBanners = readFileSync(path.join(frontendRoot, 'src/pages/NovaCampanha.jsx'), 'utf8')
const conversation = quickBanners.slice(
  quickBanners.indexOf('function BannerConversation({'),
  quickBanners.indexOf('\nfunction Counter(', quickBanners.indexOf('function BannerConversation({')),
)

test('Banners Rápidos uses only the shared visual conversation primitives', () => {
  assert.match(quickBanners, /import \{ ProductCard \} from '\.\.\/components\/design-system'/)
  for (const component of [
    'ConversationHeader',
    'ConversationAssistantBubble',
    'ConversationUserBubble',
    'ConversationQuestionCard',
  ]) {
    assert.match(quickBanners, new RegExp(component))
  }
  assert.match(conversation, /<ProductCard data-smart-conversation className="overflow-hidden">/)
  assert.match(conversation, /<ConversationHeader eyebrow="Etapa 2" title="Converse com a IA"/)
  assert.match(conversation, /<ConversationAssistantBubble>/)
  assert.match(conversation, /<ConversationUserBubble actions=/)
  assert.match(conversation, /<ConversationAssistantBubble confirmation>/)
  assert.match(conversation, /<ConversationQuestionCard/)
})

test('question sequencing and typewriter readiness remain connected to the existing flow', () => {
  assert.match(conversation, /const questionReady = readyStep === step/)
  assert.match(conversation, /const nextStep = sequence\[Math\.min\(activeIndex \+ 1, sequence\.length - 1\)\]/)
  assert.match(conversation, /const advance = \(callback\) => \{[\s\S]*?callback\?\.\(\)[\s\S]*?onStepChange\(nextStep\)/)
  assert.match(conversation, /const finishConversation = \(\) => \{[\s\S]*?onContinue\(\)/)
  assert.match(conversation, /questionLabels\[step\] \|\| questionLabels\.done/)
  assert.match(conversation, /onComplete=\{handleQuestionComplete\}/)
  assert.match(conversation, /\{questionReady && <div className="animate-fade-in motion-reduce:animate-none">\{questionContent\}<\/div>\}/)
})

test('editing, history and summary preserve their original callbacks and content', () => {
  assert.match(conversation, /history\.map\(item =>[\s\S]*?\{item\.question\}[\s\S]*?\{item\.answer\}[\s\S]*?\{item\.confirmation\}/)
  assert.match(conversation, /aria-label=\{`Editar \$\{item\.question\}`\}[\s\S]*?onClick=\{\(\) => editStep\(item\.key\)\}/)
  assert.match(conversation, /Resumo da campanha/)
  assert.match(conversation, /summaryItems\.map\(item =>/)
  assert.match(conversation, /onClick=\{item\.edit \|\| \(\(\) => editStep\(item\.step\)\)\}/)
  assert.match(conversation, /onClick=\{finishConversation\}[\s\S]*?Continuar para as imagens/)
})

test('live region and disabled states remain exposed during the conversation', () => {
  assert.match(conversation, /aria-live="polite"/)
  assert.match(conversation, /aria-busy=\{!questionReady\}/)
  assert.match(conversation, /disabled=\{!questionReady\}/)
  assert.match(conversation, /interactionGuardRef\.current = !questionReady/)
})

test('isolated test uses only Node.js built-ins', () => {
  const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const imports = ownSource.match(/^import .*$/gm) || []
  assert.ok(imports.length > 0)
  assert.ok(imports.every(line => line.includes("from 'node:")))
})
