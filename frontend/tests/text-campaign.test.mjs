import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => readFileSync(path.join(frontendRoot, relative), 'utf8')
const page = read('src/pages/TextCampaign.jsx')
const app = read('src/App.jsx')
const dashboard = read('src/pages/Dashboard.jsx')
const layout = read('src/components/layout/AppLayout.jsx')
const guidedConversation = read('src/components/conversation/GuidedConversation.jsx')
let vite
let config
let conversation

before(async () => {
  vite = await createServer({ root: frontendRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  config = await vite.ssrLoadModule('/src/config/textCampaign.js')
  conversation = await vite.ssrLoadModule('/src/config/textCampaignConversation.js')
})

after(async () => vite?.close())

test('registers a private Campanha de Textos product and localized hero', () => {
  assert.match(app, /import TextCampaign from '.\/pages\/TextCampaign'/)
  assert.match(app, /path="\/campanha-de-textos" element=\{<AccountAnalyticsRoute productId=\{PRODUCTS\.CAMPANHA_TEXTOS\}><TextCampaign \/><\/AccountAnalyticsRoute>\}/)
  assert.match(dashboard, /id: 'campanha-de-textos',[\s\S]*?title: t\('dashboard\.textCampaign\.title'\),[\s\S]*?to: '\/campanha-de-textos'/)
  assert.match(layout, /location\.pathname === '\/campanha-de-textos'/)
  assert.match(page, /<ProductHero[\s\S]*?productName=\{copy\.productName\}/)
  assert.match(page, /const \{ locale, market \} = useLocale\(\)/)
})

test('defines exactly five approved visual steps', () => {
  assert.deepEqual(config.TEXT_CAMPAIGN_STEPS.map(item => item.title), [
    'Objetivo', 'Imóvel', 'Localização', 'Diferenciais e condições', 'Revisão e criação',
  ])
  assert.match(page, /<ProductSteps/)
})

test('supports localized sale and rent labels with stable internal values', () => {
  assert.match(page, /\{ id: 'sale', label: locale === 'en-US' \? 'For sale' : 'Venda' \}/)
  assert.match(page, /\{ id: 'rent', label: locale === 'en-US' \? 'For rent' : 'Locação' \}/)
  assert.match(page, /purpose: option\.id/)
})

test('keeps the approved sale and rental stage rules', () => {
  assert.deepEqual(config.getTextCampaignStageOptions('sale'), ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar'])
  assert.deepEqual(config.getTextCampaignStageOptions('rent'), ['Pronto para morar', 'Disponível já', 'Vago'])
})

test('removes Terreno / Lote only from rental', () => {
  assert.ok(config.getTextCampaignPropertyTypes('sale').includes('Terreno / Lote'))
  assert.ok(!config.getTextCampaignPropertyTypes('rent').includes('Terreno / Lote'))
})

test('uses type-dependent fact fields from Smart Tour', () => {
  assert.deepEqual(config.getTextCampaignMeasureFields('Apartamento'), ['bedrooms', 'suites', 'parkingSpaces', 'area'])
  assert.deepEqual(config.getTextCampaignMeasureFields('Comercial'), ['parkingSpaces', 'area'])
  assert.deepEqual(config.getTextCampaignMeasureFields('Terreno / Lote'), ['area'])
})

test('uses the shared Estado, IBGE Cidade and typed Bairro controls', () => {
  assert.match(page, /<SmartCarouselStateSelect/)
  assert.match(page, /<SmartCarouselCitySelect/)
  assert.match(page, /<SmartLocationTextInput[^>]*value=\{answers\.district\}/)
})

test('supports a manual city fallback and one effective city', () => {
  assert.equal(config.getEffectiveTextCampaignCity({ city: 'Campinas', cityOther: '' }), 'Campinas')
  assert.equal(config.getEffectiveTextCampaignCity({ city: 'Campinas', cityOther: 'santos' }), 'Santos')
  assert.match(page, /ui\(locale, 'cityNotFound'\)/)
  assert.match(page, /ariaLabel=\{locale === 'en-US' \? 'City \(manual\)' : 'Cidade manual'\}/)
})

test('clears dependent location values safely', () => {
  const initial = { state: 'SP', city: 'Campinas', cityOther: 'Santos', district: 'Centro', preserved: true }
  assert.deepEqual(config.changeTextCampaignState(initial, 'RJ'), { ...initial, state: 'RJ', city: '', cityOther: '', district: '' })
  assert.deepEqual(config.changeTextCampaignSelectedCity(initial, 'Bauru'), { ...initial, city: 'Bauru', cityOther: '', district: '' })
  assert.deepEqual(config.changeTextCampaignManualCity(initial, 'são josé'), { ...initial, city: '', cityOther: 'São José', district: '' })
})

test('keeps fixed and starting-at price in the original price contract', () => {
  assert.match(page, /\['fixed', ui\(locale, 'fixedPrice'\)\]/)
  assert.match(page, /\['starting_at', ui\(locale, 'startingAt'\)\]/)
  const briefing = config.buildTextCampaignBriefing({ ...config.createEmptyTextCampaignAnswers(), purpose: 'sale', saleValueMode: 'price', salePriceMode: 'starting_at', salePrice: '500000' })
  assert.equal(briefing.commercial.price_mode, 'starting_at')
  assert.equal(briefing.commercial.price, '500000')
  assert.deepEqual(briefing.commercial.commercial_terms, {})
})

test('supports hiding the sale price and conditions', () => {
  const briefing = config.buildTextCampaignBriefing({ ...config.createEmptyTextCampaignAnswers(), purpose: 'sale', saleValueMode: 'hidden', saleConditions: ['Usa FGTS'], commercialTerms: { entry_amount: '1' } })
  assert.equal(briefing.commercial.price, '')
  assert.deepEqual(briefing.commercial.conditions, [])
  assert.deepEqual(briefing.commercial.commercial_terms, {})
})

test('keeps commercial_terms limited to entry, monthly and annual amounts', () => {
  assert.deepEqual(Object.keys(config.EMPTY_TEXT_CAMPAIGN_COMMERCIAL_TERMS), ['entry_amount', 'monthly_amount', 'annual_amount'])
  assert.deepEqual(config.normalizeTextCampaignCommercialTerms({ entry_amount: 'R$ 10', monthly_amount: '20', annual_amount: '30', starting_price: '999' }), {
    entry_amount: '10', monthly_amount: '20', annual_amount: '30',
  })
  assert.ok(!page.includes('starting_price'))
})

test('models rent, condominium, IPTU and approved guarantees separately', () => {
  assert.match(page, /\['rentPrice', 'Aluguel'\]/)
  assert.match(page, /\['condominium', 'Condomínio'\]/)
  assert.match(page, /\['iptu', 'IPTU'\]/)
  assert.deepEqual(config.TEXT_CAMPAIGN_RENT_GUARANTEES.map(item => item.id), ['seguro_fianca', 'fiador', 'caucao', 'titulo_capitalizacao', 'a_combinar', 'nao_informar'])
})

test('allows up to 15 structured highlights from the shared catalog', () => {
  assert.equal(config.TEXT_CAMPAIGN_MAX_HIGHLIGHTS, 15)
  assert.ok(config.getTextCampaignHighlightGroups('Apartamento').flatMap(group => group.items).length > 15)
  assert.match(page, /disabledAt=\{TEXT_CAMPAIGN_MAX_HIGHLIGHTS\}/)
})

test('keeps a custom highlight in addition to structured highlights', () => {
  assert.ok(conversation.TEXT_CAMPAIGN_QUESTION_ORDER.includes('custom_highlight'))
  assert.match(page, /field="customHighlight"/)
  const briefing = config.buildTextCampaignBriefing({ ...config.createEmptyTextCampaignAnswers(), highlights: ['Piscina'], customHighlight: 'Vista histórica' })
  assert.deepEqual(briefing.highlights, ['Piscina'])
  assert.equal(briefing.custom_highlight, 'Vista histórica')
})

test('offers optional factual notes without synthesizing content', () => {
  assert.equal(conversation.TEXT_CAMPAIGN_QUESTIONS.notes, 'Tem algo importante sobre o imóvel que ainda não perguntamos?')
  assert.match(page, /field="notes"[\s\S]*?multiline/)
  assert.match(page, /Inclua somente fatos confirmados sobre o imóvel/)
})

test('requires a user-selected CTA', () => {
  assert.ok(config.TEXT_CAMPAIGN_CTA_OPTIONS.includes('Agende sua visita'))
  assert.match(page, /function CtaQuestion/)
})

test('uses only the authenticated profile phone with explicit authorization', () => {
  assert.match(page, /user\?\.whatsapp \|\| user\?\.telefone \|\| user\?\.phone/)
  assert.match(page, /disabled=\{!professionalPhone\}/)
  const briefing = config.buildTextCampaignBriefing({ ...config.createEmptyTextCampaignAnswers(), includeProfessionalPhone: 'yes' }, '11999999999')
  assert.equal(briefing.contact_authorized, true)
  assert.equal(briefing.professional_phone, '11999999999')
})

test('renders an organized final review', () => {
  for (const label of ['objective', 'property', 'location', 'details', 'features', 'terms', 'notes', 'communication']) assert.match(page, new RegExp(`ui\\(locale, '${label}'\\)`))
  assert.match(page, /<ProductSectionHeading eyebrow=\{copy\.reviewEyebrow\}/)
})

test('keeps edit actions connected to GuidedConversation', () => {
  assert.match(page, /onEdit=\{conversation\.editAnswer\}/)
  assert.match(page, /onClick=\{\(\) => onEdit\(group\.editId\)\}/)
  assert.match(page, /resetAnswerForEdit/)
})

test('enables the final action only for a valid briefing and keeps loading safe', () => {
  assert.match(page, /<ProductButton disabled=\{!briefingValid \|\| loading\} loading=\{loading\} onClick=\{onGenerate\}/)
  assert.doesNotMatch(page, /OpenAI|Smart Tokens|próxima fase|geração ainda não está conectada/i)
  assert.match(page, /supabase\.functions\.invoke\('generate-text-campaign'/)
  assert.match(page, /client_request_id: generationRequestRef\.current/)
  assert.doesNotMatch(page, /token_cost|smart_token_cost|required_tokens/)
})

test('uses campaign-specific summary copy without changing the shared default', () => {
  assert.match(page, /summaryTitle=\{copy\.summaryTitle\}/)
  assert.match(guidedConversation, /summaryTitle = 'Resumo da apresentação'/)
  assert.match(guidedConversation, /<ProductSummary title=\{summaryTitle\}/)
})

test('declares the complete multichannel contract with 18 preserved blocks plus Google Ads', () => {
  assert.equal(config.TEXT_CAMPAIGN_DELIVERABLES.length, 19)
  assert.deepEqual(config.TEXT_CAMPAIGN_DELIVERABLES.filter(item => item.id.startsWith('instagram_')).map(item => item.id), ['instagram_commercial', 'instagram_emotional', 'instagram_opportunity'])
  assert.deepEqual(config.TEXT_CAMPAIGN_DELIVERABLES.filter(item => item.id.startsWith('facebook_')).map(item => item.id), ['facebook_commercial', 'facebook_emotional', 'facebook_opportunity'])
  assert.deepEqual(config.TEXT_CAMPAIGN_DELIVERABLES.filter(item => item.id.startsWith('whatsapp_')).map(item => item.id), ['whatsapp_individual', 'whatsapp_list', 'whatsapp_short'])
  assert.deepEqual(config.TEXT_CAMPAIGN_DELIVERABLES.find(item => item.id === 'email').fields, ['subject', 'body'])
  assert.equal(config.TEXT_CAMPAIGN_DELIVERABLES.find(item => item.id === 'text_carousel').slides, 5)
  assert.equal(config.TEXT_CAMPAIGN_DELIVERABLES.find(item => item.id === 'linkedin').conditional, true)
  assert.deepEqual(config.TEXT_CAMPAIGN_DELIVERABLES.at(-1), { id: 'google_ads', label: 'Google Ads', fields: ['headlines', 'long_headline', 'descriptions', 'cta', 'suggested_keywords'] })
})

test('presents a complete multichannel campaign without a fixed piece-count promise', () => {
  assert.match(page, /\{copy\.multichannel\}/)
  assert.doesNotMatch(page, /16 peças|18 peças/)
})

test('declares the future 12–15 hashtag contract', () => {
  assert.equal(config.TEXT_CAMPAIGN_HASHTAG_CONTRACT.minimum, 12)
  assert.equal(config.TEXT_CAMPAIGN_HASHTAG_CONTRACT.maximum, 15)
  assert.deepEqual(config.TEXT_CAMPAIGN_HASHTAG_CONTRACT.futureHelpers, ['strategic-hashtags', 'official-hashtags'])
})

test('requires #SmartCorretorAI in the middle of future normalized hashtags', () => {
  assert.equal(config.TEXT_CAMPAIGN_HASHTAG_CONTRACT.requiredBrand, '#SmartCorretorAI')
  assert.equal(config.TEXT_CAMPAIGN_HASHTAG_CONTRACT.brandPosition, 'middle')
})

test('does not call OpenAI or any provider', () => {
  const combined = `${page}\n${read('src/config/textCampaign.js')}\n${read('src/config/textCampaignConversation.js')}`
  assert.doesNotMatch(combined, /from ['"][^'"]*(openai|gemini|veo|creatomate)|new OpenAI|chat\.completions|responses\.create/i)
  assert.doesNotMatch(combined, /fetch\(|api\.openai\.com|gemini|veo|creatomate/i)
})

test('does not persist a campaign or a result history', () => {
  const combined = `${page}\n${read('src/config/textCampaign.js')}\n${read('src/config/textCampaignConversation.js')}`
  assert.doesNotMatch(combined, /localStorage|indexedDB|storage\.from|insert\(|upsert\(/)
  assert.doesNotMatch(page, /sessionStorage\.setItem\([^,]+,\s*(briefing|campaign|answers)/)
  assert.doesNotMatch(combined, /campaigns_generated|text_campaigns/)
})

test('reuses the consolidated Design System and guided conversation', () => {
  for (const component of ['ProductHero', 'ProductCard', 'ProductSteps', 'ProductButton', 'ProductSectionHeading', 'GuidedConversation', 'SMART_UI']) assert.ok(page.includes(component))
  assert.match(guidedConversation, /ConversationAssistantBubble/)
  assert.match(guidedConversation, /ProductSummary/)
  assert.match(page, /designSystem[\s\S]*?accent="primary"/)
  assert.match(page, /aria-busy=\{busy \|\| loading\}/)
})
