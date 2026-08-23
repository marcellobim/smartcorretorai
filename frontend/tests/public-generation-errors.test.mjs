import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getSmartTokenErrorMessage } from '../src/lib/smart-tokens.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const publicFallback = 'Não foi possível concluir esta criação. Tente novamente.'

test('oculta fornecedores, parsers, schemas, status HTTP e stack traces', () => {
  const technicalErrors = [
    'Resposta da OpenAI sem Google Ads válido',
    'Gemini returned an invalid response schema',
    'Veo generation failed with HTTP 502',
    'Creatomate parser error at render.ts:42',
    'TypeError: Cannot read properties of undefined\n    at runtime.ts:10:2',
    'Edge Function returned a non-2xx status code',
    'relation campaigns does not exist',
  ]
  const forbidden = /OpenAI|Gemini|Veo|Creatomate|HTTP|schema|parser|TypeError|runtime\.ts|Edge Function|relation/i

  for (const technicalError of technicalErrors) {
    const publicMessage = getSmartTokenErrorMessage(new Error(technicalError), publicFallback)
    assert.equal(publicMessage, publicFallback)
    assert.doesNotMatch(publicMessage, forbidden)
  }
})

test('preserva erros úteis de negócio com mensagens públicas fixas', () => {
  assert.equal(
    getSmartTokenErrorMessage({ code: 'INSUFFICIENT_SMART_TOKENS' }, publicFallback),
    'Você precisa de mais Smart Tokens para esta criação.',
  )
  assert.equal(
    getSmartTokenErrorMessage(new Error('Sessão expirada — faça login novamente'), publicFallback),
    'Sua sessão expirou. Faça login novamente.',
  )
  assert.equal(
    getSmartTokenErrorMessage(new Error('unsupported image file'), publicFallback),
    'Revise o arquivo enviado e tente novamente.',
  )
  assert.equal(
    getSmartTokenErrorMessage(new Error('Quantidade máxima de imagens excedida'), publicFallback),
    'Revise a quantidade de arquivos e tente novamente.',
  )
  assert.equal(
    getSmartTokenErrorMessage(new Error('Campo finalidade obrigatório'), publicFallback),
    'Revise as informações preenchidas e tente novamente.',
  )
  assert.equal(
    getSmartTokenErrorMessage(new Error('Os textos foram gerados, mas a campanha não foi salva automaticamente.'), publicFallback),
    'Os textos foram gerados, mas a campanha não foi salva automaticamente.',
  )
})

test('fluxos ativos passam falhas desconhecidas pelo limite público compartilhado', () => {
  for (const path of [
    'src/pages/NovaCampanha.jsx',
    'src/pages/Hero.jsx',
    'src/pages/HeroNext.jsx',
    'src/pages/SmartCarrossel.jsx',
    'src/pages/StudioHero.jsx',
    'src/pages/VirtualStaging.jsx',
    'src/pages/TextCampaign.jsx',
    'src/pages/SmartTourAI.jsx',
    'src/hooks/useCampaigns.js',
  ]) {
    assert.match(read(path), /getSmartTokenErrorMessage/)
  }
})

test('gerar-campanha mantém diagnóstico interno e responde somente mensagens públicas', () => {
  const backend = read('../supabase/functions/gerar-campanha/index.ts')

  assert.match(backend, /internal_code=CAMPAIGN_PROVIDER_HTTP_ERROR/)
  assert.match(backend, /internal_code=CAMPAIGN_PROVIDER_EMPTY_RESPONSE/)
  assert.match(backend, /internal_code=CAMPAIGN_PROVIDER_JSON_PARSE_ERROR/)
  assert.match(backend, /internal_code=CAMPAIGN_GOOGLE_ADS_INVALID_RESPONSE/)
  assert.match(backend, /return jsonResponse\(\{ error: CAMPAIGN_PUBLIC_ERROR \}, 502\)/)
  assert.match(backend, /error: CAMPAIGN_SAVE_WARNING,[\s\S]*textos: textos_gerados/)
  assert.doesNotMatch(backend, /error: `OpenAI retornou|error: 'OpenAI retornou|error: 'Resposta da OpenAI|error: `Erro ao salvar campanha/)
  assert.doesNotMatch(backend, /error: CAMPAIGN_SAVE_WARNING,[\s\S]{0,120}(code:|hint:)/)
})
