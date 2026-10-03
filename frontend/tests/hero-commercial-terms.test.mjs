import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8')

const frontend = read('frontend/src/pages/HeroNext.jsx')
const backend = read('supabase/functions/gerar-hero-ia/index.ts')
const messages = read('frontend/src/i18n/messages/pt-BR.js')

const commercialStages = frontend.match(/const COMMERCIAL_TERMS_STAGES = new Set\(\[([^\]]+)\]\)/)?.[1] || ''
const frontendFields = frontend.match(/const COMMERCIAL_TERM_FIELDS = \[([\s\S]*?)\n\]/)?.[1] || ''
const backendFields = backend.match(/const COMMERCIAL_TERM_LABELS = \{([\s\S]*?)\n\} as const/)?.[1] || ''

test('Pré-lançamento permite condições comerciais', () => {
  assert.match(commercialStages, /'Pré-lançamento'/)
  assert.match(backend, /\['pre-lancamento', 'lancamento', 'em obras'\]\.includes\(stage\)/)
})

test('Lançamento permite condições comerciais', () => {
  assert.match(commercialStages, /'Lançamento'/)
})

test('Em obras permite condições comerciais', () => {
  assert.match(commercialStages, /'Em obras'/)
})

test('Pronto para morar permanece fora da funcionalidade', () => {
  assert.doesNotMatch(commercialStages, /Pronto para morar/)
  assert.match(frontend, /commercialTermsAvailable = goal === 'sale' && COMMERCIAL_TERMS_STAGES\.has\(answers\.stage\)/)
})

test('locação permanece fora da funcionalidade no frontend e backend', () => {
  assert.match(frontend, /commercialTermsAvailable = goal === 'sale'/)
  assert.match(backend, /campaignObjective === 'venda' && isCommercialTermsStage\(payload\.property_stage\)/)
})

test('os três campos são opcionais e não entram na validação como obrigatórios', () => {
  assert.equal((frontendFields.match(/\(opcional\)/g) || []).length, 0)
  assert.match(frontend, /\{label\} <span className="font-semibold text-gray-400">\(opcional\)<\/span>/)
  assert.match(frontend, /saleValueMode === 'conditions' && \(saleConditions\.length > 0 \|\| commercialTermsEnabled\)/)
  assert.doesNotMatch(frontend, /commercialTermCalls\.length\s*>\s*0\)\s*\?\s*false/)
})

test('é possível informar somente Mensais', () => {
  assert.match(frontendFields, /id: 'monthly_amount'[\s\S]*?prefix: 'Mensais a partir de'/)
  assert.match(frontend, /terms\[id\] \? `\$\{prefix\} \$\{formatHeroPrice\(terms\[id\]\)\}` : ''/)
})

test('é possível informar somente Entrada', () => {
  assert.match(frontendFields, /id: 'entry_amount'[\s\S]*?prefix: 'Entrada de'/)
})

test('é possível informar somente Anuais', () => {
  assert.match(frontendFields, /id: 'annual_amount'[\s\S]*?prefix: 'Anuais de'/)
})

test('qualquer combinação dos três campos é preservada independentemente', () => {
  for (const field of ['entry_amount', 'monthly_amount', 'annual_amount']) {
    assert.match(frontendFields, new RegExp(`id: '${field}'`))
    assert.match(backendFields, new RegExp(`${field}:`))
  }
  assert.match(frontend, /Object\.fromEntries\([\s\S]*?\.filter\(\(\[, amount\]\) => amount\)/)
})

test('valores ausentes não são inventados nem enviados', () => {
  assert.match(frontend, /\.filter\(\(\[, amount\]\) => amount\)/)
  assert.match(backend, /\.filter\(\(\[, amount\]\) => Boolean\(amount\)\)/)
  assert.match(backend, /Nao invente, complete ou combine valores ausentes/)
})

test('preço permanece exclusivamente no fluxo existente', () => {
  assert.match(frontend, /\['fixed', 'Preço fixo'\]/)
  assert.match(frontend, /\['starting_at', 'A partir de'\]/)
  assert.match(frontend, /htmlFor="sale-price">\{b\('price'\)\}<\/label>/)
  assert.match(messages, /price: 'Valor'/)
  assert.doesNotMatch(frontendFields, /starting_price/)
  assert.doesNotMatch(backendFields, /starting_price/)
})

test('interface usa a orientação comercial aprovada', () => {
  assert.match(frontend, /\{b\('commercialHelp'\)\}/)
  assert.match(messages, /commercialHelp: 'Adicione chamadas comerciais ao banner, se quiser\.'/)
  assert.doesNotMatch(messages, /Chamadas opcionais para o empreendimento, sem montar tabela de pagamento\./)
})

test('backend aceita somente os três campos estruturados permitidos', () => {
  const allowed = [...backendFields.matchAll(/^\s+([a-z_]+):/gm)].map((match) => match[1])
  assert.deepEqual(allowed, ['entry_amount', 'monthly_amount', 'annual_amount'])
  assert.match(backend, /Object\.keys\(COMMERCIAL_TERM_LABELS\)/)
  assert.match(backend, /String\(source\[field\] \?\? ''\)\.replace\(\/\\D\/g, ''\)\.slice\(0, 12\)/)
})

test('briefing normaliza, preserva e persiste commercial_terms', () => {
  assert.match(backend, /commercialTerms = allowCommercialTerms \? normalizeCommercialTerms\(source\.commercial_terms\) : \{\}/)
  assert.match(backend, /\{ commercial_terms: commercialTerms \}/)
  assert.match(backend, /value_condition: normalizeValueCondition\([\s\S]*?isCommercialTermsStage/)
  assert.match(backend, /prompt_briefing: storedPromptBriefing/)
  assert.match(backend, /const storedPromptBriefing = sanitizePromptBriefingForStorage/)
})

test('prompt da OpenAI usa as chamadas estruturadas sem criar tabela financeira', () => {
  assert.match(backend, /formatCommercialTermCalls\(valueCondition\.commercial_terms\)/)
  assert.match(backend, /CHAMADAS COMERCIAIS AUTORIZADAS:/)
  assert.match(backend, /Use somente as chamadas comerciais autorizadas/)
  assert.match(backend, /Nao invente, complete ou combine valores ausentes/)
  assert.match(backend, /nao transforme as chamadas em tabela financeira/)
})
