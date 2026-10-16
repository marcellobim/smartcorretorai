import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { buildGoogleAdsDelivery } from '../../supabase/functions/_shared/google-ads.ts'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const landing = readFileSync(path.join(frontendRoot, 'src/pages/LandingPage.jsx'), 'utf8')
let vite
let buildCampaignPackage
let buildSmartTourCampaignPackage

before(async () => {
  vite = await createServer({ root: frontendRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  ;[{ buildCampaignPackage }, { buildSmartTourCampaignPackage }] = await Promise.all([
    vite.ssrLoadModule('/src/components/campaign/buildCampaignPackage.js'),
    vite.ssrLoadModule('/src/components/campaign/buildSmartTourCampaignPackage.js'),
  ])
})

after(async () => {
  await vite?.close()
})

const usBanner = {
  language: 'en-US',
  mediaType: 'images',
  purpose: 'sale',
  propertyType: 'us_condo',
  district: 'Downtown',
  city: 'Tampa',
  state: 'FL',
  bedrooms: '2',
  suites: '1',
  parkingSpaces: '1',
  area: '990',
  cta: 'Schedule a tour',
  existingTexts: [
    { id: 'social-1', label: 'Instagram/Facebook Commercial', text: 'Condominium for sale in Downtown, Tampa. #RealEstate #SmartCorretorAI' },
    { id: 'social-2', label: 'Instagram/Facebook Lifestyle', text: 'Discover this Tampa home. #ForSale' },
    { id: 'social-3', label: 'Instagram/Facebook Direct', text: 'Schedule a tour. #TampaRealEstate' },
  ],
}

test('shared CampaignPackage fallback makes US WhatsApp and email English and replaces its legacy brand tag', () => {
  const campaign = buildCampaignPackage(usBanner)
  const whatsapp = campaign.modules.find(module => module.id === 'whatsapp')?.text || ''
  const email = campaign.modules.find(module => module.id === 'email')?.fields?.map(field => field.text).join('\n') || ''
  const hashtags = campaign.modules.find(module => module.id === 'hashtags')?.text || ''

  assert.match(whatsapp, /Hi! I hope you are well\./)
  assert.match(whatsapp, /2 bedrooms, 1 bathroom, 1 parking space and 990 sqft/i)
  assert.match(email, /Hello,/)
  assert.doesNotMatch(`${whatsapp}\n${email}`, /Olá|Quero apresentar|dormitório|suíte|vaga|m²/i)
  assert.match(hashtags, /#SNETIA/)
  assert.doesNotMatch(hashtags, /#SmartCorretorAI/i)
})

test('US shared Google Ads copy stays in English and uses confirmed property facts only', () => {
  const googleAds = buildGoogleAdsDelivery({
    purpose: 'sale', propertyType: 'us_condo', district: 'Downtown', city: 'Tampa', state: 'FL',
    bedrooms: '2', suites: '1', highlights: [], cta: 'Schedule a tour', language: 'en-US',
  })
  const combined = JSON.stringify(googleAds)
  assert.match(combined, /Condominium|condominium/i)
  assert.match(combined, /bedroom|bathroom/i)
  assert.doesNotMatch(combined, /dormitório|suíte|venda|imóvel/i)
})

test('Real Estate Video passes its active language to shared hashtags and Google Ads', () => {
  const campaign = buildSmartTourCampaignPackage({
    property: { purpose: 'sale', type: 'Apartamento', district: 'Downtown', city: 'Tampa', state: 'FL', bedrooms: '2', suites: '1', parkingSpaces: '1', area: '990', highlights: [], description: '' },
    language: 'en-US', cta: 'Schedule a tour', phone: '', hashtags: [],
  })
  const combined = JSON.stringify(campaign)
  assert.match(combined, /#RealEstate|#PropertyForSale|#ApartmentForSale/)
  assert.match(combined, /bathrooms|bathroom/i)
  assert.doesNotMatch(combined, /#SmartCorretorAI|dormitório|suíte|m²/i)
})

test('Landing switches the Real Estate Banner carousel assets by market without replacing BR media', () => {
  assert.match(landing, /IMAGE_SHOWCASE_EXAMPLES = \(market = 'BR'\)/)
  assert.match(landing, /market === 'US' \? \[/)
  assert.match(landing, /useEffect\(\(\) => setExampleIndex\(0\), \[market, item\.id\]\)/)
  assert.match(landing, /showcase\/hero\/hero-18semimagem\.jpg/)
  for (let index = 1; index <= 6; index += 1) {
    const name = `snetia-us-banner-${String(index).padStart(2, '0')}.jpg`
    assert.match(landing, new RegExp(name))
    assert.equal(existsSync(path.join(frontendRoot, 'public/landing/banners/us', name)), true, name)
  }
})
