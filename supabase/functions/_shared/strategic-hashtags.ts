import {
  buildOfficialHashtags,
  normalizeOfficialHashtags,
  type OfficialHashtagContext,
} from './official-hashtags.ts'

type StrategicHashtagRequest = {
  apiKey: string
  context: OfficialHashtagContext
  variationKey?: string
  model?: string
}

export const STRATEGIC_HASHTAG_SYSTEM_PROMPT = `Você é especialista em marketing imobiliário brasileiro e estratégia de descoberta em redes sociais.
Gere de 12 a 15 hashtags naturais, criativas e prontas para publicação.
Misture localização, tipo do imóvel, finalidade, estilo de vida sustentado pelos dados, diferenciais reais, intenção de busca e termos amplos, médios e específicos.
Não transforme mecanicamente cada campo em hashtag. Crie combinações naturais e varie a seleção entre imóveis semelhantes.
Não invente metrô, vista, lazer, padrão, investimento ou qualquer característica ausente.
Não repita hashtags. Evite excesso de #Imoveis, #CorretorDeImoveis e #MercadoImobiliario.
Use hashtags sem acentos ou cedilha.
Inclua sempre #SmartCorretorAI misturada no meio da lista, nunca no início ou no final.
Responda somente com JSON válido no formato {"hashtags":["#Exemplo"]}.`

export const STRATEGIC_HASHTAG_EN_US_SYSTEM_PROMPT = `You are a U.S. real-estate social discovery strategist.
Generate 12 to 15 natural, publication-ready English hashtags.
Use only the supplied property data. Mix location, property type, purpose, verified lifestyle, highlights, and search intent.
Do not translate Brazilian hashtags word for word, invent features, repeat tags, or use Portuguese.
Always include #SmartCorretorAI in the middle of the list, never first or last.
Respond only with valid JSON in the format {"hashtags":["#Example"]}.`

export async function generateStrategicHashtags({ apiKey, context, variationKey = '', model = 'gpt-4.1' }: StrategicHashtagRequest) {
  const fallback = buildOfficialHashtags(context)
  if (!apiKey) return fallback
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: context.language === 'en-US' ? STRATEGIC_HASHTAG_EN_US_SYSTEM_PROMPT : STRATEGIC_HASHTAG_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ ...context, variationKey }) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        max_tokens: 650,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) return fallback
    const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null
    const content = data?.choices?.[0]?.message?.content
    if (!content) return fallback
    const parsed = JSON.parse(content) as { hashtags?: unknown }
    return normalizeOfficialHashtags(parsed.hashtags, context)
  } catch {
    return fallback
  }
}
