import type { PropertyContext } from './types.ts'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_NARRATION_MODEL = 'gpt-4.1'
const OPENAI_NARRATION_TIMEOUT_MS = 55_000

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

const normalizedEnding = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^\p{L}\p{N}]+$/gu, '')
  .trim()

const validNarration = (value: unknown, purpose: string, cta: string) => {
  const narration = clean(value, 700)
  if (!narration || narration.split(/\s+/).length < 5 || narration.split(/\s+/).length > 90) return ''
  if (/```|^\s*[\[{]/.test(narration)) return ''
  const lower = narration.toLocaleLowerCase('pt-BR')
  if (purpose === 'À venda' && !lower.includes('à venda')) return ''
  if (purpose === 'Para alugar' && !lower.includes('para alugar')) return ''
  if (cta && !normalizedEnding(narration).endsWith(normalizedEnding(cta))) return ''
  return narration
}

export async function generateSmartTourDynamicNarration(input: {
  apiKey: string
  property: PropertyContext
  selectedCta: string
  fetchImpl?: FetchLike
}) {
  if (!input.apiKey) return null
  const finalidade = purposeLabel(input.property.purpose)
  const cta = clean(input.selectedCta, 160)
  const preco = clean(input.property.price)
  const facts = {
    finalidade,
    tipoDoImovel: clean(input.property.type),
    estadoAtual: clean(input.property.stage),
    cidade: clean(input.property.city),
    bairro: clean(input.property.district),
    dormitorios: clean(input.property.bedrooms),
    suites: clean(input.property.suites),
    vagas: clean(input.property.parkingSpaces),
    area: clean(input.property.area),
    ...(preco ? { preco } : {}),
    destaques: (input.property.highlights || []).map(item => clean(item, 120)).filter(Boolean).slice(0, 10),
    cta,
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
            content: `Você é um redator especializado em narração imobiliária para vídeos curtos.
Escreva em português brasileiro um texto curto, natural e humano.
Mencione obrigatoriamente “à venda” para Venda ou “para alugar” para Locação.
Use exclusivamente os dados recebidos. Não invente informações.
Não leia uma lista de características: transforme os dados em uma fala fluida.
Varie naturalmente a abertura e evite começar sempre com “Conheça este” ou “Conheça esta”.
Finalize literalmente com a chamada recebida em cta, quando ela existir.
Retorne somente o texto final da narração, sem título, explicação, aspas, Markdown ou JSON.`,
          },
          { role: 'user', content: JSON.stringify(facts) },
        ],
        temperature: 0.9,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(OPENAI_NARRATION_TIMEOUT_MS),
    })
    const body = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: unknown } }>
    } | null
    if (!response.ok) return null
    return validNarration(body?.choices?.[0]?.message?.content, finalidade, cta) || null
  } catch {
    return null
  }
}
