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
