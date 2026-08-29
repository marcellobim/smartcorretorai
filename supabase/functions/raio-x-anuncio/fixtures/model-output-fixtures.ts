import { ATTRACTION_SECTION_COMPONENTS, LISTING_SECTION_COMPONENTS, SOCIAL_SECTION_COMPONENTS, type ListingModelSection, type ListingXrayModelOutput, type ModelSection } from '../contract.ts'

type Kind = 'excellent' | 'medium' | 'poor' | 'typo' | 'inconsistency' | 'append' | 'replace' | 'social' | 'needs_more' | 'unsure'
const section = (definition: Record<string, number>, score = 0.9, mode: ModelSection['suggestion_mode'] = 'none'): ModelSection => ({
  evaluated: true, components: Object.fromEntries(Object.entries(definition).map(([key, maximum]) => [key, Math.round(maximum * score)])), analysis: 'Análise objetiva baseada somente no material enviado.',
  suggestion_mode: mode, suggestion: mode === 'none' ? null : 'Sugestão prática.', copy_text: mode === 'none' ? null : 'Texto pronto para copiar.', issue_codes: mode === 'none' ? [] : ['improvement'],
})
const listingSection = (definition: Record<string, number>, score = 0.9, mode: ModelSection['suggestion_mode'] = 'none'): ListingModelSection => ({
  ...section(definition, score, mode),
  what_works: 'O material apresenta uma base objetiva e compreensível.',
  what_can_improve: mode === 'none' ? null : 'Há uma oportunidade específica de tornar a comunicação mais forte.',
  how_to_improve: mode === 'none' ? null : 'Aplique a sugestão pronta usando somente os fatos confirmados.',
})

export function makeModelOutputFixture(kind: Kind = 'excellent'): ListingXrayModelOutput {
  if (kind === 'needs_more' || kind === 'unsure') return {
    content_type: kind === 'unsure' ? 'UNSURE' : 'PROPERTY_LISTING', classification_confidence: kind === 'unsure' ? 55 : 92,
    needs_more_input: kind === 'needs_more', additional_input_message: kind === 'needs_more' ? 'Para uma análise mais completa, envie também uma captura da descrição.' : null,
    summary: 'Ainda não há evidência suficiente.', listing: null, social: null, priorities: [], recommendations: [],
  }
  if (kind === 'social') return {
    content_type: 'SOCIAL_PUBLICATION', classification_confidence: 95, needs_more_input: false, additional_input_message: null, summary: 'A publicação é clara, mas pode ter um gancho mais específico.', listing: null,
    social: {
      hook: section(SOCIAL_SECTION_COMPONENTS.hook, 0.75, 'replace'), clarity: section(SOCIAL_SECTION_COMPONENTS.clarity, 0.85),
      visual_communication: section(SOCIAL_SECTION_COMPONENTS.visual_communication, 0.8, 'append'), cta: section(SOCIAL_SECTION_COMPONENTS.cta, 0.7, 'replace'), conversion: section(SOCIAL_SECTION_COMPONENTS.conversion, 0.78, 'append'),
    }, priorities: [{ area: 'Gancho', text: 'Torne o benefício principal mais específico.' }], recommendations: [{ product: 'quick_banners', reason: 'Uma nova peça pode reforçar a hierarquia da mensagem.' }],
  }
  const mode = kind === 'append' ? 'append' : kind === 'replace' || kind === 'poor' ? 'replace' : kind === 'typo' ? 'correct' : 'none'
  const score = kind === 'excellent' ? 0.95 : kind === 'poor' ? 0.45 : 0.75
  return {
    content_type: 'PROPERTY_LISTING', classification_confidence: 98, needs_more_input: false, additional_input_message: null, summary: 'O anúncio apresenta as informações principais com oportunidades pontuais de melhoria.', social: null,
    listing: {
      title: listingSection(LISTING_SECTION_COMPONENTS.title, score, kind === 'typo' ? 'correct' : 'none'),
      description: listingSection(LISTING_SECTION_COMPONENTS.description, score, mode), information: listingSection(LISTING_SECTION_COMPONENTS.information, kind === 'inconsistency' ? 0.55 : score, kind === 'inconsistency' ? 'correct' : 'none'),
      persuasion: listingSection(LISTING_SECTION_COMPONENTS.persuasion, score, kind === 'poor' ? 'replace' : 'none'),
      attraction: listingSection(ATTRACTION_SECTION_COMPONENTS, kind === 'excellent' ? 0.6 : kind === 'poor' ? 0.4 : 0.8, 'append'),
      description_completeness: { state: 'COMPLETE', evidence: 'A descrição integral está presente no fixture.' },
      observed_fields: [
        { key: 'title', state: 'CONFIRMED', value: 'Apartamento à venda', evidence: 'Título legível na captura.' },
        { key: 'bedrooms', state: 'CONFIRMED', value: '2', evidence: 'Dois dormitórios visíveis.' },
        { key: 'parkingSpaces', state: kind === 'inconsistency' ? 'AMBIGUOUS' : 'CONFIRMED', value: kind === 'inconsistency' ? null : '1', evidence: kind === 'inconsistency' ? 'Uma captura informa 1 vaga e outra informa 2.' : 'Uma vaga visível.' },
      ],
    },
    priorities: [{ area: 'Descrição', text: 'Comece pela clareza da descrição.' }], recommendations: [{ product: 'text_campaign', reason: 'Pode ajudar quando for necessário criar novos textos de divulgação.' }],
  }
}

export function makeFirstCanaryQualityFixture(): ListingXrayModelOutput {
  return {
    content_type: 'PROPERTY_LISTING', classification_confidence: 98, needs_more_input: false, additional_input_message: null,
    summary: 'O anúncio reúne boa parte das informações objetivas; os maiores ganhos estão em tornar a mensagem mais específica e aproveitar melhor os diferenciais confirmados.', social: null,
    listing: {
      title: { evaluated: true, components: { clarity: 4, correctness: 5, specificity: 4, informativeness: 4, readability: 5 }, analysis: 'O título comunica tipo e dormitórios, mas pode incluir a área para ficar mais específico.', what_works: 'O título comunica o tipo do imóvel e a quantidade de dormitórios com clareza.', what_can_improve: 'O principal diferencial de área ainda não aparece no título.', how_to_improve: 'Inclua a área confirmada sem tornar o título longo.', suggestion_mode: 'replace', suggestion: 'Destaque área, dormitórios, suíte e localização no título.', copy_text: 'Apartamento de 93 m² com 2 quartos e suíte no Alto da Lapa', issue_codes: ['title_specificity'] },
      description: { evaluated: true, components: { correctness: 4, clarity: 4, useful_coverage: 4, benefits: 4, naturalness: 4 }, analysis: 'Com base no trecho visível, a descrição apresenta os dados principais; a parte não mostrada não foi avaliada.', what_works: 'O trecho visível apresenta área, dormitórios, suíte e vagas.', what_can_improve: 'As comodidades aparecem sem conexão direta com o benefício para o comprador.', how_to_improve: 'Acrescente uma frase curta ligando lazer e vagas à rotina do morador.', suggestion_mode: 'append', suggestion: 'Acrescente uma frase curta conectando os diferenciais confirmados ao benefício para o comprador.', copy_text: 'Aproveite a área de lazer com piscina, churrasqueira e quadra, além da praticidade de duas vagas cobertas.', issue_codes: ['partial_description', 'feature_to_benefit'] },
      information: { evaluated: true, components: { consistency: 5, completeness: 4, coherence: 4 }, analysis: 'Preço, área, dormitórios, suíte, banheiros, vagas e custos estão claros e coerentes nas capturas.', what_works: 'A ficha reúne informações objetivas e coerentes sobre preço, área e configuração.', what_can_improve: null, how_to_improve: null, suggestion_mode: 'none', suggestion: null, copy_text: null, issue_codes: [] },
      persuasion: { evaluated: true, components: { benefits: 4, differentiators: 3, feature_to_benefit: 3, cta: 4, clarity: 4 }, analysis: 'Os diferenciais estão presentes, mas podem ser ligados mais diretamente ao conforto e à praticidade.', what_works: 'O anúncio apresenta diferenciais relevantes e um próximo passo compreensível.', what_can_improve: 'Os recursos do imóvel ainda aparecem mais como lista do que como benefícios.', how_to_improve: 'Converta as comodidades confirmadas em ganhos práticos para o comprador.', suggestion_mode: 'append', suggestion: 'Transforme as comodidades confirmadas em benefícios concretos.', copy_text: 'Mais conforto para o dia a dia, com suíte, elevador, lavanderia e lazer completo com piscina, churrasqueira e quadra.', issue_codes: ['differentiators', 'feature_to_benefit'] },
      attraction: { evaluated: true, components: { differentiation: 3, hook: 3, curiosity: 3, feature_to_benefit: 3, commercial_appeal: 3, reason_to_choose: 3, next_step: 4, visual_use: 2, reach_variety: 2 }, analysis: 'O imóvel está bem descrito, mas o material ainda pode criar mais motivos para parar, explorar e entrar em contato.', what_works: 'Os diferenciais objetivos e o próximo passo estão presentes.', what_can_improve: 'A divulgação ainda depende muito da ficha estática e explora pouco as imagens em outros formatos.', how_to_improve: 'Destaque um motivo principal para escolher o imóvel e leve esse argumento a formatos visuais fora do portal.', suggestion_mode: 'append', suggestion: 'Transforme o principal diferencial em uma chamada de atenção e distribua o material em outros formatos.', copy_text: '93 m² com lazer completo e duas vagas: conheça um apartamento pensado para uma rotina mais prática.', issue_codes: ['weak_hook', 'limited_visual_use', 'limited_reach'] },
      description_completeness: { state: 'PARTIAL', evidence: 'A captura mostra “Ler descrição completa” e a frase termina em “foi totalmente”.' },
      observed_fields: [
        { key: 'purpose', state: 'CONFIRMED', value: 'venda', evidence: '“Venda R$ 1.550.000” está visível.' },
        { key: 'propertyType', state: 'CONFIRMED', value: 'apartamento', evidence: '“Apartamento” está visível no título e na ficha.' },
        { key: 'city', state: 'CONFIRMED', value: 'São Paulo', evidence: 'O endereço termina em “São Paulo”.' },
        { key: 'state', state: 'CONFIRMED', value: 'São Paulo', evidence: 'O contexto do endereço identifica o estado de São Paulo.' },
        { key: 'district', state: 'AMBIGUOUS', value: null, evidence: 'As capturas mencionam Lapa, Alto da Lapa e Vila Ipojuca; não há uma única referência inequívoca.' },
        { key: 'title', state: 'CONFIRMED', value: 'Apartamento 2 quartos, 1 suíte no Alto da Lapa', evidence: 'Título legível.' },
        { key: 'description', state: 'CONFIRMED', value: 'Oportunidade no Alto da Lapa! Este surpreendente apartamento de 93m², com 2 quartos, 1 suíte e 2 vagas cobertas, na Vila Ipojuca foi totalmente', evidence: 'Trecho visível e truncado antes da expansão.' },
        { key: 'area', state: 'CONFIRMED', value: '93 m²', evidence: 'Ficha informa 93 m² total e útil.' },
        { key: 'bedrooms', state: 'CONFIRMED', value: '2', evidence: 'Ficha informa 2 quartos.' },
        { key: 'suites', state: 'CONFIRMED', value: '1', evidence: 'Ficha informa 1 suíte.' },
        { key: 'bathrooms', state: 'CONFIRMED', value: '2', evidence: 'Ficha informa 2 banheiros.' },
        { key: 'parkingSpaces', state: 'CONFIRMED', value: '2', evidence: 'Ficha informa 2 vagas.' },
      ],
    },
    priorities: [
      { area: 'Título', text: 'Torne o título mais específico incluindo a área confirmada.' },
      { area: 'Descrição', text: 'Fortaleça o trecho principal com benefícios baseados nas comodidades confirmadas.' },
      { area: 'Divulgação', text: 'Aproveite o conjunto de imagens para apresentar o imóvel também fora do portal.' },
    ],
    recommendations: [
      { product: 'real_estate_video', reason: 'O anúncio indica várias imagens; selecione as melhores para criar uma apresentação em vídeo e ampliar a divulgação fora do portal.' },
      { product: 'text_campaign', reason: 'A Campanha de Textos pode adaptar os diferenciais confirmados para outros canais sem alterar a ficha original do anúncio.' },
    ],
  }
}

// Sanitized regression fixture built from the persisted facts and terminal signature of
// the failed URL canary. The raw provider body was intentionally not persisted.
export function makeObservedFieldRegressionFixture(): ListingXrayModelOutput {
  const fixture = makeFirstCanaryQualityFixture()
  if (!fixture.listing) throw new Error('fixture_listing_required')
  fixture.listing.observed_fields.push(
    { key: 'title', state: 'CONFIRMED', value: 'Apartamento para alugar', evidence: 'Segunda observação conflitante do mesmo campo.' },
    { key: 'parkingSpaces', state: 'CONFIRMED', value: null, evidence: null },
    { key: 'brokerPhone', state: 'CONFIRMED', value: 'não deve ser aceito', evidence: 'Categoria fora do contrato.' } as never,
  )
  return fixture
}

export type OpportunityScenario = 'weak' | 'medium' | 'excellent' | 'many_photos' | 'empty_room' | 'launch_offer' | 'text_good_limited'

export function makeOpportunityScenarioFixture(kind: OpportunityScenario) {
  const model = makeModelOutputFixture(kind === 'weak' ? 'poor' : kind === 'medium' ? 'medium' : 'excellent')
  if (!model.listing) throw new Error('fixture_listing_required')
  let imageCount = 1
  if (kind === 'medium') imageCount = 2
  if (kind === 'excellent') imageCount = 5
  if (kind === 'many_photos') imageCount = 44
  if (kind === 'empty_room') {
    imageCount = 2
    model.listing.persuasion = listingSection(LISTING_SECTION_COMPONENTS.persuasion, 0.65, 'append')
    model.listing.persuasion.issue_codes = ['empty_room_detected']
    model.listing.persuasion.what_can_improve = 'O ambiente vazio exige mais esforço de imaginação do interessado.'
    model.listing.persuasion.how_to_improve = 'Apresente uma possibilidade de decoração sem alterar as características do espaço.'
  }
  if (kind === 'launch_offer') {
    imageCount = 3
    model.listing.observed_fields.push(
      { key: 'stage', state: 'CONFIRMED', value: 'lançamento', evidence: 'A palavra lançamento está visível.' },
      { key: 'price', state: 'CONFIRMED', value: 'A partir de R$ 399 mil', evidence: 'A condição comercial está visível.' },
    )
  }
  if (kind === 'text_good_limited') {
    model.listing.observed_fields.push({ key: 'description', state: 'CONFIRMED', value: 'Apartamento com boa distribuição, suíte e localização prática.', evidence: 'Descrição integral no fixture.' })
  }
  if (['excellent', 'many_photos'].includes(kind)) model.listing.observed_fields.push(
    { key: 'area', state: 'CONFIRMED', value: '93 m²', evidence: 'Área visível.' },
    { key: 'suites', state: 'CONFIRMED', value: '1', evidence: 'Suíte visível.' },
    { key: 'amenities', state: 'CONFIRMED', value: 'Piscina e churrasqueira', evidence: 'Comodidades visíveis.' },
  )
  return { model, imageCount }
}

export type AttractionScenario = 'low_low' | 'high_low' | 'high_high' | 'medium_high' | 'excellent_portal_limited' | 'empty_staging' | 'visual_underused'

export function makeAttractionScenarioFixture(kind: AttractionScenario) {
  if (kind === 'empty_staging') return makeOpportunityScenarioFixture('empty_room')
  const modelKind = kind === 'low_low' ? 'poor' : kind === 'medium_high' ? 'medium' : 'excellent'
  const model = makeModelOutputFixture(modelKind)
  if (!model.listing) throw new Error('fixture_listing_required')
  let imageCount = kind === 'visual_underused' ? 5 : 1
  if (kind === 'medium_high') {
    model.listing.title = listingSection(LISTING_SECTION_COMPONENTS.title, 0.6, 'append')
    model.listing.description = listingSection(LISTING_SECTION_COMPONENTS.description, 0.6, 'append')
    model.listing.information = listingSection(LISTING_SECTION_COMPONENTS.information, 0.6, 'append')
    model.listing.persuasion = listingSection(LISTING_SECTION_COMPONENTS.persuasion, 0.6, 'append')
  }
  if (kind === 'high_high' || kind === 'medium_high') {
    model.listing.attraction = listingSection(ATTRACTION_SECTION_COMPONENTS, 0.9, 'none')
    model.listing.attraction.what_works = 'A divulgação destaca um diferencial claro, transforma características em benefícios e apresenta um próximo passo objetivo.'
  }
  if (kind === 'high_low' || kind === 'excellent_portal_limited' || kind === 'visual_underused') {
    model.listing.attraction = listingSection(ATTRACTION_SECTION_COMPONENTS, 0.6, 'append')
    model.listing.attraction.issue_codes = kind === 'visual_underused' ? ['limited_visual_use'] : ['limited_reach', 'weak_differentiation']
    model.listing.attraction.what_can_improve = kind === 'visual_underused' ? 'As imagens estão disponíveis, mas ainda são exploradas apenas de forma estática.' : 'A divulgação apresenta o imóvel corretamente, mas cria poucos motivos para parar e conhecê-lo fora do portal.'
    model.listing.attraction.how_to_improve = kind === 'visual_underused' ? 'Use as melhores imagens em um formato dinâmico com uma mensagem principal.' : 'Destaque um motivo para escolher o imóvel e leve essa mensagem a outros formatos e canais.'
  }
  return { model, imageCount }
}
