import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildVirtualStagingCampaignPackage } from '../src/components/campaign/buildVirtualStagingCampaignPackage.js'

const source = readFileSync(new URL('../src/pages/VirtualStaging.jsx', import.meta.url), 'utf8')
const property = { purpose: 'sale', type: 'Apartamento', city: 'Florianópolis', state: 'SC', bedrooms: '2', suites: '1', parkingSpaces: '1', highlights: [] }

test('professional identity is publication text only for Smart Space', () => {
  const campaign = buildVirtualStagingCampaignPackage({ property, language: 'pt-BR', cta: 'Agende sua visita', phone: '', professionalIdentity: 'Ana Silva · CRECI-F 123/SC', journeyId: 'life-in-property' })
  assert.match(campaign.aiCampaigns[0].instagram, /Ana Silva · CRECI-F 123\/SC/)
  assert.match(source, /professionalIdentity: professionalIdentitySelection\.enabled === true/)
  const requestBody = source.match(/const requestBody = \{[^\n]+\}/)?.[0] || ''
  assert.doesNotMatch(requestBody, /professionalIdentity|professional_identity|CRECI|license/i)
  assert.match(source, /never\s*\n?\s*\/\/ receive professional identity/i)
})

test('disabled identity does not appear in publication copy', () => {
  const campaign = buildVirtualStagingCampaignPackage({ property, language: 'en-US', cta: 'Schedule a visit', phone: '', professionalIdentity: '', journeyId: 'broker-presentation' })
  assert.doesNotMatch(campaign.aiCampaigns.map(item => item.instagram).join('\n'), /License|CRECI/i)
})
