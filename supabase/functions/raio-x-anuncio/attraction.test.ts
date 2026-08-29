import assert from 'node:assert/strict'
import test from 'node:test'
import { validateListingXrayModelOutput } from './contract.ts'
import { makeAttractionScenarioFixture, type AttractionScenario } from './fixtures/model-output-fixtures.ts'
import { finalizeListingXrayResult } from './scoring.ts'

function result(kind: AttractionScenario) {
  const fixture = makeAttractionScenarioFixture(kind)
  return finalizeListingXrayResult({ inputKind: 'images', listing: null, imageCount: fixture.imageCount }, validateListingXrayModelOutput(fixture.model))
}

test('qualidade 95+ e atração 60 coexistem sem reduzir artificialmente a qualidade', () => {
  const output = result('high_low')
  assert.ok(Number(output.listing_quality_score) >= 95)
  assert.equal(output.attraction_potential_score, 60)
  assert.equal(output.overall_score, output.listing_quality_score)
})

test('qualidade 60 e atração 90+ coexistem como dimensões independentes', () => {
  const output = result('medium_high')
  assert.equal(output.listing_quality_score, 60)
  assert.ok(Number(output.attraction_potential_score) >= 90)
  assert.notEqual(output.listing_quality_score, output.attraction_potential_score)
})

test('anúncio excelente com atração alta não recebe defeito falso', () => {
  const output = result('high_high')
  assert.equal(output.listing_quality_label, 'Excelente'); assert.equal(output.attraction_potential_label, 'Muito forte')
  assert.ok(Object.values(output.sections).every(section => section.issue_codes.length === 0 && section.what_can_improve === null))
  assert.equal(output.attraction.issue_codes.length, 0); assert.equal(output.attraction.what_can_improve, null)
})

test('anúncio excelente restrito ao portal recebe expansão sustentada, não correção inventada', () => {
  const output = result('excellent_portal_limited')
  assert.equal(output.listing_quality_label, 'Excelente'); assert.ok(Number(output.attraction_potential_score) < 70)
  assert.ok(output.opportunities.length >= 1); assert.ok(output.opportunities.every(item => item.evidence.length > 10))
})

test('ambiente vazio e material visual pouco explorado geram oportunidades distintas', () => {
  const empty = result('empty_staging'); const visual = result('visual_underused')
  const emptyOpportunities = empty.opportunities || []; const visualOpportunities = visual.opportunities || []
  assert.equal(emptyOpportunities[0].product_id, 'virtual_staging')
  assert.ok(visualOpportunities.some(item => item.product_id === 'real_estate_video'))
  assert.equal(visualOpportunities.some(item => item.product_id === 'life_in_property'), false)
})

test('atração usa linguagem sem promessa e mantém limites comerciais', () => {
  for (const kind of ['low_low', 'high_low', 'high_high', 'medium_high', 'excellent_portal_limited', 'empty_staging', 'visual_underused'] as AttractionScenario[]) {
    const output = result(kind); const publicText = JSON.stringify({ attraction: output.attraction, opportunities: output.opportunities, priorities: output.priorities })
    assert.doesNotMatch(publicText, /vai gerar leads|vai vender|venda garantida|conversão garantida/i)
    const opportunities = output.opportunities || []
    assert.ok(opportunities.length <= 5); assert.ok(output.priorities.length <= 3)
    assert.ok(opportunities.every(item => item.evidence && item.evidence_source && item.route.startsWith('/')))
    assert.equal('campaign' in output, false)
  }
})
