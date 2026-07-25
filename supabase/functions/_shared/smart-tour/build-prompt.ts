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
Não crie nenhum texto. Na narração, vocalize somente o texto completo fornecido pelo SmartCorretorAI no módulo NARRAÇÃO. Não altere, traduza, complete, resuma, corrija, reformate, reescreva ou combine os valores recebidos. Não crie CTA diferente, não complemente o CTA, não reescreva finalidade, tipologia, bairro, cidade ou descrição resumida e não invente diferenciais. Utilize cada valor autorizado exatamente como aparece nos DADOS ESTRUTURADOS ou nos campos literais compilados neste Briefing Base, caractere por caractere. Não exiba nomes de campos, instruções, placeholders ou metadados.

ESCOPO E RESTRIÇÕES
Este produto não contempla Virtual Staging, casal, família, pessoas vivendo no imóvel, criação de mobiliário ou alterações arquitetônicas. A única pessoa permitida é o corretor ou a corretora descrito no módulo CORRETOR, quando esse módulo estiver presente. Se o módulo CORRETOR não estiver presente, não mostre pessoas, silhuetas, reflexos, sombras, mãos, rostos ou partes do corpo.

CENÁRIO PROTEGIDO
Todo o ambiente visível em cada fotografia constitui um cenário protegido.
O cenário protegido inclui integralmente: arquitetura; paredes; pisos; tetos; portas; janelas; esquadrias; telhado; bancadas; louças; metais; móveis existentes; decoração; objetos; acabamentos; materiais; cores; iluminação física existente; proporções; perspectiva; orientação; enquadramento; composição visual.
Nenhum elemento do cenário protegido poderá ser recriado, reinterpretado, redesenhado, invertido, espelhado, reposicionado, ampliado, reduzido, removido, substituído, recortado, ocultado, transformado em close ou mostrado a partir de outro ângulo.
A fotografia original deve permanecer imediatamente reconhecível durante toda a cena.
Utilize exatamente uma fotografia por cena como única fonte visual. Nunca combine, sobreponha, mescle, empilhe ou use duas fotografias na mesma cena. Utilize todas as fotografias e respeite integralmente a ordem recebida.
FORMATO DE SAÍDA — Renderize exclusivamente em formato vertical 9:16. Preserve o máximo possível da composição original dentro do quadro vertical e não corte elementos essenciais do ambiente para acomodar o apresentador.

PROTAGONISTA CRIATIVO
Quando houver corretor ou corretora, essa pessoa será o único protagonista criativo humano autorizado. Toda transformação humana deve ficar confinada ao módulo CORRETOR. Nenhuma outra pessoa é permitida.

TRANSFORMAÇÕES AUTORIZADAS
Além do protagonista autorizado, permita exclusivamente: movimento de câmera linear; movimento de baixíssima amplitude; pan suave; push-in ou pull-back mínimo; pequenas variações naturais de luminosidade já compatíveis com a fotografia; sombras e reflexos extremamente sutis.
Essas transformações não podem mudar o horário do dia, criar novas fontes de luz, modificar janelas ou luminárias, alterar cores, esconder elementos, exigir a criação de áreas não visíveis na fotografia ou mudar a composição original.
A câmera é apenas o ponto de vista invisível. Nunca mostre câmera, celular, gimbal, estabilizador, tripé, drone, operador ou equipamento de gravação, inclusive em reflexos, espelhos, janelas ou sombras. Cada ambiente deve conduzir naturalmente ao seguinte somente pela ordem das fotografias. Nunca antecipe um ambiente que ainda não apareceu.

MODO SEM CORRETOR
Quando o módulo CORRETOR estiver ausente, não existe protagonista humano. Toda a criatividade deve ficar confinada exclusivamente ao movimento linear de câmera de baixíssima amplitude, a pequenas variações naturais da iluminação já existente e a sombras e reflexos discretos. O cenário protegido continua imutável. Não crie pessoas, animais, objetos, móveis ou novos elementos.

HIERARQUIA OBRIGATÓRIA
Prioridade 1: preservar o cenário protegido.
Prioridade 2: manter orientação, enquadramento, composição e perspectiva da fotografia.
Prioridade 3: executar apenas as transformações autorizadas.
Se existir conflito entre movimento cinematográfico e fidelidade visual, a fidelidade visual deve prevalecer.

AMBIENTES PEQUENOS
Preserve a visão geral. Não aproxime apenas pia, bancada, vaso, box ou outro objeto. Mantenha os principais elementos visíveis conforme a fotografia original e não transforme ambientes pequenos em closes.

[[MODULE:CORRETOR]]
MÓDULO CORRETOR
Crie exatamente uma pessoa profissional — corretor ou corretora conforme o valor literal indicado em apresentador nos DADOS ESTRUTURADOS — realista e consistente durante todo o vídeo. Essa pessoa é o único protagonista criativo humano autorizado.
Concentre toda a transformação criativa humana exclusivamente em movimentos corporais discretos, caminhada natural, gestos suaves, expressões naturais e apresentação do imóvel.
O corretor ou a corretora não pode causar reconstrução, reposicionamento, ocultação ou recorte do cenário protegido, encobrir elementos importantes do imóvel nem alterar sua composição. Não crie outras pessoas.
[[/MODULE:CORRETOR]]

[[MODULE:NARRACAO]]
MÓDULO NARRAÇÃO — OBRIGATÓRIO QUANDO PRESENTE
Utilize exatamente o texto abaixo.
Não altere. Não reescreva. Não complemente. Não substitua palavras. Não adicione informações. Não mude a ordem. Não improvise e não resuma.
Narre exatamente o texto fornecido em Português do Brasil, com pronúncia, gramática e vocabulário exclusivamente brasileiros:
"{{NARRACAO}}"
Não leia diferenciais, destaques, CTA ou telefone. Não crie frases adicionais. Mantenha a narração sincronizada, termine-a por completo antes da tela final e jamais antecipe ambientes.
[[/MODULE:NARRACAO]]

[[MODULE:LEGENDAS]]
MÓDULO LEGENDAS — OBRIGATÓRIO QUANDO PRESENTE
As legendas são obrigatórias quando este módulo estiver presente. Devem ser curtas, legíveis, discretas e sincronizadas, com no máximo uma informação comercial por cena, sem cobrir partes importantes do imóvel.
Renderize cada legenda em uma zona inferior segura, discreta e legível. Não cubra o rosto do corretor ou da corretora nem elementos importantes do imóvel. Mantenha distância adequada das bordas e dos controles típicos de Reels e Shorts.
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

export function buildSmartTourNarration(property: PropertyContext) {
  const propertyType = removeNonOfficialPhoneNumbers(property.type).toLocaleLowerCase('pt-BR')
  const demonstrative = propertyType === 'casa' || propertyType === 'cobertura' ? 'esta' : 'este'
  const purpose = naturalPurposeText(property.purpose)
  const district = removeNonOfficialPhoneNumbers(property.district)
  const city = removeNonOfficialPhoneNumbers(property.city)
  const description = narratedDescription(property)
  return `Conheça ${demonstrative} excelente ${propertyType} ${purpose} no bairro ${district}, em ${city}. São ${description}. Agende sua visita.`
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
  const activeModules = new Set<BriefingModule>()
  if (config.presenterGender !== 'none') activeModules.add('CORRETOR')
  if (config.narration === 'enabled') activeModules.add('NARRACAO')
  if (config.captions === 'enabled') activeModules.add('LEGENDAS')
  if (cta) activeModules.add('CTA')
  if (cta && phone) activeModules.add('TELEFONE')

  const values = {
    NARRACAO: buildSmartTourNarration(input.property),
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
