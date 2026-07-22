import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getSmartTourHighlightGroups,
  getSmartTourHighlights,
  getSmartTourMeasureFields,
  SMART_TOUR_MEASURE_OPTIONS,
  SMART_TOUR_PROPERTY_TYPES,
} from '../src/config/smartTourForm.js'
import { getSmartTourNextQuestion } from '../src/config/smartTourConversation.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const page = read('src/pages/SmartTourAI.jsx')
const smartCarousel = read('src/pages/SmartCarrossel.jsx')
const sharedUi = read('src/components/conversation/GuidedConversation.jsx')
const sharedHook = read('src/hooks/useGuidedConversation.js')
const smartStagingQuestions = page.match(/if \(generation\.mode === 'smart_staging'\) \{([\s\S]*?)\n  \}/)?.[1] || ''

test('1. bedrooms use the approved clickable choices', () => {
  assert.deepEqual(SMART_TOUR_MEASURE_OPTIONS.bedrooms, ['0', '1', '2', '3', '4', '5+'])
  assert.match(page, /SMART_TOUR_MEASURE_OPTIONS\[field\]\.map\(option => <button/)
})

test('2. suites use the approved clickable choices', () => {
  assert.deepEqual(SMART_TOUR_MEASURE_OPTIONS.suites, ['0', '1', '2', '3', '4+'])
})

test('3. parking spaces use the approved clickable choices', () => {
  assert.deepEqual(SMART_TOUR_MEASURE_OPTIONS.parkingSpaces, ['0', '1', '2', '3', '4+'])
})

test('4. area remains the only numeric input and requires a positive value', () => {
  assert.match(page, /aria-label="Área do imóvel"/)
  assert.match(page, /placeholder="Ex\.: 85"/)
  assert.match(page, /Number\(property\.area\) <= 0/)
  assert.match(page, />m²<\/span>/)
})

test('5. commercial shows parking and area without bedrooms or suites', () => {
  assert.deepEqual(getSmartTourMeasureFields('Comercial'), ['parkingSpaces', 'area'])
})

test('6. land shows area only', () => {
  assert.deepEqual(getSmartTourMeasureFields('Terreno / Lote'), ['area'])
})

test('7. commercial library contains every approved V2 highlight', () => {
  const commercial = getSmartTourHighlights('Comercial')
  const additions = [
    'Internet de alta velocidade', 'Cabeamento estruturado', 'Piso elevado', 'Energia trifásica',
    'Energia solar', 'Ponto para carregamento de carro elétrico', 'Coworking', 'Sala de reuniões',
    'Copa', 'Banheiros privativos', 'Depósito', 'Refeitório', 'Controle de acesso',
    'Monitoramento por câmeras', 'Estacionamento para clientes', 'Acesso para carga e descarga',
    'Doca', 'Próximo ao transporte público', 'Fácil acesso às principais vias', 'Ideal para clínica',
    'Ideal para escritório', 'Ideal para coworking', 'Ideal para loja', 'Ideal para logística',
    'Recém-reformado',
  ]
  for (const highlight of additions) assert.ok(commercial.includes(highlight), highlight)
})

test('8. residential library has exactly the three approved groups and options', () => {
  const groups = getSmartTourHighlightGroups('Apartamento')
  assert.deepEqual(groups.map(group => group.title), ['Localização', 'Condomínio', 'Diferenciais do imóvel'])
  const residential = groups.flatMap(group => group.items)
  const approved = [
    'Próximo ao metrô', 'Próximo ao comércio', 'Próximo a escolas', 'Próximo a parques',
    'Próximo a hospitais', 'Fácil acesso', 'Bairro valorizado', 'Vista livre', 'Lazer completo',
    'Piscina', 'Academia', 'Churrasqueira', 'Salão de festas', 'Playground', 'Quadra esportiva',
    'Quadra de tênis', 'Pet Place', 'Pista de caminhada', 'Coworking', 'Portaria 24h',
    'Segurança 24h', 'Monitoramento', 'Elevador', 'Ponto para carregamento de carro elétrico',
    'Alto padrão', 'Mobiliado', 'Móveis planejados', 'Varanda gourmet', 'Depósito privativo',
    'Vagas demarcadas', 'Ar-condicionado', 'Iluminação natural', 'Ambientes integrados',
    'Andar alto', 'Acabamento premium',
  ]
  for (const highlight of approved) assert.ok(residential.includes(highlight), highlight)
})

test('9. highlight selection remains limited to ten', () => {
  assert.match(page, /property\.highlights\.length < 10/)
  assert.match(page, /property\.highlights\.length >= 10/)
  assert.match(page, /Selecione até 10 características/)
})

test('10. highlight lists change coherently with property type', () => {
  assert.notDeepEqual(getSmartTourHighlights('Apartamento'), getSmartTourHighlights('Casa'))
  assert.notDeepEqual(getSmartTourHighlights('Comercial'), getSmartTourHighlights('Terreno / Lote'))
  assert.equal(getSmartTourHighlights('Comercial').includes('Lazer completo'), false)
  assert.equal(getSmartTourHighlights('Apartamento').includes('Doca'), false)
})

test('11. Sobrado is not a primary property type', () => {
  assert.equal(SMART_TOUR_PROPERTY_TYPES.includes('Sobrado'), false)
})

test('12. Sobrado remains a Casa highlight', () => {
  assert.equal(getSmartTourHighlights('Casa').includes('Sobrado'), true)
})

test('13. decoration mode does not ask to keep original or furnish with AI', () => {
  assert.doesNotMatch(smartStagingQuestions, /furniture|Manter original|Mobiliar com IA/)
  assert.equal(getSmartTourNextQuestion({ questionId: 'mode', answerId: 'smart_staging' }), 'staging')
})

test('14. decoration mode asks directly how to show the result', () => {
  assert.match(smartStagingQuestions, /questions\.push\(\['staging', 3, 'Como deseja mostrar o resultado\?'\]\)/)
})

test('15. decoration result choices use the approved labels', () => {
  assert.match(page, /id:'final_only',label:'Apenas resultado final'/)
  assert.match(page, /id:'before_after',label:'Antes e depois'/)
  assert.doesNotMatch(page, /Apenas mobiliado/)
})

test('16. history, summary and review reflect the decoration result', () => {
  assert.match(page, /Sugestão de decoração —/)
  assert.match(page, /Apenas resultado final/)
  assert.match(page, /Antes e depois/)
  assert.match(page, /mostrará diretamente os ambientes com a sugestão de decoração criada pela IA/)
  assert.match(page, /mostrará os ambientes originais e depois a sugestão de decoração criada pela IA/)
  assert.match(page, /reviewItems\.map/)
})

test('17. Smart Carrossel keeps its approved conversational and generation flow', () => {
  assert.match(smartCarousel, /GuidedConversation/)
  assert.match(smartCarousel, /useGuidedConversation/)
  assert.match(smartCarousel, /smart-carousel-creatomate/)
  assert.match(smartCarousel, /pollRenderStatus/)
})

test('18. the shared conversational engine remains in use and unchanged in responsibility', () => {
  assert.match(sharedUi, /summaryItems\.map/)
  assert.match(sharedUi, /CONVERSATION_PHASE\.QUESTION/)
  assert.match(sharedHook, /appendConversationTurn/)
  assert.match(sharedHook, /truncateConversationAt/)
})

test('19. generation integrations keep the approved endpoints', () => {
  assert.match(page, /supabase\.functions\.invoke\('smart-tour-generate'/)
  assert.match(page, /supabase\.functions\.invoke\('smart-tour-status'/)
  assert.match(page, /buildSmartTourCampaignPackage/)
  assert.match(page, /normalizeGeneration\(generation\)/)
})
