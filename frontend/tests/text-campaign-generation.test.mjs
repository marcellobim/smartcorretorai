import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => readFileSync(path.join(frontendRoot, relative), 'utf8')
const page = read('src/pages/TextCampaign.jsx')
const resultComponent = read('src/components/text-campaign/TextCampaignResult.jsx')
const resultHelperSource = read('src/lib/text-campaign-result.js')
let vite
let config
let resultHelpers

before(async () => {
  vite = await createServer({ root: frontendRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  ;[config, resultHelpers] = await Promise.all([
    vite.ssrLoadModule('/src/config/textCampaign.js'),
    vite.ssrLoadModule('/src/lib/text-campaign-result.js'),
  ])
})

after(async () => vite?.close())

const result = () => ({
  listing_title: 'Título', portal_description: 'Portal', short_listing: 'Curto', instagram_commercial: 'Instagram comercial', instagram_emotional: 'Instagram emocional', instagram_opportunity: 'Instagram oportunidade',
  facebook_commercial: 'Facebook comercial', facebook_emotional: 'Facebook emocional', facebook_opportunity: 'Facebook oportunidade',
  whatsapp_individual: 'WhatsApp individual', whatsapp_list: 'WhatsApp lista', whatsapp_short: 'WhatsApp curto', email: { subject: 'Assunto', body: 'Corpo' }, linkedin: { applicable: false, text: null, reason: 'Contexto não adequado.' },
  cta: 'Agende sua visita', hashtags: ['#A', '#B', '#C', '#D', '#E', '#F', '#SmartCorretorAI', '#G', '#H', '#I', '#J', '#K'], reels_script: 'Roteiro', text_carousel: { slides: [1, 2, 3, 4, 5].map(number => ({ title: `Slide ${number}`, text: `Texto ${number}` })) },
  google_ads: { headlines: ['Apartamento no Centro', '3 dormitórios'], long_headline: 'Apartamento de 3 dormitórios pronto para morar no Centro', descriptions: ['Conheça este apartamento no Centro.', 'Agende sua visita.'], cta: 'Agende sua visita', suggested_keywords: ['apartamento à venda centro', 'apartamento 3 dormitórios centro', 'comprar apartamento centro'] },
})

const validBriefing = () => config.buildTextCampaignBriefing({
  ...config.createEmptyTextCampaignAnswers(), purpose: 'sale', stage: 'Pronto para morar', type: 'Apartamento', bedrooms: '3', suites: '1', parkingSpaces: '2', area: '100', state: 'SP', city: 'São Paulo', district: 'Centro', saleValueMode: 'price', salePriceMode: 'fixed', salePrice: '500000', cta: 'Agende sua visita', includeProfessionalPhone: 'no',
})

test('enables generation only for a complete valid briefing', () => {
  assert.equal(config.isTextCampaignBriefingValid(validBriefing()), true)
  assert.equal(config.isTextCampaignBriefingValid({ ...validBriefing(), city: '' }), false)
  assert.equal(config.isTextCampaignBriefingValid({ ...validBriefing(), highlights: Array(16).fill('x') }), false)
  assert.match(page, /disabled=\{!briefingValid \|\| loading\}/)
})

test('uses a synchronous double-click lock and a single authenticated Edge Function call', () => {
  assert.match(page, /if \(generationLockRef\.current \|\| !briefingValid\) return/)
  assert.match(page, /generationLockRef\.current = true/)
  assert.match(page, /finally \{[\s\S]*?generationLockRef\.current = false/)
  assert.match(page, /supabase\.functions\.invoke\('generate-text-campaign',[\s\S]*?body: \{ briefing, language: locale, market, client_request_id: generationRequestRef\.current \}/)
  assert.doesNotMatch(page, /model: ['"]gpt|provider:|system_prompt:/)
})

test('builds BR and US briefing payloads with explicit language and market', () => {
  const br = validBriefing()
  assert.equal(br.language, 'pt-BR')
  assert.equal(br.market, 'BR')
  const us = config.buildTextCampaignBriefing({
    ...config.createEmptyTextCampaignAnswers(), purpose: 'sale', stage: 'Pronto para morar', type: 'us_condo', bedrooms: '2', bathrooms: '2', parkingSpaces: '1', area: '900',
    state: 'FL', county: 'Miami-Dade', city: 'Miami', zipCode: '', neighborhoodCommunity: 'Downtown', saleValueMode: 'hidden', cta: 'Agende sua visita', includeProfessionalPhone: 'no',
  }, '', { language: 'en-US', market: 'US' })
  assert.equal(us.language, 'en-US')
  assert.equal(us.market, 'US')
  assert.deepEqual({ state: us.state, county: us.county, city: us.city, zip_code: us.zip_code, neighborhood_community: us.neighborhood_community, bathrooms: us.bathrooms, suites: us.suites, area_unit: us.area_unit }, { state: 'FL', county: 'Miami-Dade', city: 'Miami', zip_code: '', neighborhood_community: 'Downtown', bathrooms: '2', suites: '', area_unit: 'sqft' })
  assert.equal(config.isTextCampaignBriefingValid(us), true)
})

test('keeps US bathrooms and ZIP optional while excluding Brazilian commercial options', () => {
  const us = config.buildTextCampaignBriefing({
    ...config.createEmptyTextCampaignAnswers(), purpose: 'sale', stage: 'Pronto para morar', type: 'us_condo', bedrooms: '2', bathrooms: '2', parkingSpaces: '1', area: '900',
    state: 'FL', county: 'Miami-Dade', city: 'Miami', zipCode: '', saleValueMode: 'conditions', saleConditions: ['Special terms available'], cta: 'Agende sua visita', includeProfessionalPhone: 'no',
  }, '', { language: 'en-US', market: 'US' })
  assert.equal(config.isTextCampaignBriefingValid(us), true)
  assert.equal(config.isTextCampaignBriefingValid({ ...us, zip_code: 'invalid' }), false)
  assert.deepEqual(config.getTextCampaignMeasureFields('us_condo', 'US'), ['bedrooms', 'bathrooms', 'parkingSpaces', 'area'])
  assert.ok(!config.getTextCampaignSaleConditions('US').includes('Usa FGTS'))
  assert.match(page, /getUsCitiesByCounty/)
  assert.match(page, /ZIP Code \(optional\)/)
  assert.match(page, /Loading cities…/)
  assert.match(page, /No cities were found for this county\./)
  assert.match(page, /Try again/)
  assert.match(page, /formatTextCampaignCurrencyForMarket/)
})

test('keeps the localized multichannel hero and removes only the intermediate sidebar summary', () => {
  assert.match(page, /visual=\{<DeliverablesPreview copy=\{copy\} locale=\{locale\} \/>\}/)
  assert.match(page, /showSummary=\{false\}/)
  assert.match(page, /Question \$\{number\} of \$\{total\}/)
  assert.match(page, /Final review/)
  assert.doesNotMatch(page, /summaryItems=\{summaryItems\}/)
  assert.equal(config.getTextCampaignDeliverableLabel('listing_title', 'pt-BR'), 'Título do anúncio')
  assert.equal(config.getTextCampaignDeliverableLabel('portal_description', 'pt-BR'), 'Descrição completa para portal')
  assert.equal(config.getTextCampaignDeliverableLabel('listing_title', 'en-US'), 'Listing title')
  assert.equal(config.getTextCampaignDeliverableLabel('portal_description', 'en-US'), 'Full portal description')
  assert.equal(config.getTextCampaignDeliverableLabel('instagram_commercial', 'en-US'), 'Instagram — commercial')
})

test('exposes loading, disabled and aria-busy states', () => {
  assert.match(page, /setGenerationStatus\('loading'\)/)
  assert.match(page, /loading=\{loading\}/)
  assert.match(page, /aria-busy=\{busy \|\| loading\}/)
})

test('preserves briefing on errors and offers manual review and retry', () => {
  const generationBlock = page.slice(page.indexOf('const generateCampaign'), page.indexOf('const createNewCampaign'))
  assert.match(generationBlock, /setGenerationError/)
  assert.doesNotMatch(generationBlock, /setAnswers|resetConversation/)
  assert.match(page, /\{copy\.retry\}/)
  assert.match(page, /\{copy\.backToReview\}/)
  assert.match(page, /onRetry=\{generateCampaign\}/)
})

test('renders the 18 preserved blocks plus Google Ads as the final group', () => {
  const ids = resultHelpers.TEXT_CAMPAIGN_RESULT_GROUPS.flatMap(group => group.pieces)
  assert.equal(ids.length, 19)
  assert.equal(new Set(ids).size, 19)
  assert.deepEqual(resultHelpers.TEXT_CAMPAIGN_RESULT_GROUPS.map(group => group.title), ['Anúncio', 'Instagram', 'Facebook', 'WhatsApp', 'E-mail e LinkedIn', 'Conteúdo extra', 'Google Ads'])
  assert.deepEqual(ids.slice(0, 18), ['listing_title', 'portal_description', 'short_listing', 'instagram_commercial', 'instagram_emotional', 'instagram_opportunity', 'facebook_commercial', 'facebook_emotional', 'facebook_opportunity', 'whatsapp_individual', 'whatsapp_list', 'whatsapp_short', 'email', 'linkedin', 'cta', 'hashtags', 'reels_script', 'text_carousel'])
  assert.equal(ids.at(-1), 'google_ads')
  assert.deepEqual(resultHelpers.TEXT_CAMPAIGN_RESULT_GROUPS.find(group => group.id === 'instagram').pieces, ['instagram_commercial', 'instagram_emotional', 'instagram_opportunity'])
  assert.deepEqual(resultHelpers.TEXT_CAMPAIGN_RESULT_GROUPS.find(group => group.id === 'facebook').pieces, ['facebook_commercial', 'facebook_emotional', 'facebook_opportunity'])
  assert.deepEqual(resultHelpers.TEXT_CAMPAIGN_RESULT_GROUPS.find(group => group.id === 'whatsapp').pieces, ['whatsapp_individual', 'whatsapp_list', 'whatsapp_short'])
  assert.match(resultComponent, /group\.pieces\.map/)
  assert.equal(resultHelpers.isCompleteTextCampaignResult(result()), true)
})

test('formats individual pieces including email, LinkedIn, hashtags, five slides and Google Ads', () => {
  assert.match(resultHelpers.formatTextCampaignPiece(result(), 'email'), /Assunto: Assunto[\s\S]*Corpo/)
  assert.match(resultHelpers.formatTextCampaignPiece(result(), 'linkedin'), /^Não aplicável:/)
  assert.match(resultHelpers.formatTextCampaignPiece(result(), 'hashtags'), /#SmartCorretorAI/)
  assert.equal((resultHelpers.formatTextCampaignPiece(result(), 'text_carousel').match(/Slide \d —/g) || []).length, 5)
  const googleAds = resultHelpers.formatTextCampaignPiece(result(), 'google_ads')
  assert.match(googleAds, /Títulos:[\s\S]*Apartamento no Centro/)
  assert.match(googleAds, /Título longo:[\s\S]*Apartamento de 3 dormitórios/)
  assert.match(googleAds, /Descrições:[\s\S]*Conheça este apartamento/)
  assert.match(googleAds, /CTA sugerido:[\s\S]*Agende sua visita/)
  assert.match(googleAds, /Palavras-chave sugeridas:[\s\S]*apartamento à venda centro/)
})

test('copies individual pieces and the complete campaign', async () => {
  const calls = []
  assert.equal(await resultHelpers.copyTextCampaignValue('texto', { navigatorRef: { clipboard: { writeText: async value => calls.push(value) } } }), 'clipboard')
  assert.deepEqual(calls, ['texto'])
  const complete = resultHelpers.formatCompleteTextCampaign(result())
  assert.match(complete, /TÍTULO DO ANÚNCIO/)
  assert.match(complete, /INSTAGRAM — COMERCIAL/)
  assert.match(complete, /FACEBOOK — COMERCIAL/)
  assert.doesNotMatch(complete, /LINKEDIN/)
  assert.match(complete, /CARROSSEL TEXTUAL — 5 SLIDES/)
  assert.match(complete, /GOOGLE ADS[\s\S]*Títulos:[\s\S]*Palavras-chave sugeridas:/)
  const orderedHeadings = ['TÍTULO DO ANÚNCIO', 'INSTAGRAM — COMERCIAL', 'FACEBOOK — COMERCIAL', 'WHATSAPP INDIVIDUAL', 'E-MAIL', 'CTA', 'HASHTAGS ESTRATÉGICAS', 'ROTEIRO PARA REELS', 'CARROSSEL TEXTUAL — 5 SLIDES', 'GOOGLE ADS']
  assert.ok(orderedHeadings.every((heading, index) => index === 0 || complete.indexOf(orderedHeadings[index - 1]) < complete.indexOf(heading)))
  const applicableLinkedIn = { ...result(), linkedin: { applicable: true, text: 'LinkedIn aplicável', reason: '' } }
  assert.match(resultHelpers.formatCompleteTextCampaign(applicableLinkedIn), /LINKEDIN[\s\S]*LinkedIn aplicável/)
  assert.match(resultComponent, /formatCompleteTextCampaign\(editableCampaign, locale\)[\s\S]*text\/plain;charset=utf-8/)
  assert.match(resultComponent, /download: 'campanha-de-textos\.txt'/)
  assert.match(resultComponent, /\{copy\.download\}/)
  assert.match(resultComponent, /onClick=\{\(\) => copyValue\(id, content\)\}/)
  assert.match(resultComponent, /useState\(\(\) => structuredClone\(campaign\)\)/)
  assert.match(resultComponent, /textarea aria-label=\{label\}/)
  assert.match(resultComponent, /campaign\.text_carousel\.slides\.map/)
  assert.match(resultComponent, /campaign\.google_ads\.headlines\.join/)
})

test('formats US result controls without translating the generated campaign text', () => {
  const usPiece = resultHelpers.formatTextCampaignPiece(result(), 'email', 'en-US')
  assert.match(usPiece, /^Subject: Assunto[\s\S]*Corpo/)
  const complete = resultHelpers.formatCompleteTextCampaign(result(), 'en-US')
  assert.match(complete, /LISTING TITLE/)
  assert.match(complete, /STRATEGIC HASHTAGS/)
  assert.match(complete, /GOOGLE ADS[\s\S]*Headlines:[\s\S]*Suggested keywords:/)
  assert.doesNotMatch(complete, /TÍTULO DO ANÚNCIO|PALAVRAS-CHAVE SUGERIDAS/)
})

test('uses a deterministic clipboard fallback without intrusive alerts', async () => {
  let appended
  const textarea = { value: '', style: {}, setAttribute() {}, select() {}, remove() {} }
  const documentRef = { body: { appendChild(node) { appended = node } }, createElement: () => textarea, execCommand: command => command === 'copy' }
  assert.equal(await resultHelpers.copyTextCampaignValue('fallback', { navigatorRef: {}, documentRef }), 'fallback')
  assert.equal(appended.value, 'fallback')
  assert.doesNotMatch(resultComponent, /alert\(/)
})

test('provides accessible copied feedback', () => {
  assert.match(resultComponent, /aria-live="polite"/)
  assert.match(resultComponent, /copy\.copied/)
  assert.match(resultComponent, /copiedId === 'complete'[\s\S]*?copy\.copied/)
})

test('widens only generated results and preserves responsive one/two-column layout', () => {
  assert.match(page, /campaign \? 'mx-auto w-full max-w-\[96rem\] px-smart-page py-6 sm:py-8' : SMART_UI\.page/)
  assert.match(resultComponent, /grid gap-4 lg:grid-cols-2/)
  assert.match(resultComponent, /min-w-0 p-5 sm:p-6/)
  assert.match(resultComponent, /resize-y rounded-xl border/)
})

test('clears generated text and restarts the briefing for a new campaign', () => {
  const resetBlock = page.slice(page.indexOf('const createNewCampaign'), page.indexOf('return <div'))
  assert.match(resetBlock, /setCampaign\(null\)/)
  assert.match(resetBlock, /setAnswers\(createEmptyTextCampaignAnswers\(\)\)/)
  assert.match(resetBlock, /conversation\.resetConversation\(\)/)
  assert.match(resultComponent, /\{copy\.newCampaign\}/)
})

test('keeps result data server-side and persists only an opaque completed-delivery id for recovery', () => {
  const combined = `${page}\n${resultComponent}\n${resultHelperSource}`
  assert.match(page, /sessionStorage\.getItem\(TEXT_CAMPAIGN_REQUEST_STORAGE_KEY\)/)
  assert.match(page, /sessionStorage\.setItem\(TEXT_CAMPAIGN_REQUEST_STORAGE_KEY, created\)/)
  assert.match(page, /sessionStorage\.removeItem\(TEXT_CAMPAIGN_REQUEST_STORAGE_KEY\)/)
  assert.match(page, /textDraft\.replace\(\{ completedRequestId: generationRequestRef\.current \}\)/)
  assert.match(page, /body: \{ client_request_id: clientRequestId, recovery: true \}/)
  assert.doesNotMatch(combined, /localStorage|indexedDB|storage\.from|\.insert\(|\.upsert\(/)
  assert.doesNotMatch(page, /sessionStorage\.setItem\([^,]+,\s*(briefing|campaign|answers)/)
  assert.doesNotMatch(combined, /Smart Tokens|smart_tokens|token_balance/i)
  assert.doesNotMatch(combined, /histórico|galeria/i)
})
