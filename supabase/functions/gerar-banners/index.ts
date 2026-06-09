import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const CREATOMATE_API_KEY = Deno.env.get('CREATOMATE_API_KEY') ?? ''
const MAX_VISUAL_PIECES_PER_GENERATION = 5

type TemplateMeta = {
  id: string
  nome: string
  categoria: 'banner' | 'story' | 'reels' | 'video' | 'carousel' | 'card' | 'social' | 'detailed'
  perfil: string[]
  formato: string
}

const TEMPLATES: TemplateMeta[] = [
  { id: '662883d7-1dba-4e61-a2a2-81fd9293ab15', nome: 'Anuncio Premium 1x1', categoria: 'banner', perfil: ['todos'], formato: 'square' },
  { id: 'd791b9b8-55e2-4dff-ae5d-76b9e779c551', nome: 'Anuncio Premium 4x5', categoria: 'banner', perfil: ['todos'], formato: 'portrait' },
  { id: 'd45618d1-5f7f-4053-b317-dd2bbe322f5b', nome: 'Anuncio Premium 4x5 Tipo 2', categoria: 'banner', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '116761e5-4cda-4c83-b450-7beaaa4ef5e1', nome: 'Anuncio Premium 9x16', categoria: 'banner', perfil: ['todos'], formato: 'vertical' },
  { id: 'd280898b-7237-4c0b-a889-e85ededa9644', nome: 'Anuncio Premium 16x9', categoria: 'banner', perfil: ['todos'], formato: 'horizontal' },
  { id: 'e8314ba2-cd0f-44e3-afd1-de41083c0846', nome: 'Story Premium 1x1', categoria: 'story', perfil: ['todos'], formato: 'square' },
  { id: '5461c940-4309-4c3f-bba1-d90e83e62a9a', nome: 'Story Premium 4x5', categoria: 'story', perfil: ['todos'], formato: 'portrait' },
  { id: 'e15d93e5-dbb0-45c9-b475-2d9e2d6a1d0c', nome: 'Story Premium 4x5 Tipo 2', categoria: 'story', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '1de0a863-2376-4336-8a0a-4750c2429cf7', nome: 'Story Premium 9x16', categoria: 'story', perfil: ['todos'], formato: 'vertical' },
  { id: 'c9cf1d8c-4f01-4f65-baf8-ca20c56ad76e', nome: 'Story Premium 16x9', categoria: 'story', perfil: ['todos'], formato: 'horizontal' },
  { id: '0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d', nome: 'Card Imobiliario Premium 1x1', categoria: 'card', perfil: ['todos'], formato: 'square' },
  { id: 'f7df2c44-ea60-4c42-b862-2d335029acad', nome: 'Card Imobiliario Premium 4x5', categoria: 'card', perfil: ['todos'], formato: 'portrait' },
  { id: '2b4e6dff-ee96-42f0-97e1-7956bef9dfa9', nome: 'Card Imobiliario Premium 4x5 Tipo 2', categoria: 'card', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '755d1a44-acb9-4593-96b4-f1741b1651af', nome: 'Card Imobiliario Premium 9x16', categoria: 'card', perfil: ['todos'], formato: 'vertical' },
  { id: '656ff3e1-325a-419c-9914-dfde82f911b6', nome: 'Card Imobiliario Premium 16x9', categoria: 'card', perfil: ['todos'], formato: 'horizontal' },
  { id: '1ae7e1f4-ada4-4b03-a032-737a025b88c6', nome: 'Imovel Detalhes 1x1', categoria: 'detailed', perfil: ['todos'], formato: 'square' },
  { id: '4dd468f4-a439-4a31-b6f3-29be17a1d51d', nome: 'Imovel Detalhes 4x5', categoria: 'detailed', perfil: ['todos'], formato: 'portrait' },
  { id: '4ba4698c-3b6e-4548-b73d-814d71bc7f66', nome: 'Imovel Detalhes 4x5 Tipo 2', categoria: 'detailed', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '451b3422-f222-414e-b105-44b896f8277e', nome: 'Imovel Detalhes 9x16', categoria: 'detailed', perfil: ['todos'], formato: 'vertical' },
  { id: '71aa0276-bc5f-4245-bb37-62a78fa7cf64', nome: 'Imovel Detalhes 16x9', categoria: 'detailed', perfil: ['todos'], formato: 'horizontal' },
  { id: '792ad84a-0ab8-4e6c-bda1-400fe9c040cc', nome: 'Avaliacao do Cliente 1x1', categoria: 'social', perfil: ['todos'], formato: 'square' },
  { id: 'a83a2008-8a6a-4a40-8b6f-d87190a1d306', nome: 'Avaliacao do Cliente 4x5', categoria: 'social', perfil: ['todos'], formato: 'portrait' },
  { id: 'cfded0ba-1eb9-4396-ab63-b259cb817a1e', nome: 'Avaliacao do Cliente 4x5 Tipo 2', categoria: 'social', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '52a1e65f-ca92-4c6c-af7e-9f0100c886cb', nome: 'Avaliacao do Cliente 9x16', categoria: 'social', perfil: ['todos'], formato: 'vertical' },
  { id: 'ff23c370-89eb-4883-8b5b-c21176f8e746', nome: 'Avaliacao do Cliente 16x9', categoria: 'social', perfil: ['todos'], formato: 'horizontal' },
  { id: '329b6afb-c749-4bda-a319-38ad42639034', nome: 'Chat Imobiliario 1x1', categoria: 'social', perfil: ['todos'], formato: 'square' },
  { id: '1db7b057-81e0-4db3-af4e-98a7c987cdfa', nome: 'Chat Imobiliario 4x5', categoria: 'social', perfil: ['todos'], formato: 'portrait' },
  { id: '71ae86ec-d08e-4f32-9d61-d7ddcb829f9e', nome: 'Chat Imobiliario 4x5 Tipo 2', categoria: 'social', perfil: ['todos'], formato: 'portraitAlt' },
  { id: 'f4b5c0e9-80fe-408a-b139-f7db7dfbbc89', nome: 'Chat Imobiliario 9x16', categoria: 'social', perfil: ['todos'], formato: 'vertical' },
  { id: 'bee2745c-7887-45e0-a82b-f44191fc0f0f', nome: 'Chat Imobiliario 16x9', categoria: 'social', perfil: ['todos'], formato: 'horizontal' },
  { id: '93635efc-ef44-47d2-a8f3-38a379d69941', nome: 'Momentos do Imovel 1x1', categoria: 'video', perfil: ['todos'], formato: 'square' },
  { id: 'f0a463cc-261f-4b51-ab7e-77fcea67476e', nome: 'Momentos do Imovel 4x5', categoria: 'video', perfil: ['todos'], formato: 'portrait' },
  { id: '3d72b111-76a7-4c7d-a594-1f75f70be2d2', nome: 'Momentos do Imovel 4x5 Tipo 2', categoria: 'video', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '286a1949-9b0c-4bf2-b7b3-b0e84503f671', nome: 'Momentos do Imovel 9x16', categoria: 'video', perfil: ['todos'], formato: 'vertical' },
  { id: '62d46ee6-6347-4335-af89-2b65f2794882', nome: 'Momentos do Imovel 16x9', categoria: 'video', perfil: ['todos'], formato: 'horizontal' },
  { id: '8aab78ac-60cd-4e83-9f4c-51259c4751c6', nome: 'Frase Elegante 1x1', categoria: 'social', perfil: ['todos'], formato: 'square' },
  { id: '164eef00-abf4-429a-9334-c9e4c1319998', nome: 'Frase Elegante 4x5', categoria: 'social', perfil: ['todos'], formato: 'portrait' },
  { id: '9a9c663c-0348-462b-a470-c40a86092a81', nome: 'Frase Elegante 4x5 Tipo 2', categoria: 'social', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '697a514d-4bab-4062-9c9e-3c208688c0e9', nome: 'Frase Elegante 9x16', categoria: 'social', perfil: ['todos'], formato: 'vertical' },
  { id: 'e74922ee-5882-4917-9051-9ae2e4021767', nome: 'Frase Elegante 16x9', categoria: 'social', perfil: ['todos'], formato: 'horizontal' },
  { id: '9962f7dc-6cca-491f-bffe-3184a2314f21', nome: 'Reels Moderno 1x1', categoria: 'reels', perfil: ['todos'], formato: 'square' },
  { id: '7f7f420d-da91-48c6-b701-0f0fb540b1aa', nome: 'Reels Moderno 4x5', categoria: 'reels', perfil: ['todos'], formato: 'portrait' },
  { id: 'dfdcea18-0f3d-4c84-baa9-463c182644b7', nome: 'Reels Moderno 4x5 Tipo 2', categoria: 'reels', perfil: ['todos'], formato: 'portraitAlt' },
  { id: 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae', nome: 'Reels Moderno 9x16', categoria: 'reels', perfil: ['todos'], formato: 'vertical' },
  { id: 'a8a1eebe-b357-4d35-a1fa-2d06887484aa', nome: 'Reels Moderno 16x9', categoria: 'reels', perfil: ['todos'], formato: 'horizontal' },
  { id: '7a12a73e-ace7-4ab4-9739-95741b82232a', nome: 'Galeria Imobiliaria 1x1', categoria: 'video', perfil: ['todos'], formato: 'square' },
  { id: '8e399960-3ade-453a-b868-e7059f30c6a9', nome: 'Galeria Imobiliaria 4x5', categoria: 'video', perfil: ['todos'], formato: 'portrait' },
  { id: '660ca820-3d7d-4d9f-8c45-3d6da832588b', nome: 'Galeria Imobiliaria 4x5 Tipo 2', categoria: 'video', perfil: ['todos'], formato: 'portraitAlt' },
  { id: '856a9b35-ac8c-45bb-8709-bb2dfa2618b7', nome: 'Galeria Imobiliaria 9x16', categoria: 'video', perfil: ['todos'], formato: 'vertical' },
  { id: 'f2f15dab-77c2-429e-9b62-f8d6694399ed', nome: 'Galeria Imobiliaria 16x9', categoria: 'video', perfil: ['todos'], formato: 'horizontal' },
  { id: '9c7e271b-a9c2-475a-b742-8f949e788abf', nome: 'Slides Premium 1x1', categoria: 'story', perfil: ['todos'], formato: 'square' },
  { id: '4a7830c5-ff23-446b-8664-2bc8fe86b2c0', nome: 'Slides Premium 4x5', categoria: 'story', perfil: ['todos'], formato: 'portrait' },
  { id: '13008c2d-9e7e-4515-a2ac-649c9ea18409', nome: 'Slides Premium 4x5 Tipo 2', categoria: 'story', perfil: ['todos'], formato: 'portraitAlt' },
  { id: 'eb6ae228-a08f-4747-a761-e4d47f716019', nome: 'Slides Premium 9x16', categoria: 'story', perfil: ['todos'], formato: 'vertical' },
  { id: '2d79f2a0-1143-422c-bdef-7d02c5bb72e9', nome: 'Slides Premium 16x9', categoria: 'story', perfil: ['todos'], formato: 'horizontal' },
  { id: '9ebd1bda-e650-4d88-b8aa-ff555a419082', nome: 'Video Tour 1x1', categoria: 'video', perfil: ['todos'], formato: 'square' },
  { id: '89071652-69ab-4edc-897b-9e7985c95f59', nome: 'Video Tour 4x5', categoria: 'video', perfil: ['todos'], formato: 'portrait' },
  { id: '9c831fd6-5412-4afe-9e29-dd8c4984e55c', nome: 'Video Tour 4x5 Tipo 2', categoria: 'video', perfil: ['todos'], formato: 'portraitAlt' },
  { id: 'cd6c0ed3-1dde-4fc0-a604-d728e5cbb73b', nome: 'Video Tour 9x16', categoria: 'video', perfil: ['todos'], formato: 'vertical' },
  { id: 'd5171301-84e3-41d2-a6ca-ef3013f360a1', nome: 'Video Tour 16x9', categoria: 'video', perfil: ['todos'], formato: 'horizontal' },
  { id: '2ecd48d3-146c-467b-8a0d-908152101378', nome: 'Triple Slide Carousel 1x1', categoria: 'carousel', perfil: ['todos'], formato: 'square' },
  { id: '16682dcd-eb89-404c-94dc-bb9f01317bf4', nome: 'Triple Slide Carousel 4x5', categoria: 'carousel', perfil: ['todos'], formato: 'portrait' },
  { id: '5635ee72-d0da-4906-9a84-6e0b5f587196', nome: 'Triple Slide Carousel 4x5 Tipo 2', categoria: 'carousel', perfil: ['todos'], formato: 'portraitAlt' },
  { id: 'fa82c49d-39af-46e8-bc31-3649fff10cae', nome: 'Triple Slide Carousel 9x16', categoria: 'carousel', perfil: ['todos'], formato: 'vertical' },
  { id: '21c3ff4b-f632-405f-8ebf-369c1f7d4b10', nome: 'Triple Slide Carousel 16x9', categoria: 'carousel', perfil: ['todos'], formato: 'horizontal' },
]

const TEMPLATE_MODEL_CREDIT_WEIGHTS = new Map<string, number>([
  ['Anuncio Premium', 20],
  ['Story Premium', 15],
  ['Card Imobiliario Premium', 10],
  ['Imovel Detalhes', 10],
  ['Avaliacao do Cliente', 10],
  ['Chat Imobiliario', 10],
  ['Momentos do Imovel', 60],
  ['Frase Elegante', 15],
  ['Reels Moderno', 60],
  ['Galeria Imobiliaria', 60],
  ['Slides Premium', 15],
  ['Video Tour', 60],
  ['Triple Slide Carousel', 30],
])

const getTemplateModelName = (templateName: string): string => (
  templateName
    .replace(/\s+(1x1|4x5(?:\s+Tipo\s+2)?|9x16|16x9)$/i, '')
    .trim()
)

const TEMPLATE_CREDIT_WEIGHTS = new Map<string, number>(
  TEMPLATES.map((template) => [
    template.id,
    TEMPLATE_MODEL_CREDIT_WEIGHTS.get(getTemplateModelName(template.nome)) || 0,
  ])
)

const SMART_CAMPAIGN_FIXED_CREDIT_COST = 185
const SMART_CAMPAIGN_BASE_TEMPLATE_IDS = new Set<string>([
  '662883d7-1dba-4e61-a2a2-81fd9293ab15',
  'd45618d1-5f7f-4053-b317-dd2bbe322f5b',
  'd791b9b8-55e2-4dff-ae5d-76b9e779c551',
  '0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d',
  '1ae7e1f4-ada4-4b03-a032-737a025b88c6',
  '3d72b111-76a7-4c7d-a594-1f75f70be2d2',
  '1de0a863-2376-4336-8a0a-4750c2429cf7',
  '13008c2d-9e7e-4515-a2ac-649c9ea18409',
  '697a514d-4bab-4062-9c9e-3c208688c0e9',
  'd8310f54-5c9d-4606-ae6a-dacb8c4455ae',
  '62d46ee6-6347-4335-af89-2b65f2794882',
  '2ecd48d3-146c-467b-8a0d-908152101378',
])

const DEMO_TEMPLATE_IDS = new Set<string>([
  'd791b9b8-55e2-4dff-ae5d-76b9e779c551',
  '1de0a863-2376-4336-8a0a-4750c2429cf7',
  '2ecd48d3-146c-467b-8a0d-908152101378',
])

const toPositiveInteger = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return 0
}

const normalizePriceLabel = (value: unknown): string => {
  const normalized = String(value ?? '').trim()
  return normalized || 'Consulte'
}

const formatPriceBRL = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value)
  }
  const raw = String(value ?? '').trim()
  if (!raw) return 'Consulte'
  const numeric = Number(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(numeric)
  }
  return raw
}

const toPositiveCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return 0
}

const formatCountLabel = (count: number, singular: string, plural = `${singular}s`): string => {
  if (count <= 0) return ''
  return `${count} ${count === 1 ? singular : plural}`
}

const CANONICAL_TEMPLATE_FIELDS = [
  'property_tag',
  'sale_badge',
  'property_location_type',
  'property_features',
  'property_price',
  'cta_text',
  'broker_whatsapp',
  'broker_email',
  'property_image_01',
  'property_image_02',
  'property_image_03',
  'property_image_04',
] as const

type CanonicalTemplateField = typeof CANONICAL_TEMPLATE_FIELDS[number]
type CanonicalTemplateData = Record<CanonicalTemplateField, string>

const CANONICAL_IMAGE_FIELDS = new Set<CanonicalTemplateField>([
  'property_image_01',
  'property_image_02',
  'property_image_03',
  'property_image_04',
])

const CANONICAL_FIELD_SET = new Set<string>(CANONICAL_TEMPLATE_FIELDS)

const getCanonicalFieldName = (label: string): CanonicalTemplateField | null => (
  CANONICAL_FIELD_SET.has(label) ? label as CanonicalTemplateField : null
)

const maskContactValue = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.includes('@')) {
    const [user, domain] = trimmed.split('@')
    return `${user.slice(0, 2)}***@${domain || '***'}`
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length <= 4) return '***'
  return `***${digits.slice(-4)}`
}

const publicCanonicalLog = (templateData: CanonicalTemplateData): Record<string, string> => ({
  ...templateData,
  broker_whatsapp: maskContactValue(templateData.broker_whatsapp),
  broker_email: maskContactValue(templateData.broker_email),
  property_image_01: templateData.property_image_01 ? 'presente' : '',
  property_image_02: templateData.property_image_02 ? 'presente' : '',
  property_image_03: templateData.property_image_03 ? 'presente' : '',
  property_image_04: templateData.property_image_04 ? 'presente' : '',
})

type PieceCreditReservation = {
  templateId: string
  pieceId: string
  modelId?: string | null
  useId?: string | null
  useLabel?: string | null
  index: number
  amount: number
  idempotencyKey: string
  status: string
}

type SelectedTemplatePiece = {
  piece_id: string
  template_id: string
  model_id?: string | null
  model_name?: string | null
  use_id?: string | null
  use_label?: string | null
  template_nome?: string | null
  credit_cost?: number
  label?: string | null
  index: number
}

async function cancelPieceReservations(
  supabase: ReturnType<typeof createClient>,
  reqId: string,
  userId: string,
  reservations: PieceCreditReservation[],
  reason: string,
) {
  await Promise.all(reservations.map(async (reservation) => {
    if (reservation.amount <= 0 || reservation.status !== 'reserved') return
    const { error } = await supabase.rpc('cancel_credit_reservation', {
      p_user_id: userId,
      p_idempotency_key: reservation.idempotencyKey,
      p_reason: reason,
    })
    if (error) {
      console.warn(`[${reqId}] falha ao cancelar reserva da peÃ§a ${reservation.templateId}:`, error.message)
      return
    }
    reservation.status = 'cancelled'
  }))
}

const FILL_SYSTEM_PROMPT = `VocÃª produz objetos "modifications" do Creatomate para uma lista de templates jÃ¡ selecionados. Para cada template, vocÃª recebe o NOME REAL (ou um rÃ³tulo virtual numerado, quando hÃ¡ slots duplicados) de cada elemento modificÃ¡vel e seu TIPO (text, image, video, audio).

Responda APENAS com um objeto JSON vÃ¡lido (sem markdown), no formato:
{
  "selecoes": [
    {
      "template_id": "uuid",
      "modifications": {
        "<rÃ³tulo do elemento>.text": "texto",
        "<rÃ³tulo do elemento>.source": "https://url-da-imagem-ou-video"
      }
    }
  ]
}

REGRAS GERAIS:
- Use SOMENTE chaves no formato "<rÃ³tulo>.text" (para elementos type=text) ou "<rÃ³tulo>.source" (para image/video/audio).
- O <rÃ³tulo> deve ser EXATAMENTE um dos listados em "elementos reais". NÃ£o invente nomes.
- Quando o template tem MÃšLTIPLOS slots com o mesmo nome (carrossÃ©is, montagens, slideshows), a lista os apresenta com sufixos numerados â€” ex.: "Photo" para o primeiro, "Photo-2" para o segundo, "Photo-3" para o terceiro. Cada sufixo Ã© um SLOT DISTINTO e DEVE ser preenchido individualmente.

DISTRIBUIÃ‡ÃƒO DE FOTOS DO IMÃ“VEL (regra crÃ­tica):
- A PRIMEIRA URL em fotos_urls Ã© a FOTO PRINCIPAL e DEVE ocupar o PRIMEIRO slot de imagem do imÃ³vel do template (o primeiro slot listado cujo rÃ³tulo NÃƒO seja de logo nem de avatar).
- As URLs seguintes em fotos_urls sÃ£o fotos secundÃ¡rias e devem preencher, EM ORDEM, todos os demais slots de imagem do imÃ³vel ("Photo-2", "Photo-3", "Image-2", etc.).
- TODOS os slots de imagem do imÃ³vel disponÃ­veis devem ser preenchidos com .source. Se houver mais slots que fotos, repita a Ãºltima foto disponÃ­vel para os slots restantes. NUNCA deixe um slot de imagem do imÃ³vel sem .source.
- Para elementos do tipo video que representem cenas do imÃ³vel: use uma foto como source se nÃ£o houver vÃ­deos; o Creatomate aceita imagens em slots de vÃ­deo na maioria dos casos.

CLASSIFICAÃ‡ÃƒO DE SLOTS DE IMAGEM:
- LOGO (rÃ³tulo contÃ©m "logo" ou "brand"): use a URL do logo da imobiliÃ¡ria se disponÃ­vel; senÃ£o, valor "" + .track: false.
- AVATAR/AGENT (rÃ³tulo contÃ©m "avatar", "agent", "broker", "realtor", "person", "headshot", "profile"): use a URL da foto do corretor se disponÃ­vel; senÃ£o, valor "" + .track: false.
- Demais slots de imagem/vÃ­deo: pertencem ao IMÃ“VEL e seguem a regra de distribuiÃ§Ã£o acima.

TEXTOS:
- Combine tÃ­tulo, preÃ§o, endereÃ§o, descriÃ§Ã£o curta, marca, nome do corretor conforme o significado do rÃ³tulo e seu valor padrÃ£o. Se o rÃ³tulo contÃ©m "price"/"valor", coloque o preÃ§o. Se contÃ©m "address"/"location", o endereÃ§o. Se contÃ©m "title"/"headline"/"head", o tÃ­tulo. Se contÃ©m "agent"/"broker"/"realtor", o nome do corretor. Se contÃ©m "brand"/"company"/"agency" (text), a ImobiliÃ¡ria/Marca. Se contÃ©m "phone"/"tel"/"whatsapp", o WhatsApp/Telefone. Se contÃ©m "email"/"mail", o email. Se contÃ©m "creci", "CRECI <nÃºmero>". Se contÃ©m "site"/"url"/"website", o site. Se contÃ©m "instagram"/"insta"/"social", o @ do Instagram. NUNCA use dados fictÃ­cios em inglÃªs como "John Doe", "(123) 555-1234", "info@example.com", "mybrand.com", "New York, NY".

TRADUÃ‡ÃƒO OBRIGATÃ“RIA DE FRASES FIXAS EM INGLÃŠS (regra GLOBAL, sem exceÃ§Ãµes):
- Templates stock do Creatomate possuem caixas de texto travadas com frases em inglÃªs americano. NUNCA preserve o valor original em inglÃªs â€” substitua por equivalente em portuguÃªs adequado ao contexto do imÃ³vel brasileiro, ou deixe a string vazia (''+ track:false) quando nÃ£o houver equivalente Ãºtil. Mapeamento obrigatÃ³rio:
  â€¢ "NEW ON SALE" â†’ "Novo Ã  Venda" (ou, conforme o perfil: "LanÃ§amento", "Oportunidade")
  â€¢ "NEW YORK, NY" â†’ endereÃ§o real do imÃ³vel (bairro, cidade, estado)
  â€¢ "NEW YORK" â†’ cidade do imÃ³vel
  â€¢ "NY" (estado isolado) â†’ estado do imÃ³vel (UF brasileiro) ou ''
  â€¢ "Please join us for an Open House" â†’ "Agende sua visita" (ou '' se nÃ£o houver contexto)
  â€¢ "Open House" â†’ "VisitaÃ§Ã£o"
  â€¢ "FOR SALE" / "FOR RENT" â†’ "Ã€ Venda" / "Para Alugar"
  â€¢ "JUST LISTED" â†’ "RecÃ©m-Anunciado"
  â€¢ "CONTACT US" / "CALL TODAY" â†’ respeite a regra de CTA (apenas "Saiba Mais" / "Me Ligue" / "DescriÃ§Ã£o abaixo")
- Qualquer outro texto fixo em inglÃªs americano (endereÃ§os tipo "123 Main St", ZIP codes, "MLS#", "BR/BA", etc.) deve ser traduzido para o contexto brasileiro ou retornar string vazia.

CTA (regra ESTRITA, sem exceÃ§Ãµes):
- Para QUALQUER elemento de texto cujo rÃ³tulo contenha "cta", "button" ou "action", o valor DEVE ser EXATAMENTE uma destas trÃªs variaÃ§Ãµes profissionais, escolhida conforme a intenÃ§Ã£o do criativo:
  â€¢ "Saiba Mais" â€” curiosidade / direcionar para mais detalhes (banners, cards de portal, posts informativos).
  â€¢ "Me Ligue" â€” incentivar contato telefÃ´nico direto (Stories, Reels com Ã¡udio, banners com telefone visÃ­vel).
  â€¢ "DescriÃ§Ã£o abaixo" â€” feeds/posts onde a legenda complementa o criativo (Instagram Feed, Facebook Feed).
- Ã‰ PROIBIDO usar qualquer outra variaÃ§Ã£o ("Compre Agora", "Veja Mais", "Confira", "Clique Aqui", "Saiba+", "Agende uma Visita", "Entre em Contato", "Fale Conosco", etc.). APENAS as trÃªs acima sÃ£o aceitas.

TOM E DEMAIS REGRAS:
- Tom: alto_padrao = sofisticado e exclusivo; popular_mcmv/medio_padrao = acolhedor e acessÃ­vel; lancamento = urgÃªncia e novidade; em_construcao = transparÃªncia e valorizaÃ§Ã£o.
- NÃ£o invente dados. Se uma informaÃ§Ã£o nÃ£o foi fornecida, omita a chave correspondente.
- Quando um campo tiver valor REMOVER_ELEMENTO, defina o valor do elemento como string vazia '' e adicione a propriedade 'track': false se disponÃ­vel. NUNCA use placeholders fictÃ­cios.
- Mantenha textos curtos para caber no template (Headline â‰¤ 40 chars, Subhead â‰¤ 60 chars, Description â‰¤ 120 chars, CTA â‰¤ 20 chars).`

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SANITIZER â€” garante PT-BR e remove placeholders fictÃ­cios
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type SanitizeContext = {
  preco?: string
  suites_label?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  corretor_nome?: string
  corretor_email?: string
  corretor_creci?: string
  marca_imovel?: string
  telefone_contato?: string
  whatsapp?: string
  site?: string
  instagram?: string
  titulo?: string
}

const PLACEHOLDER_EMAIL_DOMAINS = [
  'example.com', 'example.org', 'example.net',
  'mybrand.com', 'yourbrand.com', 'brand.com',
  'company.com', 'yourcompany.com',
  'realestate.com', 'realtors.com', 'realty.com',
  'website.com', 'yourwebsite.com',
  'sample.com', 'test.com', 'placeholder.com', 'domain.com', 'mail.com',
]

const PLACEHOLDER_EMAIL_USERS = new Set([
  'john', 'jane', 'doe', 'johndoe', 'janedoe',
  'elisabeth', 'elizabeth', 'michael', 'sarah', 'jessica', 'david', 'mary', 'james', 'patricia',
  'info', 'contact', 'support', 'hello', 'hi', 'admin', 'office',
  'noreply', 'no-reply', 'test', 'user', 'sample', 'placeholder', 'demo', 'example',
])

const PLACEHOLDER_DOMAINS = [
  'mybrand.com', 'yourbrand.com', 'brand.com',
  'example.com', 'example.org', 'example.net',
  'realestate.com', 'realtors.com', 'realty.com',
  'company.com', 'yourcompany.com',
  'website.com', 'yoursite.com', 'yourwebsite.com',
  'sample.com', 'test.com', 'placeholder.com', 'domain.com',
]

const ENGLISH_CITIES = [
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'fort worth', 'columbus', 'indianapolis', 'charlotte', 'san francisco',
  'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit',
  'nashville', 'memphis', 'portland', 'oklahoma city', 'las vegas',
  'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno',
  'sacramento', 'mesa', 'kansas city', 'atlanta', 'long beach', 'miami',
  'beverly hills', 'hollywood', 'malibu', 'manhattan', 'brooklyn', 'queens',
  'london', 'manchester', 'liverpool', 'birmingham', 'leeds',
  'sydney', 'melbourne', 'toronto', 'vancouver', 'montreal', 'paris', 'berlin',
]

const US_STATE_CODE_RE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/

const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'your', 'our', 'this', 'that', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'will', 'would', 'could', 'should',
  'have', 'has', 'had', 'about', 'into', 'from',
  'home', 'house', 'price', 'beautiful', 'modern', 'luxury', 'family',
  'bedroom', 'bathroom', 'living', 'kitchen', 'available', 'now',
  'call', 'today', 'contact', 'experience', 'discover', 'welcome', 'feature',
  'features', 'sale', 'rent', 'rental', 'best', 'new', 'amazing', 'stunning',
  'gorgeous', 'spacious', 'cozy', 'dream', 'perfect',
])

const PORTUGUESE_STOPWORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'pelo', 'pela', 'para', 'com', 'sem', 'sob', 'sobre',
  'que', 'qual', 'quais',
  'Ã©', 'sÃ£o', 'foi', 'foram', 'ser', 'estar', 'estÃ¡', 'estÃ£o',
  'tem', 'tÃªm', 'ter', 'hÃ¡',
  'casa', 'apartamento', 'imÃ³vel', 'imovel', 'imÃ³veis',
  'venda', 'aluguel', 'preÃ§o', 'preco',
  'belo', 'bonito', 'moderno', 'luxo', 'famÃ­lia', 'familia',
  'quarto', 'quartos', 'banheiro', 'banheiros', 'sala', 'cozinha',
  'sua', 'seu', 'nosso', 'nossa',
])

function detectLanguage(s: string): 'pt' | 'en' | 'unknown' {
  // Acento ou cedilha â†’ quase certamente PT
  if (/[Ã¡Ã Ã¢Ã£Ã©ÃªÃ­Ã³Ã´ÃµÃºÃ¼Ã§]/i.test(s)) return 'pt'
  const tokens = s.toLowerCase().split(/[\s,.;:!?()'"\-/]+/).filter((t) => t.length > 0)
  if (tokens.length < 2) return 'unknown'
  let pt = 0
  let en = 0
  for (const t of tokens) {
    if (PORTUGUESE_STOPWORDS.has(t)) pt++
    if (ENGLISH_STOPWORDS.has(t)) en++
  }
  if (pt > 0) return 'pt'
  if (en >= 3) return 'en'
  if (en >= 2 && tokens.length <= 5) return 'en'
  return 'unknown'
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DICIONÃRIO INGLÃŠS â†’ PT-BR â€” primeira camada de traduÃ§Ã£o.
//
// Templates Creatomate (stock) vÃªm com textos americanos travados:
// "FOR SALE", "NEW LISTING", "Open House", "Beautiful Modern Home",
// rÃ³tulos de specs como "Bedrooms"/"Square Feet", placeholders tipo
// "MY BRAND" / "New York, NY". Esta camada faz substituiÃ§Ã£o literal
// case-insensitive ANTES do sanitizeTemplateText, garantindo que
// frases conhecidas virem PT-BR (ou vazio, quando sÃ£o placeholders
// fictÃ­cios sem equivalente Ãºtil).
//
// Como funciona:
// - Cada entrada Ã© compilada em regex `\bTERMO\b` com flag /gi.
// - EspaÃ§os viram `\s+` para tolerar espaÃ§os mÃºltiplos / quebras.
// - Lista Ã© ordenada por tamanho descendente â€” "Real Estate Agent"
//   roda antes de "Agent" pra evitar "Real Estate Corretor".
// - Valor '' significa REMOVER o placeholder (deixa string vazia
//   para a prÃ³xima etapa decidir; sanitize/CTA tratam o vazio).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const EN_PT_DICTIONARY: Record<string, string> = {
  // â”€â”€ Headlines compostas (devem rodar antes dos termos curtos) â”€
  'See full listing in description': 'Veja o anÃºncio completo na descriÃ§Ã£o',
  'Home For Sale': 'ImÃ³vel Ã  Venda',
  'House For Sale': 'Casa Ã  Venda',
  'House For Rent': 'Casa para Alugar',
  'Home For Rent': 'ImÃ³vel para Alugar',
  'Price Starts At': 'A partir de',
  'Starts At': 'A partir de',
  'Great Features': 'Diferenciais',
  'Key Features': 'Diferenciais',
  'Built in': 'ConstruÃ­do em',

  // â”€â”€ Status / labels do anÃºncio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'For Sale': 'Ã€ Venda',
  'For Rent': 'Para Alugar',
  'For Lease': 'Para Alugar',
  'On Sale': 'Ã€ Venda',
  'New Listing': 'Novo ImÃ³vel',
  'Just Listed': 'RecÃ©m-Anunciado',
  'New on Sale': 'Novo Ã  Venda',
  'New On Sale': 'Novo Ã  Venda',
  'Coming Soon': 'Em Breve',
  'Now Available': 'DisponÃ­vel Agora',
  'Available Now': 'DisponÃ­vel Agora',
  'Price Reduced': 'PreÃ§o Reduzido',
  'Reduced Price': 'PreÃ§o Reduzido',
  'Sold': 'Vendido',
  'Rented': 'Alugado',
  'Pending': 'Reservado',
  'Featured Listing': 'ImÃ³vel em Destaque',
  'Featured Property': 'ImÃ³vel em Destaque',
  'Featured': 'Destaque',
  'Exclusive Listing': 'ImÃ³vel Exclusivo',
  'Exclusive': 'Exclusivo',
  'Luxury': 'Luxo',
  'Available': 'DisponÃ­vel',

  // â”€â”€ Eventos / convite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Please join us for an Open House': 'Agende sua Visita',
  'Join us for an Open House': 'Agende sua Visita',
  'Open House': 'Visita Aberta',
  'House Tour': 'Tour pela Casa',
  'Virtual Tour': 'Tour Virtual',

  // â”€â”€ CTAs e aÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Schedule a Visit': 'Agende uma Visita',
  'Schedule a Tour': 'Agende um Tour',
  'Schedule a Showing': 'Agende uma Visita',
  'Book a Tour': 'Agende um Tour',
  'Book a Visit': 'Agende uma Visita',
  'Request a Viewing': 'Solicite uma Visita',
  'Contact Us': 'Fale Conosco',
  'Get in Touch': 'Entre em Contato',
  'Reach Out': 'Entre em Contato',
  'Call Now': 'Ligue Agora',
  'Call Today': 'Ligue Hoje',
  'Call Us': 'Ligue para NÃ³s',
  'View Details': 'Ver Detalhes',
  'See Details': 'Ver Detalhes',
  'See More': 'Ver Mais',
  'Read More': 'Leia Mais',
  'Learn More': 'Saiba Mais',
  'Find Out More': 'Saiba Mais',
  'Visit Our Website': 'Visite Nosso Site',
  'Visit Website': 'Visite o Site',
  'Inquire Now': 'Consulte Agora',
  'Apply Now': 'Inscreva-se',
  'Get Started': 'Comece Agora',
  'Buy Now': 'Compre Agora',
  'Rent Now': 'Alugue Agora',
  'Reserve Now': 'Reserve Agora',
  'Browse Listings': 'Veja os ImÃ³veis',
  'See All Listings': 'Veja Todos os ImÃ³veis',

  // â”€â”€ EspecificaÃ§Ãµes do imÃ³vel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Square Feet': 'mÂ²',
  'Square Meters': 'mÂ²',
  'Sq Ft': 'mÂ²',
  'Sqft': 'mÂ²',
  'Sq M': 'mÂ²',
  'Bedrooms': 'Quartos',
  'Bedroom': 'Quarto',
  'Bathrooms': 'Banheiros',
  'Bathroom': 'Banheiro',
  'Baths': 'Banheiros',
  'Bath': 'Banheiro',
  'Beds': 'Quartos',
  'Bed': 'Quarto',
  'Half Baths': 'Lavabos',
  'Half Bath': 'Lavabo',
  'Living Room': 'Sala de Estar',
  'Dining Room': 'Sala de Jantar',
  'Family Room': 'Sala de FamÃ­lia',
  'Kitchen': 'Cozinha',
  'Garage': 'Garagem',
  'Garage Spaces': 'Vagas de Garagem',
  'Garage Space': 'Vaga de Garagem',
  'Parking Spots': 'Vagas',
  'Parking Spot': 'Vaga',
  'Parking Spaces': 'Vagas',
  'Parking Space': 'Vaga',
  'Parking': 'Estacionamento',
  'Pool': 'Piscina',
  'Backyard': 'Quintal',
  'Garden': 'Jardim',
  'Balcony': 'Sacada',
  'Terrace': 'TerraÃ§o',
  'Patio': 'PÃ¡tio',
  'Fireplace': 'Lareira',

  // â”€â”€ Labels de campo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Asking Price': 'PreÃ§o Pedido',
  'Listing Price': 'PreÃ§o Anunciado',
  'Monthly Rent': 'Aluguel Mensal',
  'Price': 'PreÃ§o',
  'Address': 'EndereÃ§o',
  'Location': 'LocalizaÃ§Ã£o',
  'Neighborhood': 'Bairro',
  'Description': 'DescriÃ§Ã£o',
  'Details': 'Detalhes',
  'Features': 'CaracterÃ­sticas',
  'Amenities': 'Comodidades',
  'Highlights': 'Destaques',
  'Property Type': 'Tipo de ImÃ³vel',
  'Property': 'ImÃ³vel',

  // â”€â”€ Tipos de imÃ³vel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Single Family Home': 'Casa',
  'Single Family': 'Casa',
  'Studio Apartment': 'Studio',
  'Townhouse': 'Sobrado',
  'Apartment': 'Apartamento',
  'Condo': 'Apartamento',

  // â”€â”€ Pessoas / papÃ©is â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Real Estate Agent': 'Corretor de ImÃ³veis',
  'Real Estate Agency': 'ImobiliÃ¡ria',
  'Real Estate Broker': 'Corretor de ImÃ³veis',
  'Real Estate': 'ImÃ³veis',
  'Listing Agent': 'Corretor ResponsÃ¡vel',
  'Brokerage': 'ImobiliÃ¡ria',
  'Agency': 'ImobiliÃ¡ria',
  'Realtor': 'Corretor',
  'Broker': 'Corretor',
  'Agent': 'Corretor',
  'Seller': 'Vendedor',
  'Buyer': 'Comprador',
  'Owner': 'ProprietÃ¡rio',
  'Tenant': 'Inquilino',

  // â”€â”€ Boas-vindas / emocional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Welcome Home': 'Bem-vindo ao Seu Lar',
  'Welcome to': 'Bem-vindo ao',
  'Your Dream Home': 'O Lar dos Seus Sonhos',
  'Dream Home': 'Lar dos Sonhos',
  'Find Your Home': 'Encontre Seu Lar',
  'Your New Home': 'Sua Nova Casa',
  'New Home': 'Nova Casa',
  'Make It Yours': 'FaÃ§a Dele o Seu',

  // â”€â”€ Adjetivos comuns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Newly Renovated': 'RecÃ©m-Reformado',
  'Move-In Ready': 'Pronto para Morar',
  'Move In Ready': 'Pronto para Morar',
  'Beautiful': 'Belo',
  'Stunning': 'Deslumbrante',
  'Gorgeous': 'Lindo',
  'Modern': 'Moderno',
  'Spacious': 'Amplo',
  'Cozy': 'Aconchegante',
  'Charming': 'Charmoso',
  'Elegant': 'Elegante',
  'Bright': 'Iluminado',
  'Sunny': 'Ensolarado',
  'Renovated': 'Reformado',

  // â”€â”€ Contato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'Phone Number': 'Telefone',
  'Email Address': 'Email',
  'Phone': 'Telefone',
  'Website': 'Site',
  'Follow Us On': 'Siga-nos no',
  'Follow Us': 'Siga-nos',
  'Visit Us At': 'Visite-nos em',
  'Visit Us': 'Visite-nos',
  'Find Us On': 'Encontre-nos no',

  // â”€â”€ Placeholders que viram vazio (sem equivalente PT-BR Ãºtil) â”€
  'New York, NY': '',
  'New York': '',
  'Los Angeles, CA': '',
  'Los Angeles': '',
  'San Francisco, CA': '',
  'San Francisco': '',
  'Chicago, IL': '',
  'Miami, FL': '',
  'Boston, MA': '',
  'Brooklyn, NY': '',
  'Manhattan, NY': '',
  'MY BRAND': '',
  'My Brand': '',
  'Your Brand': '',
  'BRAND NAME': '',
  'Brand Name': '',
  'YOUR LOGO': '',
  'Your Logo': '',
  'My Logo': '',
  'Logo Here': '',
  'COMPANY NAME': '',
  'Company Name': '',
  'Your Company': '',
  'Company Tagline': '',
  'Tagline Here': '',
  'Lorem Ipsum': '',
  'John Doe': '',
  'Jane Doe': '',
  'YOUR NAME': '',
  'Your Name': '',
  'Sample Text': '',
  'Click Here': '',
}

// PrÃ©-compila lista ordenada por tamanho desc (mais longa primeiro).
// EspaÃ§os do termo viram \s+ para tolerar espaÃ§os mÃºltiplos / quebras.
const EN_PT_RULES: Array<{ pattern: RegExp; replacement: string }> = (() => {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Object.entries(EN_PT_DICTIONARY)
    .sort(([a], [b]) => b.length - a.length)
    .map(([en, pt]) => {
      const body = escape(en).replace(/\s+/g, '\\s+')
      const start = /^\w/.test(en) ? '\\b' : ''
      const end = /\w$/.test(en) ? '\\b' : ''
      return { pattern: new RegExp(`${start}${body}${end}`, 'gi'), replacement: pt }
    })
})()

// Preserva o caso do termo casado:
// - "HOME FOR SALE" (ALL CAPS)  â†’ "IMÃ“VEL Ã€ VENDA"
// - "Home For Sale" (Title Case) â†’ "ImÃ³vel Ã  Venda"
// - "home for sale" (lower)      â†’ "ImÃ³vel Ã  Venda" (canonical do dicionÃ¡rio)
// ExceÃ§Ã£o: unidades de medida com convenÃ§Ã£o prÃ³pria ("mÂ²") nÃ£o viram caixa alta.
function applyCase(matched: string, replacement: string): string {
  if (!replacement) return replacement
  if (replacement === 'mÂ²') return replacement
  const isAllCaps = matched.length > 0
    && matched === matched.toUpperCase()
    && /[A-Za-zÃ€-Ã¿]/.test(matched)
  return isAllCaps ? replacement.toLocaleUpperCase('pt-BR') : replacement
}

function translateFixedEnglish(text: string): string {
  if (!text) return text
  let out = text
  for (const { pattern, replacement } of EN_PT_RULES) {
    out = out.replace(pattern, (m) => applyCase(m, replacement))
  }
  return out
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Frases fixas em inglÃªs â€” segunda camada (context-aware).
// Defensa em profundidade: roda dentro do sanitizeTemplateText
// depois do dicionÃ¡rio ENâ†’PT. MantÃ©m regras de longo prazo que
// dependem de contexto do imÃ³vel (nÃ£o pertencem ao dicionÃ¡rio).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type FixedPhraseRule = {
  pattern: RegExp
  resolve: (ctx: SanitizeContext, enderecoFinal: string) => string
}

const FIXED_ENGLISH_PHRASES: FixedPhraseRule[] = [
  // EndereÃ§o composto americano â†’ endereÃ§o real do imÃ³vel
  {
    pattern: /\bNEW\s+YORK\s*,\s*NY\b/gi,
    resolve: (_ctx, enderecoFinal) => enderecoFinal,
  },
  // Convite para visitaÃ§Ã£o
  {
    pattern: /\bplease\s+join\s+us\s+for\s+(?:an?\s+)?open\s+house\b/gi,
    resolve: () => 'Agende sua visita',
  },
  // Selo "novidade"
  { pattern: /\bNEW\s+ON\s+SALE\b/gi, resolve: () => 'Novo Ã  Venda' },
  { pattern: /\bJUST\s+LISTED\b/gi,    resolve: () => 'RecÃ©m-Anunciado' },
  // Finalidade
  { pattern: /\bFOR\s+SALE\b/gi, resolve: () => 'Ã€ Venda' },
  { pattern: /\bFOR\s+RENT\b/gi, resolve: () => 'Para Alugar' },
  // Eventos
  { pattern: /\bOpen\s+House\b/gi, resolve: () => 'VisitaÃ§Ã£o' },
  // Cidade isolada
  {
    pattern: /\bNEW\s+YORK\b/gi,
    resolve: (ctx) => ctx.cidade || '',
  },
  // Estado abreviado isolado (tambÃ©m coberto por US_STATE_CODE_RE,
  // mas explicitar garante substituiÃ§Ã£o em qualquer comprimento de texto)
  {
    pattern: /\bNY\b/g,
    resolve: (ctx) => ctx.estado || '',
  },
]

function applyFixedEnglishPhrases(text: string, ctx: SanitizeContext, enderecoFinal: string): string {
  let out = text
  for (const rule of FIXED_ENGLISH_PHRASES) {
    out = out.replace(rule.pattern, rule.resolve(ctx, enderecoFinal))
  }
  return out
}

function sanitizeTemplateText(input: unknown, ctx: SanitizeContext): string {
  if (typeof input !== 'string') return ''
  let s = input.trim()
  if (!s) return ''

  const enderecoFinal = (ctx.endereco
    || [ctx.bairro, ctx.cidade, ctx.estado].filter(Boolean).join(', ')
  ).trim()

  // 0. Frases fixas em inglÃªs (NEW ON SALE, NEW YORK NY, Open House, ...).
  //    Aplicado ANTES das demais etapas para que o restante do pipeline
  //    veja jÃ¡ o texto em PT-BR / com o dado real do imÃ³vel.
  s = applyFixedEnglishPhrases(s, ctx, enderecoFinal)
  if (ctx.suites_label) {
    s = s
      .replace(/\b\d+\s*banheiros?\b/gi, ctx.suites_label)
      .replace(/\bbanheiros?\b/gi, ctx.suites_label)
  }

  // 1. Substituir cidades em inglÃªs (com ou sem cÃ³digo de estado US: "New York, NY")
  for (const c of ENGLISH_CITIES) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}(?:\\s*,?\\s*[A-Z]{2})?\\b`, 'gi')
    if (re.test(s)) {
      s = s.replace(re, enderecoFinal)
    }
  }
  // Estado US isolado ("CA", "NY") em texto curto â†’ endereÃ§o real
  if (US_STATE_CODE_RE.test(s) && s.length <= 30 && !PORTUGUESE_STOPWORDS.has(s.toLowerCase())) {
    s = s.replace(US_STATE_CODE_RE, enderecoFinal ? ctx.estado || '' : '')
  }

  // 2. Emails placeholder (info@example.com, elisabeth@..., john@mybrand.com, etc.)
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => {
    const lower = m.toLowerCase()
    const [user, domain] = lower.split('@')
    const userBase = user.split(/[+.]/)[0]
    if (PLACEHOLDER_EMAIL_DOMAINS.some((d) => domain.endsWith(d))) return ''
    if (PLACEHOLDER_EMAIL_USERS.has(userBase)) return ''
    return m
  })

  // 3. DomÃ­nios placeholder (mybrand.com, example.com, etc.)
  for (const d of PLACEHOLDER_DOMAINS) {
    const escaped = d.replace(/\./g, '\\.')
    const re = new RegExp(`(?:https?://)?(?:www\\.)?${escaped}(?:/\\S*)?`, 'gi')
    if (re.test(s)) {
      s = s.replace(re, ctx.marca_imovel || '')
    }
  }

  // 4. Telefones fake estilo americano: "(123) 555-1234", "+1 555-...", padrÃ£o "555-xxxx"
  const phoneReal = ctx.telefone_contato || ''
  // Telefone com bloco "555" claramente placeholder
  s = s.replace(/\+?1?[\s.()-]*\d{3}[\s.()-]*555[\s.()-]*\d{4}/g, phoneReal)
  // String inteira sendo um nÃºmero US-style (10 dÃ­gitos, com opcional "+1")
  if (/^\+?1[\s.()-]*\(?\d{3}\)?[\s.()-]*\d{3}[\s.()-]*\d{4}$/.test(s)) {
    s = phoneReal
  }

  // 5. Limpar resÃ­duos (vÃ­rgulas duplas, hifens Ã³rfÃ£os, espaÃ§os extras)
  s = s
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s,;:\-|]+|[\s,;:\-|]+$/g, '')
    .trim()

  if (!s) return ''

  // 6. Se o que sobrou estiver em inglÃªs, tentar substituiÃ§Ã£o semÃ¢ntica pelo dado real;
  //    se nÃ£o houver, retornar string vazia.
  const lang = detectLanguage(s)
  if (lang === 'en') {
    const lower = s.toLowerCase()
    if (/\b(price|cost|value|valor|amount)\b/.test(lower) && ctx.preco) return String(ctx.preco)
    if (/\b(address|location|street|neighborhood|area|local)\b/.test(lower) && enderecoFinal) return enderecoFinal
    if (/\b(agent|broker|realtor|representative|seller|sales)\b/.test(lower) && ctx.corretor_nome) return ctx.corretor_nome
    if (/\b(brand|company|agency|office|realty|estate)\b/.test(lower) && ctx.marca_imovel) return ctx.marca_imovel
    if (/\b(headline|title|home|house|property)\b/.test(lower) && ctx.titulo) return ctx.titulo
    if (/\b(phone|tel|whatsapp|call)\b/.test(lower) && (ctx.whatsapp || ctx.telefone_contato)) return ctx.whatsapp || ctx.telefone_contato || ''
    if (/\b(email|e-mail|mail)\b/.test(lower) && ctx.corretor_email) return ctx.corretor_email
    if (/\b(creci)\b/.test(lower) && ctx.corretor_creci) return `CRECI ${ctx.corretor_creci}`
    if (/\b(website|site|url|web)\b/.test(lower) && ctx.site) return ctx.site
    if (/\b(instagram|insta|social|follow)\b/.test(lower) && ctx.instagram) return ctx.instagram.startsWith('@') ? ctx.instagram : `@${ctx.instagram}`
    return ''
  }

  return s
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CTAs aprovados â€” apenas estas trÃªs variaÃ§Ãµes profissionais podem
// aparecer em slots de CTA. Qualquer outra coisa que a IA retornar
// Ã© mapeada (snapCta) para uma destas trÃªs opÃ§Ãµes.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const APPROVED_CTAS = ['Saiba Mais', 'Me Ligue', 'DescriÃ§Ã£o abaixo'] as const

function isCtaElement(elementName: string): boolean {
  return /cta|button|action/i.test(elementName)
}

function isPriceElement(elementName: string): boolean {
  return /\b(price|preco|preÃ§o|valor|value|amount)\b/i.test(elementName)
}

function isBathroomElement(elementName: string): boolean {
  return /\b(bath|baths|bathroom|bathrooms|banheiro|banheiros)\b/i.test(elementName)
}

function snapCta(value: string): string {
  const lower = value.trim().toLowerCase()
  if (!lower) return 'Saiba Mais'
  for (const cta of APPROVED_CTAS) {
    if (lower === cta.toLowerCase()) return cta
  }
  if (/(ligu|liga|call|telefon|phone|whats|fal[ea])/.test(lower)) return 'Me Ligue'
  if (/(descri[Ã§c][aÃ£]o|abaixo|below|swipe|deslize|arraste|bio|legenda)/.test(lower)) return 'DescriÃ§Ã£o abaixo'
  return 'Saiba Mais'
}

// Slot de imagem do IMÃ“VEL = qualquer image/video que nÃ£o seja logo nem avatar.
function isPropertyPhotoSlot(name: string): boolean {
  const lower = name.toLowerCase()
  if (/logo|brand/.test(lower)) return false
  if (/avatar|agent|broker|realtor|person|headshot|profile/.test(lower)) return false
  return true
}

type ElementInfo = { name: string; type: string; id?: string; virtualLabel?: string; defaultValue?: string }

function findCanonicalElement(
  elementos: Map<string, ElementInfo>,
  field: CanonicalTemplateField
): { label: string; elem: ElementInfo } | null {
  const direct = elementos.get(field)
  if (direct) return { label: field, elem: direct }
  for (const [label, elem] of elementos.entries()) {
    if (elem.name === field || elem.virtualLabel === field) return { label, elem }
  }
  return null
}

function buildCanonicalModifications(
  elementos: Map<string, ElementInfo>,
  templateData: CanonicalTemplateData
): {
  modifications: Record<string, unknown>
  sentFields: string[]
  missingFields: string[]
} {
  const modifications: Record<string, unknown> = {}
  const sentFields: string[] = []
  const missingFields: string[] = []

  for (const field of CANONICAL_TEMPLATE_FIELDS) {
    const match = findCanonicalElement(elementos, field)
    if (!match) {
      missingFields.push(field)
      continue
    }

    const { elem } = match
    const isImageField = CANONICAL_IMAGE_FIELDS.has(field)
    const expectedProp = isImageField ? 'source' : 'text'
    if (isImageField && !['image', 'video', 'audio'].includes(elem.type)) {
      missingFields.push(field)
      continue
    }
    if (!isImageField && elem.type !== 'text') {
      missingFields.push(field)
      continue
    }

    const rawValue = templateData[field]
    if (!rawValue && isImageField) {
      missingFields.push(field)
      continue
    }

    const keyBase = elem.id || elem.name
    modifications[`${keyBase}.${expectedProp}`] =
      field === 'cta_text' ? snapCta(rawValue || 'Saiba Mais') : rawValue
    sentFields.push(field)
  }

  return { modifications, sentFields, missingFields }
}

function normalizeSearchText(...values: unknown[]): string {
  return values
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolvePropertyTag(categoria: string, dadosImovel: Record<string, unknown>, titulo: unknown, descricao: unknown): string {
  const search = normalizeSearchText(categoria, dadosImovel.categoria, dadosImovel.padrao, titulo, descricao)
  if (/lancamento|lanÃ§amento/.test(search)) return 'LanÃ§amento'
  if (/alto\s*padrao|alto\s*padr[aÃ£]o|luxo|premium/.test(search)) return 'Alto PadrÃ£o'
  if (/minha\s*casa|minha\s*casa\s*minha\s*vida|mcmv/.test(search)) return 'Minha Casa Minha Vida'
  if (/oportunidade|promocao|promoÃ§Ã£o|abaixo/.test(search)) return 'Oportunidade'
  if (/construcao|construÃ§Ã£o|obra/.test(search)) return 'Em construÃ§Ã£o'
  return 'Pronto para Morar'
}

function resolveSaleBadge(finalidade: unknown, titulo: unknown, descricao: unknown): string {
  const search = normalizeSearchText(finalidade, titulo, descricao)
  if (/locacao|locaÃ§Ã£o|aluguel|alugar|rent/.test(search)) return 'Para LocaÃ§Ã£o'
  return 'Ã€ Venda'
}

function resolveBairro(dadosImovel: Record<string, unknown>, endereco: unknown): string {
  const bairro = String(dadosImovel.bairro ?? '').trim()
  if (bairro) return bairro
  if (typeof endereco === 'string' && endereco.trim()) {
    return endereco.split(',')[0]?.trim() || ''
  }
  return ''
}

function buildCanonicalTemplateData(input: {
  categoria: string
  dadosImovel: Record<string, unknown>
  titulo: unknown
  descricao: unknown
  preco: unknown
  finalidade: unknown
  tipoImovel: unknown
  endereco: unknown
  fotosArr: string[]
  quartosLabel: string
  suitesLabel: string
  vagasLabel: string
  areaLabel: string
  corretorWhatsApp: string
  corretorTelefone: string
  corretorEmail: string
}): CanonicalTemplateData {
  const bairro = resolveBairro(input.dadosImovel, input.endereco)
  const tipo = String(input.tipoImovel || input.dadosImovel.tipo || '').trim()
  const propertyLocationType = [bairro, tipo].filter(Boolean).join(', ') || tipo || bairro
  const propertyFeatures =
    [input.quartosLabel, input.suitesLabel, input.vagasLabel].filter(Boolean).join(' â€¢ ')
    || input.areaLabel
    || ''
  const contact = input.corretorWhatsApp || input.corretorTelefone

  return {
    property_tag: resolvePropertyTag(input.categoria, input.dadosImovel, input.titulo, input.descricao),
    sale_badge: resolveSaleBadge(input.finalidade, input.titulo, input.descricao),
    property_location_type: propertyLocationType,
    property_features: propertyFeatures,
    property_price: formatPriceBRL(input.preco),
    cta_text: contact ? 'Agende sua visita' : 'Solicite informaÃ§Ãµes',
    broker_whatsapp: contact,
    broker_email: input.corretorEmail,
    property_image_01: input.fotosArr[0] || '',
    property_image_02: input.fotosArr[1] || '',
    property_image_03: input.fotosArr[2] || '',
    property_image_04: input.fotosArr[3] || '',
  }
}

function extractElements(node: unknown, out: ElementInfo[] = []): ElementInfo[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) extractElements(item, out)
    return out
  }
  const n = node as Record<string, unknown>
  if (typeof n.name === 'string' && typeof n.type === 'string') {
    if (['text', 'image', 'video', 'audio'].includes(n.type)) {
      const defaultValue =
        typeof n.text === 'string' ? n.text :
        typeof n.source === 'string' ? n.source :
        undefined
      const id = typeof n.id === 'string' ? n.id : undefined
      out.push({ name: n.name, type: n.type, id, defaultValue })
    }
  }
  if (Array.isArray(n.elements)) extractElements(n.elements, out)
  return out
}

async function fetchTemplateElements(reqId: string, templateId: string): Promise<{ id: string; name: string; elements: ElementInfo[]; erro?: string }> {
  try {
    const res = await fetch(`https://api.creatomate.com/v1/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${CREATOMATE_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[${reqId}] GET template ${templateId} ${res.status}:`, body.slice(0, 200))
      return { id: templateId, name: '', elements: [], erro: `GET ${res.status}` }
    }
    const body = await res.json()
    const elements = extractElements(body?.source)
    // Sufixa rÃ³tulos virtuais para nomes duplicados (Photo, Photo-2, Photo-3, ...)
    // em vez de descartÃ¡-los. Slots de mesmo nome sÃ£o comuns em templates de
    // carrossel/montagem e precisam ser endereÃ§ados individualmente. A chave
    // final enviada ao Creatomate usa o ID do elemento (nÃ£o o virtualLabel)
    // para evitar ambiguidade quando os nomes colidem.
    const counts = new Map<string, number>()
    for (const e of elements) {
      const key = `${e.name}|${e.type}`
      const idx = (counts.get(key) || 0) + 1
      counts.set(key, idx)
      e.virtualLabel = idx === 1 ? e.name : `${e.name}-${idx}`
    }
    return { id: templateId, name: String(body?.name || ''), elements }
  } catch (err) {
    console.error(`[${reqId}] GET template ${templateId} erro:`, err)
    return { id: templateId, name: '', elements: [], erro: err instanceof Error ? err.message : String(err) }
  }
}

serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)
  let supabaseClient: ReturnType<typeof createClient> | null = null
  const pieceCreditReservations: PieceCreditReservation[] = []
  let cleanupUserId = ''

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY || !CREATOMATE_API_KEY) {
      return jsonResponse({
        success: false,
        error: 'Configuração de renderização indisponível.',
        renders: [],
      }, 200)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    supabaseClient = supabase

    // === Auth: validar JWT inbound e derivar user_id da identidade autenticada ===
    // NUNCA aceitar user_id do body â€” cliente roda com service_role e RLS bypass.
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ error: 'Authorization header ausente ou invalido' }, 401)
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authUser) {
      console.warn(`[${reqId}] JWT invalido:`, authErr?.message)
      return jsonResponse({ error: 'Token invalido ou expirado' }, 401)
    }
    const authenticatedUserId = authUser.id
    cleanupUserId = authenticatedUserId

    const rawPayload = await req.json().catch(() => ({}))
    const payload = rawPayload && typeof rawPayload === 'object'
      ? rawPayload as Record<string, unknown>
      : {}
    const {
      campaign_id,
      fotos_urls = [],
      foto_principal,
      titulo,
      descricao,
      preco,
      suites,
      quartos,
      vagas,
      area,
      endereco,
      tipo_imovel,
      finalidade,
      corretor_nome,
      corretor_avatar_url,
      marca_imovel,
      credit_cost,
      generation_mode,
      video_ia_premium,
      idempotency_key,
    } = payload as Record<string, unknown>
    const selectedTemplatesPayload =
      payload.selectedTemplates
      ?? payload.selected_templates
      ?? payload.templates
      ?? payload.pieces
      ?? []

    // fotos_urls Ã© a fonte de verdade, EM ORDEM (a primeira Ã© a principal).
    // Se vier foto_principal explÃ­cita e ela nÃ£o estiver na lista, prependa.
    const fotosRaw = Array.isArray(fotos_urls) ? (fotos_urls as string[]).filter(Boolean) : []
    const fotosArr = (() => {
      const principal = typeof foto_principal === 'string' && foto_principal.length > 0 ? foto_principal : ''
      if (!principal) return fotosRaw
      if (fotosRaw[0] === principal) return fotosRaw
      return [principal, ...fotosRaw.filter((u) => u !== principal)]
    })()
    const hasCampaignId = typeof campaign_id === 'string' && campaign_id.length > 0

    // Templates escolhidos pelo usuário (frontend manda em selectedTemplates).
    // Fonte única de verdade: backend NUNCA escolhe sozinho.
    console.log(`[${reqId}] gerar-banners body`, {
      keys: Object.keys(payload),
      selected_templates_type: Array.isArray(selectedTemplatesPayload) ? 'array' : typeof selectedTemplatesPayload,
      selected_templates_count: Array.isArray(selectedTemplatesPayload) ? selectedTemplatesPayload.length : 0,
    })

    const selectedTemplatesArray = Array.isArray(selectedTemplatesPayload)
      ? selectedTemplatesPayload
      : typeof selectedTemplatesPayload === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(selectedTemplatesPayload)
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })()
        : []

    const selectedPiecesRaw: SelectedTemplatePiece[] = selectedTemplatesArray.length > 0
      ? (selectedTemplatesArray as unknown[]).map((item, index) => {
          if (typeof item === 'string' && item.trim()) {
            const templateId = item.trim()
            return {
              piece_id: `template:${templateId}:index:${index}`,
              template_id: templateId,
              index,
            }
          }
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>
            const templateId = typeof record.template_id === 'string'
              ? record.template_id.trim()
              : typeof record.templateId === 'string'
                ? record.templateId.trim()
                : ''
            if (!templateId) return null
            const pieceId = typeof record.piece_id === 'string' && record.piece_id.trim()
              ? record.piece_id.trim()
              : typeof record.pieceId === 'string' && record.pieceId.trim()
                ? record.pieceId.trim()
                : `template:${templateId}:index:${index}`
            return {
              piece_id: `${pieceId}:index:${index}`,
              template_id: templateId,
              model_id: typeof record.model_id === 'string'
                ? record.model_id
                : typeof record.modelo_id === 'string'
                  ? record.modelo_id
                  : null,
              model_name: typeof record.model_name === 'string' ? record.model_name : null,
              use_id: typeof record.use_id === 'string'
                ? record.use_id
                : typeof record.uso_id === 'string'
                  ? record.uso_id
                  : null,
              use_label: typeof record.use_label === 'string' ? record.use_label : null,
              template_nome: typeof record.template_nome === 'string' ? record.template_nome : null,
              credit_cost: toPositiveInteger(record.credit_cost),
              label: typeof record.label === 'string' ? record.label : null,
              index,
            }
          }
          return null
        }).filter((item): item is SelectedTemplatePiece => Boolean(item?.template_id))
      : []

    console.log(`[${reqId}] gerar-banners | campaign=${hasCampaignId ? 'informada' : '(sem id)'} | fotos=${fotosArr.length} | selectedPieces=${selectedPiecesRaw.length}`)

    // Buscar dados da campanha (opcional â€” se foi passado um campaign_id, enriquecemos)
    let campaignRow: { titulo?: string; dados_imovel?: Record<string, unknown>; textos_gerados?: Record<string, unknown>; user_id?: string } | null = null
    if (hasCampaignId) {
      const { data } = await supabase
        .from('campaigns')
        .select('id, titulo, dados_imovel, textos_gerados, user_id')
        .eq('id', campaign_id)
        .maybeSingle()
      campaignRow = data as typeof campaignRow

      // Ownership: campanha tem que pertencer ao usuario autenticado
      if (campaignRow && campaignRow.user_id && campaignRow.user_id !== authenticatedUserId) {
        console.warn(`[${reqId}] usuario ${authenticatedUserId} tentou acessar campanha ${campaign_id} de outro usuario`)
        return jsonResponse({ error: 'Campanha nao pertence ao usuario autenticado' }, 403)
      }
    }

    // user_id agora SEMPRE vem do JWT â€” body.user_id e campaignRow.user_id sao ignorados como fontes
    const profileId: string = authenticatedUserId

    type ProfileRow = {
      nome?: string
      email?: string
      creci?: string
      telefone?: string
      whatsapp?: string
      imobiliaria?: string
      site?: string
      instagram?: string
      avatar_url?: string
      logo_url?: string
      plano?: string
    }
    let profileRow: ProfileRow | null = null
    if (profileId) {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('nome, email, creci, telefone, whatsapp, imobiliaria, site, instagram, avatar_url, logo_url, plano')
        .eq('id', profileId)
        .maybeSingle()
      if (profileErr) console.warn(`[${reqId}] profile fetch erro:`, profileErr.message)
      profileRow = (data as ProfileRow) || null
    }

    const dadosImovel = (campaignRow?.dados_imovel as Record<string, unknown>) || {}
    const categoria = String(dadosImovel.categoria || tipo_imovel || 'medio_padrao')
    const precoFinal = formatPriceBRL(preco ?? dadosImovel.preco)
    const suitesCount = toPositiveCount(suites ?? dadosImovel.suites)
    const suitesLabel = formatCountLabel(suitesCount, 'SuÃ­te')
    const quartosLabel = formatCountLabel(toPositiveCount(quartos ?? dadosImovel.quartos), 'DormitÃ³rio')
    const vagasLabel = formatCountLabel(toPositiveCount(vagas ?? dadosImovel.vagas), 'Vaga')
    const areaLabel = String(area ?? dadosImovel.area ?? '').trim()
      ? `${String(area ?? dadosImovel.area).trim()}mÂ²`
      : ''
    const specsComerciais = [quartosLabel, suitesLabel, vagasLabel, areaLabel].filter(Boolean).join(', ')

    // Merge: profile do banco tem prioridade sobre payload (fonte de verdade)
    const corretorNomeFinal  = profileRow?.nome        || (typeof corretor_nome === 'string' ? corretor_nome : '') || ''
    const corretorEmail      = profileRow?.email       || ''
    const corretorCRECI      = profileRow?.creci       || ''
    const corretorTelefone   = profileRow?.telefone    || String(dadosImovel.telefone_contato || '')
    const corretorWhatsApp   = profileRow?.whatsapp    || corretorTelefone
    const marcaFinal         = profileRow?.imobiliaria || (typeof marca_imovel === 'string' ? marca_imovel : '') || ''
    const siteFinal          = profileRow?.site        || ''
    const instagramFinal     = profileRow?.instagram   || ''
    const logoUrl            = profileRow?.logo_url    || ''

    // Avatar do corretor:
    // - Se o profile do banco tem avatar_url, Ã© a fonte de verdade.
    // - Se o profile NÃƒO tem, mas o payload mandou 'REMOVER_ELEMENTO' explÃ­cito,
    //   honra isso (frontend jÃ¡ validou que nÃ£o hÃ¡ foto cadastrada).
    // - Caso contrÃ¡rio, segue REMOVER_ELEMENTO padrÃ£o (string vazia abaixo vira REMOVER_ELEMENTO no prompt).
    const avatarFromPayload = typeof corretor_avatar_url === 'string' ? corretor_avatar_url : ''
    const avatarUrl =
      profileRow?.avatar_url
        ? profileRow.avatar_url
        : (avatarFromPayload && avatarFromPayload !== 'REMOVER_ELEMENTO' ? avatarFromPayload : '')

    const templateData = buildCanonicalTemplateData({
      categoria,
      dadosImovel,
      titulo: titulo || campaignRow?.titulo || '',
      descricao,
      preco: preco ?? dadosImovel.preco,
      finalidade: finalidade ?? dadosImovel.finalidade,
      tipoImovel: tipo_imovel || dadosImovel.tipo,
      endereco,
      fotosArr,
      quartosLabel,
      suitesLabel,
      vagasLabel,
      areaLabel,
      corretorWhatsApp,
      corretorTelefone,
      corretorEmail,
    })

    // Bloco compartilhado com os dois prompts
    const dadosImovelBloco = `DADOS DO IMÃ“VEL:
- TÃ­tulo: ${titulo || campaignRow?.titulo || 'ImÃ³vel'}
- Categoria/Perfil: ${categoria}
- Tipo de imÃ³vel: ${tipo_imovel || dadosImovel.tipo || 'nÃ£o informado'}
- DescriÃ§Ã£o: ${descricao || ''}
- PreÃ§o: ${precoFinal}
- EspecificaÃ§Ãµes principais: ${specsComerciais || 'nÃ£o informado'}
- EndereÃ§o: ${endereco || `${dadosImovel.bairro || ''}${dadosImovel.cidade ? ', ' + dadosImovel.cidade : ''}${dadosImovel.estado ? ' - ' + dadosImovel.estado : ''}`}
- Fotos do imÃ³vel (${fotosArr.length}): ${JSON.stringify(fotosArr)}

TEMPLATE_DATA_CANONICO (prioridade para nomes exatos de elementos):
${Object.entries(templateData).map(([key, value]) => `- ${key}: ${value || 'REMOVER_ELEMENTO'}`).join('\n')}

DADOS DO CORRETOR (use exatamente esses; NÃƒO invente nem use nomes/emails/telefones fictÃ­cios em inglÃªs):
- Nome: ${corretorNomeFinal || '(nÃ£o informado)'}
- CRECI: ${corretorCRECI || 'REMOVER_ELEMENTO'}
- Telefone: ${corretorTelefone || '(nÃ£o informado)'}
- WhatsApp: ${corretorWhatsApp || 'REMOVER_ELEMENTO'}
- Email: ${corretorEmail || 'REMOVER_ELEMENTO'}
- ImobiliÃ¡ria/Marca: ${marcaFinal || 'REMOVER_ELEMENTO'}
- Site: ${siteFinal || 'REMOVER_ELEMENTO'}
- Instagram: ${instagramFinal || 'REMOVER_ELEMENTO'}
- Foto do corretor: ${avatarUrl || 'REMOVER_ELEMENTO'}
- Logo da imobiliÃ¡ria: ${logoUrl || 'REMOVER_ELEMENTO'}`

    // === ESTÃGIO 1: seleÃ§Ã£o de templates ==================================
    // ESTRITAMENTE os IDs marcados pelo corretor (frontend â†’ selectedTemplates).
    // SEM fallback de IA, SEM cap. Lista vazia => 400.
    const validIds = new Map(TEMPLATES.map((t) => [t.id, t]))

    // SEM fallback de IA. SEM cap. A lista marcada pelo corretor Ã© a fonte
    // Ãºnica de verdade. Se o frontend nÃ£o enviar selectedTemplates (ou
    // enviar lista vazia / sÃ³ IDs invÃ¡lidos), retornamos erro â€” NUNCA o
    // backend escolhe sozinho.
    if (selectedPiecesRaw.length === 0) {
      return jsonResponse({
        error: 'selectedTemplates Ã© obrigatÃ³rio. O backend nÃ£o escolhe templates autonomamente: envie a lista completa marcada pelo corretor.',
      }, 400)
    }

    const pickedPieces = selectedPiecesRaw.filter((piece) => validIds.has(piece.template_id))
    const invalidos = selectedPiecesRaw.filter((piece) => !validIds.has(piece.template_id))
    if (invalidos.length > 0) {
      console.warn(`[${reqId}] selectedTemplates contem IDs invalidos (ignorados):`, invalidos.map(piece => piece.template_id))
    }
    if (pickedPieces.length === 0) {
      return jsonResponse({
        error: 'Nenhum template vÃ¡lido em selectedTemplates',
        invalid_ids: invalidos.map(piece => piece.template_id),
      }, 400)
    }
    if (pickedPieces.length > MAX_VISUAL_PIECES_PER_GENERATION) {
      return jsonResponse({
        error: `Para garantir a geraÃ§Ã£o correta, selecione atÃ© ${MAX_VISUAL_PIECES_PER_GENERATION} peÃ§as por vez neste momento.`,
        max_pieces: MAX_VISUAL_PIECES_PER_GENERATION,
        received_pieces: pickedPieces.length,
      }, 413)
    }
    const pickedIds = pickedPieces.map(piece => piece.template_id)
    const uniquePickedIds = Array.from(new Set(pickedIds))
    console.log(`[${reqId}] estagio 1 (user-only, sem cap): ${pickedPieces.length} pecas em lote | ${uniquePickedIds.length} templates tecnicos`)

    // === ESTÃGIO 2: GET de cada template para descobrir elementos reais ===
    const frontendCreditCost = toPositiveInteger(credit_cost)
    const serverTemplateCreditCost = pickedPieces.reduce(
      (sum, piece) => sum + (piece.credit_cost || TEMPLATE_CREDIT_WEIGHTS.get(piece.template_id) || 0),
      0,
    )
    const generationMode = typeof generation_mode === 'string' && generation_mode.trim()
      ? generation_mode.trim()
      : 'manual'
    const videoIaPremium = video_ia_premium === true
    const isUnlimitedTestAdmin = (profileRow?.email || '').toLowerCase() === 'riccieri68@gmail.com'
    const isStarterPlan = !profileRow?.plano || profileRow.plano === 'starter'
    const isDemoCreditFlow = isStarterPlan && generationMode === 'demonstrativo'
    const isSmartCampaignCreditFlow = generationMode === 'smart_campaign'

    if (!isUnlimitedTestAdmin && isStarterPlan && generationMode !== 'demonstrativo') {
      return jsonResponse({
        error: 'Plano demonstrativo permite apenas a campanha demonstrativa gratuita.',
      }, 403)
    }

    if (!isUnlimitedTestAdmin && isDemoCreditFlow) {
      const invalidDemoTemplates = pickedIds.filter((id) => !DEMO_TEMPLATE_IDS.has(id))
      const hasExactDemoSet =
        pickedIds.length === DEMO_TEMPLATE_IDS.size
        && pickedIds.every((id) => DEMO_TEMPLATE_IDS.has(id))

      if (invalidDemoTemplates.length > 0 || !hasExactDemoSet) {
        return jsonResponse({
          error: 'Campanha demonstrativa permite apenas os formatos gratuitos fixos.',
        }, 403)
      }
    }

    if (!isUnlimitedTestAdmin && !isDemoCreditFlow && isSmartCampaignCreditFlow) {
      const hasExactSmartCampaignSet =
        pickedIds.length === SMART_CAMPAIGN_BASE_TEMPLATE_IDS.size
        && pickedIds.every((id) => SMART_CAMPAIGN_BASE_TEMPLATE_IDS.has(id))

      if (!hasExactSmartCampaignSet) {
        return jsonResponse({
          error: 'Campanha Inteligente exige a seleÃ§Ã£o-base oficial de produtos.',
        }, 400)
      }
    }

    const effectiveCreditCost = isUnlimitedTestAdmin || isDemoCreditFlow
      ? 0
      : isSmartCampaignCreditFlow
        ? SMART_CAMPAIGN_FIXED_CREDIT_COST
        : Math.max(frontendCreditCost, serverTemplateCreditCost)
    const idempotencyKey = typeof idempotency_key === 'string' ? idempotency_key.trim() : ''
    const creditMetadata = {
      campaign_id: hasCampaignId ? campaign_id : null,
      generation_mode: generationMode,
      selectedTemplates: pickedIds,
      selectedPieces: pickedPieces.map(piece => ({
        piece_id: piece.piece_id,
        template_id: piece.template_id,
        model_id: piece.model_id || null,
        use_id: piece.use_id || null,
        use_label: piece.use_label || null,
        credit_cost: piece.credit_cost || null,
        label: piece.label || null,
      })),
      video_ia_premium: videoIaPremium,
      credit_cost_frontend: frontendCreditCost,
      credit_cost_server: serverTemplateCreditCost,
      credit_cost_effective: effectiveCreditCost,
      req_id: reqId,
    }

    if (effectiveCreditCost > 0 && !idempotencyKey) {
      return jsonResponse({ error: 'idempotency_key obrigatoria para consumo de creditos.' }, 400)
    }

    const makeFailedPieceRender = (piece: SelectedTemplatePiece, index: number, erro: string) => {
      const meta = validIds.get(piece.template_id)
      const amount = TEMPLATE_CREDIT_WEIGHTS.get(piece.template_id) || 0
      return {
        piece_id: piece.piece_id,
        piece_index: index,
        model_id: piece.model_id || null,
        model_name: piece.model_name || null,
        use_id: piece.use_id || null,
        use_label: piece.use_label || null,
        label: piece.label || [piece.model_name, piece.use_label].filter(Boolean).join(' â€” ') || null,
        template_id: piece.template_id,
        template_nome: piece.template_nome || meta?.nome || '',
        categoria: meta?.categoria || null,
        formato: meta?.formato || null,
        status: 'failed',
        erro,
        credit_amount: effectiveCreditCost > 0 ? (piece.credit_cost || amount) : 0,
        credit_idempotency_key: null,
        credit_status: effectiveCreditCost > 0 && amount > 0 ? 'cancelled' : 'not_required',
      }
    }
    const failedBeforeRender: Array<Record<string, unknown>> = []

    const schemas = await Promise.all(uniquePickedIds.map((id) => fetchTemplateElements(reqId, id)))
    const schemasComElementos = schemas.filter((s) => s.elements.length > 0)
    if (schemasComElementos.length === 0) {
      const renders = pickedPieces.map((piece, index) => makeFailedPieceRender(piece, index, 'Nao foi possivel obter elementos reais do template.'))
      return jsonResponse({
        success: true,
        warning: 'Nenhuma peca visual foi criada. As pecas foram marcadas como falha.',
        renders,
        pick_source: 'user',
        credit_cost: effectiveCreditCost,
        credit_reservation_status: 'cancelled',
      }, 200)
    }

    console.log(`[${reqId}] estÃ¡gio 2: ${schemasComElementos.length} templates com elementos reais`)

    // === ESTÃGIO 3: IA produz modifications usando elementos REAIS ========
    const elementosBloco = schemasComElementos.map((s) => {
      const meta = validIds.get(s.id)
      const lista = s.elements
        .map((e) => `  - "${e.virtualLabel || e.name}" (${e.type})${e.defaultValue ? ` [default: ${JSON.stringify(e.defaultValue.slice(0, 80))}]` : ''}`)
        .join('\n')
      return `TEMPLATE id="${s.id}" nome="${s.name || meta?.nome || ''}" formato="${meta?.formato || ''}"
Elementos reais:
${lista}`
    }).join('\n\n')

    const fillUserPrompt = `${dadosImovelBloco}

TEMPLATES SELECIONADOS COM ELEMENTOS REAIS:
${elementosBloco}

Para cada template, gere um objeto "modifications" usando APENAS os nomes de elementos listados acima.`

    const fillTemplateDebug = schemasComElementos.map((s) => ({
      template_id: s.id,
      template_nome: s.name || validIds.get(s.id)?.nome || '',
      elementos: s.elements.length,
    }))
    console.log(`[${reqId}] fill debug templates:`, fillTemplateDebug)
    console.log(`[${reqId}] fill debug prompt_chars:`, {
      system: FILL_SYSTEM_PROMPT.length,
      user: fillUserPrompt.length,
      total: FILL_SYSTEM_PROMPT.length + fillUserPrompt.length,
    })

    let fillRes: Response
    try {
      fillRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: FILL_SYSTEM_PROMPT },
            { role: 'user', content: fillUserPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 7000,
        }),
        signal: AbortSignal.timeout(60000),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[${reqId}] fill OpenAI indisponível:`, message)
      const renders = pickedPieces.map((piece, index) => makeFailedPieceRender(
        piece,
        index,
        'Não foi possível preparar esta peça visual no momento.',
      ))
      return jsonResponse({
        success: true,
        warning: 'As peças visuais falharam antes da criação do render.',
        renders,
        pick_source: 'user',
        credit_cost: effectiveCreditCost,
        credit_reservation_status: 'cancelled',
        requested_count: pickedPieces.length,
        success_count: 0,
        failed_count: renders.length,
      }, 200)
    }

    if (!fillRes.ok) {
      const errBody = await fillRes.text()
      console.error(`[${reqId}] fill OpenAI ${fillRes.status}:`, errBody.slice(0, 300))
      const renders = pickedPieces.map((piece, index) => makeFailedPieceRender(piece, index, `OpenAI fill ${fillRes.status}: ${errBody.slice(0, 180)}`))
      return jsonResponse({
        success: true,
        warning: 'As pecas visuais falharam antes da criacao do render.',
        renders,
        pick_source: 'user',
        credit_cost: effectiveCreditCost,
        credit_reservation_status: 'cancelled',
      }, 200)
    }

    let plano: { selecoes?: Array<{ template_id: string; modifications?: Record<string, unknown> }> }
    let fillRaw = ''
    try {
      const fillData = await fillRes.json()
      const choice = fillData?.choices?.[0]
      fillRaw = typeof choice?.message?.content === 'string' ? choice.message.content : ''
      console.log(`[${reqId}] fill debug response:`, {
        finish_reason: choice?.finish_reason,
        raw_chars: fillRaw.length,
        raw_start: fillRaw.slice(0, 500),
        raw_end: fillRaw.slice(-500),
      })
      plano = JSON.parse(fillRaw)
    } catch (e) {
      console.error(`[${reqId}] fill parse:`, {
        erro: e instanceof Error ? e.message : String(e),
        templates: fillTemplateDebug,
        raw_chars: fillRaw.length,
        raw_start: fillRaw.slice(0, 1000),
        raw_end: fillRaw.slice(-1000),
      })
      const fallbackSelecoes: Array<{ template_id: string; modifications?: Record<string, unknown> }> = []
      for (let index = 0; index < pickedPieces.length; index++) {
        const piece = pickedPieces[index]
        const schema = schemasComElementos.find((item) => item.id === piece.template_id)
        if (!schema) {
          failedBeforeRender.push(makeFailedPieceRender(piece, index, 'Template sem elementos reais para fill individual.'))
          continue
        }
        try {
          const meta = validIds.get(schema.id)
          const lista = schema.elements
            .map((el) => `  - "${el.virtualLabel || el.name}" (${el.type})${el.defaultValue ? ` [default: ${JSON.stringify(el.defaultValue.slice(0, 80))}]` : ''}`)
            .join('\n')
          const singlePrompt = `${dadosImovelBloco}

TEMPLATE SELECIONADO COM ELEMENTOS REAIS:
TEMPLATE id="${schema.id}" nome="${schema.name || meta?.nome || ''}" formato="${meta?.formato || ''}"
Elementos reais:
${lista}

Gere um objeto "modifications" usando APENAS os nomes de elementos listados acima.`
          const singleRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: FILL_SYSTEM_PROMPT },
                { role: 'user', content: singlePrompt },
              ],
              response_format: { type: 'json_object' },
              max_tokens: 2500,
            }),
            signal: AbortSignal.timeout(45000),
          })
          if (!singleRes.ok) {
            const body = await singleRes.text()
            failedBeforeRender.push(makeFailedPieceRender(piece, index, `OpenAI fill individual ${singleRes.status}: ${body.slice(0, 180)}`))
            continue
          }
          const singleData = await singleRes.json()
          const raw = typeof singleData?.choices?.[0]?.message?.content === 'string'
            ? singleData.choices[0].message.content
            : ''
          const parsed = JSON.parse(raw)
          const selection = Array.isArray(parsed?.selecoes)
            ? parsed.selecoes.find((item: { template_id?: string }) => item?.template_id === piece.template_id)
            : null
          if (!selection?.modifications || typeof selection.modifications !== 'object') {
            failedBeforeRender.push(makeFailedPieceRender(piece, index, 'OpenAI fill individual nao retornou modifications para esta peca.'))
            continue
          }
          fallbackSelecoes.push({ template_id: piece.template_id, modifications: selection.modifications })
        } catch (fallbackError) {
          failedBeforeRender.push(makeFailedPieceRender(
            piece,
            index,
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          ))
        }
      }
      if (fallbackSelecoes.length === 0) {
        return jsonResponse({
          success: true,
          warning: 'As pecas visuais falharam antes da criacao do render.',
          renders: failedBeforeRender,
          pick_source: 'user',
          credit_cost: effectiveCreditCost,
          credit_reservation_status: 'cancelled',
        }, 200)
      }
      plano = { selecoes: fallbackSelecoes }
    }

    const aprovadas = (Array.isArray(plano.selecoes) ? plano.selecoes : [])
      .filter((s) => s.template_id && validIds.has(s.template_id))

    if (aprovadas.length === 0) {
      const renders = pickedPieces.map((piece, index) => makeFailedPieceRender(piece, index, 'IA (fill) nao produziu modifications para nenhum template.'))
      return jsonResponse({
        success: true,
        warning: 'As pecas visuais falharam antes da criacao do render.',
        renders,
        pick_source: 'user',
        credit_cost: effectiveCreditCost,
        credit_reservation_status: 'cancelled',
      }, 200)
    }

    // Validar/filtrar as modifications para conter SOMENTE chaves de elementos reais.
    // Indexamos por virtualLabel (o rÃ³tulo que a IA viu), nÃ£o por name â€” assim slots
    // duplicados (Photo, Photo-2, ...) sÃ£o endereÃ§Ã¡veis individualmente.
    const elementosPorTemplate = new Map<string, Map<string, ElementInfo>>()
    for (const s of schemasComElementos) {
      const m = new Map<string, ElementInfo>()
      for (const e of s.elements) m.set(e.virtualLabel || e.name, e)
      elementosPorTemplate.set(s.id, m)
    }

    const canonicalByTemplate = new Map<string, ReturnType<typeof buildCanonicalModifications>>()
    for (const s of schemasComElementos) {
      const elementos = elementosPorTemplate.get(s.id)
      if (!elementos) continue
      const canonical = buildCanonicalModifications(elementos, templateData)
      canonicalByTemplate.set(s.id, canonical)
      console.log(`[${reqId}] contrato canonico`, {
        template_id: s.id,
        canonical_fields: publicCanonicalLog(templateData),
        sent_fields: canonical.sentFields,
        missing_or_incompatible_fields: canonical.missingFields,
      })
    }

    // Contexto compartilhado para o sanitizer (PT-BR + dados reais do imÃ³vel + do corretor)
    const sanitizeCtx: SanitizeContext = {
      preco: precoFinal,
      suites_label: suitesLabel,
      endereco: typeof endereco === 'string' && endereco.trim()
        ? endereco
        : [dadosImovel.bairro, dadosImovel.cidade, dadosImovel.estado].filter(Boolean).join(', '),
      bairro: String(dadosImovel.bairro || ''),
      cidade: String(dadosImovel.cidade || ''),
      estado: String(dadosImovel.estado || ''),
      corretor_nome: corretorNomeFinal,
      corretor_email: corretorEmail,
      corretor_creci: corretorCRECI,
      marca_imovel: marcaFinal,
      telefone_contato: corretorTelefone,
      whatsapp: corretorWhatsApp,
      site: siteFinal,
      instagram: instagramFinal,
      titulo: typeof titulo === 'string' && titulo
        ? titulo
        : (campaignRow?.titulo || ''),
    }

    const aprovadasLimpas = aprovadas.map((sel) => {
      const elementos = elementosPorTemplate.get(sel.template_id)
      const canonical = canonicalByTemplate.get(sel.template_id)
      const mods: Record<string, unknown> = canonical ? { ...canonical.modifications } : {}
      const fallbackFields = new Set<string>()
      if (elementos && sel.modifications && typeof sel.modifications === 'object') {
        for (const [k, v] of Object.entries(sel.modifications)) {
          // Chave da IA: "<rÃ³tulo>.text|source|track", onde <rÃ³tulo> Ã© o virtualLabel
          // que a IA viu (ex.: "Photo", "Photo-2"). A chave final enviada ao Creatomate
          // usa o ID do elemento quando disponÃ­vel, evitando ambiguidade entre slots
          // de mesmo nome.
          const dot = k.lastIndexOf('.')
          if (dot < 0) continue
          const label = k.slice(0, dot)
          const prop = k.slice(dot + 1)
          if (getCanonicalFieldName(label)) continue
          const elem = elementos.get(label)
          if (!elem) continue

          const keyBase = elem.id || elem.name
          const finalKey = `${keyBase}.${prop}`
          fallbackFields.add(label)

          // .track: booleano, vÃ¡lido para qualquer tipo de elemento.
          // Usado pela IA para "desativar" elementos quando o dado real nÃ£o
          // existe (instruÃ§Ã£o REMOVER_ELEMENTO no prompt).
          if (prop === 'track') {
            if (typeof v === 'boolean') {
              mods[finalKey] = v
            }
            continue
          }

          // .text sÃ³ em elementos type=text; .source em image/video/audio.
          const expectedProp = elem.type === 'text' ? 'text' : 'source'
          if (prop !== expectedProp) continue
          if (prop === 'text' && isPriceElement(elem.name)) {
            mods[finalKey] = sanitizeCtx.preco || 'Consulte'
            continue
          }
          if (prop === 'text' && suitesLabel && isBathroomElement(elem.name)) {
            mods[finalKey] = suitesLabel
            continue
          }
          if (typeof v !== 'string') continue

          // String vazia EXPLÃCITA: passa direto. Ã‰ a outra metade da
          // remoÃ§Ã£o â€” apaga o texto/source default do template. Costuma
          // vir junto com .track: false.
          if (v === '') {
            mods[finalKey] = ''
            continue
          }

          // Apenas whitespace: descarta (nÃ£o Ã© remoÃ§Ã£o intencional, Ã© lixo).
          if (!v.trim()) continue

          if (prop === 'text') {
            // CAMADA 1 â€” dicionÃ¡rio ENâ†’PT: substitui frases fixas conhecidas
            // ("For Sale", "Bedrooms", "MY BRAND", etc.) antes de qualquer
            // outra etapa. Garante que placeholders americanos virem PT-BR
            // (ou vazio) mesmo se a IA nÃ£o tenha traduzido.
            const traduzido = translateFixedEnglish(v)
            // CAMADA 2 â€” sanitizer (cidades em inglÃªs, placeholders de email,
            // domÃ­nios fictÃ­cios, nÃºmeros US-style, detecÃ§Ã£o de idioma).
            const limpo = sanitizeTemplateText(traduzido, sanitizeCtx)
            if (!limpo) continue
            // CTA: forÃ§a estritamente uma das variaÃ§Ãµes profissionais aprovadas,
            // independente do que a IA tenha gerado.
            mods[finalKey] = isCtaElement(elem.name) ? snapCta(limpo) : limpo
          } else {
            mods[finalKey] = v
          }
        }
      }
      console.log(`[${reqId}] campos enviados ao Creatomate`, {
        template_id: sel.template_id,
        canonical_fields_sent: canonical?.sentFields || [],
        fallback_fields: Array.from(fallbackFields),
        modification_keys: Object.keys(mods),
      })
      return { template_id: sel.template_id, modifications: mods }
    }).filter((s) => Object.keys(s.modifications).length > 0)

    const modificationsByTemplate = new Map(aprovadasLimpas.map((sel) => [sel.template_id, sel.modifications]))
    const pecasAprovadas = pickedPieces.map((piece, index) => {
      const modifications = modificationsByTemplate.get(piece.template_id)
      if (!modifications || Object.keys(modifications).length === 0) {
        failedBeforeRender.push(makeFailedPieceRender(piece, index, 'Nenhuma modification valida sobrou para esta peca.'))
        return null
      }
      return {
        ...piece,
        modifications: { ...modifications },
      }
    }).filter((piece): piece is SelectedTemplatePiece & { modifications: Record<string, unknown> } => Boolean(piece))

    if (pecasAprovadas.length === 0) {
      return jsonResponse({
        success: true,
        warning: 'Nenhuma peca visual foi criada. As pecas foram marcadas como falha.',
        renders: failedBeforeRender,
        pick_source: 'user',
        credit_cost: effectiveCreditCost,
        credit_reservation_status: 'cancelled',
      }, 200)
    }

    // === Rede de seguranÃ§a: garante que TODOS os slots de imagem do imÃ³vel
    // de cada template estejam preenchidos. A primeira foto (foto principal)
    // ocupa o primeiro slot; as demais ocupam, em ordem, os slots seguintes;
    // se houver mais slots que fotos, a Ãºltima foto se repete. Slots jÃ¡
    // preenchidos pela IA com uma URL http(s) vÃ¡lida sÃ£o preservados. Slots
    // marcados com .track: false pela IA sÃ£o respeitados (nÃ£o preenche).
    if (fotosArr.length > 0) {
      const elementosArrPorTemplate = new Map<string, ElementInfo[]>()
      for (const s of schemasComElementos) elementosArrPorTemplate.set(s.id, s.elements)
      for (const sel of pecasAprovadas) {
        const els = elementosArrPorTemplate.get(sel.template_id) || []
        const propertySlots = els.filter(
          (e) => (e.type === 'image' || e.type === 'video') && isPropertyPhotoSlot(e.name)
        )
        let fotoIdx = 0
        for (const slot of propertySlots) {
          const keyBase = slot.id || slot.name
          const sourceKey = `${keyBase}.source`
          const trackKey = `${keyBase}.track`
          if (sel.modifications[trackKey] === false) continue
          const existing = sel.modifications[sourceKey]
          if (typeof existing === 'string' && /^https?:\/\//i.test(existing.trim())) {
            fotoIdx++
            continue
          }
          sel.modifications[sourceKey] = fotosArr[Math.min(fotoIdx, fotosArr.length - 1)]
          fotoIdx++
        }
      }
    }

    console.log(`[${reqId}] estagio 3: ${pecasAprovadas.length} pecas prontas para render | ${failedBeforeRender.length} falhas antes do render`)

    const blockedPieceIds = new Set<string>()

    if (effectiveCreditCost > 0) {
      for (let index = 0; index < pecasAprovadas.length; index++) {
        const sel = pecasAprovadas[index]
        const amount = sel.credit_cost || TEMPLATE_CREDIT_WEIGHTS.get(sel.template_id) || 0
        if (amount <= 0) continue

        const pieceKey = `${idempotencyKey}:piece:${sel.piece_id}:index:${index}`
        const pieceMetadata = {
          ...creditMetadata,
          piece_id: sel.piece_id,
          model_id: sel.model_id || null,
          model_name: sel.model_name || null,
          use_id: sel.use_id || null,
          use_label: sel.use_label || null,
          template_id: sel.template_id,
          template_index: index,
          credit_amount: amount,
          piece_idempotency_key: pieceKey,
          credit_scope: 'visual_piece',
        }

        const { data: reservationRows, error: reservationErr } = await supabase.rpc('reserve_credits', {
          p_user_id: authenticatedUserId,
          p_amount: amount,
          p_idempotency_key: pieceKey,
          p_campaign_id: hasCampaignId ? campaign_id : null,
          p_reason: 'gerar-banners-piece',
          p_metadata: pieceMetadata,
        })

        if (reservationErr) {
          const message = reservationErr.message || 'Falha ao reservar creditos.'
          console.warn(`[${reqId}] reserva de creditos da peça falhou:`, message)
          blockedPieceIds.add(sel.piece_id)
          failedBeforeRender.push({
            ...makeFailedPieceRender(
              sel,
              index,
              message.toLowerCase().includes('insuficient')
                ? 'Créditos insuficientes para esta peça.'
                : 'Não foi possível reservar créditos para esta peça.',
            ),
            credit_status: 'cancelled',
          })
          continue
        }

        const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows
        if (reservation?.status === 'cancelled') {
          blockedPieceIds.add(sel.piece_id)
          failedBeforeRender.push({
            ...makeFailedPieceRender(sel, index, 'Reserva de créditos cancelada para esta peça.'),
            credit_status: 'cancelled',
          })
          continue
        }

        pieceCreditReservations.push({
          templateId: sel.template_id,
          pieceId: sel.piece_id,
          modelId: sel.model_id || null,
          useId: sel.use_id || null,
          useLabel: sel.use_label || null,
          index,
          amount,
          idempotencyKey: pieceKey,
          status: String(reservation?.status || 'reserved'),
        })
      }

      console.log(`[${reqId}] creditos reservados por peÃ§a: ${pieceCreditReservations.length} reservas`)
    }

    const getPieceCredit = (piece: SelectedTemplatePiece) => {
      const reservation = pieceCreditReservations.find(item => item.pieceId === piece.piece_id)
      const amount = piece.credit_cost || TEMPLATE_CREDIT_WEIGHTS.get(piece.template_id) || 0
      return {
        credit_amount: reservation?.amount ?? (effectiveCreditCost > 0 ? amount : 0),
        credit_idempotency_key: reservation?.idempotencyKey || null,
        credit_status: reservation?.status || (amount > 0 && effectiveCreditCost > 0 ? 'not_reserved' : 'not_required'),
      }
    }

    // === Disparar renders no Creatomate (paralelo) ========================
    const renders: Array<Record<string, unknown>> = [...failedBeforeRender]

    const pecasParaRender = pecasAprovadas.filter((sel) => !blockedPieceIds.has(sel.piece_id))

    await Promise.all(pecasParaRender.map(async (sel, index) => {
      const meta = validIds.get(sel.template_id)!
      const pieceCredit = getPieceCredit(sel)
      try {
        const createRes = await fetch('https://api.creatomate.com/v1/renders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CREATOMATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: sel.template_id,
            modifications: sel.modifications,
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (!createRes.ok) {
          const errBody = await createRes.text()
          console.error(`[${reqId}] Creatomate render ${createRes.status} em ${meta.nome}:`, errBody.slice(0, 200))
          const reservation = pieceCreditReservations.find(item => item.pieceId === sel.piece_id)
          if (reservation?.status === 'reserved') {
            await cancelPieceReservations(supabase, reqId, authenticatedUserId, [reservation], 'creatomate_create_failed')
          }
          renders.push({
            piece_id: sel.piece_id,
            piece_index: index,
            model_id: sel.model_id || null,
            model_name: sel.model_name || null,
            use_id: sel.use_id || null,
            use_label: sel.use_label || null,
            label: sel.label || [sel.model_name, sel.use_label].filter(Boolean).join(' â€” ') || null,
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            formato: meta.formato,
            status: 'failed',
            erro: `Creatomate ${createRes.status}: ${errBody.slice(0, 200)}`,
            ...pieceCredit,
            credit_status: reservation?.status || pieceCredit.credit_status,
          })
          return
        }

        const body = await createRes.json()
        const items = Array.isArray(body) ? body : [body]
        if (items.length === 0) {
          const reservation = pieceCreditReservations.find(item => item.pieceId === sel.piece_id)
          if (reservation?.status === 'reserved') {
            await cancelPieceReservations(supabase, reqId, authenticatedUserId, [reservation], 'creatomate_empty_response')
          }
          renders.push({
            piece_id: sel.piece_id,
            piece_index: index,
            model_id: sel.model_id || null,
            model_name: sel.model_name || null,
            use_id: sel.use_id || null,
            use_label: sel.use_label || null,
            label: sel.label || [sel.model_name, sel.use_label].filter(Boolean).join(' â€” ') || null,
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            formato: meta.formato,
            status: 'failed',
            erro: 'Creatomate retornou resposta vazia para esta peca.',
            ...pieceCredit,
            credit_status: reservation?.status || pieceCredit.credit_status,
          })
          return
        }
        for (const item of items) {
          if (!item?.id) {
            const reservation = pieceCreditReservations.find(item => item.pieceId === sel.piece_id)
            if (reservation?.status === 'reserved') {
              await cancelPieceReservations(supabase, reqId, authenticatedUserId, [reservation], 'creatomate_missing_render_id')
            }
            renders.push({
              piece_id: sel.piece_id,
              piece_index: index,
              model_id: sel.model_id || null,
              model_name: sel.model_name || null,
              use_id: sel.use_id || null,
              use_label: sel.use_label || null,
              label: sel.label || [sel.model_name, sel.use_label].filter(Boolean).join(' â€” ') || null,
              template_id: sel.template_id,
              template_nome: meta.nome,
              categoria: meta.categoria,
              formato: meta.formato,
              status: 'failed',
              erro: 'Creatomate nao retornou render_id para esta peca.',
              ...pieceCredit,
              credit_status: reservation?.status || pieceCredit.credit_status,
            })
            continue
          }
          renders.push({
            piece_id: sel.piece_id,
            piece_index: index,
            model_id: sel.model_id || null,
            model_name: sel.model_name || null,
            use_id: sel.use_id || null,
            use_label: sel.use_label || null,
            label: sel.label || [sel.model_name, sel.use_label].filter(Boolean).join(' â€” ') || null,
            render_id: item.id,
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            formato: meta.formato,
            status: item.status || 'planned',
            url: item.url || null,
            snapshot_url: item.snapshot_url || null,
            ...pieceCredit,
          })
        }
      } catch (err) {
        console.error(`[${reqId}] erro ao chamar Creatomate para ${meta.nome}:`, err)
        const reservation = pieceCreditReservations.find(item => item.pieceId === sel.piece_id)
        if (reservation?.status === 'reserved') {
          await cancelPieceReservations(supabase, reqId, authenticatedUserId, [reservation], 'creatomate_create_error')
        }
        renders.push({
          piece_id: sel.piece_id,
          piece_index: index,
          model_id: sel.model_id || null,
          model_name: sel.model_name || null,
          use_id: sel.use_id || null,
          use_label: sel.use_label || null,
          label: sel.label || [sel.model_name, sel.use_label].filter(Boolean).join(' â€” ') || null,
          template_id: sel.template_id,
          template_nome: meta.nome,
          categoria: meta.categoria,
          formato: meta.formato,
          status: 'failed',
          erro: err instanceof Error ? err.message : String(err),
          ...pieceCredit,
          credit_status: reservation?.status || pieceCredit.credit_status,
        })
      }
    }))

    const successfulRenderCount = renders.filter((render) => typeof render.render_id === 'string').length
    if (effectiveCreditCost > 0 && successfulRenderCount === 0) {
      await cancelPieceReservations(supabase, reqId, authenticatedUserId, pieceCreditReservations, 'nenhum_render_criado')
      return jsonResponse({
        success: true,
        warning: 'Nenhum render foi criado. As reservas de creditos foram canceladas.',
        renders,
        pick_source: 'user',
        credit_cost: effectiveCreditCost,
        credit_reservation_status: 'cancelled',
      }, 200)
    }

    // === Persistir em campaigns.banners (jsonb) â€” somente se campaign_id ==
    if (hasCampaignId) {
      const { error: updErr } = await supabase
        .from('campaigns')
        .update({ banners: renders })
        .eq('id', campaign_id)
        .eq('user_id', authenticatedUserId)

      if (updErr) {
        console.error(`[${reqId}] falha ao salvar banners:`, updErr)
        return jsonResponse({
          warning: `Renders disparados, mas nÃ£o foi possÃ­vel salvar em campaigns.banners: ${updErr.message}`,
          renders,
          pick_source: 'user',
          credit_cost: effectiveCreditCost,
          credit_reservation_status: effectiveCreditCost > 0 ? 'reserved_per_piece' : 'not_required',
        }, 200)
      }
    }

    console.log(`[${reqId}] OK | ${renders.length} renders disparados | pick=user`)
    return jsonResponse({
      success: true,
      renders,
      pick_source: 'user',
      credit_cost: effectiveCreditCost,
      credit_reservation_status: effectiveCreditCost > 0 ? 'reserved_per_piece' : 'not_required',
      requested_count: pickedPieces.length,
      success_count: renders.filter((render) => typeof render.render_id === 'string').length,
      failed_count: renders.filter((render) => String(render.status || '').toLowerCase() === 'failed').length,
    }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    if (pieceCreditReservations.length > 0 && supabaseClient && cleanupUserId) {
      await cancelPieceReservations(supabaseClient, reqId, cleanupUserId, pieceCreditReservations, 'erro_inesperado')
    }
    return jsonResponse({
      success: false,
      error: 'Não foi possível processar os materiais visuais agora.',
      renders: [],
    }, 200)
  }
})
