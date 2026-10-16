import test from 'node:test'
import assert from 'node:assert/strict'
import { generateStrategicHashtags, STRATEGIC_HASHTAG_EN_US_SYSTEM_PROMPT, STRATEGIC_HASHTAG_SYSTEM_PROMPT } from '../strategic-hashtags.ts'

test('uses the shared OpenAI marketing call and normalizes strategic hashtags', async () => {
  const originalFetch = globalThis.fetch
  let requestBody: Record<string, unknown> = {}
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({ choices:[{ message:{ content:JSON.stringify({ hashtags:[
      '#StudioNoKlabin','#ApartamentoParaAlugar','#MorarNoKlabin','#VidaEmSaoPaulo',
      '#KlabinSP','#SeuNovoEndereco','#MetroChacaraKlabin','#LocacaoSP',
      '#SmartCorretorAI','#VistaLivre','#ApartamentoCompacto','#MobilidadeUrbana','#ImovelPronto',
    ] }) } }] }), { status:200, headers:{ 'Content-Type':'application/json' } })
  }
  try {
    const hashtags = await generateStrategicHashtags({
      apiKey:'test-only', variationKey:'request-a',
      context:{ purpose:'rent', propertyType:'Studio', city:'SÃ£o Paulo', district:'Klabin', state:'SP', highlights:['Vista livre'] },
    })
    assert.ok(hashtags.length >= 12)
    assert.equal(new Set(hashtags.map(tag => tag.toLocaleLowerCase('pt-BR'))).size, hashtags.length)
    assert.ok(hashtags.length >= 12)
    assert.ok(!hashtags.some(tag => ['#SNETIA', '#SmartCorretorAI'].includes(tag)))
    assert.equal(requestBody.model, 'gpt-4.1')
    assert.equal((requestBody.messages as Array<{ content:string }>)[0].content, STRATEGIC_HASHTAG_SYSTEM_PROMPT)
    assert.match((requestBody.messages as Array<{ content:string }>)[1].content, /request-a/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uses the EN-US prompt and keeps US hashtags English without platform tags', async () => {
  const originalFetch = globalThis.fetch
  let requestBody: Record<string, unknown> = {}
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({ choices:[{ message:{ content:JSON.stringify({ hashtags:['#Apartamento2Quartos','#SmartCorretorAI','#SNETIA'] }) } }] }), { status:200, headers:{ 'Content-Type':'application/json' } })
  }
  try {
    const hashtags = await generateStrategicHashtags({
      apiKey:'test-only', variationKey:'request-us',
      context:{ language:'en-US', purpose:'sale', propertyType:'us_condo', city:'Tampa', district:'Hyde Park', state:'FL', bedrooms:'2', bathrooms:'2', parkingSpaces:'1', highlights:['us_garage'] },
    })
    assert.equal((requestBody.messages as Array<{ content:string }>)[0].content, STRATEGIC_HASHTAG_EN_US_SYSTEM_PROMPT)
    assert.ok(hashtags.some(tag => tag === '#RealEstate'))
    assert.ok(!hashtags.some(tag => /Apartamento|Quartos|Vaga|Imovel|Moradia/i.test(tag)))
    assert.ok(!hashtags.some(tag => ['#SNETIA', '#SmartCorretorAI'].includes(tag)))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('falls back without making a request when the backend key is unavailable', async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('unexpected') }
  try {
    const hashtags = await generateStrategicHashtags({ apiKey:'', context:{ purpose:'sale', propertyType:'Apartamento', city:'Recife' } })
    assert.equal(called, false)
    assert.ok(hashtags.length >= 12)
  } finally {
    globalThis.fetch = originalFetch
  }
})
