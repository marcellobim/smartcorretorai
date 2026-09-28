import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getSmartTourHighlightGroups,
  getSmartTourHighlights,
  getSmartTourMeasureFields,
  SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY,
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

test('8. residential library exposes the expanded master categories and options', () => {
  const groups = getSmartTourHighlightGroups('Apartamento')
  assert.deepEqual(groups.map(group => group.title), ['Localização', 'Condomínio', 'Diferenciais do imóvel', 'Garagem', 'Sustentabilidade'])
  const residential = groups.flatMap(group => group.items)
  const approved = [
    'Próximo ao metrô', 'Próximo a universidades', 'Próximo à praia', 'Próximo ao aeroporto',
    'Próximo a rodovias', 'Região nobre', 'Frente para praça', 'Piscina aquecida', 'Espaço gourmet',
    'Salão de jogos', 'Brinquedoteca', 'Sauna', 'Spa', 'Cinema', 'Mini mercado', 'Bicicletário',
    'Lavanderia coletiva', 'Gerador', 'Reformado', 'Nunca habitado', 'Semi mobiliado', 'Home office',
    'Cozinha americana', 'Sacada envidraçada', 'Piscina privativa', 'Jacuzzi', 'Piso porcelanato',
    'Pé-direito alto', 'Vista para o mar', 'Fechadura eletrônica', 'Vagas demarcadas', 'Vaga coberta',
    'Box privativo', 'Carregador para veículo elétrico', 'Aquecimento solar', 'Reuso de água',
    'Preparação para carro elétrico',
  ]
  for (const highlight of approved) assert.ok(residential.includes(highlight), highlight)
})

test('8b. master highlight library is reusable and contains conditional commercial and land categories', () => {
  assert.deepEqual(Object.keys(SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY), ['Localização', 'Condomínio', 'Diferenciais do imóvel', 'Garagem', 'Sustentabilidade', 'Comercial', 'Terrenos'])
  for (const highlight of ['Recepção', 'Sala de reunião', 'Excelente visibilidade', 'Frente para avenida', 'Alto fluxo', 'Ideal para clínica', 'Ideal para escritório', 'Ideal para loja']) assert.ok(SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY.Comercial.includes(highlight), highlight)
  for (const highlight of ['Plano', 'Esquina', 'Murado', 'Documentação regular', 'Alto potencial construtivo', 'Zoneamento residencial', 'Zoneamento comercial', 'Excelente investimento']) assert.ok(SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY.Terrenos.includes(highlight), highlight)
  assert.equal(getSmartTourHighlightGroups('Apartamento').some(group => group.title === 'Comercial' || group.title === 'Terrenos'), false)
  assert.equal(getSmartTourHighlightGroups('Comercial').some(group => group.title === 'Comercial'), true)
  assert.equal(getSmartTourHighlightGroups('Terreno / Lote').some(group => group.title === 'Terrenos'), true)
})

test('8c. master library contains every approved highlight from all seven categories', () => {
  const required = {
    'Localização': ['Próximo ao metrô', 'Próximo ao comércio', 'Próximo a escolas', 'Próximo a universidades', 'Próximo a hospitais', 'Próximo a parques', 'Próximo ao shopping', 'Próximo à praia', 'Próximo ao aeroporto', 'Próximo ao centro', 'Fácil acesso', 'Próximo a rodovias', 'Rua tranquila', 'Bairro valorizado', 'Região nobre', 'Vista livre', 'Frente para praça'],
    'Condomínio': ['Piscina', 'Piscina aquecida', 'Academia', 'Espaço gourmet', 'Salão de festas', 'Salão de jogos', 'Playground', 'Brinquedoteca', 'Coworking', 'Pet Place', 'Quadra esportiva', 'Quadra de tênis', 'Sauna', 'Spa', 'Cinema', 'Mini mercado', 'Bicicletário', 'Lavanderia coletiva', 'Portaria 24h', 'Segurança 24h', 'Monitoramento', 'Elevador', 'Gerador', 'Energia solar'],
    'Diferenciais do imóvel': ['Alto padrão', 'Reformado', 'Novo', 'Nunca habitado', 'Semi mobiliado', 'Mobiliado', 'Móveis planejados', 'Closet', 'Escritório', 'Home office', 'Lavabo', 'Suíte master', 'Cozinha americana', 'Despensa', 'Área de serviço', 'Dependência', 'Varanda gourmet', 'Sacada', 'Sacada envidraçada', 'Terraço', 'Quintal', 'Jardim', 'Piscina privativa', 'Jacuzzi', 'Churrasqueira privativa', 'Piso porcelanato', 'Piso vinílico', 'Mármore', 'Granito', 'Pé-direito alto', 'Excelente ventilação', 'Sol da manhã', 'Sol da tarde', 'Iluminação natural', 'Ambientes integrados', 'Vista panorâmica', 'Vista permanente', 'Vista para o mar', 'Vista para parque', 'Vista para cidade', 'Ar-condicionado', 'Fechadura eletrônica', 'Acabamento premium'],
    'Garagem': ['Vagas demarcadas', 'Vaga coberta', 'Box privativo', 'Carregador para veículo elétrico'],
    'Sustentabilidade': ['Energia solar', 'Aquecimento solar', 'Reuso de água', 'Preparação para carro elétrico'],
    'Comercial': ['Recepção', 'Copa', 'Sala de reunião', 'Excelente visibilidade', 'Frente para avenida', 'Alto fluxo', 'Ideal para clínica', 'Ideal para escritório', 'Ideal para loja'],
    'Terrenos': ['Plano', 'Esquina', 'Murado', 'Documentação regular', 'Alto potencial construtivo', 'Zoneamento residencial', 'Zoneamento comercial', 'Excelente investimento'],
  }
  for (const [category, items] of Object.entries(required)) {
    for (const item of items) assert.ok(SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY[category].includes(item), `${category}: ${item}`)
  }
})

test('9. highlight selection remains limited to ten', () => {
  assert.match(page, /property\.highlights\.length < 10/)
  assert.match(page, /property\.highlights\.length >= 10/)
  assert.match(page, /Selecione até 10 características/)
  assert.match(page, /Somente os itens escolhidos serão enviados como contexto/)
})

test('10. highlight lists change coherently with property type', () => {
  assert.notDeepEqual(getSmartTourHighlights('Apartamento'), getSmartTourHighlights('Casa'))
  assert.notDeepEqual(getSmartTourHighlights('Comercial'), getSmartTourHighlights('Terreno / Lote'))
  assert.equal(getSmartTourHighlights('Comercial').includes('Lazer completo'), false)
  assert.equal(getSmartTourHighlights('Apartamento').includes('Doca'), false)
})

test('11. Sobrado is not a primary property type', () => {
  assert.equal(SMART_TOUR_PROPERTY_TYPES.some((type) => type.value === 'Sobrado'), false)
})

test('12. Sobrado remains a Casa highlight', () => {
  assert.equal(getSmartTourHighlights('Casa').includes('Sobrado'), true)
})

test('13. active flow contains no staging, furniture or decoration question', () => {
  assert.doesNotMatch(page, /id === 'furniture'|id === 'staging'|Como deseja mostrar o resultado|Mobiliar com IA|Sugestão de decoração/)
  assert.equal(getSmartTourNextQuestion({ questionId: 'highlights' }), 'presenter')
})

test('14. frontend forces the original property without virtual staging', () => {
  assert.match(page, /furniture: 'original'/)
  assert.match(page, /stagingPresentation: 'final_only'/)
  assert.doesNotMatch(page, /virtual_staging|before_after/)
})

test('15. asks the formal independent questions with localized caption and identity prompts', () => {
  for (const question of [
    'Deseja um apresentador virtual durante o vídeo?',
    'Deseja narração durante o vídeo?',
    'Deseja uma chamada para ação no final do vídeo?',
  ]) assert.ok(page.includes(question), question)
  assert.match(page, /smartTour\.captions\.question/)
  assert.match(page, /smartTour\.professionalIdentity\.question/)
})

test('16. history, summary and review reflect every independent choice', () => {
  for (const label of ['Apresentador', 'Narração', 'CTA final', 'Chamada escolhida', 'Telefone']) assert.ok(page.includes(label), label)
  assert.match(page, /smartTour\.captions\.reviewLabel/)
  assert.match(page, /smartTour\.professionalIdentity\.reviewLabel/)
  assert.match(page, /ctaEnabled === true \? cta : ''/)
  assert.match(page, /includeProfessionalPhone: videoCtaEnabled && includePhone === true/)
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
