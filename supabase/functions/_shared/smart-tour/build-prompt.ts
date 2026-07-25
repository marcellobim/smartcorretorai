import type { PropertyContext, SmartTourGenerationConfig } from './types.ts'
import { normalizeGeneration } from './validation.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'

type BriefingModule = 'CORRETOR' | 'NARRACAO' | 'LEGENDAS' | 'CTA' | 'TELEFONE'

const MODULE_PATTERN = /\[\[MODULE:(CORRETOR|NARRACAO|LEGENDAS|CTA|TELEFONE)\]\]([\s\S]*?)\[\[\/MODULE:\1\]\]/g

/**
 * Única fonte de instruções do Smart Tour. O compilador abaixo apenas preenche
 * dados controlados pelo sistema e remove módulos que o usuário desativou.
 */
export const SMART_TOUR_BASE_BRIEFING = `REGRA GLOBAL OBRIGATÓRIA — PORTUGUÊS DO BRASIL
Toda a geração deve utilizar exclusivamente Português do Brasil (pt-BR), incluindo narração, legendas, CTA, textos e qualquer palavra exibida no vídeo. É proibido usar Português de Portugal, misturar idiomas ou utilizar qualquer idioma diferente do Português do Brasil.

MISSÃO
Transformar as fotografias fornecidas em um Smart Tour imobiliário cinematográfico, realista e visualmente fiel. As fotografias são a única fonte visual e a verdade absoluta sobre o imóvel.

OBJETIVO
Criar uma visita contínua e natural ao imóvel. O imóvel permanece como protagonista e cenário preservado. Anime a câmera, nunca o imóvel.

TEXTOS CONTROLADOS PELO SMARTCORRETORAI
Não crie nenhum texto além das palavras fixas da frase-modelo definida no módulo NARRAÇÃO. Não altere, traduza, complete, resuma, corrija, reformate, reescreva ou combine os valores recebidos. Não crie CTA diferente, não complemente o CTA, não reescreva finalidade, tipologia, bairro, cidade ou descrição resumida e não invente diferenciais. Utilize cada valor autorizado exatamente como aparece nos DADOS ESTRUTURADOS ou nos campos literais compilados neste Briefing Base, caractere por caractere. Não exiba nomes de campos, instruções, placeholders ou metadados.

ESCOPO E RESTRIÇÕES
Este produto não contempla Virtual Staging, casal, família, pessoas vivendo no imóvel, criação de mobiliário ou alterações arquitetônicas. A única pessoa permitida é o corretor ou a corretora descrito no módulo CORRETOR, quando esse módulo estiver presente. Se o módulo CORRETOR não estiver presente, não mostre pessoas, silhuetas, reflexos, sombras, mãos, rostos ou partes do corpo.
Preserve integralmente arquitetura, acabamentos, móveis existentes, decoração, objetos, portas, janelas, pisos, tetos, iluminação, cores, proporções, layout, área externa e paisagismo existentes.
Não redesenhe, modernize, reforme, aprimore, substitua, remova ou acrescente elementos. Não crie móveis, cômodos, passagens, varandas, ângulos, pontos de vista ou atributos não comprovados pelas fotografias.
Utilize exatamente uma fotografia por cena como única fonte visual. Nunca combine, sobreponha, mescle, empilhe ou use duas fotografias na mesma cena. Utilize todas as fotografias e respeite integralmente a ordem recebida.
Cada fotografia é o quadro mestre e a referência visual imutável de sua cena. Preserve sua orientação original e não inverta horizontalmente, não espelhe, não troque o lado dos elementos, não mude o ponto de vista e não reconstrua o ambiente a partir de outro ângulo.
Não altere a composição principal, não aproxime excessivamente um único objeto, não recorte partes importantes do ambiente e não transforme uma fotografia ampla em close. Mantenha visíveis os principais elementos da imagem original; ela deve continuar imediatamente reconhecível durante toda a cena.
Use somente movimentos de câmera muito suaves e de baixa amplitude. Evite órbitas, giros, rotações amplas e qualquer movimento que exija imaginar áreas não mostradas. Não gere conteúdo fora dos limites visuais conhecidos da fotografia.
Em ambientes pequenos, inclusive banheiros, preserve a visão geral. Não foque apenas em pia, bancada ou outro objeto; mantenha box, janela, paredes e demais elementos relevantes visíveis conforme a fotografia original.

PROTAGONISTA CRIATIVO E MOVIMENTO CINEMATOGRÁFICO
Quando o módulo CORRETOR estiver ausente, concentre toda a criatividade exclusivamente em movimentos cinematográficos suaves de câmera e em pequenas variações naturais da iluminação já existente. Preserve todo o restante fiel às fotografias.
Utilize somente movimentos fisicamente possíveis e sustentados pela fotografia: caminhada lenta estabilizada, dolly suave, pan suave, tilt suave, aproximação suave, afastamento suave e pequenas mudanças naturais de perspectiva.
A câmera é apenas o ponto de vista invisível. Nunca mostre câmera, celular, gimbal, estabilizador, tripé, drone, operador ou equipamento de gravação, inclusive em reflexos, espelhos, janelas ou sombras.
Cada ambiente deve conduzir naturalmente ao seguinte somente pela ordem das fotografias e pelo movimento dentro de cada fotografia. Nunca antecipe um ambiente que ainda não apareceu.

[[MODULE:CORRETOR]]
MÓDULO CORRETOR
Crie exatamente uma pessoa profissional — corretor ou corretora conforme o valor literal indicado em apresentador nos DADOS ESTRUTURADOS — realista e consistente durante todo o vídeo. Concentre a transformação criativa exclusivamente em dois focos estreitos e controlados: a movimentação natural e discreta do corretor ou da corretora e variações extremamente sutis da iluminação já existente na fotografia. O imóvel deve permanecer como cenário protegido e preservado.
Não altere a posição, a orientação, a composição, a arquitetura, os móveis, os objetos, os materiais, as cores ou as proporções do imóvel. A pessoa não pode encobrir detalhes arquitetônicos, competir com o imóvel ou provocar qualquer alteração visual no ambiente. Nenhuma outra pessoa é permitida.
Trabalhe somente com luz compatível com a fotografia. Não mude radicalmente o horário do dia, não crie fontes de luz, não modifique janelas, luminárias ou aberturas, não apague elementos e não transforme a cena em noite. Use apenas pequenas variações de luminosidade, sombras e reflexos. A iluminação é um foco criativo secundário para ajudar a preservar o imóvel, nunca uma transformação visual ampla.
[[/MODULE:CORRETOR]]

[[MODULE:NARRACAO]]
MÓDULO NARRAÇÃO — OBRIGATÓRIO QUANDO PRESENTE
Apresente o imóvel com tom humano, curto e comercial de um corretor, pronúncia, gramática e vocabulário exclusivamente brasileiros. Use exatamente esta frase-modelo, sem acrescentar, remover ou substituir informações:
"Conheça este excelente {{TIPOLOGIA}} {{FINALIDADE_NATURAL}} no bairro {{BAIRRO}}, em {{CIDADE}}. São {{DESCRICAO_NARRADA}}. Agende sua visita."
A finalidade natural deve ser exatamente "à venda" para Venda e "para locação" para Locação. Nunca produza construções artificiais como "apartamento venda" ou "apartamento locação".
Não leia, mencione nem transforme em fala a lista de diferenciais. Não narre palavras isoladas como "portaria", "ventilação" ou equivalentes. Não invente informações e não altere finalidade, tipologia, bairro, cidade ou descrição resumida.
Mantenha a narração curta, natural, sincronizada e adequada a um vídeo de aproximadamente 10 segundos. Termine-a por completo antes da tela final e jamais antecipe ambientes. O convite narrado "Agende sua visita" é fixo, encerra a narração e é independente do CTA visual final; não fale o CTA nem o telefone.
[[/MODULE:NARRACAO]]

[[MODULE:LEGENDAS]]
MÓDULO LEGENDAS — OBRIGATÓRIO QUANDO PRESENTE
As legendas são obrigatórias quando este módulo estiver presente. Devem ser curtas, legíveis, discretas e sincronizadas, com no máximo uma informação comercial por cena, sem cobrir partes importantes do imóvel.
Não repita finalidade, tipologia, dormitórios, suítes ou vagas já apresentados pela narração. Monte um roteiro de no máximo cinco legendas comerciais, nesta ordem:
CENA 1 — estadoDoImovel, exatamente como recebido, quando existir.
CENA 2 — primeiro item de diferenciais, exatamente como recebido.
CENA 3 — item de localização ainda não utilizado presente em diferenciais, quando existir, exatamente como recebido e sem reescrevê-lo.
CENA 4 — segundo item de diferenciais ainda não utilizado, exatamente como recebido.
CENA 5 — preco, exatamente como recebido, somente quando o campo existir e estiver preenchido, pois sua presença representa autorização de exibição. Se preco não existir ou estiver vazio, use o próximo item de diferenciais ainda não utilizado.
Use somente os dados enviados nos DADOS ESTRUTURADOS, respeite a ordem recebida, não repita itens e não invente, complete ou reescreva informações. Se houver menos de cinco informações válidas, use apenas as disponíveis e não preencha espaços. O CTA final permanece separado dessas cinco legendas.
[[/MODULE:LEGENDAS]]

[[MODULE:CTA]]
MÓDULO CTA — OBRIGATÓRIO QUANDO PRESENTE
Exiba obrigatoriamente uma única tela final. O CTA deve aparecer somente nessa tela, exatamente uma vez e exatamente assim:
"{{CTA}}"
Não fale o CTA. Não crie frases comerciais, títulos, subtítulos, slogans, marcas, complementos, ícones ou outros textos.
[[MODULE:TELEFONE]]
Na mesma tela final, exiba exatamente o telefone abaixo, sem traduzir, completar, corrigir, substituir, inferir ou reformatar qualquer caractere:
"{{TELEFONE}}"
[[/MODULE:TELEFONE]]
[[/MODULE:CTA]]

REGRAS GERAIS
Execute somente os módulos que permanecerem neste Briefing Base após a compilação. A ausência de um módulo significa que a respectiva camada está proibida: sem CORRETOR, nenhuma pessoa; sem NARRAÇÃO, nenhuma fala ou voz; sem LEGENDAS, nenhum texto durante as cenas; sem CTA, nenhuma tela final comercial, CTA, telefone ou contato.
Sincronize todos os elementos com a progressão real das fotografias. Não invente características, informações factuais ou diferenciais. O resultado deve parecer uma filmagem imobiliária profissional do imóvel real, nunca uma recriação por IA.`

const purposeText = (value: unknown) => {
  const purpose = removeNonOfficialPhoneNumbers(value).toLocaleLowerCase('pt-BR')
  if (purpose === 'sale') return 'À VENDA'
  if (purpose === 'rent') return 'PARA LOCAÇÃO'
  return removeNonOfficialPhoneNumbers(value)
}

const naturalPurposeText = (value: unknown) => {
  const purpose = removeNonOfficialPhoneNumbers(value).toLocaleLowerCase('pt-BR')
  if (purpose === 'sale') return 'à venda'
  if (purpose === 'rent') return 'para locação'
  return removeNonOfficialPhoneNumbers(value)
}

const measuredFact = (value: unknown, singular: string, plural: string) => {
  const literal = removeNonOfficialPhoneNumbers(value)
  if (!literal) return ''
  return `${literal} ${literal === '1' ? singular : plural}`
}

const summarizedDescription = (property: PropertyContext) => [
  measuredFact(property.bedrooms, 'dormitório', 'dormitórios'),
  measuredFact(property.suites, 'suíte', 'suítes'),
  measuredFact(property.parkingSpaces, 'vaga', 'vagas'),
].filter(Boolean).join(' • ')

const narratedDescription = (property: PropertyContext) => {
  const facts = [
    measuredFact(property.bedrooms, 'dormitório', 'dormitórios'),
    measuredFact(property.suites, 'suíte', 'suítes'),
    measuredFact(property.parkingSpaces, 'vaga', 'vagas'),
  ].filter(Boolean)
  if (facts.length < 2) return facts[0] || ''
  return `${facts.slice(0, -1).join(', ')} e ${facts[facts.length - 1]}`
}

const safeHighlights = (property: PropertyContext) => (property.highlights || [])
  .map(removeNonOfficialPhoneNumbers)
  .filter(Boolean)
  .slice(0, 10)

const replaceLiteral = (source: string, token: string, value: string) => source.replaceAll(token, () => value)

function compileBaseBriefing(base: string, activeModules: Set<BriefingModule>, values: Record<string, string>) {
  let compiled = base
  let previous = ''
  while (compiled !== previous) {
    previous = compiled
    compiled = compiled.replace(MODULE_PATTERN, (_match, module: BriefingModule, content: string) => activeModules.has(module) ? content.trim() : '')
  }
  for (const [token, value] of Object.entries(values)) compiled = replaceLiteral(compiled, `{{${token}}}`, value)
  if (/\{\{[A-Z_]+\}\}/.test(compiled)) throw new Error('unresolved_briefing_value')
  return compiled.replace(/\n{3,}/g, '\n\n').trim()
}

export function buildPropertyContext(property: PropertyContext, cta = '', phone = '', presenter = '') {
  const highlights = safeHighlights(property)
  const data = {
    finalidadeOriginal: removeNonOfficialPhoneNumbers(property.purpose),
    finalidadeExibicao: purposeText(property.purpose),
    tipologia: removeNonOfficialPhoneNumbers(property.type),
    descricaoResumida: summarizedDescription(property),
    estadoDoImovel: removeNonOfficialPhoneNumbers(property.stage),
    area: removeNonOfficialPhoneNumbers(property.area),
    estado: removeNonOfficialPhoneNumbers(property.state),
    cidade: removeNonOfficialPhoneNumbers(property.city),
    bairro: removeNonOfficialPhoneNumbers(property.district),
    preco: removeNonOfficialPhoneNumbers(property.price),
    condominio: removeNonOfficialPhoneNumbers(property.condominium),
    iptu: removeNonOfficialPhoneNumbers(property.iptu),
    descricaoEnviada: removeNonOfficialPhoneNumbers(property.description),
    diferenciais: highlights,
    ...(cta ? { cta: removeNonOfficialPhoneNumbers(cta) } : {}),
    ...(cta && phone ? { telefone: phone } : {}),
    ...(presenter ? { apresentador: presenter } : {}),
  }
  return `DADOS ESTRUTURADOS — VALORES LITERAIS CONTROLADOS PELO SMARTCORRETORAI\n${JSON.stringify(data, null, 2)}`
}

export function buildSmartTourPrompt(input: {generation: SmartTourGenerationConfig; property: PropertyContext; selectedCta: string; phone?: string}) {
  const config = normalizeGeneration(input.generation)
  const cta = removeNonOfficialPhoneNumbers(input.selectedCta)
  const phone = cta ? input.phone || '' : ''
  const highlights = safeHighlights(input.property)
  const activeModules = new Set<BriefingModule>()
  if (config.presenterGender !== 'none') activeModules.add('CORRETOR')
  if (config.narration === 'enabled') activeModules.add('NARRACAO')
  if (config.captions === 'enabled') activeModules.add('LEGENDAS')
  if (cta) activeModules.add('CTA')
  if (cta && phone) activeModules.add('TELEFONE')

  const values = {
    FINALIDADE: purposeText(input.property.purpose),
    FINALIDADE_NATURAL: naturalPurposeText(input.property.purpose),
    TIPOLOGIA: removeNonOfficialPhoneNumbers(input.property.type),
    DESCRICAO_RESUMIDA: summarizedDescription(input.property),
    DESCRICAO_NARRADA: narratedDescription(input.property),
    BAIRRO: removeNonOfficialPhoneNumbers(input.property.district),
    CIDADE: removeNonOfficialPhoneNumbers(input.property.city),
    DIFERENCIAIS: highlights.length ? highlights.map(value => `- "${value}"`).join('\n') : '- Nenhum diferencial foi enviado; não exiba nem narre diferenciais.',
    CTA: cta,
    TELEFONE: phone,
  }
  const compiledBriefing = compileBaseBriefing(SMART_TOUR_BASE_BRIEFING, activeModules, values)
  const remainingModules = [...activeModules].join(', ') || 'nenhum módulo opcional'
  const presenter = config.presenterGender === 'female' ? 'corretora' : config.presenterGender === 'male' ? 'corretor' : ''
  const prompt = [
    buildPropertyContext(input.property, cta, phone, presenter),
    `BRIEFING BASE COMPILADO\n${compiledBriefing}`,
    `MÓDULOS RESTANTES APÓS A COMPILAÇÃO\n${remainingModules}`,
  ].join('\n\n')
  assertNoContradictions(prompt, config, Boolean(cta), Boolean(phone))
  return prompt
}

export function assertNoContradictions(prompt: string, config: SmartTourGenerationConfig, hasCta = false, hasPhone = false) {
  const conflicts = [
    config.presenterGender === 'none' && /MÓDULO CORRETOR/.test(prompt),
    config.narration === 'disabled' && /MÓDULO NARRAÇÃO/.test(prompt),
    config.captions === 'disabled' && /MÓDULO LEGENDAS/.test(prompt),
    !hasCta && /MÓDULO CTA/.test(prompt),
    (!hasCta || !hasPhone) && /Na mesma tela final, exiba exatamente o telefone abaixo/.test(prompt),
    /Virtual Staging, casal, família, pessoas vivendo/.test(prompt) === false,
  ]
  if (conflicts.some(Boolean)) throw new Error('contradictory_prompt')
}
