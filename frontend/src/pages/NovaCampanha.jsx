import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, MessageCircle, Copy, Download, CheckCircle2, Plus, Camera, X, Send, AlertCircle, Zap, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import MarketingObjectiveCatalog from '../components/MarketingObjectiveCatalog'
import { CAMPAIGN_MODES, CAMPAIGN_MODE_ORDER } from '../data/campaignModes'
import { CAMPAIGN_TEMPLATES } from '../data/campaignTemplates'
import { TEMPLATE_CATALOG, TEMPLATE_MODEL_CREDIT_WEIGHTS, TEMPLATE_MODEL_PREVIEWS } from '../data/templateCatalog'
import { MARKETING_OBJECTIVES, SMART_CAMPAIGN_OBJECTIVES, getSelectedTemplatesFromObjectiveIds } from '../data/marketingObjectives'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

// ═══════════════════════════════════════════════════════════════
//  DADOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════

const CATEGORIAS = [
  { id: 'alto_padrao',    nome: 'Alto Padrão',   icon: '💎', cor: 'from-amber-500 to-yellow-400',   ring: 'ring-amber-400',   badge: 'bg-amber-100 text-amber-800',   desc: 'Luxo e exclusividade' },
  { id: 'medio_padrao',   nome: 'Médio Padrão',  icon: '🏠', cor: 'from-blue-500 to-blue-400',      ring: 'ring-blue-400',    badge: 'bg-blue-100 text-blue-800',     desc: 'Custo-benefício' },
  { id: 'popular_mcmv',   nome: 'Popular/MCMV',  icon: '🤝', cor: 'from-green-500 to-emerald-400',  ring: 'ring-green-400',   badge: 'bg-green-100 text-green-800',   desc: 'Casa própria' },
  { id: 'lancamento',     nome: 'Lançamento',    icon: '🚀', cor: 'from-purple-500 to-violet-400',  ring: 'ring-purple-400',  badge: 'bg-purple-100 text-purple-800', desc: 'Na planta' },
  { id: 'em_construcao',  nome: 'Em Construção', icon: '🏗️', cor: 'from-orange-500 to-amber-400',  ring: 'ring-orange-400',  badge: 'bg-orange-100 text-orange-800', desc: 'Em obra' },
]

const TIPOS = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado', 'Terreno / Lote']

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const PRODUCT_CONTEXTS = {
  hero: {
    label: 'Hero IA',
    sourcePath: '/hero',
    headerTitle: 'Cadastro padrão do imóvel',
    headerSubtitle: 'O contexto do Hero IA será preservado neste fluxo.',
    propertyEyebrow: 'Hero IA',
    propertyTitle: 'Cadastro padrão do imóvel',
    propertySubtitle: 'Use os mesmos dados oficiais do SmartCorretorAI. Nenhum cadastro paralelo será criado.',
    uploadEyebrow: 'Upload do Hero IA',
    uploadTitle: 'Envie as fotos do imóvel',
    photosSubtitle: 'As fotos serão usadas como base visual do Hero IA.',
    uploadHelp: 'Fotos obrigatórias para gerar materiais Hero IA. Vídeo é opcional nesta etapa.',
    photoRequired: true,
    videoRequired: false,
    allowOptionalPhotos: true,
    allowVideo: true,
    reviewTitle: 'Revisão do Hero IA',
    reviewSubtitle: 'Confira o imóvel e as fotos antes da etapa de geração do Hero IA.',
    costTitle: 'Hero IA preparado',
    costSubtitle: 'O cadastro único foi preservado. A geração real do Hero IA será conectada na próxima fase.',
    nextLabel: 'Geração do Hero IA em preparação',
  },
  transformar_video: {
    label: 'Transformar Meu Vídeo',
    sourcePath: '/transformar-video',
    headerTitle: 'Cadastro padrão do imóvel',
    headerSubtitle: 'O contexto do Transformar Meu Vídeo será preservado neste fluxo.',
    propertyEyebrow: 'Transformar Meu Vídeo',
    propertyTitle: 'Cadastro padrão do imóvel',
    propertySubtitle: 'Use os mesmos dados oficiais do SmartCorretorAI. O vídeo será obrigatório apenas neste produto.',
    uploadEyebrow: 'Upload do Transformar Meu Vídeo',
    uploadTitle: 'Envie seu vídeo',
    photosSubtitle: 'Fotos podem apoiar o material. O envio de vídeo será obrigatório para este produto na etapa final.',
    uploadHelp: 'Vídeo obrigatório para Transformar Meu Vídeo. Fotos são opcionais como apoio visual.',
    photoRequired: false,
    videoRequired: true,
    allowOptionalPhotos: true,
    allowVideo: true,
    reviewTitle: 'Revisão do Transformar Meu Vídeo',
    reviewSubtitle: 'Confira o imóvel e os arquivos antes da etapa de transformação do vídeo.',
    costTitle: 'Transformar Meu Vídeo preparado',
    costSubtitle: 'O cadastro único foi preservado. A geração real de vídeo será conectada na próxima fase.',
    nextLabel: 'Geração do vídeo em preparação',
  },
  campanha_completa: {
    label: 'Gerar Campanha',
    headerTitle: 'Gerar Campanhas Profissionais',
    headerSubtitle: 'Escolha, informe os dados e gere tudo em um clique',
    propertyEyebrow: 'Dados do imóvel',
    propertyTitle: 'Informe o imóvel',
    propertySubtitle: 'Esses dados ajudam a IA a criar uma campanha mais útil e persuasiva.',
    uploadEyebrow: 'Fotos do imóvel',
    uploadTitle: 'Envie as fotos',
    photosSubtitle: 'As imagens ajudam a personalizar os materiais da campanha.',
    uploadHelp: 'Fotos obrigatórias para a Campanha Completa.',
    photoRequired: true,
    videoRequired: false,
    allowOptionalPhotos: true,
    allowVideo: false,
    reviewTitle: 'Análise Inteligente do Imóvel',
    reviewSubtitle: 'Esta leitura é visual e local nesta etapa, sem nova chamada de backend.',
    costTitle: 'Revise e gere em um clique',
    costSubtitle: 'O servidor continua validando o consumo real de créditos.',
  },
}

const SUBPRODUCT_LABELS = {
  hero_completo: 'Hero Completo',
  pecas_individuais: 'Peças Individuais',
  video_rapido: 'Vídeo Rápido',
  video_premium_cinematografico: 'Vídeo Premium/Cinematográfico',
  campanha_por_objetivo: 'Campanha por Objetivo',
  monte_sua_campanha: 'Monte Sua Campanha',
}

const MSGS_POR_CAT = {
  alto_padrao:   ['Analisando o perfil de luxo...', 'Criando texto sofisticado...', 'Elaborando roteiro cinematográfico...', 'Refinando detalhes exclusivos...'],
  medio_padrao:  ['Analisando os pontos fortes...', 'Criando texto para Instagram...', 'Preparando mensagem de WhatsApp...', 'Quase pronto...'],
  popular_mcmv:  ['Pensando no sonho da casa própria...', 'Criando texto acolhedor...', 'Destacando FGTS e financiamento...', 'Finalizando...'],
  lancamento:    ['Analisando o potencial do lançamento...', 'Criando texto de urgência...', 'Elaborando estratégia de pré-venda...', 'Quase lá...'],
  em_construcao: ['Analisando o progresso da obra...', 'Criando conteúdo transparente...', 'Mostrando valorização...', 'Finalizando...'],
}

const TEXT_FORMATS_FIXOS = [
  { nome: 'Instagram',           desc: 'Legenda para redes' },
  { nome: 'WhatsApp',            desc: 'Mensagem completa' },
  { nome: 'Facebook',            desc: 'Texto do post' },
  { nome: 'TikTok',              desc: 'Roteiro cena a cena' },
  { nome: 'LinkedIn',            desc: 'Texto profissional' },
  { nome: 'YouTube',             desc: 'Título + descrição' },
  { nome: 'Apresentação do imóvel', desc: 'Ficha completa para divulgação' },
  { nome: 'Roteiro de Locução',  desc: 'Script para narração' },
  { nome: 'Público Google Ads',  desc: 'Segmentação + palavras-chave' },
]

const TEMPLATE_CATALOG_BY_TEMPLATE_ID = Object.fromEntries(
  TEMPLATE_CATALOG.map(template => [template.templateId, template])
)

const ACTIVE_CAMPAIGN_TEMPLATE_IDS = new Set(TEMPLATE_CATALOG.map(template => template.templateId))
const HIDDEN_MARKETING_OBJECTIVE_IDS = new Set(['tiktok', 'galeria'])
const VISIBLE_MARKETING_OBJECTIVES = MARKETING_OBJECTIVES.filter(objective => !HIDDEN_MARKETING_OBJECTIVE_IDS.has(objective.id))

const TYPE_LABELS = {
  banner: 'Arte',
  card: 'Arte',
  detailed: 'Arte',
  carousel: 'Arte',
  story: 'Video',
  reels: 'Video',
  video: 'Video',
  social: 'Arte',
}

const FORMAT_LABELS = {
  square: '1:1',
  portrait: '4:5',
  vertical: '9:16',
  horizontal: '16:9',
  card: 'Card',
  detailed: 'Detalhado',
}

const SUGGESTED_CHANNEL_LABELS = {
  banner: 'Instagram Feed, Facebook e portais',
  story: 'Stories, Status e comunicações rápidas',
  reels: 'Instagram Reels, TikTok e Shorts',
  video: 'YouTube, WhatsApp, sites e apresentações',
  card: 'Portais, feed e envio direto',
  detailed: 'Portais e materiais de comparação',
  carousel: 'Instagram e Facebook',
  social: 'WhatsApp, feed e prova social',
}

const CAMPAIGN_USE_OPTIONS = {
  feed: { id: 'feed', icon: '📱', label: 'Feed / Redes Sociais' },
  vertical: { id: 'vertical', icon: '🎬', label: 'Stories / Reels / TikTok / Status' },
  horizontal: { id: 'horizontal', icon: '🌐', label: 'Google Ads / Landing Page / Vídeo' },
  whatsapp: { id: 'whatsapp', icon: '💬', label: 'WhatsApp / Envio Direto' },
  portais: { id: 'portais', icon: '🏠', label: 'Portais Imobiliários' },
}

const MAX_VISUAL_PIECES_PER_GENERATION = 5

const CAMPAIGN_MODEL_LIBRARY_BASE = [
  {
    id: 'anuncio_premium',
    icon: '\u{1F3C6}',
    name: 'Anuncio Premium',
    previewUrl: '/previews/modelos-produto3/anuncio-premium.svg',
    description: 'Impacto visual para venda.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: 'd791b9b8-55e2-4dff-ae5d-76b9e779c551',
      vertical: '116761e5-4cda-4c83-b450-7beaaa4ef5e1',
      horizontal: 'd280898b-7237-4c0b-a889-e85ededa9644',
      whatsapp: '662883d7-1dba-4e61-a2a2-81fd9293ab15',
      portais: 'd45618d1-5f7f-4053-b317-dd2bbe322f5b',
    },
  },
  {
    id: 'story_premium',
    icon: '\u{1F3C6}',
    name: 'Story Premium',
    previewUrl: '/previews/modelos-produto3/story-premium.svg',
    description: 'Divulgação rápida para redes.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '5461c940-4309-4c3f-bba1-d90e83e62a9a',
      vertical: '1de0a863-2376-4336-8a0a-4750c2429cf7',
      horizontal: 'c9cf1d8c-4f01-4f65-baf8-ca20c56ad76e',
      whatsapp: 'e8314ba2-cd0f-44e3-afd1-de41083c0846',
      portais: 'e15d93e5-dbb0-45c9-b475-2d9e2d6a1d0c',
    },
  },
  {
    id: 'card_imobiliario_premium',
    icon: '\u{1F3C6}',
    name: 'Card Imobiliario Premium',
    previewUrl: '/previews/modelos-produto3/card-imobiliario-premium.svg',
    description: 'Dados do imóvel em destaque.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: 'f7df2c44-ea60-4c42-b862-2d335029acad',
      vertical: '755d1a44-acb9-4593-96b4-f1741b1651af',
      horizontal: '656ff3e1-325a-419c-9914-dfde82f911b6',
      whatsapp: '0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d',
      portais: '2b4e6dff-ee96-42f0-97e1-7956bef9dfa9',
    },
  },
  {
    id: 'imovel_detalhes',
    icon: '\u{1F3C6}',
    name: 'Imovel Detalhes',
    previewUrl: '/previews/modelos-produto3/imovel-detalhes.svg',
    description: 'Informações claras do imóvel.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '4dd468f4-a439-4a31-b6f3-29be17a1d51d',
      vertical: '451b3422-f222-414e-b105-44b896f8277e',
      horizontal: '71aa0276-bc5f-4245-bb37-62a78fa7cf64',
      whatsapp: '1ae7e1f4-ada4-4b03-a032-737a025b88c6',
      portais: '4ba4698c-3b6e-4548-b73d-814d71bc7f66',
    },
  },
  {
    id: 'avaliacao_do_cliente',
    icon: '\u{1F3C6}',
    name: 'Avaliacao do Cliente',
    previewUrl: '/previews/modelos-produto3/avaliacao-do-cliente.svg',
    description: 'Prova social para gerar confiança.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: 'a83a2008-8a6a-4a40-8b6f-d87190a1d306',
      vertical: '52a1e65f-ca92-4c6c-af7e-9f0100c886cb',
      horizontal: 'ff23c370-89eb-4883-8b5b-c21176f8e746',
      whatsapp: '792ad84a-0ab8-4e6c-bda1-400fe9c040cc',
      portais: 'cfded0ba-1eb9-4396-ab63-b259cb817a1e',
    },
  },
  {
    id: 'chat_imobiliario',
    icon: '\u{1F3C6}',
    name: 'Chat Imobiliario',
    previewUrl: '/previews/modelos-produto3/chat-imobiliario.svg',
    description: 'Conversa pronta para contato.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '1db7b057-81e0-4db3-af4e-98a7c987cdfa',
      vertical: 'f4b5c0e9-80fe-408a-b139-f7db7dfbbc89',
      horizontal: 'bee2745c-7887-45e0-a82b-f44191fc0f0f',
      whatsapp: '329b6afb-c749-4bda-a319-38ad42639034',
      portais: '71ae86ec-d08e-4f32-9d61-d7ddcb829f9e',
    },
  },
  {
    id: 'momentos_do_imovel',
    icon: '\u{1F3C6}',
    name: 'Momentos do Imovel',
    previewUrl: '/previews/modelos-produto3/momentos-do-imovel.svg',
    description: 'Ambientes com sensação de visita.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: 'f0a463cc-261f-4b51-ab7e-77fcea67476e',
      vertical: '286a1949-9b0c-4bf2-b7b3-b0e84503f671',
      horizontal: '62d46ee6-6347-4335-af89-2b65f2794882',
      whatsapp: '93635efc-ef44-47d2-a8f3-38a379d69941',
      portais: '3d72b111-76a7-4c7d-a594-1f75f70be2d2',
    },
  },
  {
    id: 'frase_elegante',
    icon: '\u{1F3C6}',
    name: 'Frase Elegante',
    previewUrl: '/previews/modelos-produto3/frase-elegante.svg',
    description: 'Chamada elegante e sofisticada.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '164eef00-abf4-429a-9334-c9e4c1319998',
      vertical: '697a514d-4bab-4062-9c9e-3c208688c0e9',
      horizontal: 'e74922ee-5882-4917-9051-9ae2e4021767',
      whatsapp: '8aab78ac-60cd-4e83-9f4c-51259c4751c6',
      portais: '9a9c663c-0348-462b-a470-c40a86092a81',
    },
  },
  {
    id: 'reels_moderno',
    icon: '\u{1F3C6}',
    name: 'Reels Moderno',
    previewUrl: '/previews/modelos-produto3/reels-moderno.svg',
    description: 'Vídeo curto para redes.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '7f7f420d-da91-48c6-b701-0f0fb540b1aa',
      vertical: 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae',
      horizontal: 'a8a1eebe-b357-4d35-a1fa-2d06887484aa',
      whatsapp: '9962f7dc-6cca-491f-bffe-3184a2314f21',
      portais: 'dfdcea18-0f3d-4c84-baa9-463c182644b7',
    },
  },
  {
    id: 'galeria_imobiliaria',
    icon: '\u{1F3C6}',
    name: 'Galeria Imobiliaria',
    previewUrl: '/previews/modelos-produto3/galeria-imobiliaria.svg',
    description: 'Sequência para fotos e ambientes.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '8e399960-3ade-453a-b868-e7059f30c6a9',
      vertical: '856a9b35-ac8c-45bb-8709-bb2dfa2618b7',
      horizontal: 'f2f15dab-77c2-429e-9b62-f8d6694399ed',
      whatsapp: '7a12a73e-ace7-4ab4-9739-95741b82232a',
      portais: '660ca820-3d7d-4d9f-8c45-3d6da832588b',
    },
  },
  {
    id: 'slides_premium',
    icon: '\u{1F3C6}',
    name: 'Slides Premium',
    previewUrl: '/previews/modelos-produto3/slides-premium.svg',
    description: 'Slides para apresentar detalhes.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '4a7830c5-ff23-446b-8664-2bc8fe86b2c0',
      vertical: 'eb6ae228-a08f-4747-a761-e4d47f716019',
      horizontal: '2d79f2a0-1143-422c-bdef-7d02c5bb72e9',
      whatsapp: '9c7e271b-a9c2-475a-b742-8f949e788abf',
      portais: '13008c2d-9e7e-4515-a2ac-649c9ea18409',
    },
  },
  {
    id: 'video_tour',
    icon: '\u{1F3C6}',
    name: 'Video Tour',
    previewUrl: '/previews/modelos-produto3/video-tour.svg',
    description: 'Apresentação em vídeo.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '89071652-69ab-4edc-897b-9e7985c95f59',
      vertical: 'cd6c0ed3-1dde-4fc0-a604-d728e5cbb73b',
      horizontal: 'd5171301-84e3-41d2-a6ca-ef3013f360a1',
      whatsapp: '9ebd1bda-e650-4d88-b8aa-ff555a419082',
      portais: '9c831fd6-5412-4afe-9e29-dd8c4984e55c',
    },
  },
  {
    id: 'triple_slide_carousel',
    icon: '\u{1F3C6}',
    name: 'Triple Slide Carousel',
    previewUrl: '/previews/modelos-produto3/carrossel-premium.svg',
    description: 'Narrativa visual em carrossel.',
    compatibleUses: ['feed', 'vertical', 'horizontal', 'whatsapp', 'portais'],
    useTemplates: {
      feed: '16682dcd-eb89-404c-94dc-bb9f01317bf4',
      vertical: 'fa82c49d-39af-46e8-bc31-3649fff10cae',
      horizontal: '21c3ff4b-f632-405f-8ebf-369c1f7d4b10',
      whatsapp: '2ecd48d3-146c-467b-8a0d-908152101378',
      portais: '5635ee72-d0da-4906-9a84-6e0b5f587196',
    },
  }
]

const CAMPAIGN_MODEL_LIBRARY = CAMPAIGN_MODEL_LIBRARY_BASE.map(model => {
  const preview = TEMPLATE_MODEL_PREVIEWS[model.id] || {}
  return {
    ...model,
    posterUrl: preview.posterUrl || model.previewUrl || null,
    previewUrl: preview.previewUrl || model.previewUrl || null,
    previewType: preview.previewType || 'image/svg+xml',
    previewFormat: preview.previewFormat || null,
    previewTemplateId: preview.previewTemplateId || null,
    previewLabel: preview.previewLabel || 'Ver',
    previewAlt: preview.previewAlt || `Preview do modelo ${model.name}`,
  }
})

const CAMPAIGN_MODEL_BY_ID = Object.fromEntries(
  CAMPAIGN_MODEL_LIBRARY.map(model => [model.id, model])
)

const CAMPAIGN_MODEL_BY_TEMPLATE_ID = Object.fromEntries(
  CAMPAIGN_MODEL_LIBRARY.flatMap(model => (
    Object.values(model.useTemplates || {}).map(templateId => [templateId, model])
  ))
)

const normalizeModelUses = (modelUses = {}) => {
  const normalized = {}
  CAMPAIGN_MODEL_LIBRARY.forEach(model => {
    const selected = Array.isArray(modelUses[model.id]) ? modelUses[model.id] : []
    const valid = selected.filter(useId => model.compatibleUses.includes(useId))
    if (valid.length > 0) normalized[model.id] = Array.from(new Set(valid))
  })
  return normalized
}

const getTemplateIdsFromModelUses = (modelUses = {}) => (
  CAMPAIGN_MODEL_LIBRARY
    .flatMap(model => (
      (modelUses[model.id] || [])
        .map(useId => model.useTemplates?.[useId])
        .filter(Boolean)
    ))
)

const getCampaignPiecesFromModelUses = (modelUses = {}) => (
  CAMPAIGN_MODEL_LIBRARY.flatMap(model => (
    (modelUses[model.id] || [])
      .map(useId => {
        const templateId = model.useTemplates?.[useId]
        const template = TEMPLATE_CATALOG_BY_TEMPLATE_ID[templateId]
        const use = CAMPAIGN_USE_OPTIONS[useId]
        if (!templateId || !template || !use) return null
        return {
          piece_id: `${model.id}:${useId}:${templateId}`,
          model_id: model.id,
          model_name: model.name,
          use_id: useId,
          use_label: use.label,
          template_id: templateId,
          template,
        }
      })
      .filter(Boolean)
  ))
)

const getModelUsesFromTemplateIds = (templateIds = []) => {
  const selected = new Set(templateIds)
  const next = {}
  CAMPAIGN_MODEL_LIBRARY.forEach(model => {
    const uses = model.compatibleUses.filter(useId => selected.has(model.useTemplates?.[useId]))
    if (uses.length > 0) next[model.id] = uses
  })
  return next
}

const getModelCreditWeight = (modelId) => TEMPLATE_MODEL_CREDIT_WEIGHTS[modelId] || 0

const RENDER_READY_STATUSES = new Set(['succeeded', 'completed'])
const RENDER_ERROR_STATUSES = new Set(['failed', 'error', 'canceled', 'timeout'])
const RENDER_FINAL_STATUSES = new Set([...RENDER_READY_STATUSES, ...RENDER_ERROR_STATUSES])
const RENDER_STATUS_LABELS = {
  pending: 'Processando',
  planned: 'Em fila',
  processing: 'Processando',
  succeeded: 'Pronto',
  completed: 'Pronto',
  failed: 'Falhou',
  error: 'Falhou',
  canceled: 'Falhou',
  timeout: 'Falhou',
}

const normalizeRenderStatus = (status) => String(status || 'planned').toLowerCase()
const getRenderStatusLabel = (status) => RENDER_STATUS_LABELS[normalizeRenderStatus(status)] || 'Processando'
const MISSING_RENDER_ERROR = 'Não foi possível iniciar esta peça. Tente novamente.'
const BANNER_BATCH_ERROR = 'Materiais visuais não foram iniciados agora. Tente gerar novamente em alguns instantes.'
const hasRenderProcessingEvidence = (render) => Boolean(
  render?.render_id
  || render?.render_job_id
  || render?.job_id
  || render?.url
  || render?.snapshot_url
  || render?.erro
  || render?.error_message
  || RENDER_READY_STATUSES.has(normalizeRenderStatus(render?.status))
  || RENDER_ERROR_STATUSES.has(normalizeRenderStatus(render?.status))
  || ['processing', 'pending'].includes(normalizeRenderStatus(render?.status))
)
const normalizeRequestedVisualPieces = (pieces = []) => (
  (Array.isArray(pieces) ? pieces : []).map((piece, index) => {
    const templateId = piece.template_id || piece.templateId || null
    const modelId = piece.model_id || piece.modelo_id || piece.modelId || null
    const modelName = piece.model_name || piece.modelName || null
    const useId = piece.use_id || piece.uso_id || piece.useId || null
    const useLabel = piece.use_label || piece.useLabel || null
    const creditWeight = piece.credit_cost || piece.creditWeight || piece.credit_amount || 0
    const requestKey = piece.requestKey || piece.piece_id || `requested:${templateId || index}:${useId || 'uso'}:${index}`
    return {
      requestKey,
      piece_id: piece.piece_id || requestKey,
      template_id: templateId,
      templateId,
      template_nome: piece.template_nome || piece.label || modelName || 'Peça visual',
      model_id: modelId,
      modelId,
      model_name: modelName,
      modelName,
      use_id: useId,
      useId,
      use_label: useLabel,
      useLabel,
      credit_amount: creditWeight,
      credit_cost: creditWeight,
      creditWeight,
      status: 'pending',
      requested: true,
      missing_from_response: true,
    }
  })
)
const mergeRequestedVisualPieces = (requestedPieces = [], returnedRenders = [], options = {}) => {
  const requested = normalizeRequestedVisualPieces(requestedPieces)
  const returned = Array.isArray(returnedRenders) ? returnedRenders : []
  const used = new Set()
  const missingStatus = options.missingStatus || 'pending'
  const missingErrorMessage = options.missingErrorMessage || ''

  const findMatch = (piece) => {
    const byPieceId = returned.find((render, index) => !used.has(index) && render?.piece_id && render.piece_id === piece.piece_id)
    if (byPieceId) return byPieceId
    return returned.find((render, index) => !used.has(index) && render?.template_id && render.template_id === piece.template_id)
  }

  const merged = requested.map(piece => {
    const match = findMatch(piece)
    if (!match) {
      return {
        ...piece,
        status: missingStatus,
        erro: missingStatus === 'failed' ? missingErrorMessage : piece.erro,
        error_message: missingStatus === 'failed' ? missingErrorMessage : piece.error_message,
      }
    }
    used.add(returned.indexOf(match))
    const lacksProcessingEvidence = options.requireProcessingEvidence && !hasRenderProcessingEvidence(match)
    return {
      ...piece,
      ...match,
      requestKey: match.requestKey || piece.requestKey,
      piece_id: match.piece_id || piece.piece_id,
      template_id: match.template_id || piece.template_id,
      templateId: match.template_id || piece.template_id,
      template_nome: match.template_nome || piece.template_nome,
      model_id: match.model_id || piece.model_id,
      modelId: match.model_id || piece.model_id,
      model_name: match.model_name || piece.model_name,
      modelName: match.model_name || piece.model_name,
      use_id: match.use_id || piece.use_id,
      useId: match.use_id || piece.use_id,
      use_label: match.use_label || piece.use_label,
      useLabel: match.use_label || piece.use_label,
      credit_amount: match.credit_amount ?? piece.credit_amount,
      credit_cost: match.credit_cost ?? piece.credit_cost,
      creditWeight: match.credit_cost ?? piece.credit_cost,
      requested: true,
      missing_from_response: false,
      status: lacksProcessingEvidence ? 'failed' : (match.status || 'planned'),
      erro: lacksProcessingEvidence ? MISSING_RENDER_ERROR : match.erro,
      error_message: lacksProcessingEvidence ? MISSING_RENDER_ERROR : match.error_message,
    }
  })

  returned.forEach((render, index) => {
    if (!used.has(index)) merged.push(render)
  })

  return merged
}
const getRenderDebugPayload = (render) => ({
  render_id: render?.render_id || null,
  template_id: render?.template_id || null,
  status: render?.status || null,
  erro: render?.erro || null,
  error_message: render?.error_message || null,
})
const readFunctionErrorBody = async (error) => {
  try {
    return await error?.context?.json?.()
  } catch {
    try {
      const text = await error?.context?.text?.()
      return text ? { error: text } : null
    } catch {
      return null
    }
  }
}
const normalizePrecoPayload = (value) => {
  const normalized = String(value ?? '').trim()
  return normalized || 'Consulte'
}
const formatQuantityLabel = (value, singular, plural = `${singular}s`) => {
  const count = Number(value) || 0
  if (count <= 0) return ''
  return `${count} ${count === 1 ? singular : plural}`
}
const removeHashtagsFromText = (value) => (
  typeof value === 'string'
    ? value
      .split('\n')
      .filter(line => !line.trim().startsWith('#'))
      .join('\n')
      .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    : value
)
const getSuggestedHashtags = (...values) => {
  const found = values
    .filter(value => typeof value === 'string')
    .flatMap(value => value.match(/#[\p{L}\p{N}_-]+/gu) || [])
  return Array.from(new Set(found.map(tag => tag.trim()).filter(Boolean)))
}

const CREDIT_BUILDER_TABS = [
  {
    id: 'recommended',
    label: 'Campanhas Recomendadas',
    description: 'O sistema sugere os produtos de marketing ideais para o objetivo da campanha.',
  },
  {
    id: 'manual',
    label: 'Monte Sua Campanha',
    description: 'Escolha exatamente quais produtos de marketing deseja gerar e acompanhe o custo.',
  },
]

const WIZARD_STEPS = [
  {
    id: 'welcome',
    title: 'Conheça',
    description: 'Veja o que o SmartCorretorAI pode criar.',
  },
  {
    id: 'products',
    title: 'Escolha',
    description: 'Selecione campanhas ou produtos de marketing.',
  },
  {
    id: 'credits',
    title: 'Créditos',
    description: 'Confira consumo estimado e saldo.',
  },
  {
    id: 'property',
    title: 'Imóvel',
    description: 'Informe os dados principais.',
  },
  {
    id: 'photos',
    title: 'Fotos',
    description: 'Envie imagens para personalizar a campanha.',
  },
  {
    id: 'review',
    title: 'Gerar',
    description: 'Revise e gere sua campanha.',
  },
]

const createGenerationIdempotencyKey = (userId) => {
  const randomPart = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `${userId || 'user'}:${Date.now()}:${randomPart}`
}

const SMART_CAMPAIGNS = [
  {
    id: 'venda_rapida',
    title: 'Venda Rápida',
    description: 'Campanha direta para gerar contatos em imóveis prontos.',
    benefits: ['Mais velocidade para captar leads', 'Ótima para oportunidade de preço', 'Formatos essenciais para redes sociais'],
    smartTip: 'Publique os Stories diariamente e alterne os Banners no Feed durante a semana para aumentar o alcance.',
  },
  {
    id: 'luxo_premium',
    title: 'Luxo Premium',
    description: 'Apresentação sofisticada para imóveis de alto padrão.',
    benefits: ['Valoriza acabamento e exclusividade', 'Visual mais refinado', 'Ideal para fotos fortes e imóveis premium'],
    smartTip: 'Use o vídeo premium para abrir a campanha e reforce os diferenciais com carrosséis ao longo da semana.',
  },
  {
    id: 'lancamento',
    title: 'Lançamento',
    description: 'Campanha para gerar expectativa, urgência e pré-venda.',
    benefits: ['Boa para planta e obra', 'Destaque para oportunidade', 'Ajuda a comunicar escassez e novidade'],
    smartTip: 'Comece pelos Stories para criar expectativa e use o carrossel para explicar planta, lazer e condições.',
  },
  {
    id: 'mcmv',
    title: 'Minha Casa Minha Vida',
    description: 'Comunicação clara para financiamento, entrada e WhatsApp.',
    benefits: ['Linguagem acessível', 'Foco em conversa e simulação', 'Boa para primeiro imóvel'],
    smartTip: 'Priorize chamadas simples e envie o material no WhatsApp para estimular simulações e conversas rápidas.',
  },
  {
    id: 'airbnb_temporada',
    title: 'Airbnb / Temporada',
    description: 'Campanha focada em experiência, lazer e reservas.',
    benefits: ['Valoriza ambientes e lifestyle', 'Boa para imóveis mobiliados', 'Ideal para diária e temporada'],
    smartTip: 'Mostre primeiro a experiência do imóvel e depois use Stories para reforçar datas, localização e reservas.',
  },
  {
    id: 'captacao_imovel',
    hidden: true,
    title: 'Comercial / Captação',
    description: 'Campanha para captar proprietários e abrir conversas qualificadas.',
    benefits: ['Boa para prospecção ativa', 'Foco em conversa e autoridade', 'Ajuda a gerar novas oportunidades'],
    smartTip: 'Use materiais diretos para iniciar conversas e reforce autoridade com prova social.',
  },
  {
    id: 'comercial',
    hidden: true,
    title: 'Comercial',
    description: 'Campanha objetiva para salas, lojas, terrenos e galpões.',
    benefits: ['Foco em localização e metragem', 'Comunicação mais racional', 'Boa para decisão B2B'],
    smartTip: 'Destaque localização, metragem e uso ideal no Feed, depois envie o material pelo WhatsApp para leads qualificados.',
  },
]

const SMART_CAMPAIGN_MODEL_PRESETS = {
  venda_rapida: {
    economica: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'card_imobiliario_premium', useId: 'portais' },
    ],
    premium_ia: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'imovel_detalhes', useId: 'portais' },
    ],
    completa: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'card_imobiliario_premium', useId: 'portais' },
      { modelId: 'momentos_do_imovel', useId: 'horizontal' },
    ],
  },
  luxo_premium: {
    economica: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'video_tour', useId: 'horizontal' },
      { modelId: 'avaliacao_do_cliente', useId: 'feed' },
    ],
    premium_ia: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'video_tour', useId: 'horizontal' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
    ],
    completa: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'video_tour', useId: 'horizontal' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'avaliacao_do_cliente', useId: 'feed' },
    ],
  },
  lancamento: {
    economica: [
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'reels_moderno', useId: 'vertical' },
    ],
    premium_ia: [
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'anuncio_premium', useId: 'horizontal' },
    ],
    completa: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'slides_premium', useId: 'feed' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
    ],
  },
  mcmv: {
    economica: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'card_imobiliario_premium', useId: 'portais' },
    ],
    premium_ia: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'slides_premium', useId: 'feed' },
    ],
    completa: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'card_imobiliario_premium', useId: 'portais' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'reels_moderno', useId: 'vertical' },
    ],
  },
  airbnb_temporada: {
    economica: [
      { modelId: 'video_tour', useId: 'horizontal' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'reels_moderno', useId: 'vertical' },
    ],
    premium_ia: [
      { modelId: 'video_tour', useId: 'horizontal' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'momentos_do_imovel', useId: 'feed' },
    ],
    completa: [
      { modelId: 'video_tour', useId: 'horizontal' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'momentos_do_imovel', useId: 'horizontal' },
    ],
  },
  captacao_imovel: {
    economica: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'avaliacao_do_cliente', useId: 'feed' },
    ],
    premium_ia: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
    ],
    completa: [
      { modelId: 'anuncio_premium', useId: 'feed' },
      { modelId: 'story_premium', useId: 'vertical' },
      { modelId: 'reels_moderno', useId: 'vertical' },
      { modelId: 'chat_imobiliario', useId: 'whatsapp' },
      { modelId: 'triple_slide_carousel', useId: 'feed' },
      { modelId: 'avaliacao_do_cliente', useId: 'feed' },
    ],
  },
}

const getSmartCampaignPreset = (campaignId, modeId = 'economica') => (
  SMART_CAMPAIGN_MODEL_PRESETS[campaignId]?.[modeId]
  || SMART_CAMPAIGN_MODEL_PRESETS[campaignId]?.economica
  || []
)

const getSmartCampaignUseIds = (campaignId, modeId = 'economica') => (
  Array.from(new Set(getSmartCampaignPreset(campaignId, modeId).map(item => item.useId).filter(Boolean)))
)

const OFFICIAL_SUGGESTED_PROFILE_IDS = [
  'venda_rapida',
  'luxo_premium',
  'lancamento',
  'mcmv',
  'airbnb_temporada',
]

const OFFICIAL_SUGGESTED_CAMPAIGNS = [
  {
    id: 'venda_rapida_essencial',
    profileId: 'venda_rapida',
    title: 'Venda Rápida Essencial',
    badge: 'Mais usada',
    description: 'Pacote direto para gerar interesse rápido em canais essenciais.',
    modelIds: ['anuncio_premium', 'story_premium', 'chat_imobiliario', 'imovel_detalhes'],
    channelIds: ['feed', 'vertical', 'whatsapp', 'portais'],
  },
  {
    id: 'venda_rapida_completa',
    profileId: 'venda_rapida',
    title: 'Venda Rápida Completa',
    badge: 'Mais completa',
    description: 'Combina impacto visual, conversa e apresentação completa do imóvel.',
    modelIds: ['anuncio_premium', 'story_premium', 'galeria_imobiliaria', 'chat_imobiliario', 'video_tour'],
    channelIds: ['feed', 'vertical', 'whatsapp', 'horizontal', 'portais'],
  },
  {
    id: 'oferta_direta_whatsapp',
    profileId: 'venda_rapida',
    title: 'Oferta Direta WhatsApp',
    badge: 'Rápida para WhatsApp',
    description: 'Campanha objetiva para iniciar conversas e acelerar contatos.',
    modelIds: ['chat_imobiliario', 'story_premium', 'anuncio_premium', 'imovel_detalhes'],
    channelIds: ['whatsapp', 'vertical', 'feed'],
  },
  {
    id: 'portais_e_redes',
    profileId: 'venda_rapida',
    title: 'Portais e Redes',
    badge: 'Boa para portais',
    description: 'Materiais claros para portais, redes sociais e anúncios.',
    modelIds: ['anuncio_premium', 'imovel_detalhes', 'card_imobiliario_premium', 'galeria_imobiliaria'],
    channelIds: ['portais', 'feed', 'horizontal'],
  },
  {
    id: 'luxo_impacto_visual',
    profileId: 'luxo_premium',
    title: 'Luxo Impacto Visual',
    badge: 'Mais usada',
    description: 'Apresentação visual forte para imóveis de alto padrão.',
    modelIds: ['anuncio_premium', 'frase_elegante', 'galeria_imobiliaria', 'video_tour', 'momentos_do_imovel'],
    channelIds: ['feed', 'vertical', 'horizontal', 'portais'],
  },
  {
    id: 'luxo_lifestyle_completo',
    profileId: 'luxo_premium',
    title: 'Luxo Lifestyle Completo',
    badge: 'Mais completa',
    description: 'Biblioteca premium para valorizar estilo de vida e diferenciais.',
    modelIds: ['galeria_imobiliaria', 'momentos_do_imovel', 'reels_moderno', 'slides_premium', 'anuncio_premium'],
    channelIds: ['feed', 'vertical', 'horizontal', 'portais'],
  },
  {
    id: 'luxo_stories_reels',
    profileId: 'luxo_premium',
    title: 'Luxo para Stories/Reels',
    badge: 'Ideal para redes',
    description: 'Peças verticais para presença sofisticada nas redes.',
    modelIds: ['reels_moderno', 'story_premium', 'momentos_do_imovel', 'frase_elegante'],
    channelIds: ['vertical', 'feed'],
  },
  {
    id: 'alto_padrao_portais',
    profileId: 'luxo_premium',
    title: 'Alto Padrão Portais',
    badge: 'Boa para portais',
    description: 'Materiais completos para apresentar detalhes e valor percebido.',
    modelIds: ['imovel_detalhes', 'galeria_imobiliaria', 'anuncio_premium', 'video_tour'],
    channelIds: ['portais', 'horizontal', 'feed'],
  },
  {
    id: 'lancamento_pre_venda',
    profileId: 'lancamento',
    title: 'Lançamento Pré-venda',
    badge: 'Mais usada',
    description: 'Campanha para expectativa, apresentação e captação inicial.',
    modelIds: ['slides_premium', 'anuncio_premium', 'reels_moderno', 'story_premium'],
    channelIds: ['feed', 'vertical', 'whatsapp', 'horizontal'],
  },
  {
    id: 'lancamento_completo',
    profileId: 'lancamento',
    title: 'Lançamento Completo',
    badge: 'Mais completa',
    description: 'Conjunto completo para explicar o lançamento com riqueza visual.',
    modelIds: ['slides_premium', 'triple_slide_carousel', 'galeria_imobiliaria', 'reels_moderno', 'anuncio_premium'],
    channelIds: ['feed', 'vertical', 'horizontal', 'portais'],
  },
  {
    id: 'lancamento_para_leads',
    profileId: 'lancamento',
    title: 'Lançamento para Leads',
    badge: 'Ideal para anúncios',
    description: 'Foco em anúncios, atendimento e geração de contatos.',
    modelIds: ['chat_imobiliario', 'story_premium', 'anuncio_premium', 'slides_premium'],
    channelIds: ['horizontal', 'whatsapp', 'feed'],
  },
  {
    id: 'lancamento_redes_sociais',
    profileId: 'lancamento',
    title: 'Lançamento Redes Sociais',
    badge: 'Ideal para redes',
    description: 'Modelos sociais para divulgar novidades e criar desejo.',
    modelIds: ['story_premium', 'reels_moderno', 'triple_slide_carousel', 'slides_premium'],
    channelIds: ['vertical', 'feed'],
  },
  {
    id: 'mcmv_direto_ao_ponto',
    profileId: 'mcmv',
    title: 'MCMV Direto ao Ponto',
    badge: 'Mais usada',
    description: 'Comunicação clara para financiamento, conversa e decisão.',
    modelIds: ['card_imobiliario_premium', 'story_premium', 'chat_imobiliario', 'imovel_detalhes'],
    channelIds: ['feed', 'vertical', 'whatsapp', 'portais'],
  },
  {
    id: 'mcmv_completo',
    profileId: 'mcmv',
    title: 'MCMV Completo',
    badge: 'Mais completa',
    description: 'Pacote completo para redes, WhatsApp, anúncios e portais.',
    modelIds: ['card_imobiliario_premium', 'story_premium', 'chat_imobiliario', 'imovel_detalhes', 'anuncio_premium'],
    channelIds: ['feed', 'vertical', 'whatsapp', 'horizontal', 'portais'],
  },
  {
    id: 'mcmv_whatsapp',
    profileId: 'mcmv',
    title: 'MCMV WhatsApp',
    badge: 'Rápida para WhatsApp',
    description: 'Materiais simples para estimular simulações e conversa.',
    modelIds: ['chat_imobiliario', 'story_premium', 'card_imobiliario_premium', 'anuncio_premium'],
    channelIds: ['whatsapp', 'vertical', 'feed'],
  },
  {
    id: 'mcmv_portais',
    profileId: 'mcmv',
    title: 'MCMV Portais',
    badge: 'Boa para portais',
    description: 'Apresentação objetiva para portais, redes e anúncios.',
    modelIds: ['imovel_detalhes', 'card_imobiliario_premium', 'anuncio_premium', 'galeria_imobiliaria'],
    channelIds: ['portais', 'feed', 'horizontal'],
  },
  {
    id: 'temporada_ocupacao_rapida',
    profileId: 'airbnb_temporada',
    title: 'Temporada Ocupação Rápida',
    badge: 'Mais usada',
    description: 'Campanha visual para gerar reservas e conversas rapidamente.',
    modelIds: ['momentos_do_imovel', 'galeria_imobiliaria', 'story_premium', 'chat_imobiliario'],
    channelIds: ['feed', 'vertical', 'whatsapp'],
  },
  {
    id: 'airbnb_experiencia',
    profileId: 'airbnb_temporada',
    title: 'Airbnb Experiência',
    badge: 'Mais completa',
    description: 'Valoriza experiência, ambientes e diferenciais da estadia.',
    modelIds: ['momentos_do_imovel', 'galeria_imobiliaria', 'reels_moderno', 'story_premium', 'video_tour'],
    channelIds: ['feed', 'vertical', 'horizontal'],
  },
  {
    id: 'temporada_stories_reels',
    profileId: 'airbnb_temporada',
    title: 'Temporada Stories/Reels',
    badge: 'Ideal para redes',
    description: 'Peças sociais para mostrar atmosfera, lazer e desejo.',
    modelIds: ['reels_moderno', 'story_premium', 'momentos_do_imovel', 'galeria_imobiliaria'],
    channelIds: ['vertical', 'feed'],
  },
  {
    id: 'temporada_whatsapp',
    profileId: 'airbnb_temporada',
    title: 'Temporada WhatsApp',
    badge: 'Rápida para WhatsApp',
    description: 'Materiais prontos para enviar e converter interessados.',
    modelIds: ['chat_imobiliario', 'galeria_imobiliaria', 'story_premium', 'momentos_do_imovel'],
    channelIds: ['whatsapp', 'feed', 'vertical'],
  },
]

const getOfficialSuggestedCampaign = (campaignId) => (
  OFFICIAL_SUGGESTED_CAMPAIGNS.find(campaign => campaign.id === campaignId)
)

const getOfficialSuggestedCampaignModels = (campaign) => (
  (campaign?.modelIds || []).map(modelId => CAMPAIGN_MODEL_BY_ID[modelId]).filter(Boolean)
)

const getOfficialSuggestedModelUses = (campaign, useId) => {
  const selectedUseId = campaign?.channelIds?.includes(useId) ? useId : campaign?.channelIds?.[0]
  if (!selectedUseId) return {}
  const modelUses = {}
  getOfficialSuggestedCampaignModels(campaign).forEach(model => {
    if (model.useTemplates?.[selectedUseId]) modelUses[model.id] = [selectedUseId]
  })
  return modelUses
}

const getModelUsesFromPreset = (preset = []) => {
  const next = {}
  preset.forEach(({ modelId, useId }) => {
    const model = CAMPAIGN_MODEL_BY_ID[modelId]
    if (!model || !model.compatibleUses.includes(useId)) return
    next[modelId] = [useId]
  })
  return next
}

const DEMO_CAMPAIGN_ID = 'venda_rapida'
const DEMO_TEMPLATE_IDS = [
  'd791b9b8-55e2-4dff-ae5d-76b9e779c551',
  '1de0a863-2376-4336-8a0a-4750c2429cf7',
  '2ecd48d3-146c-467b-8a0d-908152101378',
]

const SMART_CAMPAIGN_FIXED_CREDIT_COST = 185
const SMART_CAMPAIGN_BASE_TEMPLATE_IDS = [
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
]
const SMART_CAMPAIGN_BASE_DELIVERABLES = [
  { key: 'banners', title: 'Banners', count: 6 },
  { key: 'stories', title: 'Stories', count: 3 },
  { key: 'videos', title: 'Reels', count: 2 },
  { key: 'carousels', title: 'Carrossel', count: 1 },
  { key: 'textIa', title: 'Textos completos' },
  { key: 'whatsapp', title: 'WhatsApp' },
]

const DELIVERABLE_LABELS = {
  banners: ['banner', 'card', 'detailed', 'social'],
  stories: ['story'],
  carousels: ['carousel'],
  videos: ['video', 'reels'],
}

const DELIVERABLE_DETAILS = {
  banners: {
    title: 'Banner Feed',
    where: 'Instagram e Facebook',
    purpose: 'divulgar o imóvel no feed e gerar interesse imediato.',
  },
  stories: {
    title: 'Story',
    where: 'Instagram Stories, Facebook Stories e Status do WhatsApp',
    purpose: 'aumentar visualizações rápidas e gerar contatos.',
  },
  carousels: {
    title: 'Carrossel',
    where: 'Instagram e Facebook',
    purpose: 'mostrar vários ambientes do imóvel em uma única publicação.',
  },
  videos: {
    title: 'Vídeo/Reels',
    where: 'Instagram Reels, TikTok e Facebook Reels',
    purpose: 'aumentar alcance e criar impacto visual.',
  },
  textIa: {
    title: 'Texto IA',
    where: 'portais, Instagram, Facebook e WhatsApp',
    purpose: 'publicar com mais qualidade sem precisar escrever do zero.',
  },
  whatsapp: {
    title: 'WhatsApp',
    where: 'grupos, clientes e leads',
    purpose: 'compartilhar o imóvel rapidamente e iniciar conversas.',
  },
}

const countDeliverables = (catalogItems = []) => {
  const items = TEMPLATE_CATALOG.filter(template => catalogItems.includes(template.id))
  const countByTypes = (types) => items.filter(item => types.includes(item.type)).length
  return {
    banners: countByTypes(DELIVERABLE_LABELS.banners),
    stories: countByTypes(DELIVERABLE_LABELS.stories),
    carousels: countByTypes(DELIVERABLE_LABELS.carousels),
    videos: countByTypes(DELIVERABLE_LABELS.videos),
    total: items.length,
  }
}

const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`

const createDeliverableDetail = (key, count = null) => ({
  key,
  count,
  ...DELIVERABLE_DETAILS[key],
})

const getCampaignCardDetails = (campaignId, modeId, isDemoPlan = false, channelId = null) => {
  const officialCampaign = getOfficialSuggestedCampaign(campaignId)
  if (officialCampaign) {
    const modelUses = getOfficialSuggestedModelUses(officialCampaign, channelId || officialCampaign.channelIds[0])
    const suggestedTemplates = getTemplateIdsFromModelUses(modelUses)
    const catalogItems = TEMPLATE_CATALOG
      .filter(template => suggestedTemplates.includes(template.templateId) && ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(template.templateId))
      .map(template => template.id)
    const counts = countDeliverables(catalogItems)
    const deliverables = [
      counts.banners > 0 ? createDeliverableDetail('banners', counts.banners) : null,
      counts.stories > 0 ? createDeliverableDetail('stories', counts.stories) : null,
      counts.carousels > 0 ? createDeliverableDetail('carousels', counts.carousels) : null,
      counts.videos > 0 ? createDeliverableDetail('videos', counts.videos) : null,
      createDeliverableDetail('textIa'),
      createDeliverableDetail('whatsapp'),
    ].filter(Boolean)

    return {
      deliverables,
      totalPieces: counts.total,
      creditCost: TEMPLATE_CATALOG
        .filter(template => suggestedTemplates.includes(template.templateId) && ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(template.templateId))
        .reduce((sum, template) => sum + (template.creditWeight || 0), 0),
    }
  }

  const mode = CAMPAIGN_TEMPLATES[campaignId]?.modes?.[modeId] || CAMPAIGN_TEMPLATES[campaignId]?.modes?.economica
  const preset = getSmartCampaignPreset(campaignId, modeId)
  const modelUses = getModelUsesFromPreset(preset)
  const suggestedTemplates = getTemplateIdsFromModelUses(modelUses)
  const catalogItems = isDemoPlan && campaignId === DEMO_CAMPAIGN_ID
    ? TEMPLATE_CATALOG.filter(template => DEMO_TEMPLATE_IDS.includes(template.templateId)).map(template => template.id)
    : TEMPLATE_CATALOG.filter(template => suggestedTemplates.includes(template.templateId) && ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(template.templateId)).map(template => template.id)
  const counts = countDeliverables(catalogItems)
  const deliverables = [
    counts.banners > 0 ? createDeliverableDetail('banners', counts.banners) : null,
    counts.stories > 0 ? createDeliverableDetail('stories', counts.stories) : null,
    counts.carousels > 0 ? createDeliverableDetail('carousels', counts.carousels) : null,
    counts.videos > 0 ? createDeliverableDetail('videos', counts.videos) : null,
    createDeliverableDetail('textIa'),
    createDeliverableDetail('whatsapp'),
  ].filter(Boolean)

  return {
    deliverables,
    totalPieces: counts.total,
    creditCost: isDemoPlan && campaignId === DEMO_CAMPAIGN_ID
      ? 0
      : (TEMPLATE_CATALOG
        .filter(template => suggestedTemplates.includes(template.templateId) && ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(template.templateId))
        .reduce((sum, template) => sum + (template.creditWeight || 0), 0) || mode?.creditCost || 0),
  }
}

const DIAS_SEMANA = [
  { id: 'seg', nome: 'Seg', label: 'Segunda' }, { id: 'ter', nome: 'Ter', label: 'Terça' },
  { id: 'qua', nome: 'Qua', label: 'Quarta' },  { id: 'qui', nome: 'Qui', label: 'Quinta' },
  { id: 'sex', nome: 'Sex', label: 'Sexta' },   { id: 'sab', nome: 'Sáb', label: 'Sábado' },
  { id: 'dom', nome: 'Dom', label: 'Domingo' },
]

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTES — FORMULÁRIO
// ═══════════════════════════════════════════════════════════════

function Counter({ label, value, onChange, max = 9 }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-bold">−</button>
        <span className="w-6 text-center text-base font-bold text-gray-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-bold">+</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTE — POPUP DE AGENDAMENTO
// ═══════════════════════════════════════════════════════════════

const PECAS_AGENDA = [
  { id: 'ig_feed',    nome: 'Instagram Feed',    icon: '📸' },
  { id: 'ig_stories', nome: 'Instagram Stories', icon: '📱' },
  { id: 'fb_feed',    nome: 'Facebook Feed',      icon: '👍' },
  { id: 'whatsapp',   nome: 'Mensagem WhatsApp',  icon: '💬' },
  { id: 'tiktok',     nome: 'TikTok / Reels',    icon: '🎵' },
  { id: 'linkedin',   nome: 'LinkedIn',           icon: '💼' },
  { id: 'portal_zap', nome: 'ZAP Imóveis',        icon: '🏠' },
]

function AgendamentoPopup({ titulo, onClose }) {
  const [diasSel, setDiasSel] = useState(new Set(['seg', 'qua', 'sex']))
  const [horario, setHorario] = useState('10:00')
  const [cronograma, setCronograma] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const toggleDia = (id) => setDiasSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const gerar = () => {
    const dias = DIAS_SEMANA.filter(d => diasSel.has(d.id))
    const resultado = dias.map((dia, i) => ({
      dia: dia.label,
      horario,
      peca: PECAS_AGENDA[i % PECAS_AGENDA.length],
    }))
    setCronograma(resultado)
  }

  const copiarTexto = async () => {
    if (!cronograma) return
    const txt = cronograma.map(c => `${c.dia} às ${c.horario} — ${c.peca.icon} ${c.peca.nome}`).join('\n')
    await navigator.clipboard.writeText(`📅 CRONOGRAMA — ${titulo}\n\n${txt}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const baixarIcs = () => {
    if (!cronograma) return
    const hoje = new Date()
    const proximaSegunda = new Date(hoje)
    const diasParaSeg = (8 - hoje.getDay()) % 7 || 7
    proximaSegunda.setDate(hoje.getDate() + diasParaSeg)

    const diasMap = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4, sab: 5, dom: 6 }
    const [h, m] = horario.split(':').map(Number)

    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SmartCorretorAI//PT\r\n'
    cronograma.forEach(({ dia, peca }) => {
      const diaObj = DIAS_SEMANA.find(d => d.label === dia)
      if (!diaObj) return
      const offset = diasMap[diaObj.id]
      const dt = new Date(proximaSegunda)
      dt.setDate(proximaSegunda.getDate() + offset)
      dt.setHours(h, m, 0, 0)
      const dtEnd = new Date(dt); dtEnd.setMinutes(dt.getMinutes() + 30)
      const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      ics += `BEGIN:VEVENT\r\nDTSTART:${fmt(dt)}\r\nDTEND:${fmt(dtEnd)}\r\nSUMMARY:${peca.icon} ${peca.nome} — ${titulo}\r\nDESCRIPTION:Publicar conteúdo gerado pelo SmartCorretorAI\r\nEND:VEVENT\r\n`
    })
    ics += 'END:VCALENDAR'

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'cronograma-publicacao.ics' })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Agendar distribuição 📅</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Quer que eu distribua essas peças ao longo da semana?
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {!cronograma ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Dias da semana</label>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_SEMANA.map(d => (
                  <button key={d.id} type="button" onClick={() => toggleDia(d.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      diasSel.has(d.id) ? 'gradient-primary text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {d.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Horário de publicação</label>
              <div className="flex gap-2 flex-wrap">
                {['08:00', '10:00', '12:00', '18:00', '19:00', '20:00'].map(h => (
                  <button key={h} type="button" onClick={() => setHorario(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      horario === h ? 'gradient-primary text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {h}
                  </button>
                ))}
                <input type="time" value={horario} onChange={e => setHorario(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Agora não
              </button>
              <button onClick={gerar} disabled={diasSel.size === 0}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Criar cronograma
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {cronograma.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c.peca.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{c.peca.nome}</p>
                      <p className="text-xs text-gray-500">{c.dia}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full">
                    {c.horario}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={copiarTexto}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
                {copiado ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
              </button>
              <button onClick={baixarIcs}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
                <Download className="w-3.5 h-3.5" />Baixar .ics
              </button>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Pronto
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTES — RESULTADO VISUAL
// ═══════════════════════════════════════════════════════════════

function AnimatedCard({ delay = 0, children }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div className={`transition-all duration-700 ease-out ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
      {children}
    </div>
  )
}

function SuggestedHashtagsBlock({ tags, copyId, copiedId, onCopy }) {
  if (!tags?.length) return null
  const text = tags.join(' ')
  return (
    <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-primary-900">Hashtags sugeridas</p>
          <p className="mt-1 text-xs text-gray-600">Use apenas quando fizer sentido para o post social.</p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(text, copyId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-50"
        >
          {copiedId === copyId ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar hashtags</>}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function TikTokPlayer({ roteiro }) {
  const cenas = (roteiro || '').split(/\n+/).filter(c => c.trim()).slice(0, 10)
  const [idx, setIdx] = useState(0)
  const [show, setShow] = useState(true)
  const [playing, setPlaying] = useState(true)

  const goTo = useCallback((nextIdx) => {
    setShow(false)
    setTimeout(() => { setIdx((nextIdx + cenas.length) % cenas.length); setShow(true) }, 350)
  }, [cenas.length])

  useEffect(() => {
    if (!playing || cenas.length <= 1) return
    const iv = setInterval(() => goTo(idx + 1), 3800)
    return () => clearInterval(iv)
  }, [playing, idx, goTo, cenas.length])

  return (
    <div className="mx-auto relative rounded-3xl overflow-hidden shadow-2xl border border-white/10"
         style={{ width: '200px', aspectRatio: '9/16', background: 'linear-gradient(135deg, #1a0533, #0d0d0d, #1a0533)' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-transparent to-pink-900/30" />
      <div className="absolute top-4 left-3 right-3 flex gap-0.5">
        {cenas.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/25 overflow-hidden">
            <div className={`h-full rounded-full bg-white transition-all duration-500 ${i < idx ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-3 top-1/3 bottom-24 flex items-center justify-center text-center">
        <p className={`text-white text-xs font-semibold leading-relaxed transition-all duration-350 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
           style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          {cenas[idx] || ''}
        </p>
      </div>
      <div className="absolute right-2.5 bottom-28 flex flex-col gap-3.5 items-center">
        {[['❤️', '2,3k'], ['💬', '84'], ['↗️', '412']].map(([icon, count]) => (
          <div key={icon} className="flex flex-col items-center gap-0.5">
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-white/70 text-xs">{count}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-5 left-3 right-12 flex items-center justify-center gap-2.5">
        <button onClick={() => goTo(idx - 1)} className="w-7 h-7 bg-white/15 rounded-full text-white text-xs flex items-center justify-center hover:bg-white/25">⏮</button>
        <button onClick={() => setPlaying(p => !p)} className="w-9 h-9 bg-white/25 rounded-full text-white text-sm flex items-center justify-center hover:bg-white/35">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => goTo(idx + 1)} className="w-7 h-7 bg-white/15 rounded-full text-white text-xs flex items-center justify-center hover:bg-white/25">⏭</button>
      </div>
      <div className="absolute top-8 right-3 text-white/50 text-xs">{idx + 1}/{cenas.length}</div>
    </div>
  )
}

function InstagramFeedCard({ dados, gradiente }) {
  return (
    <div className="max-w-xs mx-auto rounded-2xl overflow-hidden shadow-xl border border-gray-100">
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradiente} flex items-center justify-center text-lg`}>🏠</div>
        <div className="flex-1"><p className="text-sm font-semibold text-gray-900">seu.perfil</p><p className="text-xs text-gray-400">Patrocinado</p></div>
        <span className="text-gray-400 text-lg font-bold">···</span>
      </div>
      <div className={`aspect-square bg-gradient-to-br ${gradiente} flex flex-col items-center justify-center p-6 text-white text-center`}>
        <span className="text-7xl mb-3">🏠</span>
        <p className="text-base font-bold uppercase tracking-wide">Imóvel à Venda</p>
        <p className="text-xs text-white/70 mt-1">Deslize para mais →</p>
      </div>
      <div className="px-4 py-2.5 bg-white flex justify-between">
        <div className="flex gap-3 text-2xl">❤️ 💬 📤</div>
        <span className="text-2xl">🔖</span>
      </div>
      <div className="px-4 pb-4 bg-white">
        <p className="text-xs font-semibold text-gray-900 mb-1">seu.perfil</p>
        <p className="text-xs text-gray-800 leading-relaxed">{removeHashtagsFromText(dados.legenda)}</p>
        {dados.cta && <p className="text-xs font-semibold text-primary-600 mt-2">👉 {dados.cta}</p>}
      </div>
    </div>
  )
}

function StoriesCard({ dados, gradiente }) {
  return (
    <div className="mx-auto relative rounded-3xl overflow-hidden shadow-xl" style={{ width: '175px', aspectRatio: '9/16' }}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradiente}`}>
        <div className="absolute top-3 left-3 right-3 flex gap-1">
          {[1,2,3].map(i => <div key={i} className={`h-0.5 flex-1 rounded-full ${i===1?'bg-white':'bg-white/35'}`} />)}
        </div>
        <div className="absolute top-7 left-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-xs">🏠</div>
          <span className="text-white text-xs font-bold">seu.perfil</span>
        </div>
        <div className="absolute inset-x-4 top-[35%] text-center">
          <p className="text-white text-xs font-bold leading-relaxed" style={{ textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>
            {removeHashtagsFromText(dados.texto_principal)}
          </p>
        </div>
        <div className="absolute bottom-8 left-3 right-3">
          <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-full py-2 text-center">
            <span className="text-white text-xs font-bold">↑ {dados.cta || 'Ver mais'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function WhatsAppCard({ dados }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl max-w-xs mx-auto">
      <div className="bg-green-600 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🏠</div>
        <div><p className="text-white text-sm font-bold">Corretor</p><p className="text-green-200 text-xs">online agora ●</p></div>
      </div>
      <div className="bg-[#e5ddd5] p-4 flex justify-end">
        <div className="bg-[#dcf8c6] rounded-tl-2xl rounded-tr-none rounded-br-2xl rounded-bl-2xl max-w-[90%] px-4 py-3 shadow-sm">
          <p className="text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">{removeHashtagsFromText(dados.mensagem)}</p>
          <div className="flex justify-end items-center gap-1 mt-1.5">
            <span className="text-gray-400 text-xs">18:42</span>
            <span className="text-blue-400 text-sm">✓✓</span>
          </div>
        </div>
      </div>
      <div className="bg-[#e5ddd5] pb-4 flex justify-center">
        <div className="bg-white rounded-full px-5 py-2 text-xs text-gray-500 shadow-sm">📎  Enviar mensagem</div>
      </div>
    </div>
  )
}

function FacebookCard({ dados }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl max-w-xs mx-auto bg-white border border-gray-200">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xl">🏠</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Seu Perfil Imóveis</p>
          <p className="text-xs text-gray-400">Agora · 🌐</p>
        </div>
        <span className="text-gray-400 font-bold">···</span>
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-800 leading-relaxed">{removeHashtagsFromText(dados.texto)}</p>
        {dados.cta && <p className="text-xs text-blue-600 font-semibold mt-2">👉 {dados.cta}</p>}
      </div>
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 h-28 flex items-center justify-center">
        <span className="text-white text-5xl">🏠</span>
      </div>
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-400">
        <div>👍❤️😍 <span className="ml-1">1,2 mil</span></div>
        <div className="flex gap-3"><span>84 comentários</span><span>320 compart.</span></div>
      </div>
      <div className="border-t border-gray-100 px-4 py-2 flex justify-around">
        {['👍 Curtir', '💬 Comentar', '↗️ Compartilhar'].map(a => (
          <button key={a} className="text-xs text-gray-600 font-medium">{a}</button>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

// Redimensiona e comprime a foto no browser (canvas) antes do upload.
// - Lado maior cap em 1920px (preserva proporção; imagens menores passam direto).
// - JPEG qualidade 0.80 — equilíbrio entre nitidez e peso.
// O corretor não precisa pensar em tamanho/peso: sempre normalizamos aqui.
async function resizeFoto(file, maxPx = 1920) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ dados: canvas.toDataURL('image/jpeg', 0.80).split(',')[1], tipo: 'image/jpeg' })
    }
    img.src = url
  })
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function NovaCampanha() {
  const { user: authedUser, accessToken, loading: authLoading, isPro, isUnlimitedTestAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const produtoParamRaw = new URLSearchParams(location.search).get('produto') || location.state?.produto || ''
  const produtoParam = PRODUCT_CONTEXTS[produtoParamRaw] ? produtoParamRaw : ''
  const productContext = PRODUCT_CONTEXTS[produtoParam] || PRODUCT_CONTEXTS.campanha_completa
  const subprodutoParam = new URLSearchParams(location.search).get('subproduto') || location.state?.subproduto || ''
  const subprodutoLabel = SUBPRODUCT_LABELS[subprodutoParam] || ''
  const isProductEntry = ['hero', 'transformar_video'].includes(produtoParam)
  const [fase, setFase] = useState('form')

  const [categoria, setCategoria] = useState(null)
  const [tipo, setTipo] = useState('')
  const [finalidade, setFinalidade] = useState('Venda')
  const [quartos, setQuartos] = useState(2)
  const [banheiros, setBanheiros] = useState(1)
  const [suites, setSuites] = useState(0)
  const [vagas, setVagas] = useState(1)
  const [area, setArea] = useState('')
  const [preco, setPreco] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cidades, setCidades] = useState([])
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [diferenciais, setDiferenciais] = useState([])
  const [difCustom, setDifCustom] = useState('')
  const [fotos, setFotos] = useState([])
  const [videoArquivo, setVideoArquivo] = useState(null)
  const [msgIdx, setMsgIdx] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [campanhaId, setCampanhaId] = useState(null)
  const [copiadoId, setCopiadoId] = useState(null)
  const [igConectado, setIgConectado] = useState(false)
  const [postando, setPostando] = useState(false)
  const [igPostado, setIgPostado] = useState(false)
  const pollRef = useRef(null)
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const failedRenderLogRef = useRef(new Set())

  const [showAgendamento, setShowAgendamento] = useState(false)

  const [renders, setRenders] = useState(null)
  const [requestedVisualPieces, setRequestedVisualPieces] = useState([])
  const [gerandoBanners, setGerandoBanners] = useState(false)
  const [generationNotice, setGenerationNotice] = useState('')
  const renderPollRef = useRef(null)
  const [activePreviewModel, setActivePreviewModel] = useState(null)
  const [previewVideoFailed, setPreviewVideoFailed] = useState(false)

  const closePreviewModal = useCallback(() => {
    setActivePreviewModel(null)
    setPreviewVideoFailed(false)
  }, [])

  const openPreviewModal = useCallback((model, event) => {
    event?.stopPropagation?.()
    setPreviewVideoFailed(false)
    setActivePreviewModel(model)
  }, [])

  useEffect(() => {
    if (!activePreviewModel) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePreviewModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePreviewModel, closePreviewModal])

  const selecionarTudo = () => {
    setSelectedSmartCampaign(null)
    setCreditBuilderMode('manual')
    const nextModelUses = Object.fromEntries(
      CAMPAIGN_MODEL_LIBRARY.map(model => [model.id, [model.compatibleUses[0]]])
    )
    setSelectedModelUses(nextModelUses)
    setSelectedTemplateIds(getTemplateIdsFromModelUses(nextModelUses))
  }

  const [creditos, setCreditos] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [productFlowStep, setProductFlowStep] = useState(isProductEntry ? 'property' : 'campaign-choice')
  const [campaignFlowType, setCampaignFlowType] = useState(null)
  const [wizardStep, setWizardStep] = useState(0)
  const [visualCreditMode, setVisualCreditMode] = useState('economica')
  const [creditBuilderMode, setCreditBuilderMode] = useState('recommended')
  const [selectedSmartCampaign, setSelectedSmartCampaign] = useState(null)
  const [selectedSuggestedProfile, setSelectedSuggestedProfile] = useState(null)
  const [selectedSuggestedChannel, setSelectedSuggestedChannel] = useState(null)
  const [activeCampaignModelId, setActiveCampaignModelId] = useState(null)
  const [selectedModelUses, setSelectedModelUses] = useState({})
  const [campaignObjective, setCampaignObjective] = useState('')
  const [demoUsed, setDemoUsed] = useState(false)
  const isDemoPlan = !isPro && !isUnlimitedTestAdmin
  const demoStorageKey = authedUser?.id ? `smartcorretor_demo_used_${authedUser.id}` : null

  useEffect(() => {
    setIgConectado(false)
    setCreditos({
      plano: 'starter',
      limite_mensal: 5,
      restantes_mes: 5,
      creditos_avulsos: 0,
      total_disponivel: 5,
    })
  }, [])

  useEffect(() => {
    if (!demoStorageKey) return
    setDemoUsed(localStorage.getItem(demoStorageKey) === 'true')
  }, [demoStorageKey])

  const catAtual = CATEGORIAS.find(c => c.id === categoria)
  const msgs = MSGS_POR_CAT[categoria] || MSGS_POR_CAT.medio_padrao
  const selectedCampaignPieces = getCampaignPiecesFromModelUses(selectedModelUses)
  const selectedTemplateIds = selectedCampaignPieces.map(piece => piece.template_id)
  const selectedTemplateIdSet = new Set(selectedTemplateIds)
  const selectedMarketingObjectives = VISIBLE_MARKETING_OBJECTIVES.filter(objective =>
    objective.selectedTemplates.every(templateId => selectedTemplateIdSet.has(templateId))
  )
  const campaignObjectiveId = campaignFlowType === 'smart' ? selectedSmartCampaign : campaignObjective
  const selectedOfficialCampaign = getOfficialSuggestedCampaign(selectedSmartCampaign)
  const campaignObjectiveInfo = selectedOfficialCampaign || SMART_CAMPAIGNS.find(campaign => campaign.id === campaignObjectiveId)
  const campaignObjectiveLabel = campaignObjectiveInfo?.title || ''
  const selectedObjectiveCount = selectedMarketingObjectives.length
  const simulatedCreditBalance = 150
  const selectedCatalogItems = selectedCampaignPieces.length > 0
    ? selectedCampaignPieces.map((piece, index) => ({
        ...piece.template,
        pieceId: piece.piece_id,
        pieceIndex: index,
        modelId: piece.model_id,
        modelName: piece.model_name,
        useId: piece.use_id,
        useLabel: piece.use_label,
      }))
    : TEMPLATE_CATALOG.filter(template => selectedTemplateIds.includes(template.templateId) && ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(template.templateId))
  const selectedTemplatePayload = selectedCatalogItems.map((item, index) => ({
    requestKey: `${item.modelId || item.templateId}:${item.useId || 'uso'}:${item.templateId}:index:${index}`,
    piece_id: item.pieceId || `template:${item.templateId}:index:${index}`,
    template_id: item.templateId,
    model_id: item.modelId || null,
    modelo_id: item.modelId || null,
    model_name: item.modelName || item.publicName || null,
    use_id: item.useId || null,
    uso_id: item.useId || null,
    use_label: item.useLabel || null,
    template_nome: item.publicName || null,
    credit_cost: item.creditWeight || 0,
    label: [item.modelName || item.publicName, item.useLabel].filter(Boolean).join(' - '),
    index,
  }))
  const activeCampaignModel = CAMPAIGN_MODEL_LIBRARY.find(model => model.id === activeCampaignModelId)
  const selectedModelSummaries = CAMPAIGN_MODEL_LIBRARY
    .map(model => {
      const useIds = selectedModelUses[model.id] || []
      const selectedUses = useIds
        .map(useId => CAMPAIGN_USE_OPTIONS[useId])
        .filter(Boolean)
      return selectedUses.length > 0 ? { ...model, selectedUses, creditWeight: getModelCreditWeight(model.id) } : null
    })
    .filter(Boolean)
  const selectedModelCount = selectedModelSummaries.length
  const selectedUseCount = selectedModelSummaries.reduce((sum, model) => sum + model.selectedUses.length, 0)
  const isSmartCampaignSelection = false
  const estimatedCreditConsumption = selectedCatalogItems.reduce((sum, item) => sum + item.creditWeight, 0)
  const balanceAfterGeneration = simulatedCreditBalance - estimatedCreditConsumption
  const hasInsufficientCredits = balanceAfterGeneration < 0
  const economySuggestion = selectedCatalogItems.some(item => ['video', 'reels'].includes(item.type))
    ? 'Remova Vídeo/Reels para economizar créditos e manter artes + textos IA.'
    : 'Escolha apenas Banner Feed e Story para uma geração mais econômica.'
  const generationModeForCredits = isDemoPlan ? 'demonstrativo' : 'manual'
  const generationCreditCost = isDemoPlan ? 0 : (isSmartCampaignSelection ? SMART_CAMPAIGN_FIXED_CREDIT_COST : estimatedCreditConsumption)
  const generationHasPremiumVideo = !isDemoPlan && selectedCatalogItems.some(item => ['video', 'reels'].includes(item.type))
  const activeWizardStep = WIZARD_STEPS[wizardStep] || WIZARD_STEPS[0]
  const wizardProgress = ((wizardStep + 1) / WIZARD_STEPS.length) * 100
  const goToPreviousWizardStep = () => setWizardStep(step => Math.max(0, step - 1))
  const goToNextWizardStep = () => setWizardStep(step => Math.min(WIZARD_STEPS.length - 1, step + 1))

  const setSelectedTemplateIds = (templateIds = []) => {
    setSelectedModelUses(getModelUsesFromTemplateIds(templateIds))
  }

  const applySelectedModelUses = (modelUses = {}) => {
    const normalized = normalizeModelUses(modelUses)
    setSelectedModelUses(normalized)
    setSelectedTemplateIds(getTemplateIdsFromModelUses(normalized))
  }

  const toggleMarketingObjective = (objective) => {
    const next = new Set(selectedTemplateIds)
    const alreadySelected = objective.selectedTemplates.every(templateId => next.has(templateId))

    objective.selectedTemplates.forEach(templateId => {
      if (alreadySelected) next.delete(templateId)
      else next.add(templateId)
    })

    setSelectedSmartCampaign(null)
    setCreditBuilderMode('manual')
    setSelectedTemplateIds(Array.from(next))
    setSelectedModelUses(getModelUsesFromTemplateIds(Array.from(next)))
  }

  const toggleTemplateCatalogItem = (templateId) => {
    const next = new Set(selectedTemplateIds)
    if (next.has(templateId)) next.delete(templateId)
    else next.add(templateId)
    setSelectedSmartCampaign(null)
    setCreditBuilderMode('manual')
    setSelectedTemplateIds(Array.from(next))
    setSelectedModelUses(getModelUsesFromTemplateIds(Array.from(next)))
  }

  const toggleCampaignModelUse = (modelId, useId) => {
    const model = CAMPAIGN_MODEL_BY_ID[modelId]
    if (!model || !model.compatibleUses.includes(useId)) return

    const current = new Set(selectedModelUses[modelId] || [])
    const alreadySelected = current.has(useId)
    if (alreadySelected) current.delete(useId)
    else current.add(useId)

    const next = {
      ...selectedModelUses,
      [modelId]: Array.from(current),
    }
    if (next[modelId].length === 0) delete next[modelId]

    if (!alreadySelected && getCampaignPiecesFromModelUses(next).length > MAX_VISUAL_PIECES_PER_GENERATION) {
      toast.error(`Para garantir a geração correta, selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} peças por vez neste momento.`)
      return
    }

    setSelectedSmartCampaign(null)
    setCreditBuilderMode('manual')
    applySelectedModelUses(next)
  }

  const applySmartCampaign = (campaignId, modeId = visualCreditMode) => {
    const officialCampaign = getOfficialSuggestedCampaign(campaignId)
    if (officialCampaign) {
      const officialModelUses = getOfficialSuggestedModelUses(officialCampaign, selectedSuggestedChannel)
      const selected = getTemplateIdsFromModelUses(officialModelUses)
      const allowed = selected.filter(templateId => ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(templateId))
      setSelectedModelUses(officialModelUses)
      setSelectedTemplateIds(allowed)
      setSelectedSmartCampaign(campaignId)
      setCampaignObjective(officialCampaign.profileId)
      setCreditBuilderMode('recommended')
      return
    }

    if (isDemoPlan && campaignId !== DEMO_CAMPAIGN_ID) return
    const preset = getSmartCampaignPreset(campaignId, modeId)
    const presetModelUses = getModelUsesFromPreset(preset)
    const selected = getTemplateIdsFromModelUses(presetModelUses)
    const allowed = isDemoPlan ? DEMO_TEMPLATE_IDS : selected.filter(templateId => ACTIVE_CAMPAIGN_TEMPLATE_IDS.has(templateId))
    setSelectedModelUses(isDemoPlan ? getModelUsesFromTemplateIds(DEMO_TEMPLATE_IDS) : presetModelUses)
    setSelectedTemplateIds(allowed)
    setSelectedSmartCampaign(campaignId)
    setCampaignObjective(campaignId)
    setCreditBuilderMode('recommended')
  }

  const selectCampaignMode = (modeId) => {
    setVisualCreditMode(modeId)
    if (selectedSmartCampaign) {
      applySmartCampaign(selectedSmartCampaign, modeId)
    }
  }

  useEffect(() => {
    if (fase !== 'gerando') return
    const iv = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2500)
    return () => clearInterval(iv)
  }, [fase, msgs.length])

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(renderPollRef.current) }, [])

  // Carrega cidades do IBGE quando o estado muda
  useEffect(() => {
    if (!estado) {
      setCidades([])
      setCarregandoCidades(false)
      return
    }
    let abortado = false
    setCarregandoCidades(true)
    setCidade('') // reseta cidade ao trocar UF
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('IBGE ' + r.status)))
      .then(arr => {
        if (abortado) return
        const nomes = Array.isArray(arr) ? arr.map(m => m?.nome).filter(Boolean) : []
        nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'))
        setCidades(nomes)
      })
      .catch(err => {
        if (abortado) return
        console.error('[IBGE] falha ao carregar municípios:', err)
        setCidades([])
      })
      .finally(() => {
        if (!abortado) setCarregandoCidades(false)
      })
    return () => { abortado = true }
  }, [estado])

  const handleFotos = async (files) => {
    const novos = Array.from(files).slice(0, 10 - fotos.length)
    const processadas = await Promise.all(novos.map(async f => ({
      preview: URL.createObjectURL(f),
      ...(await resizeFoto(f)),
    })))
    setFotos(prev => [...prev, ...processadas].slice(0, 10))
  }

  const removerFoto = (idx) => setFotos(prev => prev.filter((_, i) => i !== idx))
  const handleVideo = (files) => {
    const file = Array.from(files || []).find(item => item.type?.startsWith('video/'))
    if (!file) {
      toast.error('Envie um arquivo de vídeo válido.')
      return
    }
    setVideoArquivo({
      file,
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file),
    })
  }
  const removerVideo = () => setVideoArquivo(null)

  const precoParaPayload = normalizePrecoPayload(preco)
  const dadosImovelValidos = tipo && bairro.trim() && cidade.trim() && estado
  const profileWhatsapp = authedUser?.whatsapp || authedUser?.telefone || authedUser?.phone || authedUser?.phone_number || ''
  const isLandProperty = ['Terreno / Lote', 'Loteamento'].includes(tipo)
  const quartosParaPayload = isLandProperty ? 0 : quartos
  const suitesParaPayload = isLandProperty ? 0 : suites
  const vagasParaPayload = isLandProperty ? 0 : vagas
  const podaGerar = categoria && dadosImovelValidos

  const resetCampaignState = (targetStep = 'campaign-choice') => {
    setFase('form'); setCategoria(null); setTipo(''); setFinalidade('Venda')
    setQuartos(2); setBanheiros(1); setSuites(0); setVagas(1); setArea(''); setPreco('')
    setBairro(''); setCidade(''); setEstado(''); setDiferenciais([]); setDifCustom(''); setFotos([]); setVideoArquivo(null)
    setResultado(null); setCampanhaId(null); setIgPostado(false)
    setShowAgendamento(false)
    setRenders(null); setRequestedVisualPieces([]); setGerandoBanners(false); setGenerationNotice(''); setProductFlowStep(targetStep); setCampaignFlowType(null); setSelectedSmartCampaign(null); setActiveCampaignModelId(null); setSelectedModelUses({}); setCampaignObjective('')
    clearInterval(renderPollRef.current)
  }

  const voltarResultadoParaCusto = () => {
    setFase('form')
    setProductFlowStep('cost')
  }

  const confirmarGeracao = () => {
    if (isProductEntry) {
      toast('A geração real deste produto será conectada na próxima fase.')
      return
    }
    if (!dadosImovelValidos) { toast.error('Preencha os campos obrigatórios'); return }
    if (campaignFlowType === 'manual' && !campaignObjective) { toast.error('Escolha o objetivo da campanha.'); return }
    if (!categoria) setCategoria('medio_padrao')
    if (isDemoPlan && demoUsed) {
      toast.error('Sua campanha demonstrativa já foi utilizada. Escolha um plano para continuar.')
      return
    }
    if (isDemoPlan && selectedSmartCampaign && selectedSmartCampaign !== DEMO_CAMPAIGN_ID) {
      toast.error('No plano demonstrativo, somente Venda Rápida está disponível.')
      return
    }
    if (isDemoPlan && !selectedSmartCampaign) {
      applySmartCampaign(DEMO_CAMPAIGN_ID)
    }
    setShowConfirm(true)
  }

  // ══════════════════════════════════════════════════════════
  //  GERAÇÃO — CORRIGIDA
  //  Upload de fotos não trava mais o processo.
  //  Se falhar, continua sem fotos e avisa o usuário.
  // ══════════════════════════════════════════════════════════
  const gerarAnuncios = async () => {
    setShowConfirm(false)
    setFase('gerando')
    setMsgIdx(0)
    setGenerationNotice('')

    try {
      const todosDisferenciais = [
        ...diferenciais,
        ...(difCustom.trim() ? [difCustom.trim()] : []),
      ]

      // Autenticação — APENAS via AuthContext. Zero chamadas a
      // supabase.auth.getSession()/refreshSession() (eles davam timeout).
      // O JWT vem do contexto e é repassado EXPLICITAMENTE no header
      // Authorization de cada invoke — assim o supabase-js não tenta
      // recuperar sessão sozinho.
      if (authLoading) {
        toast.error('Aguarde — carregando sessão...')
        setFase('form')
        return
      }
      const userId = authedUser?.id
      const token = accessToken
      if (!userId || !token) {
        toast.error('Sua sessão expirou. Faça login novamente.')
        setFase('form')
        navigate('/login', { replace: true })
        return
      }
      if (selectedTemplatePayload.length > MAX_VISUAL_PIECES_PER_GENERATION) {
        toast.error(`Para garantir a geração correta, selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} peças por vez neste momento.`)
        setFase('form')
        return
      }

      // ── Upload das fotos: sequencial, timeout 120s por tentativa, retry 1x ──
      // Cada foto tem até 2 tentativas; se ambas falharem/expirarem, segue sem ela.
      // invoke da Edge Function é OBRIGATÓRIO — uploads não podem bloquear o fluxo.
      const uploadComTimeout = (path, blob, contentType, ms = 180000) =>
        Promise.race([
          supabase.storage
            .from('smartcorretor-assets')
            .upload(path, blob, { contentType, upsert: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`upload timeout ${ms}ms`)), ms)),
        ])

      const fotos_urls = []
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i]
        const bin = Uint8Array.from(atob(f.dados), (c) => c.charCodeAt(0))
        const blob = new Blob([bin], { type: f.tipo })
        const path = `${userId}/campaigns/${Date.now()}_${i}.jpg`
        let url = null
        for (let tentativa = 1; tentativa <= 2; tentativa++) {
          try {
            const { error: upErr } = await uploadComTimeout(path, blob, f.tipo)
            if (upErr) {
              console.error(`[upload] foto ${i + 1} tentativa ${tentativa} falhou:`, upErr.message)
              continue
            }
            if (!path.startsWith(`${userId}/`)) {
              console.error(`[upload] foto ${i + 1} caminho invalido`)
              continue
            }
            const { data: signed, error: signedErr } = await supabase.storage
              .from('smartcorretor-assets')
              .createSignedUrl(path, 60 * 60 * 24)
            if (signedErr) {
              console.error(`[upload] foto ${i + 1} assinatura falhou:`, signedErr.message)
              continue
            }
            url = signed.signedUrl
            break
          } catch (uploadErr) {
            console.error(`[upload] foto ${i + 1} tentativa ${tentativa} erro/timeout:`, uploadErr?.message || 'erro desconhecido')
          }
        }
        if (url) fotos_urls.push(url)
      }

      // ── Templates escolhidos pelo usuário (somente os marcados) ──
      // Bloqueia qualquer geração automática de templates não escolhidos.
      const selectedTemplates = selectedTemplatePayload
      const idempotencyKey = createGenerationIdempotencyKey(userId)
      const creditPayload = {
        credit_cost: generationCreditCost,
        generation_mode: generationModeForCredits,
        video_ia_premium: generationHasPremiumVideo,
        idempotency_key: idempotencyKey,
      }
      // ── Disparar gerar-campanha E gerar-banners EM PARALELO (mesmo clique) ──
      // Inputs derivados do formulário para o gerar-banners (não dependem do AI ainda)
      const enderecoCompleto = [bairro, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')
      const tituloPreliminar = `${tipo || 'Imóvel'} ${quartosParaPayload ? quartosParaPayload + 'q ' : ''}em ${bairro || cidade || ''}`.trim()
      const descricaoPreliminar = [
        campaignObjectiveLabel ? `Objetivo da campanha: ${campaignObjectiveLabel}` : '',
        `${tipo || 'Imóvel'} ${categoria ? '(' + categoria + ')' : ''}`,
        isLandProperty ? '' : `${quartosParaPayload} quarto${quartosParaPayload !== 1 ? 's' : ''}, ${banheiros} banheiro${banheiros !== 1 ? 's' : ''}, ${vagasParaPayload} vaga${vagasParaPayload !== 1 ? 's' : ''}`,
        area ? `${area}m²` : '',
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
      ].filter(Boolean).join('. ')

      // Foto do corretor: se o perfil não tem avatar cadastrado, força REMOVER_ELEMENTO
      // (assim o template não renderiza a mulher fictícia padrão).
      const tituloComercial = `${tipo || 'Imóvel'} ${finalidade === 'Venda' ? 'à Venda' : finalidade ? `para ${finalidade}` : 'em destaque'}`.trim()
      const headlineComercial = campaignObjectiveLabel || tituloComercial || `${tipo || 'Imóvel'} em destaque`
      const especificacoesPrincipais = [
        formatQuantityLabel(quartosParaPayload, 'Dormitório'),
        suitesParaPayload > 0 ? formatQuantityLabel(suitesParaPayload, 'Suíte') : '',
        formatQuantityLabel(vagasParaPayload, 'Vaga'),
        area ? `${area}m²` : '',
      ].filter(Boolean).join(', ')
      const descricaoComercial = [
        headlineComercial,
        `${tipo || 'Imóvel'} em ${bairro || cidade || 'destaque'}`,
        especificacoesPrincipais,
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
      ].filter(Boolean).join('. ')

      const avatarPerfil = authedUser?.avatar_url || authedUser?.foto_url || authedUser?.photo_url || ''
      const corretorAvatarUrl = avatarPerfil ? avatarPerfil : 'REMOVER_ELEMENTO'

      // fotos_urls vai EM ORDEM — a primeira é a principal do imóvel, demais são secundárias.
      const fotosOrdenadas = fotos_urls.slice(0, 10)
      const fotoPrincipal = fotosOrdenadas[0] || null

      setGerandoBanners(true)
      setRenders(null)
      setRequestedVisualPieces(selectedTemplates)

      // Só dispara gerar-banners se o usuário escolheu pelo menos 1 template.
      const bannersInvoke = selectedTemplates.length > 0
        ? supabase.functions.invoke('gerar-banners', {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              // campaign_id é opcional agora; vamos linkar depois
              user_id: userId,
              selectedTemplates,
              selected_templates: selectedTemplates,
              pieces: selectedTemplates,
              fotos_urls: fotosOrdenadas,
              foto_principal: fotoPrincipal,
              titulo: tituloComercial,
              descricao: descricaoComercial,
              preco: precoParaPayload,
              suites: suitesParaPayload,
              quartos: quartosParaPayload,
              vagas: vagasParaPayload,
              area: area || null,
              endereco: enderecoCompleto,
              tipo_imovel: tipo,
              corretor_nome: authedUser?.displayName || authedUser?.full_name || authedUser?.nome || authedUser?.email?.split('@')[0] || '',
              corretor_avatar_url: corretorAvatarUrl,
              marca_imovel: authedUser?.imobiliaria || authedUser?.marca || authedUser?.nome_imobiliaria || '',
              ...creditPayload,
            },
          })
        : Promise.resolve({ data: { renders: [], skipped: true }, error: null })

      const [campaignResult, bannersResult] = await Promise.allSettled([
        supabase.functions.invoke('gerar-campanha', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            user_id: userId,
            categoria,
            tipo,
            dados: {
              finalidade, quartos: quartosParaPayload, banheiros, suites: suitesParaPayload, vagas: vagasParaPayload,
              area: area || null, preco: precoParaPayload, bairro, cidade, estado,
              diferenciais: todosDisferenciais,
              telefone_contato: profileWhatsapp,
              formatos_selecionados: selectedModelUses,
              selectedTemplates,
              selected_templates: selectedTemplates,
              pieces: selectedTemplates,
              objetivo_campanha: campaignObjectiveLabel || null,
            },
            fotos_urls: fotosOrdenadas,
            foto_principal: fotoPrincipal,
            redes_sociais: ['instagram_feed', 'instagram_stories', 'whatsapp', 'facebook', 'tiktok'],
          },
        }),
        bannersInvoke,
      ])

      // ── Processar resultado da CAMPANHA (textos) ──
      let campaignData = null
      let partialCampaignWarning = ''
      if (campaignResult.status === 'rejected') {
        const errBody = await readFunctionErrorBody(campaignResult.reason)
        console.error('[gerar-campanha] rejeitado:', campaignResult.reason?.message || 'erro desconhecido')
        if (errBody?.textos) {
          campaignData = { textos: errBody.textos, error: errBody.error }
          partialCampaignWarning = errBody.error || 'Os textos foram gerados, mas a campanha não foi salva automaticamente.'
        } else {
          throw new Error(errBody?.error || campaignResult.reason?.message || 'Erro ao gerar campanha')
        }
      } else {
        const { data, error } = campaignResult.value
        if (error) {
          const errBody = await readFunctionErrorBody(error)
          console.error('[gerar-campanha] erro:', error?.message || 'erro desconhecido')
          if (errBody?.textos) {
            campaignData = { textos: errBody.textos, error: errBody.error }
            partialCampaignWarning = errBody.error || 'Os textos foram gerados, mas a campanha não foi salva automaticamente.'
          } else {
            throw new Error(errBody?.error || error.message || 'Erro desconhecido')
          }
        } else {
          campaignData = data
        }
      }
      if (!campaignData) throw new Error('Resposta vazia da Edge Function (gerar-campanha)')

      const campaignRow = campaignData.campanha || null
      const generatedTexts = campaignRow?.textos_gerados || campaignData.textos || campaignData.textos_gerados || null
      if (!generatedTexts || typeof generatedTexts !== 'object') {
        throw new Error('Textos da campanha não retornados em formato exibível.')
      }

      const camp = {
        ...(campaignRow || {}),
        id: campaignRow?.id || null,
        titulo: campaignRow?.titulo || generatedTexts.titulo_campanha || tituloComercial || 'Campanha gerada',
        textos_gerados: generatedTexts,
        dados_imovel: campaignRow?.dados_imovel || {
          tipo,
          categoria,
          fotos_urls: fotosOrdenadas,
        },
      }

      setResultado(camp)
      setCampanhaId(camp.id || null)
      setIgPostado(false)
      if (partialCampaignWarning) {
        setGenerationNotice(`${partialCampaignWarning} Os textos IA foram preservados abaixo.`)
      }
      if (isDemoPlan && demoStorageKey) {
        localStorage.setItem(demoStorageKey, 'true')
        setDemoUsed(true)
      }
      setFase('resultado')

      // ── Processar resultado dos BANNERS (renders) ──
      if (bannersResult.status === 'fulfilled') {
        const { data: bData, error: bError } = bannersResult.value
        if (bError) {
          const edgeErrorBody = await readFunctionErrorBody(bError)
          console.error('[gerar-banners] erro:', bError?.message || 'erro desconhecido')
          setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
            missingStatus: 'failed',
            missingErrorMessage: BANNER_BATCH_ERROR,
          }))
          setGenerationNotice('Textos IA gerados. Materiais visuais não foram iniciados agora; tente gerar novamente em alguns instantes.')
          toast.error(edgeErrorBody?.error || 'Falha ao gerar banners (textos OK)')
        } else if (bData?.renders?.length) {
          const rs = bData.renders
          const normalizedRenders = mergeRequestedVisualPieces(selectedTemplates, rs, {
            missingStatus: 'failed',
            missingErrorMessage: MISSING_RENDER_ERROR,
            requireProcessingEvidence: true,
          })
          setRenders(normalizedRenders)
          setGenerationNotice('Textos IA gerados. Materiais visuais em preparação.')
          if (bData.warning) toast(bData.warning, { icon: '⚠️' })
          toast.success(`${rs.length} ${rs.length > 1 ? 'materiais em produção' : 'material em produção'}. Processando...`)
          iniciarPollingRenders(rs, camp.id || null, selectedTemplates)
          // Linkar renders à campanha recém-criada (gerar-banners rodou sem campaign_id)
          if (camp.id) {
            supabase
              .from('campaigns')
              .update({ banners: rs })
              .eq('id', camp.id)
              .then(({ error: updErr }) => {
                if (updErr) console.warn('[link banners] falhou:', updErr.message)
              })
          }
        } else {
          console.warn('[gerar-banners] sem renders no retorno')
          setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
            missingStatus: 'failed',
            missingErrorMessage: MISSING_RENDER_ERROR,
          }))
          setGenerationNotice('Textos IA gerados. Nenhum material visual foi retornado ainda.')
        }
      } else {
        const edgeErrorBody = await readFunctionErrorBody(bannersResult.reason)
        console.error('[gerar-banners] rejeitado:', bannersResult.reason?.message || 'erro desconhecido')
        setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
          missingStatus: 'failed',
          missingErrorMessage: BANNER_BATCH_ERROR,
        }))
        setGenerationNotice('Textos IA gerados. Materiais visuais não foram iniciados agora; tente gerar novamente em alguns instantes.')
        toast.error(edgeErrorBody?.error || 'Falha ao gerar banners (textos OK)')
      }

      setGerandoBanners(false)
      setTimeout(() => setShowAgendamento(true), 1800)

    } catch (err) {
      console.error('[gerarAnuncios] erro:', err?.message || 'erro desconhecido')
      toast.error(err.message || 'Erro ao gerar campanha')
      setGerandoBanners(false)
      setFase('form')
    }
  }

  const copiar = async (texto, id) => {
    await navigator.clipboard.writeText(texto)
    setCopiadoId(id); toast.success('Copiado!')
    setTimeout(() => setCopiadoId(null), 2000)
  }
  const abrirWhatsApp = (texto) => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')

  const baixarTudo = () => {
    if (!resultado?.textos_gerados) return
    const REDES = {
      titulo_campanha: ['TÍTULO DA CAMPANHA', null],
      descricao_portal: ['DESCRIÇÃO PARA PORTAL', null],
      post_instagram: ['POST INSTAGRAM', null],
      hashtags: ['HASHTAGS', null],
      script_video_reels: ['SCRIPT VÍDEO / REELS', null],
      carrossel_passo_a_passo: ['CARROSSEL PASSO A PASSO', null],
      mensagem_whatsapp: ['MENSAGEM WHATSAPP', null],
      instagram_feed: ['📸 INSTAGRAM FEED', 'legenda'],
      instagram_stories: ['📱 STORIES', 'texto_principal'],
      whatsapp: ['💬 WHATSAPP', 'mensagem'],
      facebook: ['👍 FACEBOOK', 'texto'],
      tiktok: ['🎵 TIKTOK / REELS', 'roteiro'],
      youtube: ['▶️ YOUTUBE', 'descricao'],
      linkedin: ['💼 LINKEDIN', 'texto'],
    }
    const formatDownloadValue = (key, dados, campo) => {
      const value = campo && dados && typeof dados === 'object'
        ? dados[campo] || Object.values(dados)[0] || ''
        : dados
      if (Array.isArray(value)) {
        return key === 'hashtags'
          ? value.join(' ')
          : value.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
      }
      if (typeof value === 'string') return key === 'hashtags' ? value : removeHashtagsFromText(value)
      if (value == null) return ''
      return JSON.stringify(value, null, 2)
    }
    let txt = `✅ ANÚNCIOS — ${resultado.titulo}\n${catAtual ? `📂 ${catAtual.nome}\n` : ''}${'─'.repeat(50)}\n\n`
    Object.entries(resultado.textos_gerados).forEach(([rede, dados]) => {
      const [label, campo] = REDES[rede] || ['', 'texto']
      const content = formatDownloadValue(rede, dados, campo)
      if (!content) return
      txt += `${label || rede}\n${'─'.repeat(30)}\n${content}\n`
      txt += '\n\n'
    })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })), download: `anuncios-${resultado.titulo?.replace(/\s+/g, '-').toLowerCase() || 'imovel'}.txt` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const postarNoInstagram = async () => {
    toast('Publicação no Instagram chega em breve.', { icon: '🚧' })
  }

  const logFailedRender = (render, source = 'unknown') => {
    const status = normalizeRenderStatus(render?.status)
    const hasFailure = RENDER_ERROR_STATUSES.has(status) || Boolean(render?.erro || render?.error_message)
    if (!hasFailure) return

    const debugPayload = getRenderDebugPayload({ ...render, status })
    const logKey = [
      source,
      debugPayload.render_id || debugPayload.template_id || 'sem-id',
      status,
      debugPayload.erro || debugPayload.error_message || '',
    ].join('|')

    if (failedRenderLogRef.current.has(logKey)) return
    failedRenderLogRef.current.add(logKey)
    console.error('[renders] render falhou:', {
      source,
      ...debugPayload,
    })
  }

  const iniciarPollingRenders = (iniciais, campaignIdForPolling = campanhaId, requestedPieces = requestedVisualPieces) => {
    clearInterval(renderPollRef.current)
    renderPollRef.current = null
    setRenders(mergeRequestedVisualPieces(requestedPieces, iniciais, {
      missingStatus: 'failed',
      missingErrorMessage: MISSING_RENDER_ERROR,
      requireProcessingEvidence: true,
    }))
    ;(Array.isArray(iniciais) ? iniciais : []).forEach(render => logFailedRender(render, 'gerar-banners'))

    const renderIds = (Array.isArray(iniciais) ? iniciais : [])
      .map(render => render?.render_id)
      .filter(Boolean)
    if (!renderIds.length) return

    const token = accessToken
    if (!token) {
      console.warn('[renders] polling nao iniciado: token ausente')
      return
    }

    const startedAt = Date.now()
    const timeoutMs = 3 * 60 * 1000
    let inFlight = false

    const mergeRenderUpdates = (updates = [], timedOut = false) => {
      setRenders(current => {
        const currentList = mergeRequestedVisualPieces(requestedPieces, current, {
          missingStatus: 'failed',
          missingErrorMessage: MISSING_RENDER_ERROR,
          requireProcessingEvidence: true,
        })
        const updatesById = new Map(updates.map(item => [item.render_id, item]))
        const updatesByTemplateId = new Map(updates.map(item => [item.template_id, item]))
        return currentList.map(item => {
          const update = item?.render_id
            ? updatesById.get(item.render_id)
            : updatesByTemplateId.get(item?.template_id)
          const merged = update ? { ...item, ...update } : item
          const status = normalizeRenderStatus(merged.status)
          if (timedOut && !RENDER_FINAL_STATUSES.has(status)) {
            return {
              ...merged,
              status: 'timeout',
              erro: 'Tempo limite de processamento atingido.',
            }
          }
          return { ...merged, status }
        })
      })
    }

    const stopPolling = () => {
      clearInterval(renderPollRef.current)
      renderPollRef.current = null
    }

    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const timedOut = Date.now() - startedAt >= timeoutMs
        if (timedOut) {
          const { data, error } = await supabase.functions.invoke('get-render-status', {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              render_ids: renderIds,
              renders: Array.isArray(iniciais) ? iniciais : [],
              campaign_id: campaignIdForPolling || null,
              mark_timeout: true,
            },
          })
          if (error) {
            console.warn('[renders] timeout get-render-status erro:', error?.message || 'erro desconhecido')
            mergeRenderUpdates([], true)
          } else {
            const updates = Array.isArray(data?.renders) ? data.renders : []
            updates.forEach(render => logFailedRender(render, 'get-render-status-timeout'))
            mergeRenderUpdates(updates, true)
          }
          stopPolling()
          return
        }

        const { data, error } = await supabase.functions.invoke('get-render-status', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            render_ids: renderIds,
            renders: Array.isArray(iniciais) ? iniciais : [],
            campaign_id: campaignIdForPolling || null,
          },
        })

        if (error) {
          console.warn('[renders] get-render-status erro:', error?.message || 'erro desconhecido')
          return
        }

        const updates = Array.isArray(data?.renders) ? data.renders : []
        updates.forEach(render => logFailedRender(render, 'get-render-status'))
        mergeRenderUpdates(updates)

        const updatesById = new Map(updates.map(item => [item.render_id, item]))
        const allDone = renderIds.every(renderId => {
          const update = updatesById.get(renderId)
          return RENDER_FINAL_STATUSES.has(normalizeRenderStatus(update?.status))
        })
        if (allDone) stopPolling()
      } catch (error) {
        console.warn('[renders] polling falhou:', error?.message || 'erro desconhecido')
      } finally {
        inFlight = false
      }
    }

    poll()
    renderPollRef.current = setInterval(poll, 5000)
  }

  const gerarBanners = async () => {
    if (!campanhaId) return toast.error('Campanha não encontrada — gere os textos primeiro')
    if (gerandoBanners) return

    // Token direto do AuthContext (sem getSession/refreshSession).
    const token = accessToken
    if (!token) {
      toast.error('Sua sessão expirou. Faça login novamente.')
      navigate('/login', { replace: true })
      return
    }

    const selectedTemplates = selectedTemplatePayload
    if (selectedTemplates.length === 0) {
      toast.error('Selecione ao menos um banner ou vídeo no formulário')
      return
    }
    if (selectedTemplates.length > MAX_VISUAL_PIECES_PER_GENERATION) {
      toast.error(`Para garantir a geração correta, selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} peças por vez neste momento.`)
      return
    }

    const idempotencyKey = createGenerationIdempotencyKey(authedUser?.id)
    const creditPayload = {
      credit_cost: generationCreditCost,
      generation_mode: generationModeForCredits,
      video_ia_premium: generationHasPremiumVideo,
      idempotency_key: idempotencyKey,
    }

    setGerandoBanners(true)
    setRenders(null)
    setRequestedVisualPieces(selectedTemplates)

    try {
      const fotosBrutas = resultado?.dados_imovel?.fotos_urls
        || resultado?.fotos_urls
        || []
      const fotosOrdenadas = (Array.isArray(fotosBrutas) ? fotosBrutas : []).slice(0, 10)
      const fotoPrincipal = fotosOrdenadas[0] || null

      const enderecoCompleto = [bairro, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')

      const descricaoCurta = resultado?.textos_gerados?.descricao_portal
        || resultado?.textos_gerados?.post_instagram
        || resultado?.textos_gerados?.mensagem_whatsapp
        || ''

      // Sem avatar do corretor → remove o slot pra evitar a mulher fictícia padrão.
      const avatarPerfil = authedUser?.avatar_url || authedUser?.foto_url || authedUser?.photo_url || ''
      const corretorAvatarUrl = avatarPerfil ? avatarPerfil : 'REMOVER_ELEMENTO'

      const { data, error } = await supabase.functions.invoke('gerar-banners', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          campaign_id: campanhaId,
          selectedTemplates,
          selected_templates: selectedTemplates,
          pieces: selectedTemplates,
          fotos_urls: fotosOrdenadas,
          foto_principal: fotoPrincipal,
          titulo: resultado?.titulo || resultado?.textos_gerados?.titulo_campanha || '',
          descricao: descricaoCurta,
          preco: precoParaPayload,
          suites: suitesParaPayload,
          quartos: quartosParaPayload,
          vagas: vagasParaPayload,
          area: area || null,
          endereco: enderecoCompleto,
          tipo_imovel: tipo,
          corretor_nome: authedUser?.displayName || authedUser?.full_name || authedUser?.nome || authedUser?.email?.split('@')[0] || '',
          corretor_avatar_url: corretorAvatarUrl,
          marca_imovel: authedUser?.marca || authedUser?.imobiliaria || authedUser?.nome_imobiliaria || '',
          ...creditPayload,
        },
      })

      if (error) {
        try {
          const errBody = await error.context?.json?.()
          throw new Error(errBody?.error || error.message || 'Falha na Edge Function')
        } catch {
          throw error
        }
      }

      const rs = Array.isArray(data?.renders) ? data.renders : []
      if (rs.length === 0) {
        setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
          missingStatus: 'failed',
          missingErrorMessage: MISSING_RENDER_ERROR,
        }))
        setGenerationNotice('Nenhum material visual foi retornado. As peças solicitadas foram marcadas como falha.')
        throw new Error('Nenhuma peça visual foi enviada para processamento')
      }

      const normalizedRenders = mergeRequestedVisualPieces(selectedTemplates, rs, {
        missingStatus: 'failed',
        missingErrorMessage: MISSING_RENDER_ERROR,
        requireProcessingEvidence: true,
      })
      setRenders(normalizedRenders)
      setGenerationNotice('Materiais visuais em preparação.')
      if (data?.warning) toast(data.warning, { icon: '⚠️' })
      toast.success(`${rs.length} ${rs.length > 1 ? 'materiais em produção' : 'material em produção'}. Processando...`)

      iniciarPollingRenders(rs, campanhaId, selectedTemplates)
    } catch (err) {
      console.error('[gerarBanners] erro:', err?.message || 'erro desconhecido')
      setRenders(current => (Array.isArray(current) && current.length > 0
        ? current
        : mergeRequestedVisualPieces(selectedTemplates, [], {
          missingStatus: 'failed',
          missingErrorMessage: BANNER_BATCH_ERROR,
        })))
      setGenerationNotice('Materiais visuais não foram iniciados agora. As peças solicitadas aparecem como pendentes para nova tentativa.')
      toast.error(err.message || 'Falha ao gerar banners')
    } finally {
      setGerandoBanners(false)
    }
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  if (['form', 'gerando', 'resultado'].includes(fase)) {
    const selectedCampaign = getOfficialSuggestedCampaign(selectedSmartCampaign) || SMART_CAMPAIGNS.find(campaign => campaign.id === selectedSmartCampaign)
    const selectedProductNames = selectedMarketingObjectives.map(item => item.publicName)
    const suggestedCampaignProfiles = SMART_CAMPAIGNS.filter(campaign => (
      !campaign.hidden && OFFICIAL_SUGGESTED_PROFILE_IDS.includes(campaign.id)
    ))
    const suggestedCampaignChannels = Object.values(CAMPAIGN_USE_OPTIONS)
    const canShowSuggestedCampaigns = Boolean(selectedSuggestedProfile && selectedSuggestedChannel)
    const filteredSuggestedCampaigns = canShowSuggestedCampaigns
      ? OFFICIAL_SUGGESTED_CAMPAIGNS.filter(campaign => (
        campaign.profileId === selectedSuggestedProfile
        && campaign.channelIds.includes(selectedSuggestedChannel)
      ))
      : []
    const recommendedSuggestedCampaigns = filteredSuggestedCampaigns.slice(0, 2)
    const otherSuggestedCampaigns = filteredSuggestedCampaigns.slice(2)
    const simpleCost = generationCreditCost
    const simpleBalance = isUnlimitedTestAdmin ? 'Ilimitado' : simulatedCreditBalance
    const simpleStatus = isUnlimitedTestAdmin || simpleCost <= simulatedCreditBalance
      ? 'Saldo suficiente para gerar.'
      : 'Créditos insuficientes para esta geração.'
    const goHome = () => {
      setCampaignFlowType(null)
      navigate('/dashboard')
    }
    const goBackFromProperty = () => {
      if (isProductEntry) {
        navigate(productContext.sourcePath)
        return
      }
      if (campaignFlowType === 'smart') {
        setProductFlowStep('smart-campaigns')
        return
      }
      setProductFlowStep('manual-catalog')
    }
    const goToCampaignChoice = () => {
      setProductFlowStep('campaign-choice')
      setCampaignFlowType(null)
    }
    const startSmartFlow = () => {
      setCampaignFlowType('smart')
      setCreditBuilderMode('recommended')
      setProductFlowStep('smart-campaigns')
    }
    const startManualFlow = () => {
      setCampaignFlowType('manual')
      setCreditBuilderMode('manual')
      setSelectedSmartCampaign(null)
      setActiveCampaignModelId(null)
      setCampaignObjective('')
      setProductFlowStep('manual-catalog')
    }
    const selectSmartCampaignAndContinue = (campaignId) => {
      applySmartCampaign(campaignId)
      setCampaignFlowType('smart')
      setProductFlowStep('property')
    }
    const continueFromManual = () => {
      if (selectedTemplateIds.length === 0) {
        toast.error('Selecione pelo menos um produto de marketing.')
        return
      }
      if (selectedTemplatePayload.length > MAX_VISUAL_PIECES_PER_GENERATION) {
        toast.error(`Para garantir a geração correta, selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} peças por vez neste momento.`)
        return
      }
      setCampaignFlowType('manual')
      setProductFlowStep('property')
    }
    const renderSuggestedCampaignCard = (campaign) => {
      const cardDetails = getCampaignCardDetails(campaign.id, visualCreditMode, isDemoPlan, selectedSuggestedChannel)
      const includedModels = getOfficialSuggestedCampaignModels(campaign)
      const selectedChannel = CAMPAIGN_USE_OPTIONS[selectedSuggestedChannel]
      const channelLabels = campaign.channelIds
        .map(channelId => CAMPAIGN_USE_OPTIONS[channelId]?.label)
        .filter(Boolean)
      const locked = isDemoPlan && campaign.profileId !== DEMO_CAMPAIGN_ID

      return (
        <article key={campaign.id} className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${locked ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">
                {campaign.badge}
              </span>
              <h3 className="mt-3 text-lg font-black text-gray-950">{campaign.title}</h3>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
              {cardDetails.creditCost} créditos
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-gray-500">{campaign.description}</p>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-black text-gray-800">Canais compatíveis</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{channelLabels.join(' · ')}</p>
            {selectedChannel && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-black text-gray-700">
                <span aria-hidden="true">{selectedChannel.icon}</span>
                Selecionado: {selectedChannel.label}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-xs font-black text-gray-800">Modelos incluídos</p>
            <div className="mt-2 space-y-2">
              {includedModels.map(model => (
                <div key={`${campaign.id}-${model.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-xs font-bold text-gray-700">{model.name}</span>
                  <button
                    type="button"
                    onClick={(event) => openPreviewModal(model, event)}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-black text-gray-800 shadow-sm hover:border-amber-300 hover:bg-amber-50"
                  >
                    Ver
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-black text-gray-800">Receba:</p>
            <div className="mt-2 space-y-1">
              {cardDetails.deliverables.map(item => (
                <p key={item.key} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <span>{item.count ? `${item.count} ` : ''}{item.title}</span>
                </p>
              ))}
            </div>
          </div>

          <button type="button" disabled={locked} onClick={() => selectSmartCampaignAndContinue(campaign.id)}
            className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">
            {locked ? 'Disponível nos planos pagos' : 'Escolher campanha'}
          </button>
        </article>
      )
    }
    const continueFromProperty = () => {
      if (!dadosImovelValidos) {
        toast.error('Preencha os campos obrigatórios do imóvel.')
        return
      }
      if (!isProductEntry && campaignFlowType === 'manual' && !campaignObjective) {
        toast.error('Escolha o objetivo da campanha.')
        return
      }
      if (!categoria) setCategoria('medio_padrao')
      setProductFlowStep('photos')
    }
    const continueFromUploads = () => {
      if (productContext.photoRequired && fotos.length === 0) {
        toast.error(isProductEntry ? 'Envie ao menos uma foto para continuar.' : 'Envie ao menos uma foto do imóvel.')
        return
      }
      if (productContext.videoRequired && !videoArquivo) {
        toast.error('Envie o vídeo do imóvel/corretor para continuar.')
        return
      }
      setProductFlowStep('analysis')
    }
    const renderFlowHeader = (eyebrow, title, subtitle) => (
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary-600">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-black text-gray-950">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    )
    const renderProductContextNotice = () => (
      isProductEntry ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <p className="text-sm font-black text-primary-900">Produto selecionado: {productContext.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Este fluxo reutiliza o cadastro único do imóvel. A geração real deste produto ainda não será iniciada aqui.
            </p>
          </div>
        </div>
      ) : null
    )
    const renderBackButton = (onClick, label = 'Voltar') => (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
      >
        {label}
      </button>
    )
    const renderStepActions = (onBack, backLabel = 'Voltar') => (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {renderBackButton(onBack, backLabel)}
        <button
          type="button"
          onClick={goHome}
          className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          Cancelar fluxo
        </button>
      </div>
    )
    const propertyForm = (
      <div className="card p-6 space-y-5">
        <h2 className="text-base font-bold text-gray-900">Dados do imóvel</h2>

        {campaignFlowType === 'smart' && selectedOfficialCampaign && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-800">Campanha sugerida escolhida</p>
            <h3 className="mt-1 text-base font-black text-gray-950">{selectedOfficialCampaign.title}</h3>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-gray-700 sm:grid-cols-2">
              <p><span className="font-black text-gray-900">Perfil:</span> {SMART_CAMPAIGNS.find(campaign => campaign.id === selectedOfficialCampaign.profileId)?.title}</p>
              <p><span className="font-black text-gray-900">Canal escolhido:</span> {CAMPAIGN_USE_OPTIONS[selectedSuggestedChannel]?.label || 'Canal compatível'}</p>
              <p className="sm:col-span-2">
                <span className="font-black text-gray-900">Modelos incluídos:</span>{' '}
                {getOfficialSuggestedCampaignModels(selectedOfficialCampaign).map(model => model.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Objetivo da campanha <span className="text-red-400">*</span>
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {campaignFlowType === 'smart'
                  ? 'Objetivo definido pela campanha escolhida.'
                  : 'Escolha o foco de marketing para adaptar textos, CTA, linguagem e estratégia.'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              Marketing
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SMART_CAMPAIGNS.filter(campaign => !campaign.hidden).map(campaign => {
              const active = campaignFlowType === 'smart'
                ? selectedOfficialCampaign?.profileId === campaign.id
                : campaignObjectiveId === campaign.id
              const disabled = campaignFlowType === 'smart'
              return (
                <button
                  key={campaign.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setCampaignObjective(campaign.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? 'gradient-primary text-white border-transparent shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  } ${disabled ? 'cursor-default opacity-80' : ''}`}
                >
                  {campaign.title}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo <span className="text-red-400">*</span></label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${tipo === t ? 'gradient-primary text-white border-transparent shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Finalidade <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            {['Venda', 'Aluguel', 'Temporada'].map(f => (
              <button key={f} type="button" onClick={() => setFinalidade(f)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all ${finalidade === f ? 'gradient-primary text-white border-transparent shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {!isLandProperty && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Quantidade</label>
            <div className="flex gap-6 flex-wrap">
              <Counter label="Quartos" value={quartos} onChange={setQuartos} />
              <Counter label="Suítes" value={suites} onChange={setSuites} />
              <Counter label="Vagas" value={vagas} onChange={setVagas} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estado <span className="text-red-400">*</span></label>
            <select value={estado} onChange={e => setEstado(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white">
              <option value="">UF</option>
              {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cidade <span className="text-red-400">*</span></label>
            <select value={cidade} onChange={e => setCidade(e.target.value)}
              disabled={!estado || carregandoCidades}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">
                {!estado ? 'Selecione o estado primeiro' : carregandoCidades ? 'Carregando cidades...' : 'Selecione a cidade'}
              </option>
              {cidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bairro <span className="text-red-400">*</span></label>
            <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Moema, Jardins, Copacabana"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Preço (R$) <span className="text-gray-400 font-normal">opcional</span></label>
            <input value={preco} onChange={e => setPreco(e.target.value)} type="number" placeholder="Ex: 1200000 ou deixe em branco"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Área (m²) <span className="text-gray-400 font-normal">opcional</span></label>
            <input value={area} onChange={e => setArea(e.target.value)} type="number" placeholder="Ex: 110"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <label htmlFor="destaques-imovel-novo" className="block text-sm font-bold text-gray-900">
                ✨ O que você deseja destacar neste imóvel?
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Descreva livremente os diferenciais, localização, acabamento, lazer ou qualquer ponto forte. A IA irá organizar e melhorar o texto automaticamente.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700">
              IA organiza
            </span>
          </div>
          <textarea
            id="destaques-imovel-novo"
            value={difCustom}
            onChange={e => setDifCustom(e.target.value)}
            maxLength={500}
            rows={5}
            placeholder="Exemplo: apartamento reformado, vista livre, varanda gourmet, próximo ao metrô, acabamento premium, lazer completo e excelente iluminação natural."
            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-gray-400">
            <span>Escreva do seu jeito. A IA cuida da apresentação.</span>
            <span className={difCustom.length >= 450 ? 'font-bold text-amber-600' : ''}>{difCustom.length}/500</span>
          </div>
        </div>
      </div>
    )
    const formatFileSize = (bytes = 0) => {
      if (!bytes) return '0 MB'
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }
    const photoUpload = (
      <div className="card p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-base font-bold text-gray-900">Arquivos do imóvel</h2>
            <span className="text-xs text-gray-400 font-medium">{fotos.length}/10 fotos</span>
          </div>
          <p className="text-xs text-gray-500">{productContext.uploadHelp}</p>
        </div>

        {productContext.allowVideo && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Vídeo do imóvel/corretor</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {productContext.videoRequired ? 'Obrigatório para Transformar Meu Vídeo.' : 'Opcional neste produto.'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                productContext.videoRequired ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {productContext.videoRequired ? 'Obrigatório' : 'Opcional'}
              </span>
            </div>

            {videoArquivo ? (
              <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100">
                    <Video className="h-5 w-5 text-primary-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{videoArquivo.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(videoArquivo.size)}</p>
                  </div>
                </div>
                <button type="button" onClick={removerVideo}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-white">
                  Remover vídeo
                </button>
              </div>
            ) : (
              <div onClick={() => videoRef.current.click()} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleVideo(e.dataTransfer.files) }}
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 p-5 text-center transition-all hover:border-primary-300 hover:bg-primary-50/30">
                <input ref={videoRef} type="file" accept="video/*" className="hidden"
                  onChange={e => handleVideo(e.target.files)} />
                <Video className="mx-auto mb-2 h-7 w-7 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">Clique ou arraste o vídeo aqui</p>
                <p className="mt-1 text-xs text-gray-400">MP4, MOV ou arquivo de vídeo compatível</p>
              </div>
            )}
          </div>
        )}

        {productContext.allowOptionalPhotos && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Fotos do imóvel</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {productContext.photoRequired
                    ? 'Obrigatórias para este produto.'
                    : 'Opcionais como apoio visual.'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                productContext.photoRequired ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {productContext.photoRequired ? 'Obrigatórias' : 'Opcionais'}
              </span>
            </div>

            {fotos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-3">
                {fotos.map((f, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-600 text-white shadow">
                        Principal
                      </span>
                    )}
                    <button type="button" onClick={() => removerFoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {fotos.length < 10 && (
              <div onClick={() => fileRef.current.click()} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFotos(e.dataTransfer.files) }}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleFotos(e.target.files)} />
                <Camera className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Clique ou arraste as fotos aqui</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG · até 10 fotos · a primeira é a principal</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
    const analysisItems = [
      'Tipo e padrão do imóvel identificados',
      'Localização considerada na estratégia',
      'Diferenciais organizados para a campanha',
      'Fotos serão usadas para personalizar os materiais',
      'Estratégia sugerida conforme objetivo escolhido',
    ]
    const strategyLabel = campaignFlowType === 'smart'
      ? selectedCampaign?.title || 'Campanha Inteligente'
      : campaignObjectiveLabel
        ? `${campaignObjectiveLabel} com ${selectedProductNames.length ? selectedProductNames.join(', ') : 'produtos selecionados'}`
        : selectedProductNames.length ? selectedProductNames.join(', ') : 'Produtos selecionados'

    return (
      <>
      {activePreviewModel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closePreviewModal}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-600">Preview do modelo</p>
                <h3 className="mt-1 text-lg font-black text-gray-950">{activePreviewModel.name}</h3>
              </div>
              <button
                type="button"
                onClick={closePreviewModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                aria-label="Fechar preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-gray-950 p-4">
              {activePreviewModel.previewType === 'video/mp4' && activePreviewModel.previewUrl && !previewVideoFailed ? (
                <video
                  key={activePreviewModel.previewUrl}
                  src={activePreviewModel.previewUrl}
                  poster={activePreviewModel.posterUrl || undefined}
                  controls
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onError={() => setPreviewVideoFailed(true)}
                  className="mx-auto aspect-square max-h-[70vh] w-full max-w-[70vh] rounded-2xl bg-black object-contain"
                />
              ) : activePreviewModel.posterUrl ? (
                <div className="mx-auto max-w-2xl">
                  <img
                    src={activePreviewModel.posterUrl}
                    alt={activePreviewModel.previewAlt}
                    className="mx-auto aspect-square max-h-[70vh] w-full max-w-[70vh] rounded-2xl bg-white object-contain"
                  />
                  <p className="mt-3 text-center text-xs font-semibold text-gray-300">
                    Preview em vídeo em preparação.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-sm font-semibold text-gray-200">
                  Preview em vídeo em preparação.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Confirmar geração</h3>
                <p className="text-xs text-gray-500">Sua campanha completa será gerada em um clique.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Custo desta geração</span>
                <span className="font-black text-gray-900">{simpleCost} créditos</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Saldo disponível</span>
                <span className="font-black text-gray-900">{simpleBalance}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={gerarAnuncios}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-full bg-gray-50">
          <Header title={productContext.headerTitle} subtitle={productContext.headerSubtitle} />
          <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
            {fase === 'form' && productFlowStep === 'campaign-choice' && (<>
              {renderFlowHeader('Gerar Campanha', 'Escolha o subproduto da campanha', 'Use uma campanha por objetivo ou monte sua própria combinação de produtos de marketing.')}
              {renderStepActions(goHome)}
              <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <ol className="grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-5">
                  {['Escolha o caminho', 'Confira os materiais', 'Preencha o imóvel', 'Gere a campanha', 'Receba e divulgue'].map((step, index) => (
                    <li key={step} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-[11px] font-black text-amber-800">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button type="button" onClick={startSmartFlow}
                  className="rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-sm font-black text-amber-800">
                    01
                  </div>
                  <h2 className="mt-5 text-2xl font-black text-gray-950">Campanha por Objetivo</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">Escolha uma sugestão pronta conforme o objetivo de divulgação do imóvel.</p>
                  <span className="mt-6 inline-flex rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white">Escolher objetivo</span>
                </button>
                <button type="button" onClick={startManualFlow}
                  className="rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-sm font-black text-amber-800">
                    02
                  </div>
                  <h2 className="mt-5 text-2xl font-black text-gray-950">Monte Sua Campanha</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">Escolha exatamente quais produtos de marketing deseja gerar.</p>
                  <span className="mt-6 inline-flex rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white">Montar campanha</span>
                </button>
              </div>
            </>)}

            {fase === 'form' && productFlowStep === 'smart-campaigns' && (<>
              {renderFlowHeader('Campanha por Objetivo', 'Escolha uma sugestão pronta', 'Cada card mostra o objetivo, os modelos incluídos e os canais recomendados.')}
              {renderStepActions(goToCampaignChoice)}
              <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <ol className="grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-5">
                  {[
                    'Escolha o perfil',
                    'Escolha onde divulgar',
                    'Escolha a campanha',
                    'Preencha o imóvel',
                    'Gere e receba',
                  ].map((step, index) => (
                    <li key={step} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-[11px] font-black text-amber-800">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mb-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-gray-500">Perfil da divulgação</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestedCampaignProfiles.map(campaign => {
                      const active = selectedSuggestedProfile === campaign.id
                      return (
                        <button
                          key={campaign.id}
                          type="button"
                          onClick={() => setSelectedSuggestedProfile(campaign.id)}
                          className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                            active
                              ? 'border-gray-950 bg-gray-950 text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          {campaign.title}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-gray-500">Onde pretende divulgar</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestedCampaignChannels.map(use => {
                      const active = selectedSuggestedChannel === use.id
                      return (
                        <button
                          key={use.id}
                          type="button"
                          onClick={() => setSelectedSuggestedChannel(use.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                            active
                              ? 'border-gray-950 bg-gray-950 text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          <span aria-hidden="true">{use.icon}</span>
                          <span>{use.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-gray-500">
                  As campanhas sugeridas aparecem depois que você define o perfil e o canal. Cada campanha mostra os modelos oficiais incluídos e permite visualizar o preview antes de escolher.
                </p>
              </div>
              {recommendedSuggestedCampaigns.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-amber-700">Recomendadas para você</p>
                    <h3 className="mt-1 text-base font-black text-gray-950">Melhores opções para esta combinação</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {recommendedSuggestedCampaigns.map(renderSuggestedCampaignCard)}
                  </div>
                </section>
              )}

              {otherSuggestedCampaigns.length > 0 && (
                <section className="mt-5 space-y-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-gray-500">Outras opções compatíveis</p>
                    <h3 className="mt-1 text-base font-black text-gray-950">Campanhas que também atendem ao canal escolhido</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {otherSuggestedCampaigns.map(renderSuggestedCampaignCard)}
                  </div>
                </section>
              )}
              {!canShowSuggestedCampaigns && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500">
                  Escolha primeiro o perfil da divulgação e onde pretende divulgar.
                </div>
              )}
              {canShowSuggestedCampaigns && filteredSuggestedCampaigns.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500">
                  Nenhuma campanha sugerida disponível para esta combinação no momento.
                </div>
              )}
            </>)}

            {fase === 'form' && productFlowStep === 'manual-catalog' && (<>
              {renderFlowHeader('Monte Sua Campanha', 'Escolha os modelos da sua campanha', 'Veja a biblioteca principal e marque onde deseja usar cada modelo.')}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {renderBackButton(goToCampaignChoice)}
                  <button
                    type="button"
                    onClick={goHome}
                    className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    Cancelar fluxo
                  </button>
                </div>
              </div>
              <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <ol className="grid gap-2 text-xs font-bold text-gray-600 sm:grid-cols-5">
                  {[
                    'Escolha os modelos',
                    'Marque os usos desejados',
                    'Preencha os dados do imóvel',
                    'Gere seus materiais',
                    'Receba e divulgue seus produtos',
                  ].map((step, index) => (
                    <li key={step} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-[11px] font-black text-amber-800">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-primary-600">Biblioteca de modelos</p>
                      <h2 className="mt-1 text-lg font-black text-gray-950">Modelos principais disponíveis</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Use os ícones para escolher onde cada modelo será usado. O sistema cuida dos formatos internamente.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-700">
                        {selectedModelCount} modelo{selectedModelCount === 1 ? '' : 's'} selecionado{selectedModelCount === 1 ? '' : 's'}
                      </span>
                      {selectedCatalogItems.length > 0 && (
                        <button type="button" onClick={() => applySelectedModelUses({})}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">
                          Limpar seleção
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-500">Legenda dos usos</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.values(CAMPAIGN_USE_OPTIONS).map(use => (
                        <span
                          key={use.id}
                          title={use.label}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm"
                        >
                          <span className="text-base leading-none">{use.icon}</span>
                          <span>{use.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {CAMPAIGN_MODEL_LIBRARY.map(model => {
                      const modelCredit = getModelCreditWeight(model.id)
                      const creditLabel = `${modelCredit} créditos por peça`
                      const useIds = selectedModelUses[model.id] || []
                      const selected = useIds.length > 0
                      return (
                        <article key={model.id}
                          className={`flex h-full flex-col rounded-2xl border p-4 transition-all ${
                            selected
                              ? 'border-primary-400 bg-primary-50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-sm'
                          }`}>
                          <div className="text-left">
                            <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
                              <img
                                src={model.posterUrl || model.previewUrl}
                                alt={model.previewAlt}
                                className="aspect-square w-full object-cover"
                                loading="lazy"
                              />
                            </div>

                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-sm font-black text-gray-950">{model.name}</h3>
                                <p className="mt-1 overflow-hidden text-xs leading-relaxed text-gray-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{model.description}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => openPreviewModal(model, event)}
                                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-black text-gray-800 shadow-sm hover:border-amber-300 hover:bg-amber-50 hover:text-gray-950"
                                >
                                  {model.previewLabel || 'Ver'}
                                </button>
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                  selected ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-white'
                                }`}>
                                  {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                {creditLabel}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Marque onde deseja usar</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {model.compatibleUses.map(useId => {
                                const use = CAMPAIGN_USE_OPTIONS[useId]
                                const checked = useIds.includes(useId)
                                const blockedByLimit = !checked && selectedTemplatePayload.length >= MAX_VISUAL_PIECES_PER_GENERATION
                                return (
                                  <button
                                    key={`${model.id}-${useId}-${model.useTemplates?.[useId]}`}
                                    type="button"
                                    title={blockedByLimit ? `Limite de ${MAX_VISUAL_PIECES_PER_GENERATION} peças atingido` : use.label}
                                    aria-label={`${checked ? 'Remover' : 'Selecionar'} ${use.label} para ${model.name}`}
                                    onClick={() => toggleCampaignModelUse(model.id, useId)}
                                    className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border text-xl shadow-sm transition-all ${
                                      checked
                                        ? 'border-primary-500 bg-primary-600 text-white shadow-primary-100 ring-2 ring-primary-100'
                                        : blockedByLimit
                                          ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                                          : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
                                    }`}
                                  >
                                    <span aria-hidden="true">{use.icon}</span>
                                    {checked && (
                                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
                <aside className="lg:sticky lg:top-6 lg:self-start">
                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-wide text-primary-600">Resumo da campanha</p>
                    <h3 className="mt-1 text-lg font-black text-gray-950">Selecionados</h3>

                    {selectedModelSummaries.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {selectedModelSummaries.map(model => (
                          <div key={model.id} className="rounded-2xl bg-gray-50 px-3 py-3">
                            <p className="text-sm font-black text-gray-900">{model.name}</p>
                            <div className="mt-2 space-y-1.5">
                              {model.selectedUses.map(use => (
                                <div key={`${model.id}-${use.id}-${model.useTemplates?.[use.id]}`} className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                                  <span>{use.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-500">
                        Escolha pelo menos um modelo e marque onde deseja usá-lo.
                      </p>
                    )}

                    <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-primary-900">Modelos</span>
                        <span className="text-sm font-black text-primary-900">{selectedModelCount}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-primary-900">Peças selecionadas</span>
                        <span className="text-sm font-black text-primary-900">{selectedUseCount}</span>
                      </div>
                      <div className="mt-3 border-t border-primary-100 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-primary-900">Total</span>
                          <span className="text-sm font-black text-primary-900">{estimatedCreditConsumption} créditos</span>
                        </div>
                      </div>
                    </div>

                    {selectedCatalogItems.length >= MAX_VISUAL_PIECES_PER_GENERATION - 1 && (
                      <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-900">
                        Você pode gerar até {MAX_VISUAL_PIECES_PER_GENERATION} peças por vez. Depois de receber os resultados, poderá gerar mais materiais para este mesmo imóvel.
                      </p>
                    )}

                    {selectedCatalogItems.length > 0 && (
                      <button type="button" onClick={() => applySelectedModelUses({})}
                        className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-600 hover:bg-gray-50">
                        Limpar seleção
                      </button>
                    )}

                    <button type="button" onClick={continueFromManual} disabled={selectedCatalogItems.length === 0}
                      className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-black transition-colors ${
                        selectedCatalogItems.length > 0
                          ? 'bg-gray-950 text-white hover:bg-gray-800'
                          : 'cursor-not-allowed bg-gray-100 text-gray-400'
                      }`}>
                      Continuar
                    </button>
                  </div>
                </aside>
              </div>
            </>)}

            {fase === 'form' && productFlowStep === 'property' && (<>
              {renderFlowHeader(productContext.propertyEyebrow, productContext.propertyTitle, productContext.propertySubtitle)}
              {renderStepActions(goBackFromProperty)}
              {renderProductContextNotice()}
              {propertyForm}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={continueFromProperty}
                  className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800"
                >
                  Continuar
                </button>
              </div>
            </>)}

            {fase === 'form' && productFlowStep === 'photos' && (<>
              {renderFlowHeader(productContext.uploadEyebrow, productContext.uploadTitle, productContext.photosSubtitle)}
              {renderStepActions(() => setProductFlowStep('property'))}
              {photoUpload}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={continueFromUploads}
                  className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800"
                >
                  Continuar
                </button>
              </div>
            </>)}

            {fase === 'form' && productFlowStep === 'analysis' && (<>
              {renderFlowHeader(productContext.reviewTitle, 'Confirmar materiais da campanha', productContext.reviewSubtitle)}
              {renderStepActions(() => setProductFlowStep('photos'))}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">Resumo antes de gerar</p>
                  <h2 className="mt-1 text-xl font-black text-gray-950">{strategyLabel}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {analysisItems.map(item => (
                      <div key={item} className="flex items-start gap-2 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  {!profileWhatsapp && (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                      WhatsApp não encontrado no perfil. Complete seu perfil para incluir seu contato automaticamente nos materiais.
                    </div>
                  )}
                </section>

                <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm lg:self-start">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-500">Confirmação</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-600">Peças incluídas</span>
                      <span className="font-black text-gray-950">{selectedCatalogItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-600">Créditos estimados</span>
                      <span className="font-black text-gray-950">{simpleCost}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                      <span className="font-semibold text-gray-600">Saldo após gerar</span>
                      <span className="font-black text-gray-950">{isUnlimitedTestAdmin ? 'Ilimitado' : balanceAfterGeneration}</span>
                    </div>
                  </div>
                  {isDemoPlan && demoUsed && (
                    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                      Sua campanha demonstrativa já foi utilizada.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={confirmarGeracao}
                    disabled={!podaGerar || (isDemoPlan && demoUsed)}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-colors ${
                      podaGerar && !(isDemoPlan && demoUsed)
                        ? 'bg-gray-950 text-white hover:bg-gray-800'
                        : 'cursor-not-allowed bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Gerar campanha
                  </button>
                </aside>
              </div>
            </>)}

        {fase === 'gerando' && (
          <div className="card p-14 text-center animate-fade-in">
            <div className={`w-24 h-24 bg-gradient-to-br ${catAtual?.cor || 'from-primary-500 to-primary-400'} rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-2xl`}>
              <span className="text-5xl">{catAtual?.icon || '✨'}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Criando sua campanha...</h2>
            <p className="text-primary-600 font-semibold text-lg min-h-[28px]" key={msgIdx}>{msgs[msgIdx]}</p>
            <p className="text-gray-400 text-sm mt-3">A IA está pesquisando o bairro e criando textos personalizados</p>
            <div className="mt-8 flex justify-center gap-2">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>
        )}

        {fase === 'resultado' && resultado && (() => {
          const tg = resultado.textos_gerados || {}
          const grad = catAtual?.cor || 'from-primary-500 to-primary-400'
          const returnedVisualPieces = Array.isArray(renders) ? renders : []
          const visualPieces = requestedVisualPieces.length
            ? mergeRequestedVisualPieces(requestedVisualPieces, returnedVisualPieces, {
                missingStatus: 'failed',
                missingErrorMessage: MISSING_RENDER_ERROR,
                requireProcessingEvidence: true,
              })
            : returnedVisualPieces
          const visualPiecesReady = visualPieces.filter(r => RENDER_READY_STATUSES.has(normalizeRenderStatus(r.status))).length
          const visualPiecesFailed = visualPieces.filter(r => RENDER_ERROR_STATUSES.has(normalizeRenderStatus(r.status)) || !!r.erro).length
          const visualPiecesPending = visualPieces.filter(r => {
            const status = normalizeRenderStatus(r.status)
            const failed = RENDER_ERROR_STATUSES.has(status) || !!r.erro
            return !failed && (status === 'pending' || r.missing_from_response)
          }).length
          const visualPiecesProcessing = Math.max(visualPieces.length - visualPiecesReady - visualPiecesFailed - visualPiecesPending, 0)
          const getCreditAmount = (render) => {
            const value = Number(render?.credit_amount || 0)
            return Number.isFinite(value) ? Math.max(0, value) : 0
          }
          const hasConfirmedCreditAccounting = visualPieces.some(r => (
            (r.credit_status === 'consumed' || r.credit_status === 'cancelled') && getCreditAmount(r) > 0
          ))
          const visualCreditsConsumed = visualPieces
            .filter(r => r.credit_status === 'consumed')
            .reduce((sum, render) => sum + getCreditAmount(render), 0)
          const visualCreditsRefunded = visualPieces
            .filter(r => r.credit_status === 'cancelled')
            .reduce((sum, render) => sum + getCreditAmount(render), 0)

          const textosEdge = [
            { key: 'titulo_campanha',         icon: '🏷️', titulo: 'Título da Campanha' },
            { key: 'descricao_portal',        icon: '🏠', titulo: 'Descrição para Portal' },
            { key: 'post_instagram',          icon: '📸', titulo: 'Post Instagram' },
            { key: 'hashtags',                icon: '#', titulo: 'Hashtags' },
            { key: 'script_video_reels',      icon: '🎬', titulo: 'Script Vídeo / Reels' },
            { key: 'carrossel_passo_a_passo', icon: '🎠', titulo: 'Carrossel Passo a Passo' },
            { key: 'mensagem_whatsapp',       icon: '💬', titulo: 'Mensagem WhatsApp' },
          ]
          const getTextoEdge = (k) => {
            const v = resultado[k] ?? tg[k]
            if (v == null) return ''
            if (Array.isArray(v)) {
              return k === 'hashtags'
                ? v.join(' ')
                : v
                  .map((item) => `📍 ${typeof item === 'string' ? item : JSON.stringify(item)}`)
                  .join('\n')
            }
            return typeof v === 'string'
              ? (k === 'hashtags' ? v : removeHashtagsFromText(v))
              : JSON.stringify(v, null, 2)
          }

          return (
            <div className="space-y-6">

              {isDemoPlan && (
                <AnimatedCard delay={0}>
                  <div className="card p-5 border-primary-200 bg-primary-50">
                    <h2 className="text-lg font-extrabold text-gray-900">Campanha demonstrativa concluída.</h2>
                    <p className="text-sm text-gray-600 mt-1">Escolha um plano para continuar gerando campanhas completas.</p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {['START', 'PRO', 'ELITE'].map(plan => (
                        <a key={plan} href="/planos" className="rounded-xl bg-gray-950 text-white text-sm font-bold px-4 py-2.5 text-center hover:bg-gray-800 transition-colors">
                          Assinar {plan}
                        </a>
                      ))}
                    </div>
                  </div>
                </AnimatedCard>
              )}

              <AnimatedCard delay={0}>
                <div className="card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-gray-900 text-xl">Campanha pronta! 🎉</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-gray-500">{resultado.titulo}</p>
                          {catAtual && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${catAtual.badge}`}>{catAtual.icon} {catAtual.nome}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <button
                      type="button"
                      onClick={voltarResultadoParaCusto}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => resetCampaignState('campaign-choice')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
                    >
                      <Plus className="w-4 h-4" />
                      Criar nova campanha
                    </button>
                    <button
                      type="button"
                      onClick={() => resetCampaignState('campaign-choice')}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Voltar para Home
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/pacotes-gerados')}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Ver campanhas geradas
                    </button>
                    <button onClick={baixarTudo}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Download className="w-4 h-4" />
                      Baixar tudo
                    </button>
                  </div>
                </div>
              </AnimatedCard>

              {generationNotice && (
                <AnimatedCard delay={80}>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-900">
                    {generationNotice}
                  </div>
                </AnimatedCard>
              )}

              {textosEdge.map((item, idx) => {
                const conteudo = getTextoEdge(item.key)
                if (!conteudo) return null
                const copyId = `edge_${item.key}`
                return (
                  <AnimatedCard key={item.key} delay={100 + idx * 100}>
                    <div className="card p-5">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{item.icon}</span>
                          <h3 className="font-bold text-gray-900 text-lg">{item.titulo}</h3>
                        </div>
                        <button onClick={() => copiar(conteudo, copyId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === copyId ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                        {conteudo}
                      </div>
                    </div>
                  </AnimatedCard>
                )
              })}

              {tg.instagram_feed && (
                <AnimatedCard delay={300}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">📸</span><h3 className="font-bold text-gray-900 text-lg">Instagram Feed</h3></div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => copiar(removeHashtagsFromText([tg.instagram_feed.legenda, tg.instagram_feed.cta ? `👉 ${tg.instagram_feed.cta}` : ''].filter(Boolean).join('\n\n')), 'ig_feed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'ig_feed' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => abrirWhatsApp(removeHashtagsFromText(tg.instagram_feed.legenda || ''))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                        </button>
                      </div>
                    </div>
                    <InstagramFeedCard dados={tg.instagram_feed} gradiente={grad} />
                    <SuggestedHashtagsBlock
                      tags={getSuggestedHashtags(tg.instagram_feed.hashtags, tg.instagram_feed.legenda)}
                      copyId="ig_feed_hashtags"
                      copiedId={copiadoId}
                      onCopy={copiar}
                    />
                  </div>
                </AnimatedCard>
              )}

              {tg.instagram_stories && (
                <AnimatedCard delay={600}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">📱</span><h3 className="font-bold text-gray-900 text-lg">Instagram Stories</h3></div>
                      <button onClick={() => copiar(removeHashtagsFromText([tg.instagram_stories.texto_principal, tg.instagram_stories.cta].filter(Boolean).join('\n\n')), 'stories')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        {copiadoId === 'stories' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                      </button>
                    </div>
                    <StoriesCard dados={tg.instagram_stories} gradiente={grad} />
                    <SuggestedHashtagsBlock
                      tags={getSuggestedHashtags(tg.instagram_stories.hashtags, tg.instagram_stories.texto_principal)}
                      copyId="stories_hashtags"
                      copiedId={copiadoId}
                      onCopy={copiar}
                    />
                  </div>
                </AnimatedCard>
              )}

              {tg.whatsapp && (
                <AnimatedCard delay={900}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">💬</span><h3 className="font-bold text-gray-900 text-lg">WhatsApp</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => copiar(removeHashtagsFromText(tg.whatsapp.mensagem), 'wa')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'wa' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => abrirWhatsApp(removeHashtagsFromText(tg.whatsapp.mensagem))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />Enviar agora
                        </button>
                      </div>
                    </div>
                    <WhatsAppCard dados={tg.whatsapp} />
                  </div>
                </AnimatedCard>
              )}

              {tg.facebook && (
                <AnimatedCard delay={1200}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">👍</span><h3 className="font-bold text-gray-900 text-lg">Facebook</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => copiar(removeHashtagsFromText([tg.facebook.texto, tg.facebook.cta ? `👉 ${tg.facebook.cta}` : ''].filter(Boolean).join('\n\n')), 'fb')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'fb' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => abrirWhatsApp(removeHashtagsFromText([tg.facebook.texto, tg.facebook.cta].filter(Boolean).join('\n\n')))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                        </button>
                      </div>
                    </div>
                    <FacebookCard dados={tg.facebook} />
                    <SuggestedHashtagsBlock
                      tags={getSuggestedHashtags(tg.facebook.hashtags, tg.facebook.texto)}
                      copyId="facebook_hashtags"
                      copiedId={copiadoId}
                      onCopy={copiar}
                    />
                  </div>
                </AnimatedCard>
              )}

              {tg.tiktok && (
                <AnimatedCard delay={1500}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">🎵</span><h3 className="font-bold text-gray-900 text-lg">TikTok / Reels</h3><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">▶ Automático</span></div>
                      <button onClick={() => copiar(removeHashtagsFromText(tg.tiktok.roteiro || ''), 'tiktok')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        {copiadoId === 'tiktok' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar roteiro</>}
                      </button>
                    </div>
                    <TikTokPlayer roteiro={removeHashtagsFromText(tg.tiktok.roteiro)} />
                    <SuggestedHashtagsBlock
                      tags={getSuggestedHashtags(tg.tiktok.hashtags, tg.tiktok.roteiro)}
                      copyId="tiktok_hashtags"
                      copiedId={copiadoId}
                      onCopy={copiar}
                    />
                  </div>
                </AnimatedCard>
              )}

              {visualPieces.length > 0 && (
                <AnimatedCard delay={2700}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🖼️</span>
                        <h3 className="font-bold text-gray-900 text-lg">Peças visuais geradas</h3>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-bold">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">{visualPieces.length} solicitadas</span>
                        <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">{visualPiecesReady} prontas</span>
                        {visualPiecesProcessing > 0 && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">{visualPiecesProcessing} processando</span>}
                        {visualPiecesPending > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{visualPiecesPending} pendentes</span>}
                        {visualPiecesFailed > 0 && <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">{visualPiecesFailed} falharam</span>}
                      </div>
                    </div>
                    <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                      <p className="text-sm font-black text-primary-900">Resumo da geração</p>
                      <div className={`mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 ${hasConfirmedCreditAccounting ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Peças solicitadas</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualPieces.length}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Peças prontas</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualPiecesReady}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Em processamento</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualPiecesPending + visualPiecesProcessing}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Peças com falha</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualPiecesFailed}</p>
                        </div>
                        {hasConfirmedCreditAccounting && (
                          <>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Créditos consumidos</p>
                              <p className="mt-1 text-xl font-black text-gray-950">{visualCreditsConsumed}</p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Créditos devolvidos</p>
                              <p className="mt-1 text-xl font-black text-gray-950">{visualCreditsRefunded}</p>
                            </div>
                          </>
                        )}
                      </div>
                      <p className="mt-3 text-xs font-bold text-primary-800">
                        Você só paga pelas peças geradas com sucesso.
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {visualPieces.map((r, i) => {
                        const status = normalizeRenderStatus(r.status)
                        const ok = RENDER_READY_STATUSES.has(status)
                        const falhou = RENDER_ERROR_STATUSES.has(status) || !!r.erro
                        const ehVideo = r.url && /\.(mp4|webm|mov)$/i.test(r.url)
                        const nomePeca = r.template_nome && !/template|creatomate|uuid/i.test(r.template_nome)
                          ? r.template_nome
                          : 'Peça visual'
                        return (
                          <div key={r.piece_id || r.render_id || `${r.model_id || r.template_id || 'render'}-${r.use_id || 'uso'}-${r.template_id || i}-${i}`} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white">
                            <div className="p-3 pb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-gray-700 truncate">{nomePeca}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                ok ? 'bg-green-100 text-green-700'
                                  : falhou ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {getRenderStatusLabel(status)}
                              </span>
                            </div>
                            <div className="bg-gray-100 aspect-video flex items-center justify-center overflow-hidden">
                              {ok && ehVideo ? (
                                <video src={r.url} controls className="w-full h-full object-contain bg-black" />
                              ) : ok && r.url ? (
                                <img src={r.snapshot_url || r.url} alt={nomePeca} draggable="false" onContextMenu={e => e.preventDefault()} className="w-full h-full object-contain pointer-events-none select-none" />
                              ) : r.snapshot_url ? (
                                <img src={r.snapshot_url} alt={nomePeca} draggable="false" onContextMenu={e => e.preventDefault()} className="w-full h-full object-contain opacity-70 pointer-events-none select-none" />
                              ) : (
                                <div className="text-xs text-gray-500 px-3 py-6 text-center">
                                  {falhou ? (r.erro || 'Falhou') : 'Processando...'}
                                </div>
                              )}
                            </div>
                            <div className="p-3 pt-2">
                              {ok && r.url ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                                    className="block text-xs font-bold text-center py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                    Visualizar
                                  </a>
                                  <a href={r.url} download target="_blank" rel="noopener noreferrer"
                                    className="block text-xs font-bold text-center py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                    <Download className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                                    Baixar
                                  </a>
                                </div>
                              ) : (
                                <div className="text-[11px] text-gray-400 text-center py-2">
                                  {falhou ? 'arquivo indisponível' : normalizeRenderStatus(r.status) === 'pending' ? 'aguardando retorno' : 'aguardando…'}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </AnimatedCard>
              )}

              <AnimatedCard delay={3000}>
                <div className="card p-5 text-center">
                  <p className="text-gray-500 text-sm mb-4">Quer criar campanha para outro imóvel?</p>
                  <button
                    onClick={() => resetCampaignState('campaign-choice')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" />
                    Criar campanha para outro imóvel
                  </button>
                </div>
              </AnimatedCard>

            </div>
          )
        })()}

        {fase === 'resultado' && !resultado && (
          <div className="card p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 className="text-lg font-black text-gray-950">Não foi possível mostrar o resultado agora.</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  A geração foi iniciada, mas o retorno da campanha não chegou em um formato exibível. Seus dados foram preservados para tentar novamente.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFase('form')}
                    className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white hover:bg-gray-800"
                  >
                    Voltar e tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => resetCampaignState('campaign-choice')}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Criar nova campanha
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </main>
        </div>
      </>
    )
  }
}
