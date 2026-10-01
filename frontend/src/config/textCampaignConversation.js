export const TEXT_CAMPAIGN_QUESTION_ORDER = Object.freeze([
  'purpose',
  'stage',
  'type',
  'facts',
  'location',
  'commercial',
  'highlights',
  'custom_highlight',
  'notes',
  'cta',
  'phone',
  'review',
])

export const TEXT_CAMPAIGN_QUESTIONS = Object.freeze({
  purpose: 'Qual é a finalidade do imóvel?',
  stage: 'Qual é a situação atual do imóvel?',
  type: 'Que tipo de imóvel vamos divulgar?',
  facts: 'Quais são as informações principais do imóvel?',
  location: 'Onde fica o imóvel?',
  commercial: 'Como deseja apresentar os valores e condições comerciais?',
  highlights: 'Quais diferenciais devem aparecer na campanha?',
  custom_highlight: 'Deseja adicionar outro diferencial ou destaque personalizado?',
  notes: 'Tem algo importante sobre o imóvel que ainda não perguntamos?',
  cta: 'Qual chamada deve conduzir a campanha?',
  phone: 'Deseja divulgar seu telefone profissional?',
  review: 'Tudo pronto. Revise o briefing da Campanha de Textos.',
})

const EN_US_QUESTIONS = Object.freeze({
  purpose: 'What is the property purpose?', stage: 'What is the property status?', type: 'What type of property are you marketing?', facts: 'What are the key property details?', location: 'Where is the property located?', commercial: 'How would you like to present price and terms?', highlights: 'Which features should appear in the campaign?', custom_highlight: 'Would you like to add a custom feature?', notes: 'Any other confirmed property information?', cta: 'Which call to action should guide the campaign?', phone: 'Would you like to show your professional phone number?', review: 'Everything is ready. Review your text campaign brief.',
})

// Supplementary labels for the same Text Campaign UI catalogue. Values remain business-stable elsewhere.
const TEXT_CAMPAIGN_UI_LABELS = Object.freeze({
  'en-US': { sessionExpired: 'Your session has expired. Please sign in again.', generationFailed: 'We could not create the campaign right now. Please try again.', incompleteCampaign: 'The campaign was incomplete. Please try again.', continue: 'Continue', select: 'Select', phoneUnavailable: 'No professional phone number was found in your profile. You can continue without one.', usePhone: 'Use professional phone number', noPhone: 'Do not display a phone number', phoneAuthorized: 'Professional phone authorized', optional: 'Optional', doNotInform: 'Do not provide', review: 'Review before creating', facts: 'Property details', commercial: 'Price and terms', notes: 'Additional notes', highlights: 'features', selected: 'selected', objective: 'Purpose', property: 'Property', location: 'Location', details: 'Details', features: 'Features', terms: 'Commercial terms', communication: 'CTA / contact', noHighlights: 'No features provided', noNotes: 'No additional notes', valuesNotProvided: 'Prices not provided', fixedPrice: 'Fixed price', startingAt: 'Starting at', salePrice: 'Sale price', pricePlaceholder: '$0', showPrice: 'Show price', highlightTerms: 'Highlight terms', hideValues: 'Do not show prices', addTerms: 'Add commercial copy if you wish.', rent: 'Rent', condominium: 'HOA / condo fee', tax: 'Property tax', guarantee: 'Rental guarantee', rentalGuarantee: 'Rental guarantee', rentalPricesNotProvided: 'Rental prices not provided', customHighlightPlaceholder: 'e.g., open park views', notesPlaceholder: 'Include only confirmed property facts', sale: 'For sale', rentPurpose: 'For rent', rentalGuarantees: { seguro_fianca: 'Renters insurance', fiador: 'Guarantor', caucao: 'Security deposit', titulo_capitalizacao: 'Capitalization bond', a_combinar: 'To be agreed', nao_informar: 'Not provided' } },
  'pt-BR': { sessionExpired: 'Sua sessão expirou. Faça login novamente.', generationFailed: 'Não foi possível criar a campanha agora. Tente novamente.', incompleteCampaign: 'A campanha retornou incompleta. Tente novamente.', continue: 'Continuar', select: 'Selecione', phoneUnavailable: 'Nenhum telefone profissional foi encontrado no perfil. Você pode seguir sem telefone.', usePhone: 'Usar telefone profissional', noPhone: 'Não divulgar telefone', phoneAuthorized: 'Telefone profissional autorizado', optional: 'Opcional', doNotInform: 'Não informar', review: 'Confira antes de criar', facts: 'Ficha do imóvel', commercial: 'Valores e condições', notes: 'Observações adicionais', highlights: 'destaques', selected: 'selecionados', objective: 'Objetivo', property: 'Imóvel', location: 'Localização', details: 'Ficha', features: 'Diferenciais', terms: 'Condições comerciais', communication: 'CTA/contato', noHighlights: 'Nenhum destaque informado', noNotes: 'Sem observações adicionais', valuesNotProvided: 'Valores não informados', fixedPrice: 'Preço fixo', startingAt: 'A partir de', salePrice: 'Valor de venda', pricePlaceholder: 'R$ 0', showPrice: 'Informar preço', highlightTerms: 'Destacar condições', hideValues: 'Não informar valores', addTerms: 'Adicione chamadas comerciais ao texto, se quiser.', rent: 'Aluguel', condominium: 'Condomínio', tax: 'IPTU', guarantee: 'Garantia', rentalGuarantee: 'Garantia de locação', rentalPricesNotProvided: 'Sem valores de locação', customHighlightPlaceholder: 'Ex.: vista aberta para a praça', notesPlaceholder: 'Inclua somente fatos confirmados sobre o imóvel', sale: 'Venda', rentPurpose: 'Locação', rentalGuarantees: {} },
})

export function getTextCampaignUiLabel(locale, key) {
  return TEXT_CAMPAIGN_UI_LABELS[locale === 'en-US' ? 'en-US' : 'pt-BR'][key] || key
}

export function getTextCampaignRentalGuaranteeLabel(locale, value, fallback) {
  const labels = TEXT_CAMPAIGN_UI_LABELS[locale === 'en-US' ? 'en-US' : 'pt-BR'].rentalGuarantees || {}
  return labels[value] || fallback || value
}

export function getTextCampaignUiCopy(locale = 'pt-BR') {
  if (locale === 'en-US') return {
    productName: 'Text Campaign', headerSubtitle: 'Complete real-estate brief', heroHeadline: 'One brief. Every piece you need to market your property.', heroDescription: 'Organize property facts, features, and terms in a guided conversation and receive a complete campaign for every channel.', deliveryComplete: 'Complete delivery', multichannel: 'Complete multichannel campaign', deliverablesNote: 'Portals, social media, WhatsApp, email, CTA, hashtags, Reels, and text carousel.', stepsLabel: 'Text Campaign steps', briefingEyebrow: 'Campaign brief', briefingTitle: 'Tell us the property facts', briefingDescription: 'Questions tailor the brief for sale or rent without inventing information.', summaryTitle: 'Campaign summary', continue: 'Continue', select: 'Select', reviewEyebrow: 'Final review', reviewTitle: 'Review before creating', edit: 'Edit', retry: 'Try again', backToReview: 'Back to review', create: 'Create Text Campaign', resultEyebrow: 'Campaign ready', resultHeadline: 'Your multichannel communication is organized.', resultDescription: 'Copy each piece separately or take the complete campaign at once.', copy: 'Copy', copied: 'Copied', copyAll: 'Copy full campaign', download: 'Download TXT', newCampaign: 'Create new campaign', copyError: 'Could not copy.', restore: 'Restore original', slide: 'Slide', editPrefix: 'Edit', resultGroups: { listing: 'Listing', instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp', professional: 'Email & LinkedIn', extra: 'Extra content', 'google-ads': 'Google Ads' },
  }
  return { productName: 'Campanha de Textos', headerSubtitle: 'Briefing imobiliário completo', heroHeadline: 'Um briefing. Todas as peças para divulgar seu imóvel.', heroDescription: 'Organize fatos, diferenciais e condições do imóvel em uma conversa guiada e receba uma campanha completa para diferentes canais.', deliveryComplete: 'Entrega completa', multichannel: 'Campanha completa multicanal', deliverablesNote: 'Portais, redes sociais, WhatsApp, e-mail, CTA, hashtags, Reels e carrossel textual.', stepsLabel: 'Etapas da Campanha de Textos', briefingEyebrow: 'Briefing da campanha', briefingTitle: 'Conte os fatos do imóvel', briefingDescription: 'As perguntas adaptam o briefing à venda ou locação sem inventar informações.', summaryTitle: 'Resumo da campanha', continue: 'Continuar', select: 'Selecione', reviewEyebrow: 'Revisão final', reviewTitle: 'Confira antes de criar', edit: 'Editar', retry: 'Tentar novamente', backToReview: 'Voltar à revisão', create: 'Criar Campanha de Textos', resultEyebrow: 'Campanha pronta', resultHeadline: 'Sua comunicação multicanal está organizada.', resultDescription: 'Copie cada peça separadamente ou leve a campanha completa de uma só vez.', copy: 'Copiar', copied: 'Copiado', copyAll: 'Copiar campanha completa', download: 'Baixar TXT', newCampaign: 'Criar nova campanha', copyError: 'Não foi possível copiar.', restore: 'Restaurar original', slide: 'Slide', editPrefix: 'Editar', resultGroups: { listing: 'Anúncio', instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp', professional: 'E-mail e LinkedIn', extra: 'Conteúdo extra', 'google-ads': 'Google Ads' } }
}

export function getTextCampaignQuestion(questionId, locale = 'pt-BR') {
  return locale === 'en-US' ? EN_US_QUESTIONS[questionId] || TEXT_CAMPAIGN_QUESTIONS[questionId] : TEXT_CAMPAIGN_QUESTIONS[questionId]
}

export function getTextCampaignNextQuestion(questionId) {
  const index = TEXT_CAMPAIGN_QUESTION_ORDER.indexOf(questionId)
  return TEXT_CAMPAIGN_QUESTION_ORDER[Math.min(index + 1, TEXT_CAMPAIGN_QUESTION_ORDER.length - 1)] || 'review'
}

export function getTextCampaignConfirmation(questionId, answer, locale = 'pt-BR') {
  const english = locale === 'en-US'
  const notProvided = english ? 'Do not provide' : 'Não informar'
  const phoneAuthorized = english ? 'Professional phone authorized' : 'Telefone profissional'
  if (english) {
    const confirmations = {
      purpose: answer === 'For rent' ? 'Perfect! The campaign will use rental language only.' : 'Perfect! The campaign will use sales language only.',
      stage: `Got it! The status “${answer}” has been recorded.`,
      type: `Great! The property type “${answer}” has been recorded.`,
      facts: 'Perfect! The main property details have been organized.',
      location: `Great! The location in ${answer} has been recorded.`,
      commercial: 'Perfect! Price and terms have been organized without mixing contracts.',
      highlights: `Excellent! ${answer} have been selected.`,
      custom_highlight: answer === notProvided ? 'All set! We will use only the structured features.' : 'Great! The custom feature has been recorded.',
      notes: answer === notProvided ? 'All set! There are no additional notes.' : 'Perfect! The note has been recorded as a fact you provided.',
      cta: `Great! The call to action will be “${answer}”.`,
      phone: answer === phoneAuthorized ? 'Perfect! Your professional contact has been authorized.' : 'All set! The campaign will continue without a phone number.',
    }
    return confirmations[questionId] || 'Information recorded.'
  }
  const confirmations = {
    purpose: answer === 'Locação' ? 'Perfeito! A campanha usará somente linguagem de locação.' : 'Perfeito! A campanha usará somente linguagem de venda.',
    stage: `Certo! A situação “${answer}” foi registrada.`,
    type: `Ótimo! O tipo “${answer}” foi registrado.`,
    facts: 'Perfeito! A ficha principal do imóvel foi organizada.',
    location: `Ótimo! A localização em ${answer} foi registrada.`,
    commercial: 'Perfeito! Os valores e condições foram organizados sem misturar os contratos.',
    highlights: `Excelente! ${answer} foram selecionados.`,
    custom_highlight: answer === 'Não informar' ? 'Tudo certo! Seguiremos apenas com os destaques estruturados.' : 'Ótimo! O destaque personalizado foi registrado.',
    notes: answer === 'Não informar' ? 'Tudo certo! Não há observações adicionais.' : 'Perfeito! A observação foi registrada como um fato informado por você.',
    cta: `Ótimo! A chamada será “${answer}”.`,
    phone: answer === 'Telefone profissional' ? 'Perfeito! Seu contato profissional foi autorizado.' : 'Tudo certo! A campanha seguirá sem telefone.',
  }
  return confirmations[questionId] || 'Informação registrada.'
}
