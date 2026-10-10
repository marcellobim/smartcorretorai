import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildProfessionalIdentity } from '../src/config/professionalProfile.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const carousel = readFileSync(path.join(root, 'src/pages/SmartCarrossel.jsx'), 'utf8')
const request = readFileSync(path.join(root, 'src/lib/smart-carousel-request.js'), 'utf8')
const renderer = readFileSync(path.join(root, '../supabase/functions/smart-carousel-creatomate/index.ts'), 'utf8')

test('Smart Carousel persists the explicit professional identity selection and sends only that contract', () => {
  assert.match(carousel, /professionalIdentity: professionalIdentitySelection/)
  assert.match(request, /professionalIdentity\?\.enabled === true && \(professionalIdentity\.credential_source === 'br_creci'/)
  assert.match(request, /name_source: professionalIdentity\.name_source/)
  assert.match(carousel, /<ProfessionalIdentityQuestion/)
  assert.match(carousel, /flowDraft\.clear\(\)/)
})

test('Smart Carousel resolves BR and US identities by the chosen name source, or sends none when disabled', () => {
  const brProfile = { nome: 'Ana Legal', display_name: 'Ana Prime', creci: '12345', creci_type: 'F', estado: 'SP' }
  const usProfile = { nome: 'Alex Legal', display_name: 'Alex Homes', license_number: 'LIC-77', license_state: 'FL' }
  assert.equal(buildProfessionalIdentity(brProfile, { enabled: false }, 'BR'), null)
  assert.equal(buildProfessionalIdentity(brProfile, { enabled: true, name_source: 'real', credential_source: 'br_creci' }, 'US').formatted, 'Ana Legal · CRECI-F 12345/SP')
  assert.equal(buildProfessionalIdentity(brProfile, { enabled: true, name_source: 'display', credential_source: 'br_creci' }, 'BR').formatted, 'Ana Prime · CRECI-F 12345/SP')
  assert.equal(buildProfessionalIdentity(usProfile, { enabled: false }, 'US'), null)
  assert.equal(buildProfessionalIdentity(usProfile, { enabled: true, name_source: 'real', credential_source: 'us_license' }, 'BR').formatted, 'Alex Legal · License #LIC-77 · FL')
  assert.equal(buildProfessionalIdentity(usProfile, { enabled: true, name_source: 'display', credential_source: 'us_license' }, 'US').formatted, 'Alex Homes · License #LIC-77 · FL')
})

test('Smart Carousel backend validates the structured contract, resolves from profile, and uses it only in final CTA and captions', () => {
  assert.match(renderer, /resolveProfessionalIdentity\(profile, professionalIdentitySelection, locale\.market\)/)
  assert.match(renderer, /Identificação profissional inválida/)
  assert.match(renderer, /buildProfessionalIdentityRenderElement\(professionalIdentity, ctaTime, Boolean\(phone\)\)/)
  assert.match(renderer, /appendProfessionalIdentity\(campaign\.instagram\)/)
  const marketingInvocation = renderer.slice(renderer.indexOf('const intelligence = await generateMarketingIntelligence('), renderer.indexOf('const voice = selectNarrationVoice'))
  assert.doesNotMatch(marketingInvocation, /professionalIdentity/)
  assert.match(renderer, /creci, creci_type, estado, license_number, license_state/)
})
