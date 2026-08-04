import test from 'node:test'
import assert from 'node:assert/strict'
import { generateStrategicHashtags, STRATEGIC_HASHTAG_SYSTEM_PROMPT } from '../strategic-hashtags.ts'

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
    const brandIndex = hashtags.indexOf('#SmartCorretorAI')
    assert.ok(brandIndex > 0 && brandIndex < hashtags.length - 1)
    assert.equal(requestBody.model, 'gpt-4.1')
    assert.equal((requestBody.messages as Array<{ content:string }>)[0].content, STRATEGIC_HASHTAG_SYSTEM_PROMPT)
    assert.match((requestBody.messages as Array<{ content:string }>)[1].content, /request-a/)
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
