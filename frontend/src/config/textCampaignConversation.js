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

export function getTextCampaignConfirmation(questionId, answer) {
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
