import type { AnalysisInputKind, ListingAnalysis, NormalizedListing, ProductOpportunity } from './contract.ts'
import { listingXrayProductCapability, type ListingXrayProductId } from './product-capabilities.ts'
import { formatPtBrQuantity } from './pt-br-quantities.ts'

type OpportunityInput = { inputKind: AnalysisInputKind; imageCount: number; listing: NormalizedListing | null; analysis: ListingAnalysis }
type RankedOpportunity = ProductOpportunity & { rank: number }
const text = (value: unknown) => Array.isArray(value) ? value.join(' ') : String(value || '')
const normalizedText = (value: unknown) => text(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const numeric = (value: unknown) => Number(String(value || '').replace(/[^0-9]/g, '')) || 0
const fact = (listing: NormalizedListing | null, analysis: ListingAnalysis, key: keyof NormalizedListing['fields']) => {
  if (listing?.fields[key]?.state === 'CONFIRMED') return listing.fields[key].value
  const observed = analysis.observed_fields.find(field => field.key === key)
  return observed?.state === 'CONFIRMED' ? observed.value : null
}
const issueCodes = (analysis: ListingAnalysis) => Object.values({ title: analysis.title, description: analysis.description, information: analysis.information, persuasion: analysis.persuasion, attraction: analysis.attraction }).flatMap(section => section.issue_codes.map(code => code.toLowerCase()))
const opportunity = (productId: ListingXrayProductId, rank: number, content: Omit<ProductOpportunity, 'product_id' | 'cta_label' | 'route'>): RankedOpportunity => {
  const capability = listingXrayProductCapability(productId)
  return { product_id: productId, cta_label: capability.cta_label, route: capability.route, rank, ...content }
}

export function buildListingXrayOpportunities(input: OpportunityInput): ProductOpportunity[] {
  const { listing, analysis } = input
  const detectedImages = listing?.detectedImageCount?.state === 'CONFIRMED' ? numeric(listing.detectedImageCount.value) : 0
  const availableImages = Math.max(input.imageCount, detectedImages)
  const get = (key: keyof NormalizedListing['fields']) => fact(listing, analysis, key)
  const description = text(get('description')).trim()
  const factsText = normalizedText([get('title'), description, get('stage'), get('highlights'), get('amenities')])
  const codes = issueCodes(analysis)
  const emptyRoom = input.inputKind === 'images' && codes.some(code => ['empty_room_detected', 'nearly_empty_room_detected'].includes(code))
  const movementReady = input.inputKind === 'images' && codes.some(code => ['motion_suitable_image', 'motion_opportunity_detected'].includes(code))
  const launchOrOffer = ['lancamento', 'oportunidade', 'oferta', 'desconto', 'condicao especial', 'alto padrao'].some(term => factsText.includes(term))
  const richFacts = [get('area'), get('bedrooms'), get('suites'), get('parkingSpaces'), get('highlights'), get('amenities')].filter(value => value !== null && value !== undefined && value !== '').length
  const candidates: RankedOpportunity[] = []

  if (emptyRoom) candidates.push(opportunity('virtual_staging', 100, { title: 'Mostre o potencial deste ambiente', reason: 'Uma observação visual identificou um ambiente vazio ou quase vazio.', benefit: 'Uma nova proposta de decoração ajuda o interessado a imaginar melhor o uso do ambiente.', evidence: 'A análise visual identificou um ambiente vazio ou quase vazio.', evidence_source: 'model_visual_observation' }))
  if (availableImages >= 1 && richFacts >= 2) candidates.push(opportunity('real_estate_video', 95, { title: 'Transforme suas melhores fotos em uma apresentação', reason: 'O anúncio possui material visual e informações que podem sustentar uma apresentação fora do portal.', benefit: 'Selecione até 5 das melhores imagens para criar um Vídeo Imobiliário e ampliar a divulgação.', evidence: `${formatPtBrQuantity(availableImages, 'imagem')} ${availableImages === 1 ? 'identificada' : 'identificadas'}; o produto utiliza uma seleção de até 5.`, evidence_source: 'listing_metadata' }))
  if (availableImages >= 5) candidates.push(opportunity('smart_carousel', 93, { title: 'Organize suas melhores imagens em sequência', reason: 'Há material visual suficiente para uma apresentação sequencial.', benefit: 'Selecione de 5 a 20 das melhores imagens para criar um Smart Carrossel.', evidence: `${availableImages} imagens foram identificadas; o produto utiliza uma seleção de 5 a 20.`, evidence_source: 'listing_metadata' }))
  if (launchOrOffer) candidates.push(opportunity('commercial_real_estate', 90, { title: 'Crie um comercial para esta oportunidade', reason: 'O conteúdo confirmado apresenta um sinal promocional relevante.', benefit: 'Os diferenciais confirmados podem virar uma peça publicitária para divulgação digital.', evidence: 'O texto confirmado contém lançamento, oferta, oportunidade, condição especial ou alto padrão.', evidence_source: 'confirmed_text' }))
  if (movementReady) candidates.push(opportunity('life_in_property', 85, { title: 'Dê vida a uma imagem adequada', reason: 'A análise visual identificou uma imagem apropriada para movimento.', benefit: 'Uma cena com movimento pode criar outro formato de apresentação do imóvel.', evidence: 'A análise visual marcou uma imagem como adequada para movimento.', evidence_source: 'model_visual_observation' }))
  if (input.inputKind === 'images' && availableImages >= 1 && richFacts >= 3) candidates.push(opportunity('broker_presentation', 80, { title: 'Humanize a apresentação deste imóvel', reason: 'O conjunto reúne material visual e informações objetivas para uma apresentação conduzida pelo corretor.', benefit: 'A presença do corretor pode organizar os diferenciais e criar um novo ponto de contato.', evidence: `${formatPtBrQuantity(availableImages, 'imagem')} e ${formatPtBrQuantity(richFacts, 'grupo')} de fatos confirmados estão disponíveis.`, evidence_source: 'derived_safe_signal' }))
  if (get('price') || launchOrOffer) candidates.push(opportunity('quick_banners', 70, { title: 'Leve a chamada comercial para as redes sociais', reason: 'Há preço ou sinal promocional confirmado para uma mensagem de leitura rápida.', benefit: 'Banners Rápidos podem transformar essa chamada em até 5 peças por entrega.', evidence: get('price') ? `Preço confirmado no anúncio: ${text(get('price'))}.` : 'O texto confirmado contém um sinal promocional.', evidence_source: get('price') ? 'normalized_fact' : 'confirmed_text' }))
  if (richFacts >= 4) candidates.push(opportunity('real_estate_banner', 65, { title: 'Organize os diferenciais em uma peça completa', reason: 'O imóvel reúne informações suficientes para uma peça visual estruturada.', benefit: 'Um Banner Imobiliário pode destacar o principal motivo para conhecer o imóvel.', evidence: `${richFacts} grupos de informações foram confirmados.`, evidence_source: 'derived_safe_signal' }))
  if (description || richFacts >= 2) candidates.push(opportunity('text_campaign', 60, { title: 'Use os fatos confirmados em outros canais', reason: 'As informações disponíveis podem sustentar mensagens específicas além do anúncio original.', benefit: 'A Campanha de Textos adapta os fatos confirmados para outros canais; ela não é gerada automaticamente pelo Raio-X.', evidence: description ? 'O anúncio possui descrição confirmada.' : `${richFacts} grupos de informações foram confirmados.`, evidence_source: description ? 'confirmed_text' : 'derived_safe_signal' }))

  return candidates.sort((a, b) => b.rank - a.rank).slice(0, 5).map(({ rank: _rank, ...item }) => item)
}

const forbiddenPriority = /^(manter|continue|continuar|preservar|seguir com)\b/i
const addImagesPriority = /(?:adicion|inclu|acrescent|coloque|insira).{0,30}(?:mais\s+)?(?:foto|fotos|imagem|imagens)|mais\s+(?:foto|fotos|imagem|imagens)/i
export function buildListingXrayPriorities(priorities: Array<{ area: string; text: string }>, opportunities: ProductOpportunity[], attraction?: { what_can_improve?: string | null; how_to_improve?: string | null }, abundantImages = false) {
  const actionable = priorities.filter(item => item.text.trim() && !forbiddenPriority.test(item.text.trim()) && !/(inconsist|diverg|conflit)/i.test(item.text) && !(abundantImages && addImagesPriority.test(item.text))).slice(0, 1)
  if (attraction?.what_can_improve && attraction.how_to_improve && actionable.length < 2) actionable.push({ area: 'Atração', text: attraction.how_to_improve })
  if (opportunities.length && actionable.length < 3) actionable.push({ area: 'Divulgação', text: `${opportunities[0].cta_label} para ampliar a divulgação deste imóvel.` })
  return actionable.slice(0, 3)
}
