import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/NovaCampanha.jsx', import.meta.url), 'utf8')
const backend = readFileSync(new URL('../../supabase/functions/gerar-banners/index.ts', import.meta.url), 'utf8')

test('frontend sends functional selection and UUID client request, never a price', () => {
  assert.match(page, /client_request_id: clientRequestId/)
  assert.match(page, /window\.crypto\?\.randomUUID/)
  const initialPayload = page.slice(page.indexOf('const clientRequestId ='), page.indexOf('// Inputs derivados', page.indexOf('const clientRequestId =')))
  assert.doesNotMatch(initialPayload, /credit_cost|smartTokenCost|45/)
})

test('economic preparation happens before gerar-campanha provider call', () => {
  const prepare = page.indexOf("invokeBanners('prepare')")
  const campaign = page.indexOf("functions.invoke('gerar-campanha'", prepare)
  const execute = page.indexOf("invokeBanners('execute'", campaign)
  assert.ok(prepare > -1 && campaign > prepare && execute > campaign)
})

test('manual retry selects only failed persisted items', () => {
  assert.match(page, /retryableRenders[\s\S]*?RENDER_ERROR_STATUSES[\s\S]*?quick_banner_item_id/)
  assert.match(page, /hasPriorRenders && retryableRenders\.length === 0/)
  assert.match(page, /const selectedTemplates = hasPriorRenders[\s\S]*?retryableRenders\.map/)
  assert.match(page, /retry_of_item_id: render\.quick_banner_item_id/)
})

test('backend rejects the raw manipulated count and any invalid template before provider stages', () => {
  const rawLimit = backend.indexOf('selectedPiecesRaw.length > MAX_VISUAL_PIECES_PER_GENERATION')
  const invalid = backend.indexOf("code: 'INVALID_TEMPLATE_ID'")
  const templateProvider = backend.indexOf('fetchTemplateElements', backend.indexOf('// === ESTÁGIO 2'))
  assert.ok(rawLimit > -1 && invalid > rawLimit && templateProvider > invalid)
})

test('backend reserves total through canonical quote and does not trust frontend cost', () => {
  assert.match(backend, /economicQuote = quoteQuickBannerItems/)
  assert.match(backend, /availableTokens < economicQuote\.totalCost/)
  assert.match(backend, /economy\.reserve\(/)
  assert.match(backend, /const effectiveCreditCost = 0/)
  const reserve = backend.indexOf('await economy.reserve(')
  const begin = backend.indexOf('await economy.beginExecution(')
  const firstPaidPreparation = backend.indexOf('fetchTemplateElements(reqId', begin)
  assert.ok(reserve > -1 && begin > reserve && firstPaidPreparation > begin)
})

test('backend recognizes Admin only through the official centralized helper', () => {
  assert.match(backend, /import \{ isAuthorizedAdmin \} from '\.\.\/_shared\/admin-authorization\.ts'/)
  assert.match(backend, /isAuthorizedAdmin\(supabase, authenticatedUserId\)/)
  assert.doesNotMatch(backend, /user_metadata\?*\.role|profiles?\?*\.role|\.eq\(['"]email['"]/i)
})
