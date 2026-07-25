import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  OFFICIAL_MATRIX,
  SMART_TOUR_BASE_BRIEFING,
  buildPropertyContext,
  buildSmartTourPrompt,
  normalizeGeneration,
  resolveSmartTourProfessionalPhone,
  validateSmartTourRequest,
} from '../index.ts'

const property = {
  purpose: 'sale',
  type: 'Apartamento',
  city: 'São Paulo',
  district: 'Moema',
  bedrooms: '2',
  suites: '1',
  parkingSpaces: '1',
  area: '85',
  stage: 'Pronto para morar',
  highlights: ['Vista livre', 'Varanda gourmet', 'Lazer completo'],
}

const buildPrompt = (
  generation: Parameters<typeof normalizeGeneration>[0],
  selectedCta = 'Fale comigo',
  phone = '(11) 99999-9999',
  propertyOverride = property,
) => buildSmartTourPrompt({
  generation: normalizeGeneration(generation),
  property: propertyOverride,
  selectedCta,
  phone,
})

test('has one complete modular Briefing Base as the only instruction source', () => {
  const source = readFileSync(new URL('../build-prompt.ts', import.meta.url), 'utf8')
  assert.equal((source.match(/export const SMART_TOUR_BASE_BRIEFING =/g) || []).length, 1)
  for (const module of ['CORRETOR', 'NARRACAO', 'LEGENDAS', 'CTA', 'TELEFONE']) {
    assert.equal((SMART_TOUR_BASE_BRIEFING.match(new RegExp(`\\[\\[MODULE:${module}\\]\\]`, 'g')) || []).length, 1)
  }
  assert.doesNotMatch(source, /SMART_TOUR_VISUAL_CORE|champion prompt|Prompt Campeão/i)
})

test('global Brazilian Portuguese rule is the first rule in the Briefing Base', () => {
  assert.ok(SMART_TOUR_BASE_BRIEFING.startsWith('REGRA GLOBAL OBRIGATÓRIA — PORTUGUÊS DO BRASIL'))
  assert.match(SMART_TOUR_BASE_BRIEFING, /exclusivamente Português do Brasil \(pt-BR\)/)
  assert.match(SMART_TOUR_BASE_BRIEFING, /Português de Portugal, misturar idiomas/)
  const prompt = buildPrompt({ mode: 'guided_tour', language: 'en-US' })
  assert.match(prompt, /exclusivamente Português do Brasil/)
  assert.doesNotMatch(prompt, /entire final presentation must be in English|selected language/i)
})

test('request text contains structured data, compiled base and remaining modules in order', () => {
  const prompt = buildPrompt({ mode: 'guided_tour', presenterGender: 'female' })
  const dataIndex = prompt.indexOf('DADOS ESTRUTURADOS')
  const briefingIndex = prompt.indexOf('BRIEFING BASE COMPILADO')
  const modulesIndex = prompt.indexOf('MÓDULOS RESTANTES APÓS A COMPILAÇÃO')
  assert.ok(dataIndex === 0)
  assert.ok(dataIndex < briefingIndex && briefingIndex < modulesIndex)
  assert.doesNotMatch(prompt, /\[\[\/?MODULE:|\{\{[A-Z_]+\}\}/)
})

test('compiler only removes disabled modules and keeps fixed rules byte-for-byte', () => {
  const full = buildPrompt({ mode: 'guided_tour', presenterGender: 'female', narration: 'enabled', captions: 'enabled' })
  const clean = buildPrompt({ mode: 'cinematic_tour', presenterGender: 'none', narration: 'disabled', captions: 'disabled' }, '', '')
  for (const fixed of [
    'MISSÃO\nTransformar as fotografias fornecidas',
    'OBJETIVO\nCriar uma visita contínua e natural',
    'TEXTOS CONTROLADOS PELO SMARTCORRETORAI',
    'ESCOPO E RESTRIÇÕES',
    'PROTAGONISTA CRIATIVO E MOVIMENTO CINEMATOGRÁFICO',
    'REGRAS GERAIS',
  ]) {
    assert.match(full, new RegExp(fixed))
    assert.match(clean, new RegExp(fixed))
  }
  for (const module of ['CORRETOR', 'NARRAÇÃO', 'LEGENDAS', 'CTA']) assert.doesNotMatch(clean, new RegExp(`MÓDULO ${module}`))
})

test('presenter option only controls the broker module', () => {
  const female = buildPrompt({ mode: 'guided_tour', presenterGender: 'female' })
  const male = buildPrompt({ mode: 'guided_tour', presenterGender: 'male' })
  const none = buildPrompt({ mode: 'guided_tour', presenterGender: 'none' })
  assert.match(female, /MÓDULO CORRETOR[\s\S]*corretor ou corretora conforme o valor literal indicado em apresentador/)
  assert.match(female, /"apresentador": "corretora"/)
  assert.match(male, /"apresentador": "corretor"/)
  assert.doesNotMatch(none, /MÓDULO CORRETOR/)
  assert.match(none, /Se o módulo CORRETOR não estiver presente, não mostre pessoas, silhuetas, reflexos, sombras, mãos, rostos ou partes do corpo/)
})

test('creative protagonist limits broker mode to broker movement and existing light', () => {
  const withBroker = buildPrompt({ mode: 'guided_tour', presenterGender: 'female' })
  assert.match(withBroker, /dois focos estreitos e controlados: a movimentação natural e discreta do corretor ou da corretora e variações extremamente sutis da iluminação já existente/)
  assert.match(withBroker, /O imóvel deve permanecer como cenário protegido e preservado/)
  assert.match(withBroker, /Não mude radicalmente o horário do dia, não crie fontes de luz/)
  assert.match(withBroker, /Use apenas pequenas variações de luminosidade, sombras e reflexos/)
  assert.match(withBroker, /A iluminação é um foco criativo secundário/)
  const withoutBroker = buildPrompt({ mode: 'cinematic_tour', presenterGender: 'none' })
  assert.match(withoutBroker, /movimentos cinematográficos suaves de câmera e em pequenas variações naturais da iluminação já existente/)
  assert.match(withoutBroker, /Preserve todo o restante fiel às fotografias/)
})

test('narration uses the required human format without reading differentiators', () => {
  const enabled = buildPrompt({ mode: 'cinematic_tour', narration: 'enabled' })
  assert.match(enabled, /"Conheça este excelente Apartamento à venda no bairro Moema, em São Paulo\. São 2 dormitórios, 1 suíte e 1 vaga\. Agende sua visita\."/)
  assert.match(enabled, /pronúncia, gramática e vocabulário exclusivamente brasileiros/)
  assert.match(enabled, /Não leia, mencione nem transforme em fala a lista de diferenciais/)
  assert.match(enabled, /Não narre palavras isoladas como "portaria", "ventilação"/)
  assert.match(enabled, /adequada a um vídeo de aproximadamente 10 segundos/)
  assert.match(enabled, /"Agende sua visita" é fixo, encerra a narração e é independente do CTA visual final/)
  assert.doesNotMatch(enabled, /Principais diferenciais/)
  assert.match(enabled, /jamais antecipe ambientes/)
  assert.doesNotMatch(buildPrompt({ mode: 'cinematic_tour', narration: 'disabled' }), /MÓDULO NARRAÇÃO/)
})

test('caption module requires at most five ordered commercial scene captions', () => {
  const enabled = buildPrompt({ mode: 'cinematic_tour', captions: 'enabled' })
  assert.match(enabled, /MÓDULO LEGENDAS — OBRIGATÓRIO QUANDO PRESENTE/)
  assert.match(enabled, /As legendas são obrigatórias quando este módulo estiver presente/)
  assert.match(enabled, /no máximo uma informação comercial por cena/)
  assert.match(enabled, /Não repita finalidade, tipologia, dormitórios, suítes ou vagas/)
  const sequence = ['CENA 1 — estadoDoImovel', 'CENA 2 — primeiro item de diferenciais', 'CENA 3 — item de localização ainda não utilizado', 'CENA 4 — segundo item de diferenciais', 'CENA 5 — preco']
  let previous = -1
  for (const item of sequence) {
    const current = enabled.indexOf(item)
    assert.ok(current > previous, item)
    previous = current
  }
  assert.match(enabled, /preco, exatamente como recebido, somente quando o campo existir e estiver preenchido/)
  assert.match(enabled, /Se preco não existir ou estiver vazio, use o próximo item de diferenciais/)
  assert.match(enabled, /Se houver menos de cinco informações válidas, use apenas as disponíveis e não preencha espaços/)
  assert.match(enabled, /O CTA final permanece separado dessas cinco legendas/)
  assert.doesNotMatch(buildPrompt({ mode: 'cinematic_tour', captions: 'disabled' }), /MÓDULO LEGENDAS/)
})

test('caption price is available only when supplied and authorized', () => {
  const withoutPrice = buildPrompt({ mode: 'cinematic_tour', captions: 'enabled' }, '', '')
  const withPrice = buildPrompt({ mode: 'cinematic_tour', captions: 'enabled' }, '', '', { ...property, price: 'R$ 850.000' })
  assert.match(withoutPrice, /"preco": ""/)
  assert.match(withPrice, /"preco": "R\$ 850\.000"/)
  assert.match(withPrice, /somente quando o campo existir e estiver preenchido, pois sua presença representa autorização de exibição/)
  assert.match(withoutPrice, /Se preco não existir ou estiver vazio, use o próximo item de diferenciais ainda não utilizado/)
})

test('differentials are literal, ordered, capped at ten and never invented', () => {
  const highlights = Array.from({ length: 12 }, (_, index) => `Diferencial ${index + 1}`)
  const prompt = buildPrompt({ mode: 'cinematic_tour', narration: 'enabled', captions: 'enabled' }, '', '', { ...property, highlights })
  for (const value of highlights.slice(0, 10)) assert.match(prompt, new RegExp(value))
  assert.doesNotMatch(prompt, /Diferencial 11|Diferencial 12/)
  assert.ok(prompt.indexOf('Diferencial 1') < prompt.indexOf('Diferencial 2'))
  assert.match(prompt, /não invente diferenciais/i)
})

test('CTA and phone are exact nested modules shown only on the final screen', () => {
  const cta = 'Agende sua visita agora'
  const phone = '(11) 98765-4321'
  const prompt = buildPrompt({ mode: 'guided_tour' }, cta, phone)
  assert.match(prompt, /MÓDULO CTA — OBRIGATÓRIO QUANDO PRESENTE/)
  assert.match(prompt, /uma única tela final/)
  assert.match(prompt, /"Agende sua visita agora"/)
  assert.match(prompt, /Na mesma tela final[\s\S]*"\(11\) 98765-4321"/)
  assert.match(prompt, /Não fale o CTA\. Não crie frases comerciais/)
})

test('disabling CTA removes CTA and phone modules and strips the profile phone', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' }, '', '(11) 98765-4321')
  assert.doesNotMatch(prompt, /MÓDULO CTA|Na mesma tela final|98765-4321/)
  assert.doesNotMatch(prompt, /\"cta\":|\"telefone\":/)
  assert.match(prompt, /sem CTA, nenhuma tela final comercial, CTA, telefone ou contato/)
})

test('CTA without authorized phone keeps CTA and removes only phone module', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' }, 'Fale comigo', '')
  assert.match(prompt, /MÓDULO CTA/)
  assert.doesNotMatch(prompt, /Na mesma tela final, exiba exatamente o telefone abaixo/)
  assert.doesNotMatch(prompt, /\"telefone\":/)
})

test('all SmartCorretorAI text-control prohibitions are explicit', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' })
  for (const rule of [
    'Não crie nenhum texto',
    'Não crie CTA diferente',
    'não complemente o CTA',
    'não reescreva finalidade, tipologia, bairro, cidade ou descrição resumida',
    'não invente diferenciais',
    'exatamente como aparece nos DADOS ESTRUTURADOS ou nos campos literais compilados neste Briefing Base, caractere por caractere',
  ]) assert.match(prompt, new RegExp(rule, 'i'))
})

test('fixed visual restrictions preserve the property and image order', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' })
  for (const item of ['arquitetura', 'acabamentos', 'móveis existentes', 'decoração', 'objetos', 'portas', 'janelas', 'pisos', 'tetos', 'proporções']) assert.match(prompt, new RegExp(item))
  assert.match(prompt, /exatamente uma fotografia por cena como única fonte visual/)
  assert.match(prompt, /Utilize todas as fotografias e respeite integralmente a ordem recebida/)
  assert.match(prompt, /não contempla Virtual Staging, casal, família, pessoas vivendo no imóvel, criação de mobiliário ou alterações arquitetônicas/)
})

test('each original photograph remains the immutable master frame', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' })
  assert.match(prompt, /Cada fotografia é o quadro mestre e a referência visual imutável de sua cena/)
  assert.match(prompt, /não inverta horizontalmente, não espelhe, não troque o lado dos elementos/)
  assert.match(prompt, /não mude o ponto de vista e não reconstrua o ambiente a partir de outro ângulo/)
  assert.match(prompt, /não aproxime excessivamente um único objeto/)
  assert.match(prompt, /não transforme uma fotografia ampla em close/)
  assert.match(prompt, /movimentos de câmera muito suaves e de baixa amplitude/)
  assert.match(prompt, /Evite órbitas, giros, rotações amplas/)
  assert.match(prompt, /não foque apenas em pia, bancada ou outro objeto/i)
  assert.match(prompt, /exatamente uma fotografia por cena como única fonte visual/)
})

test('structured data preserves literals and omits unauthorized phone-like text', () => {
  const value = buildPropertyContext({ ...property, description: 'Ligue (21) 98765-4321', highlights: ['Contato 11 3456-7890'] }, 'CTA 31 99876-5432')
  assert.match(value, /\"tipologia\": \"Apartamento\"/)
  assert.match(value, /\"descricaoResumida\": \"2 dormitórios • 1 suíte • 1 vaga\"/)
  assert.doesNotMatch(value, /98765-4321|3456-7890|99876-5432/)
})

test('sale and rental get controlled exact display purpose', () => {
  assert.match(buildPrompt({ mode: 'guided_tour' }), /Apartamento à venda no bairro Moema/)
  assert.match(buildPrompt({ mode: 'guided_tour' }, 'Fale comigo', '', { ...property, purpose: 'rent' }), /Apartamento para locação no bairro Moema/)
  assert.doesNotMatch(buildPrompt({ mode: 'guided_tour' }), /Apartamento venda|Apartamento locação/)
})

test('all official combinations compile without contradictions or legacy staging instructions', () => {
  assert.equal(OFFICIAL_MATRIX.length, 19)
  for (const generation of OFFICIAL_MATRIX) {
    const prompt = buildSmartTourPrompt({ generation, property, selectedCta: 'Agende sua visita' })
    assert.doesNotMatch(prompt, /apply virtual staging|plausible, removable furniture|before-and-after/i)
    assert.doesNotMatch(prompt, /\[\[\/?MODULE:|\{\{[A-Z_]+\}\}/)
  }
})

test('backend continues normalizing legacy staging inputs away', () => {
  const normalized = normalizeGeneration({ mode: 'smart_staging', furniture: 'virtual_staging', stagingPresentation: 'before_after' })
  assert.equal(normalized.furniture, 'original')
  assert.equal(normalized.stagingPresentation, 'final_only')
})

test('professional phone resolution contract remains unchanged', () => {
  assert.equal(resolveSmartTourProfessionalPhone(true, '11987654321'), '(11) 98765-4321')
  assert.equal(resolveSmartTourProfessionalPhone(false, '11987654321'), '')
  assert.equal(resolveSmartTourProfessionalPhone(true, 'invalid', '1134567890'), '(11) 3456-7890')
  for (const phone of ['', '12345', '551198765432', '00000000000']) assert.equal(resolveSmartTourProfessionalPhone(true, phone), '')
})

test('request payload validation contract remains unchanged', () => {
  const paths = Array.from({ length: 5 }, (_, index) => `u/${index + 1}.jpg`)
  const base = {
    clientRequestId: 'abc',
    imagePaths: paths,
    imageOrder: [...paths],
    property,
    generation: normalizeGeneration({ mode: 'narrated_tour' }),
    selectedCta: 'CTA',
    includeProfessionalPhone: false,
    language: 'pt-BR',
  }
  const validated = validateSmartTourRequest(base)
  assert.deepEqual(validated.imagePaths, paths)
  assert.deepEqual(validated.imageOrder, paths)
  const six = Array.from({ length: 6 }, (_, index) => `u/${index + 1}.jpg`)
  assert.throws(() => validateSmartTourRequest({ ...base, imagePaths: six, imageOrder: six }), /invalid_image_count/)
  assert.throws(() => validateSmartTourRequest({ ...base, imagePaths: ['u/1.jpg', 'u/1.jpg'], imageOrder: ['u/1.jpg', 'u/1.jpg'] }), /invalid_image_count/)
})
