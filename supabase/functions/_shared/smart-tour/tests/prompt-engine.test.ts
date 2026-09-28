import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  OFFICIAL_MATRIX,
  SMART_TOUR_BASE_BRIEFING,
  applySmartTourCustomPresenterSpeech,
  buildPropertyContext,
  buildSmartTourNarration,
  buildSmartTourPrompt,
  buildSmartTourStructuredBriefing,
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

test('has one complete modular Briefing Base and no legacy instruction source', () => {
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

test('compiler resolves modules while keeping fixed Briefing Base rules byte-for-byte', () => {
  const full = buildPrompt({ mode: 'guided_tour', presenterGender: 'female', narration: 'enabled', captions: 'enabled' })
  const clean = buildPrompt({ mode: 'cinematic_tour', presenterGender: 'none', narration: 'disabled', captions: 'disabled' }, '', '')
  for (const fixed of [
    'MISSÃO\nTransformar as fotografias fornecidas',
    'OBJETIVO\nCriar uma visita contínua e natural',
    'TEXTOS CONTROLADOS PELO SMARTCORRETORAI',
    'ESCOPO E RESTRIÇÕES',
    'CENÁRIO PROTEGIDO',
    'PROTAGONISTA CRIATIVO',
    'TRANSFORMAÇÕES AUTORIZADAS',
    'HIERARQUIA OBRIGATÓRIA',
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

test('creative protagonist confines human transformation to the broker', () => {
  const withBroker = buildPrompt({ mode: 'guided_tour', presenterGender: 'female' })
  assert.match(withBroker, /Essa pessoa é o único protagonista criativo humano autorizado/)
  assert.match(withBroker, /movimentos corporais discretos, caminhada natural, gestos suaves, expressões naturais e apresentação do imóvel/)
  assert.match(withBroker, /não pode causar reconstrução, reposicionamento, ocultação ou recorte do cenário protegido/)
  assert.match(withBroker, /Não crie outras pessoas/)
  const withoutBroker = buildPrompt({ mode: 'cinematic_tour', presenterGender: 'none' })
  assert.match(withoutBroker, /MODO SEM CORRETOR/)
  assert.match(withoutBroker, /não existe protagonista humano/)
  assert.match(withoutBroker, /movimento linear de câmera de baixíssima amplitude, a pequenas variações naturais da iluminação já existente e a sombras e reflexos discretos/)
  assert.match(withoutBroker, /O cenário protegido continua imutável/)
  assert.match(withoutBroker, /Não crie pessoas, animais, objetos, móveis ou novos elementos/)
})

test('backend builds the complete narration exclusively from captured property data', () => {
  const narration = (overrides: Partial<typeof property>) => buildSmartTourNarration({ ...property, ...overrides })
  assert.equal(
    narration({ district: 'Copacabana', city: 'Rio de Janeiro', bedrooms: '4', suites: '2', parkingSpaces: '2' }),
    'Conheça este excelente apartamento à venda em Copacabana, Rio de Janeiro. São 4 dormitórios, 2 suítes e 2 vagas de garagem. Agende sua visita.',
  )
  assert.match(narration({ bedrooms: '2', suites: '1', parkingSpaces: '1' }), /São 2 dormitórios, 1 suíte e 1 vaga de garagem\./)
  assert.match(narration({ bedrooms: '1', suites: '1', parkingSpaces: '1' }), /O imóvel possui 1 dormitório, 1 suíte e 1 vaga de garagem\./)
  assert.match(narration({ bedrooms: '3', suites: '0', parkingSpaces: '2' }), /São 3 dormitórios e 2 vagas de garagem\./)
  assert.match(narration({ bedrooms: '2', suites: '1', parkingSpaces: '0' }), /São 2 dormitórios e 1 suíte\./)
  assert.match(narration({ bedrooms: '1', suites: '0', parkingSpaces: '0' }), /O imóvel possui 1 dormitório\./)

  assert.equal(
    narration({ purpose: 'rent', type: 'Casa', district: 'Boa Viagem', city: 'Recife' }),
    'Conheça esta excelente casa para locação em Boa Viagem, Recife. São 2 dormitórios, 1 suíte e 1 vaga de garagem. Agende sua visita.',
  )
  assert.match(narration({ type: 'Apartamento' }), /^Conheça este excelente apartamento /)
  assert.match(narration({ type: 'Cobertura' }), /^Conheça esta excelente cobertura /)
  assert.match(narration({ type: 'Tipo não mapeado' }), /^Conheça este imóvel à venda /)
  assert.match(narration({ district: '', city: 'São Paulo' }), /à venda em São Paulo\./)
  assert.match(narration({ district: 'Copacabana', city: '' }), /à venda em Copacabana\./)
  assert.doesNotMatch(narration({ district: 'Copacabana', city: 'Rio de Janeiro', state: 'RJ' }), /Rio de Janeiro, RJ/)

  const prohibited = /no bairro|na cidade em|suítes em|vagas em|0 suítes|0 vagas/
  for (const values of [
    { bedrooms: '4', suites: '2', parkingSpaces: '2' },
    { bedrooms: '3', suites: '0', parkingSpaces: '2' },
    { bedrooms: '2', suites: '1', parkingSpaces: '0' },
    { bedrooms: '1', suites: '0', parkingSpaces: '0' },
  ]) assert.doesNotMatch(narration(values), prohibited)
})

test('Gemini receives the ready narration and is forbidden from rewriting it', () => {
  const enabled = buildPrompt({ mode: 'cinematic_tour', narration: 'enabled' })
  assert.match(enabled, /"Conheça este excelente apartamento à venda em Moema, São Paulo\. São 2 dormitórios, 1 suíte e 1 vaga de garagem\. Agende sua visita\."/)
  assert.match(enabled, /Utilize exatamente o texto abaixo/)
  assert.match(enabled, /Não altere\. Não reescreva\. Não complemente\. Não substitua palavras\. Não adicione informações\. Não mude a ordem\./)
  assert.match(enabled, /Não improvise e não resuma/)
  assert.match(enabled, /Narre exatamente o texto fornecido em Português do Brasil/)
  assert.match(enabled, /pronúncia, gramática e vocabulário exclusivamente brasileiros/)
  assert.match(enabled, /Não leia diferenciais, destaques, CTA ou telefone/)
  assert.match(enabled, /Não crie frases adicionais/)
  assert.doesNotMatch(enabled, /Principais diferenciais/)
  assert.doesNotMatch(enabled, /frase-modelo|\{\{TIPOLOGIA\}\}|\{\{FINALIDADE_NATURAL\}\}/)
  assert.match(enabled, /jamais antecipe ambientes/)
  assert.doesNotMatch(buildPrompt({ mode: 'cinematic_tour', narration: 'disabled' }), /MÓDULO NARRAÇÃO/)
})

test('caption module makes every available commercial scene caption mandatory', () => {
  const enabled = buildPrompt({ mode: 'cinematic_tour', captions: 'enabled' })
  assert.match(enabled, /MÓDULO LEGENDAS — OBRIGATÓRIO QUANDO PRESENTE/)
  assert.match(enabled, /As legendas são obrigatórias quando este módulo estiver presente/)
  assert.match(enabled, /no máximo uma informação comercial por cena/)
  assert.match(enabled, /Renderize cada legenda em uma zona inferior segura, discreta e legível/)
  assert.match(enabled, /Não cubra o rosto do corretor ou da corretora nem elementos importantes do imóvel/)
  assert.match(enabled, /distância adequada das bordas e dos controles típicos de Reels e Shorts/)
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
  assert.match(enabled, /As legendas fazem parte obrigatória da geração quando o módulo LEGENDAS estiver ativo/)
  assert.match(enabled, /Não podem ser omitidas e devem aparecer obrigatoriamente/)
  assert.match(enabled, /Exiba exatamente cinco legendas comerciais quando existirem informações suficientes, com uma legenda por cena/)
  assert.match(enabled, /Nunca substitua legendas por narração\. Nunca omita legendas\. Nunca transforme legendas em elementos opcionais\./)
  assert.doesNotMatch(buildPrompt({ mode: 'cinematic_tour', captions: 'disabled' }), /MÓDULO LEGENDAS/)
  assert.doesNotMatch(buildPrompt({ mode: 'cinematic_tour', captions: 'disabled' }), /REFORÇO DE LEGENDAS/)
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

test('final CTA content remains exactly equal to the SmartCorretorAI text', () => {
  const cta = 'Agende sua visita — condição 100% exclusiva! contato@smartcorretor.ai https://smartcorretor.ai/imovel?id=42&origem=tour'
  const prompt = buildPrompt({ mode: 'guided_tour' }, cta, '')
  assert.ok(prompt.includes(JSON.stringify(cta)))
  assert.match(prompt, /O conteúdo do CTA deverá ser reproduzido exatamente como recebido, caractere por caractere/)
  assert.match(prompt, /Nenhum caractere poderá ser alterado/)
  assert.match(prompt, /Não recrie, interprete, corrija, complete, reformate ou substitua o conteúdo textual do cartão final/)
})

test('final card preserves phones, e-mails and URLs and forbids creating alternatives', () => {
  const phone = '+55 (11) 98765-4321'
  const email = 'contato+tour@smartcorretor.ai'
  const url = 'https://smartcorretor.ai/imovel/ABC-123?utm_source=smart-tour&ref=CTA'
  const cta = `Fale comigo | ${email} | ${url}`
  const prompt = buildPrompt({ mode: 'guided_tour' }, cta, phone)

  assert.ok(prompt.includes(JSON.stringify(phone)))
  assert.ok(prompt.includes(email))
  assert.ok(prompt.includes(url))
  assert.match(prompt, /É proibido criar telefone, alterar telefone, criar e-mail, alterar e-mail, criar URL, alterar URL, criar frases, corrigir frases ou completar frases/)
})

test('disabling CTA removes CTA and phone modules and strips the profile phone', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' }, '', '(11) 98765-4321')
  assert.doesNotMatch(prompt, /MÓDULO CTA|Na mesma tela final|98765-4321/)
  assert.doesNotMatch(prompt, /\"cta\":|\"telefone\":/)
  assert.doesNotMatch(prompt, /REFORÇO DETERMINÍSTICO DO CTA FINAL/)
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
    'Não crie nenhum texto além dos textos autorizados neste briefing',
    'Na narração, vocalize somente o texto completo fornecido pelo SmartCorretorAI',
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

test('protected scene semantically locks every visual element', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' })
  assert.match(prompt, /Renderize exclusivamente em formato vertical 9:16/)
  assert.match(prompt, /Preserve o máximo possível da composição original dentro do quadro vertical/)
  assert.match(prompt, /não corte elementos essenciais do ambiente para acomodar o apresentador/)
  assert.match(prompt, /Todo o ambiente visível em cada fotografia constitui um cenário protegido/)
  for (const item of ['arquitetura', 'paredes', 'pisos', 'tetos', 'portas', 'janelas', 'esquadrias', 'telhado', 'bancadas', 'louças', 'metais', 'móveis existentes', 'decoração', 'objetos', 'acabamentos', 'materiais', 'cores', 'iluminação física existente', 'proporções', 'perspectiva', 'orientação', 'enquadramento', 'composição visual']) assert.match(prompt, new RegExp(item))
  for (const action of ['recriado', 'reinterpretado', 'redesenhado', 'invertido', 'espelhado', 'reposicionado', 'ampliado', 'reduzido', 'removido', 'substituído', 'recortado', 'ocultado', 'transformado em close', 'mostrado a partir de outro ângulo']) assert.match(prompt, new RegExp(action))
  assert.match(prompt, /A fotografia original deve permanecer imediatamente reconhecível durante toda a cena/)
  assert.match(prompt, /exatamente uma fotografia por cena como única fonte visual/)
})

test('authorized transformations remain narrow and subordinate to fidelity', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' })
  assert.match(prompt, /TRANSFORMAÇÕES AUTORIZADAS/)
  assert.match(prompt, /movimento de câmera linear; movimento de baixíssima amplitude; pan suave; push-in ou pull-back mínimo/)
  assert.match(prompt, /pequenas variações naturais de luminosidade já compatíveis com a fotografia; sombras e reflexos extremamente sutis/)
  for (const prohibition of ['mudar o horário do dia', 'criar novas fontes de luz', 'modificar janelas ou luminárias', 'alterar cores', 'esconder elementos', 'criação de áreas não visíveis', 'mudar a composição original']) assert.match(prompt, new RegExp(prohibition))
  assert.match(prompt, /Prioridade 1: preservar o cenário protegido/)
  assert.match(prompt, /Prioridade 2: manter orientação, enquadramento, composição e perspectiva da fotografia/)
  assert.match(prompt, /Prioridade 3: executar apenas as transformações autorizadas/)
  assert.match(prompt, /Se existir conflito entre movimento cinematográfico e fidelidade visual, a fidelidade visual deve prevalecer/)
})

test('small rooms preserve the overview and never become close-ups', () => {
  const prompt = buildPrompt({ mode: 'guided_tour' })
  assert.match(prompt, /AMBIENTES PEQUENOS/)
  assert.match(prompt, /Não aproxime apenas pia, bancada, vaso, box ou outro objeto/)
  assert.match(prompt, /Mantenha os principais elementos visíveis conforme a fotografia original/)
  assert.match(prompt, /não transforme ambientes pequenos em closes/)
})

test('structured data preserves literals and omits unauthorized phone-like text', () => {
  const value = buildPropertyContext({ ...property, description: 'Ligue (21) 98765-4321', highlights: ['Contato 11 3456-7890'] }, 'CTA 31 99876-5432')
  assert.match(value, /\"tipologia\": \"Apartamento\"/)
  assert.match(value, /\"descricaoResumida\": \"2 dormitórios • 1 suíte • 1 vaga\"/)
  assert.doesNotMatch(value, /98765-4321|3456-7890|99876-5432/)
})

test('sale and rental get controlled exact display purpose', () => {
  assert.match(buildPrompt({ mode: 'guided_tour' }), /apartamento à venda em Moema, São Paulo/)
  assert.match(buildPrompt({ mode: 'guided_tour' }, 'Fale comigo', '', { ...property, purpose: 'rent' }), /apartamento para locação em Moema, São Paulo/)
  assert.doesNotMatch(buildPrompt({ mode: 'guided_tour' }), /apartamento venda|apartamento locação/)
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

test('custom presenter speech is literal, enables narration, and is limited to 25 words server-side', () => {
  const paths = ['u/1.jpg']
  const base = {
    clientRequestId: 'custom-speech',
    imagePaths: paths,
    imageOrder: [...paths],
    property,
    selectedCta: '',
    includeProfessionalPhone: false,
    language: 'pt-BR',
  }
  const exactSpeech = '  Conheça este imóvel incrível, pronto para receber seus melhores momentos.  '
  const validated = validateSmartTourRequest({
    ...base,
    generation: normalizeGeneration({ mode: 'guided_tour', presenterGender: 'female', presenterSpeechMode: 'custom', presenterCustomSpeech: exactSpeech, narration: 'disabled' }),
  })
  assert.equal(validated.generation.presenterSpeechMode, 'custom')
  assert.equal(validated.generation.presenterCustomSpeech, exactSpeech)
  assert.equal(validated.generation.narration, 'enabled')

  const briefing = buildSmartTourStructuredBriefing({ generation: validated.generation, property, selectedCta: '', imagePaths: paths, language: 'pt-BR' })
  const customized = applySmartTourCustomPresenterSpeech(briefing, validated.generation.presenterCustomSpeech)
  assert.equal(customized.timeline.narracao[0].texto, exactSpeech)
  assert.equal(customized.cenas[0].narracao, exactSpeech)
  assert.match(JSON.stringify(customized.regrasObrigatorias), /A narração deve usar exatamente o texto literal/)

  const words25 = Array.from({ length: 25 }, (_, index) => `palavra${index + 1}`).join(' ')
  const generation = { mode: 'guided_tour', presenterGender: 'male', presenterSpeechMode: 'custom', presenterCustomSpeech: words25, narration: 'enabled' }
  assert.equal(validateSmartTourRequest({ ...base, generation }).generation.presenterCustomSpeech, words25)
  assert.throws(() => validateSmartTourRequest({ ...base, generation: { ...generation, presenterCustomSpeech: '' } }), /invalid_presenter_custom_speech/)
  assert.throws(() => validateSmartTourRequest({ ...base, generation: { ...generation, presenterCustomSpeech: `${words25} excedente` } }), /invalid_presenter_custom_speech/)
})

test('legacy generation data defaults to automatic presenter speech', () => {
  const normalized = normalizeGeneration({ mode: 'guided_tour', presenterGender: 'female', narration: 'enabled' })
  assert.equal(normalized.presenterSpeechMode, 'automatic')
  assert.equal(normalized.presenterCustomSpeech, '')
})

test('guided tour presenter gender accepts only the explicit supported values', () => {
  assert.equal(normalizeGeneration({ mode: 'guided_tour', presenterGender: 'male' }).presenterGender, 'male')
  assert.equal(normalizeGeneration({ mode: 'guided_tour', presenterGender: 'female' }).presenterGender, 'female')
  assert.equal(normalizeGeneration({ mode: 'guided_tour', presenterGender: 'none' }).presenterGender, 'none')
  assert.equal(normalizeGeneration({ mode: 'guided_tour', presenterGender: 'unexpected' as never }).presenterGender, 'none')
})

test('custom presenter speech preserves independent caption and CTA choices', () => {
  const normalized = normalizeGeneration({
    mode: 'guided_tour', presenterGender: 'male', presenterSpeechMode: 'custom', presenterCustomSpeech: 'Fala literal.',
    narration: 'enabled', captions: 'enabled',
  })
  const briefing = buildSmartTourStructuredBriefing({ generation: normalized, property, selectedCta: 'Fale comigo', imagePaths: ['u/1.jpg'], language: 'pt-BR' })
  assert.equal(normalized.captions, 'enabled')
  assert.equal(briefing.configuracoes.ctaAtivo, true)
  assert.equal(briefing.timeline.cta.texto, 'Fale comigo')
})

test('custom speech remains literal without a virtual presenter', () => {
  const normalized = normalizeGeneration({
    mode: 'guided_tour', presenterGender: 'none', presenterSpeechMode: 'custom', presenterCustomSpeech: 'Fala literal sem apresentador.',
    narration: 'enabled', captions: 'enabled',
  })
  const briefing = buildSmartTourStructuredBriefing({ generation: normalized, property, selectedCta: 'Fale comigo', imagePaths: ['u/1.jpg'], language: 'pt-BR' })
  const customized = applySmartTourCustomPresenterSpeech(briefing, normalized.presenterCustomSpeech)
  assert.equal(normalized.presenterSpeechMode, 'custom')
  assert.equal(customized.apresentador.tipo, 'nenhum')
  assert.equal(customized.timeline.narracao[0].texto, 'Fala literal sem apresentador.')
  assert.equal(customized.configuracoes.legendasAtivas, true)
  assert.equal(customized.timeline.cta.texto, 'Fale comigo')
})
