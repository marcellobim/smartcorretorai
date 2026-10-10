import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const frontend = read('../src/pages/HeroNext.jsx')
const renderer = read('../../supabase/functions/gerar-hero-ia/index.ts')
const quickBanners = read('../src/pages/NovaCampanha.jsx')

test('passes a chosen professional identity from Banner Imobiliário into the renderer contract', () => {
  assert.match(frontend, /show_professional_identity: showProfessionalIdentity === true/)
  assert.match(frontend, /professional_identity: showProfessionalIdentity === true \? professionalIdentitySelection : \{ enabled: false \}/)
  assert.match(renderer, /resolveProfessionalIdentity\(profile, selected as JsonRecord, payload\.market === 'US' \? 'US' : 'BR'\)/)
  assert.match(renderer, /show_professional_identity: payload\.show_professional_identity === true/)
  assert.match(renderer, /professional_identity: payload\.show_professional_identity === true \? normalizeProfessionalIdentity\(payload\.professional_identity\) : ''/)
  assert.match(renderer, /IDENTIFICACAO PROFISSIONAL OBRIGATORIA NA ARTE: \$\{professionalIdentity\}/)
  assert.match(renderer, /Renderize essa identificacao exatamente uma vez/)
})

test('renders neither identity nor credentials when the choice is false or unsafe', () => {
  assert.match(renderer, /choices\.show_professional_identity === true\s*\?\s*normalizeProfessionalIdentity\(choices\.professional_identity\)\s*:\s*''/)
  assert.match(renderer, /!professionalIdentity \? 'Nao exiba identificacao profissional, CRECI, license ou dados profissionais no rodape\.'/)
  assert.match(renderer, /hasBrazilianCredential.*CRECI[\s\S]*hasUsCredential.*License/s)
})

test('uses the same single-piece renderer for every active Banner format without changing Quick Banners', () => {
  assert.match(renderer, /function buildHeroNextSinglePiecePrompt/)
  assert.match(renderer, /formatStrategy\.compositionInstruction/)
  assert.match(renderer, /getExperimentalImageSize/)
  assert.doesNotMatch(quickBanners, /professional_identity|showProfessionalIdentity/)
})

test('keeps the choice in the Banner draft and recovery-compatible generation briefing', () => {
  assert.match(frontend, /restoredBannerDraft\.showProfessionalIdentity/)
  assert.match(frontend, /const draft = \{ phase, goal, answers, showProfessionalIdentity/)
  assert.match(renderer, /sanitizePromptBriefingForStorage\(\{[\s\S]*promptBriefing/)
})
