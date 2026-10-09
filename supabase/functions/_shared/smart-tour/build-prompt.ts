import type { PropertyContext, SmartTourGenerationConfig } from './types.ts'
import type { SmartTourStructuredBriefing } from './structured-briefing.ts'
import { normalizeGeneration } from './validation.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
import { presentSmartTourHighlights, presentSmartTourPropertyType } from './presentation.ts'
import { GEMINI_VIDEO_TEXT_RULES_PROMPT } from '../gemini-video-text-rules.ts'

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
Não crie nenhum texto além dos textos autorizados neste briefing. Na narração, vocalize somente o texto completo fornecido pelo SmartCorretorAI no módulo NARRAÇÃO. Não altere, traduza, complete, resuma, corrija, reformate, reescreva ou combine os valores recebidos. Não crie CTA diferente, não complemente o CTA, não reescreva finalidade, tipologia, bairro, cidade ou descrição resumida e não invente diferenciais. Renderize os textos autorizados exatamente uma vez, como uma única camada do próprio vídeo final. Utilize cada valor autorizado exatamente como aparece nos DADOS ESTRUTURADOS ou nos campos literais compilados neste Briefing Base, caractere por caractere. Não exiba nomes de campos, instruções, placeholders ou metadados.

${GEMINI_VIDEO_TEXT_RULES_PROMPT}

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
  if (purpose === 'sale' || purpose === 'venda') return 'à venda'
  if (purpose === 'rent' || purpose === 'locação' || purpose === 'locacao') return 'para locação'
  return ''
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

const NARRATION_PROPERTY_TYPES: Record<string, { demonstrative: 'este' | 'esta'; label: string }> = {
  apartamento: { demonstrative: 'este', label: 'apartamento' },
  casa: { demonstrative: 'esta', label: 'casa' },
  cobertura: { demonstrative: 'esta', label: 'cobertura' },
  sobrado: { demonstrative: 'este', label: 'sobrado' },
  'studio / loft': { demonstrative: 'este', label: 'studio / loft' },
  'terreno / lote': { demonstrative: 'este', label: 'terreno / lote' },
  comercial: { demonstrative: 'este', label: 'imóvel comercial' },
}

const narrationOpening = (property: PropertyContext) => {
  const capturedType = removeNonOfficialPhoneNumbers(presentSmartTourPropertyType(property.type)).toLocaleLowerCase('pt-BR')
  const mappedType = NARRATION_PROPERTY_TYPES[capturedType]
  const subject = mappedType
    ? `Conheça ${mappedType.demonstrative} excelente ${mappedType.label}`
    : 'Conheça este imóvel'
  return [subject, naturalPurposeText(property.purpose)].filter(Boolean).join(' ')
}

const narrationLocation = (property: PropertyContext) => {
  const district = removeNonOfficialPhoneNumbers(property.district)
  const city = removeNonOfficialPhoneNumbers(property.city)
  const location = [district, city].filter(Boolean).join(', ')
  return location ? `em ${location}` : ''
}

const narratedFact = (value: unknown, singular: string, plural: string) => {
  const literal = removeNonOfficialPhoneNumbers(value)
  if (!literal || Number(literal) === 0) return null
  return { literal, text: `${literal} ${literal === '1' ? singular : plural}` }
}

const naturalList = (items: string[]) => {
  if (items.length < 2) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`
}

const narratedDescription = (property: PropertyContext) => {
  const facts = [
    narratedFact(property.bedrooms, 'dormitório', 'dormitórios'),
    narratedFact(property.suites, 'suíte', 'suítes'),
    narratedFact(property.parkingSpaces, 'vaga de garagem', 'vagas de garagem'),
  ].filter((fact): fact is { literal: string; text: string } => Boolean(fact))
  if (!facts.length) return ''
  const subject = facts[0].literal === '1' ? 'O imóvel possui' : 'São'
  return `${subject} ${naturalList(facts.map(fact => fact.text))}.`
}

export function buildSmartTourNarration(property: PropertyContext) {
  const opening = [narrationOpening(property), narrationLocation(property)].filter(Boolean).join(' ')
  const description = narratedDescription(property)
  return [`${opening}.`, description, 'Agende sua visita.'].filter(Boolean).join(' ')
}

const safeHighlights = (property: PropertyContext) => presentSmartTourHighlights(property.highlights)
  .map(removeNonOfficialPhoneNumbers)
  .filter(Boolean)
  .slice(0, 10)

const replaceLiteral = (source: string, token: string, value: string) => source.replaceAll(token, () => value)

const CTA_DETERMINISTIC_REINFORCEMENT = `REFORÇO DETERMINÍSTICO DO CTA FINAL — OBRIGATÓRIO
O cartão final deverá utilizar EXCLUSIVAMENTE os textos fornecidos pelo SmartCorretorAI. O conteúdo do CTA deverá ser reproduzido exatamente como recebido, caractere por caractere. Nenhum caractere poderá ser alterado.
É proibido criar telefone, alterar telefone, criar e-mail, alterar e-mail, criar URL, alterar URL, criar frases, corrigir frases ou completar frases.
Não recrie, interprete, corrija, complete, reformate ou substitua o conteúdo textual do cartão final.`

const REQUIRED_CAPTIONS_REINFORCEMENT = `REFORÇO DE LEGENDAS — OBRIGATÓRIO
As legendas fazem parte obrigatória da geração quando o módulo LEGENDAS estiver ativo. Não podem ser omitidas e devem aparecer obrigatoriamente.
Exiba exatamente cinco legendas comerciais quando existirem informações suficientes, com uma legenda por cena. Quando houver menos de cinco informações válidas, exiba obrigatoriamente todas as disponíveis, conforme o roteiro do módulo LEGENDAS.
Nunca substitua legendas por narração. Nunca omita legendas. Nunca transforme legendas em elementos opcionais.`

const MODULE_REINFORCEMENTS: Partial<Record<BriefingModule, string>> = {
  CTA: CTA_DETERMINISTIC_REINFORCEMENT,
  LEGENDAS: REQUIRED_CAPTIONS_REINFORCEMENT,
}

function compileBaseBriefing(base: string, activeModules: Set<BriefingModule>, values: Record<string, string>) {
  let compiled = base
  let previous = ''
  while (compiled !== previous) {
    previous = compiled
    compiled = compiled.replace(MODULE_PATTERN, (_match, module: BriefingModule, content: string) => {
      if (!activeModules.has(module)) return ''
      return [content.trim(), MODULE_REINFORCEMENTS[module]].filter(Boolean).join('\n')
    })
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
    tipologia: removeNonOfficialPhoneNumbers(presentSmartTourPropertyType(property.type)),
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

const US_PROVIDER_KEYS: Record<string, string> = {
  versao: 'version', tarefa: 'mission', configuracoes: 'configuration', modo: 'mode', idioma: 'language', formato: 'format', duracaoSegundos: 'durationSeconds', quantidadeImagens: 'imageCount', narracaoAtiva: 'narrationEnabled', legendasAtivas: 'captionsEnabled', ctaAtivo: 'ctaEnabled', identificacaoProfissionalAtiva: 'professionalIdentityEnabled', imovel: 'property', finalidade: 'purpose', tipo: 'propertyType', estadoDoImovel: 'propertyStatus', localizacao: 'location', estado: 'state', cidade: 'city', bairro: 'neighborhood', dormitorios: 'bedrooms', suites: 'suites', banheiros: 'bathrooms', vagas: 'parkingSpaces', area: 'areaSqft', preco: 'priceUsd', condominio: 'hoa', iptu: 'propertyTaxes', destaques: 'highlights', descricao: 'description', apresentador: 'presenter', unicoHumanoAutorizado: 'onlyAuthorizedPerson', musica: 'music', configurada: 'configured', instrucao: 'instruction', sequenciaDasImagens: 'imageSequence', movimentosDesejados: 'requestedMovements', cenas: 'scenes', numero: 'number', frase_id: 'phraseId', imagem: 'image', movimento: 'movement', legenda: 'caption', narracao: 'narration', duracaoNarracaoSegundos: 'narrationDurationSeconds', tempoTelefoneVisivelAposNarracaoSegundos: 'phoneVisibleAfterNarrationSeconds', timeline: 'timeline', duracaoTotalSegundos: 'totalDurationSeconds', legendas: 'captions', cta: 'cta', identificacaoProfissional: 'professionalIdentity', ativas: 'enabled', titulo: 'title', telefone: 'phone', texto: 'text', regrasPreservacao: 'preservationRules', cenarioProtegido: 'protectedScene', umaImagemPorCena: 'oneImagePerScene', respeitarOrdemDasImagens: 'respectImageOrder', elementosImutaveis: 'immutableElements', transformacoesPermitidas: 'allowedTransformations', regrasObrigatorias: 'mandatoryRules', codigo: 'code', valor: 'value', bloco: 'block', inicioSegundos: 'startSeconds', fimSegundos: 'endSeconds', tipo: 'type', identificacaoProfissionalVisualDeterministica: 'deterministicProfessionalIdentity',
}

const US_PROVIDER_VALUES: Record<string, string> = {
  corretora: 'female_real_estate_agent', corretor: 'male_real_estate_agent', nenhum: 'none', preservar_comportamento_atual: 'preserve_current_behavior',
  movimento_linear_baixa_amplitude: 'low_amplitude_linear_movement', pan_suave: 'gentle_pan', push_in_minimo: 'minimal_push_in', pull_back_minimo: 'minimal_pull_back',
  abertura: 'opening', caracteristicas: 'features', diferencial: 'highlight', localizacao: 'location', encerramento: 'closing',
  usar_json_como_fonte_unica: 'use_json_as_only_source', sem_invencao: 'no_invention', apresentador_obrigatorio: 'presenter_required', apresentador_excecao_unica: 'presenter_only_exception', apresentador_preserva_imovel: 'presenter_preserves_property', idioma: 'language', formato_vertical: 'vertical_format', duracao_total_segundos: 'total_duration_seconds', legendas_obrigatorias_quando_ativas: 'captions_required_when_enabled', timeline_temporal_fonte_efetiva: 'timeline_is_effective_temporal_source', identificacao_profissional_visual_deterministica: 'deterministic_professional_identity_overlay', legendas_sem_valores_comerciais_automaticos: 'no_automatic_commercial_values_in_captions', narracao_complementar: 'complementary_narration', cta_deterministico: 'deterministic_cta', ultima_narracao_curta: 'short_final_narration',
}

const US_PROVIDER_SENTENCE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Renderizar no próprio vídeo final exclusivamente timeline\.legendas, timeline\.narracao, timeline\.cta e timeline\.identificacaoProfissional como fonte efetiva dos textos, da narração e de seus tempos\. As trocas de texto são independentes das trocas de imagem\. Os campos textuais de cenas existem somente para compatibilidade temporária e não controlam a timeline\./g, 'Render only timeline captions, narration, CTA and professional identity as the effective source of timed text and voice. Scene text fields are compatibility-only and do not control the timeline.'],
  [/Nunca usar automaticamente em legendas: valor do condomínio, IPTU, preço, taxas ou código do imóvel\. Condomínio somente pode aparecer como benefício selecionado, como lazer completo, piscina, academia, portaria 24 horas ou condomínio clube; nunca como valor monetário\./g, 'Never automatically use prices, HOA, property taxes, fees or property codes in captions. Use only confirmed selected highlights, never a monetary value.'],
  [/a narração não pode repetir exatamente a legenda/g, 'narration must not exactly repeat the caption'],
  [/reservar a última cena para a legenda formada somente por cta\.titulo e cta\.telefone, sem alterar caracteres/g, 'reserve the last scene for the exact CTA title and phone only'],
  [/limitar a narração final a 1,2 segundo e manter somente o telefone visível por aproximadamente 0,8 segundo após a fala/g, 'limit final narration to 1.2 seconds and keep only the phone visible for about 0.8 seconds after narration'],
]

const translateUsProviderString = (value: string) => {
  let translated = US_PROVIDER_VALUES[value] || value
  for (const [pattern, replacement] of US_PROVIDER_SENTENCE_REPLACEMENTS) translated = translated.replace(pattern, replacement)
  return translated
}

function englishProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(englishProviderPayload)
  if (typeof value === 'string') return translateUsProviderString(value)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => key !== 'suites' && !(key === 'condominio' && !item) && !(key === 'iptu' && !item))
    .map(([key, item]) => [US_PROVIDER_KEYS[key] || key, englishProviderPayload(item)]))
}

export function buildSmartTourVideoPrompt(briefing: SmartTourStructuredBriefing) {
  return JSON.stringify(briefing.configuracoes.idioma === 'en-US' ? englishProviderPayload(briefing) : briefing)
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
