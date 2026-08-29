import assert from 'node:assert/strict'
import test from 'node:test'
import { validateListingXrayModelOutput } from './contract.ts'
import { makeOpportunityScenarioFixture, type OpportunityScenario } from './fixtures/model-output-fixtures.ts'
import { finalizeListingXrayResult } from './scoring.ts'

function result(kind: OpportunityScenario) {
  const fixture = makeOpportunityScenarioFixture(kind)
  return finalizeListingXrayResult({ inputKind: 'images', listing: null, imageCount: fixture.imageCount }, validateListingXrayModelOutput(fixture.model))
}

test('fixtures fraco e médio mantêm correções separadas da expansão', () => {
  const weak = result('weak'); const medium = result('medium')
  assert.equal(weak.content_type, 'PROPERTY_LISTING'); assert.ok(weak.sections.description.what_can_improve)
  assert.equal(medium.opportunities.some(item => item.product_id === 'life_in_property'), false)
  assert.ok(medium.opportunities.every(item => item.evidence.length > 10))
})

test('anúncio excelente ainda recebe oportunidades defensáveis sem perder a nota', () => {
  const excellent = result('excellent')
  assert.equal(excellent.overall_label, 'Excelente')
  assert.ok(excellent.opportunities.length >= 3); assert.ok(excellent.opportunities.length <= 5)
  assert.ok(excellent.opportunities.some(item => item.product_id === 'real_estate_video'))
})

test('muitas fotos priorizam vídeo e nunca exibem o catálogo inteiro', () => {
  const many = result('many_photos')
  assert.equal(many.opportunities[0].product_id, 'real_estate_video')
  assert.ok(many.opportunities.length <= 5)
  assert.ok(many.opportunities.some(item => item.product_id === 'smart_carousel'))
  assert.equal(many.opportunities.find(item => item.product_id === 'real_estate_video').title, 'Transforme suas melhores fotos em uma apresentação')
  assert.match(many.opportunities.find(item => item.product_id === 'real_estate_video').benefit, /Selecione até 5 das melhores imagens/i)
  assert.equal(many.opportunities.find(item => item.product_id === 'smart_carousel').title, 'Organize suas melhores imagens em sequência')
  assert.match(many.opportunities.find(item => item.product_id === 'smart_carousel').benefit, /Selecione de 5 a 20 das melhores imagens/i)
  assert.ok(many.opportunities.every(item => item.evidence && item.evidence_source))
  assert.equal(new Set(many.opportunities.map(item => item.product_id)).size, many.opportunities.length)
})

test('44 imagens removem prioridade incoerente de adicionar mais material visual', () => {
  const fixture = makeOpportunityScenarioFixture('many_photos')
  fixture.model.priorities = [{ area: 'Visual', text: 'Adicionar imagens atraentes do imóvel e do condomínio.' }]
  fixture.model.listing!.attraction.what_can_improve = 'Adicionar mais imagens atraentes do imóvel.'
  fixture.model.listing!.attraction.how_to_improve = 'Adicione imagens atraentes e uma experiência única.'
  fixture.model.listing!.attraction.suggestion = 'Adicionar mais fotos.'; fixture.model.listing!.attraction.copy_text = 'Um lar acolhedor em localização privilegiada.'
  const output = finalizeListingXrayResult({ inputKind: 'images', listing: null, imageCount: fixture.imageCount }, validateListingXrayModelOutput(fixture.model))
  const publicText = JSON.stringify({ sections: output.sections, attraction: output.attraction, priorities: output.priorities })
  assert.doesNotMatch(publicText, /adicionar (?:mais )?(?:fotos|imagens)|experiência única|lar acolhedor|localização privilegiada/i)
  assert.match(publicText, /Selecione as imagens mais fortes/i)
})

test('ambiente vazio recomenda Virtual Staging com evidência e não confunde movimento', () => {
  const empty = result('empty_room')
  const staging = empty.opportunities.find(item => item.product_id === 'virtual_staging')
  assert.ok(staging); assert.match(staging.benefit, /decora/i); assert.match(staging.evidence, /vazio/i); assert.equal(staging.evidence_source, 'model_visual_observation')
  assert.notEqual(empty.opportunities[0]?.product_id, 'life_in_property')
})

test('lançamento ou oferta recomenda comercial e banners com CTAs de navegação', () => {
  const launch = result('launch_offer')
  assert.ok(launch.opportunities.some(item => item.product_id === 'commercial_real_estate'))
  assert.ok(launch.opportunities.some(item => item.product_id === 'quick_banners'))
  assert.ok(launch.opportunities.every(item => item.route.startsWith('/') && !item.route.startsWith('//')))
})

test('texto bom com divulgação limitada recomenda Campanha de Textos sem gerar campanha', () => {
  const textual = result('text_good_limited')
  const campaign = textual.opportunities.find(item => item.product_id === 'text_campaign')
  assert.ok(campaign); assert.equal(campaign.route, '/campanha-de-textos')
  assert.equal('campaign' in textual, false)
})

test('prioridades finais são ações e recovery não executa produtos', () => {
  const fixture = makeOpportunityScenarioFixture('excellent')
  fixture.model.priorities = [
    { area: 'Clareza', text: 'Manter a boa clareza.' },
    { area: 'Título', text: 'Incluir a área confirmada no título.' },
  ]
  const final = finalizeListingXrayResult({ inputKind: 'images', listing: null, imageCount: fixture.imageCount }, validateListingXrayModelOutput(fixture.model))
  assert.ok(final.priorities.every(item => !/^(manter|continuar|preservar)/i.test(item.text)))
  assert.ok(final.priorities.some(item => /Criar|Conhecer/i.test(item.text)))
  assert.ok(final.opportunities.every(item => !('execute' in item) && !('payload' in item)))
})
