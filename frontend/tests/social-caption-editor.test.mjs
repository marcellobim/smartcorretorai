import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const editor = fs.readFileSync(new URL('../src/components/campaign/SocialCaptionEditor.jsx', import.meta.url), 'utf8')
const dialog = fs.readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../src/pages/VirtualStaging.jsx', import.meta.url), 'utf8')
const campaignPackage = fs.readFileSync(new URL('../src/components/campaign/CampaignPackage.jsx', import.meta.url), 'utf8')
const heroNext = fs.readFileSync(new URL('../src/pages/HeroNext.jsx', import.meta.url), 'utf8')
const smartTour = fs.readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')
const studioHero = fs.readFileSync(new URL('../src/pages/StudioHero.jsx', import.meta.url), 'utf8')
const smartCarousel = fs.readFileSync(new URL('../src/pages/SmartCarrossel.jsx', import.meta.url), 'utf8')
const quickBanners = fs.readFileSync(new URL('../src/pages/NovaCampanha.jsx', import.meta.url), 'utf8')
const textCampaign = fs.readFileSync(new URL('../src/pages/TextCampaign.jsx', import.meta.url), 'utf8')

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

test('os cinco produtos adicionais habilitam exatamente o mesmo editor compartilhado', () => {
  assert.match(campaignPackage, /bannerPublish\?\.captionEditable === true/)
  assert.match(campaignPackage, /videoPublish\?\.captionEditable === true/)
  assert.match(campaignPackage, /studioPublish\?\.captionEditable === true/)
  assert.match(heroNext, /bannerPublish=\{\{[\s\S]*?captionEditable: true/)
  assert.match(smartTour, /videoPublish=\{!isShortVideoResult[\s\S]*?captionEditable\s*:\s*true/)
  assert.match(studioHero, /const studioPublish = [\s\S]*?captionEditable\s*:\s*true/)
  assert.ok((smartCarousel.match(/captionEditable: true/g) || []).length >= 2)
})

test('Short Videos e produtos fora do escopo continuam sem editor', () => {
  assert.match(smartTour, /videoPublish=\{!isShortVideoResult/)
  assert.doesNotMatch(quickBanners, /captionEditable/)
  assert.doesNotMatch(textCampaign, /captionEditable/)
})
