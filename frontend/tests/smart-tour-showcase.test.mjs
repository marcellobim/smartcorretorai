import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')

test('Real Estate Video preserves the photo-first guided conversation and final review', () => {
  assert.match(page, /activeInputFlow.*\|\| 'images'/)
  assert.match(page, /<GuidedConversation/)
  assert.match(page, /review=\{question\[0\] === 'review'\}/)
  assert.match(page, /onEdit=\{editConversationAnswer\}/)
})
