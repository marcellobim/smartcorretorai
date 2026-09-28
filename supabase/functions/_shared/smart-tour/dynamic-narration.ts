import type { PropertyContext } from './types.ts'
import { presentSmartTourHighlights, presentSmartTourPropertyType } from './presentation.ts'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_NARRATION_MODEL = 'gpt-4.1'
const OPENAI_NARRATION_TIMEOUT_MS = 55_000
// Ten seconds at a natural Brazilian Portuguese delivery rate (~2.4 words/s).
export const SMART_TOUR_NARRATION_MAX_WORDS = 24

type FetchLike = typeof fetch

const clean = (value: unknown, maxLength = 240) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength)

const purposeLabel = (value: unknown) => {
  const normalized = clean(value, 40).toLocaleLowerCase('pt-BR')
  if (['rent', 'rental', 'locacao', 'locação'].includes(normalized)) return 'Para alugar'
  if (['sale', 'venda'].includes(normalized)) return 'À venda'
  return clean(value, 40)
}

const validNarration = (value: unknown, purpose: string) => {
  const narration = clean(value, 700)
  if (!narration || narration.split(/\s+/).length < 5 || narration.split(/\s+/).length > SMART_TOUR_NARRATION_MAX_WORDS) return ''
  if (/```|^\s*[\[{]/.test(narration)) return ''
  const lower = narration.toLocaleLowerCase('pt-BR')
  if (purpose === 'À venda' && !lower.includes('à venda')) return ''
  if (purpose === 'Para alugar' && !lower.includes('para alugar')) return ''
  if (purpose === 'For sale' && !lower.includes('for sale')) return ''
  if (purpose === 'For rent' && !lower.includes('for rent')) return ''
  return narration
}

export async function generateSmartTourDynamicNarration(input: {
  apiKey: string
  property: PropertyContext
  selectedCta: string
  language?: 'pt-BR' | 'en-US'
  fetchImpl?: FetchLike
}) {
  if (!input.apiKey) return null
  const english = input.language === 'en-US'
  const finalidade = english ? (input.property.purpose === 'rent' ? 'For rent' : 'For sale') : purposeLabel(input.property.purpose)
  const characteristics = [
    clean(input.property.bedrooms) && `${clean(input.property.bedrooms)} dormitórios`,
    clean(input.property.suites) && `${clean(input.property.suites)} suítes`,
    clean(input.property.parkingSpaces) && `${clean(input.property.parkingSpaces)} vagas`,
    clean(input.property.area) && `${clean(input.property.area)} m²`,
  ].filter(Boolean).slice(0, 2)
  const facts = {
    finalidade,
    tipoDoImovel: clean(presentSmartTourPropertyType(input.property.type)),
    estadoAtual: clean(input.property.stage),
    cidade: clean(input.property.city),
    bairro: clean(input.property.district),
    caracteristicasPrincipais: characteristics,
    destaquesPrincipais: presentSmartTourHighlights(input.property.highlights).map(item => clean(item, 120)).filter(Boolean).slice(0, 2),
  }

  try {
    const response = await (input.fetchImpl || fetch)(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_NARRATION_MODEL,
        messages: [
          {
            role: 'system',
            content: english ? `You are a real-estate narrator for short videos.
Write natural American English, between 12 and ${SMART_TOUR_NARRATION_MAX_WORDS} words.
Mention “for sale” or “for rent” exactly as supplied. Use only the received data and never invent details.
Prioritize purpose, property type/context, relevant location, up to two features and one highlight.
Do not include a CTA, phone, professional name, license, title or social media. Return only the narration.` : `Você é um redator especializado em narração imobiliária para vídeos curtos.
Escreva em português brasileiro um texto curto, natural e humano, entre 12 e ${SMART_TOUR_NARRATION_MAX_WORDS} palavras.
Mencione obrigatoriamente “à venda” para Venda ou “para alugar” para Locação.
Use exclusivamente os dados recebidos. Não invente informações.
Comece pela finalidade e depois priorize tipo/contexto, localização quando relevante, no máximo duas características e no máximo um destaque.
Não leia listas; transforme somente os pontos principais em uma fala fluida. Se não couber tudo, remova destaque, característica e localização nessa ordem; nunca remova a finalidade.
Não inclua CTA, telefone, nome profissional, apelido, CRECI, licença, cargo ou redes sociais.
Varie naturalmente a abertura e evite começar sempre com “Conheça este” ou “Conheça esta”.
Retorne somente o texto final da narração, sem título, explicação, aspas, Markdown ou JSON.`,
          },
          { role: 'user', content: JSON.stringify(facts) },
        ],
        temperature: 0.9,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(OPENAI_NARRATION_TIMEOUT_MS),
    })
    const body = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: unknown } }>
    } | null
    if (!response.ok) return null
    return validNarration(body?.choices?.[0]?.message?.content, finalidade) || null
  } catch {
    return null
  }
}
