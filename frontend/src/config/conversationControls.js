/**
 * Copy shared by guided product conversations.  Market is deliberately the
 * only input: draft/profile locales must never affect structural UI copy.
 */
export function getConversationControls(market = 'BR') {
  const us = market === 'US'
  return us
    ? {
        back: 'Back', editAnswer: 'Edit / Change answer', edit: 'Edit', continue: 'Continue', confirm: 'Confirm', cancel: 'Cancel', retry: 'Try again',
        yes: 'Yes', no: 'No', question: (current, total) => `Question ${current} of ${total}`,
        finalReview: 'Final review', completed: 'Completed',
      }
    : {
        back: 'Voltar', editAnswer: 'Voltar e corrigir', edit: 'Editar', continue: 'Continuar', confirm: 'Confirmar', cancel: 'Cancelar', retry: 'Tentar novamente',
        yes: 'Sim', no: 'Não', question: (current, total) => `Pergunta ${current} de ${total}`,
        finalReview: 'Revisão final', completed: 'Concluído',
      }
}

export function localizedConversationLabel(value, labels) {
  if (value == null || value === '') return ''
  return typeof value === 'object' ? (value.label || value[labels.market === 'US' ? 'en-US' : 'pt-BR'] || '') : String(value)
}

// Histories sometimes outlive a catalog migration.  Keep known transport IDs
// out of a user-facing bubble while preserving arbitrary free text verbatim.
const systemAnswerLabels = {
  us_single_family_home: { BR: 'Casa unifamiliar', US: 'Single-family home' },
  apartment: { BR: 'Apartamento', US: 'Apartment' },
  house: { BR: 'Casa', US: 'House' },
  sale: { BR: 'Venda de imóvel', US: 'Property sale' },
  rental: { BR: 'Locação', US: 'Rental' },
  yes: { BR: 'Sim', US: 'Yes' },
  no: { BR: 'Não', US: 'No' },
}

export function formatConversationSystemAnswer(value, market = 'BR') {
  if (Array.isArray(value)) return value.map(item => formatConversationSystemAnswer(item, market)).join(', ')
  const key = String(value || '').trim()
  return systemAnswerLabels[key]?.[market === 'US' ? 'US' : 'BR'] || key
}
