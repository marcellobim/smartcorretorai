import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const editor = fs.readFileSync(new URL('../src/components/campaign/SocialCaptionEditor.jsx', import.meta.url), 'utf8')
const dialog = fs.readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../src/pages/VirtualStaging.jsx', import.meta.url), 'utf8')

test('modal compartilhado expõe a legenda opcional e bloqueia edição após iniciar', () => {
  assert.match(editor, /TEXTO DA PUBLICAÇÃO \(OPCIONAL\)/)
  assert.match(editor, /Array\.from/)
  assert.match(editor, /SOCIAL_CAPTION_MAX_LENGTH = 2200/)
  assert.match(dialog, /captionEditable \? \{ \.\.\.intent, captionSnapshot: caption \} : intent/)
  assert.match(dialog, /disabled=\{submissionLocked\}/)
})

test('Smart Space começa vazio com o placeholder aprovado', () => {
  assert.match(page, /captionEditable/)
  assert.match(page, /captionPlaceholder/)
  assert.match(page, /onConfirmed/)
})

test('o mesmo modal compartilhado atende Smart Space, Vida no Imóvel e Apresentação pelo Corretor', () => {
  assert.match(page, /smart_space_life/)
  assert.match(page, /smart_space_broker/)
  assert.match(page, /smartSpacePublish=\{smartSpacePublication\}/)
})
