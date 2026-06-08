import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, MessageCircle, Copy, Download, CheckCircle2, Plus, Camera, X, Send, AlertCircle, Zap, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import CreditSummary from '../components/CreditSummary'
import MarketingObjectiveCatalog from '../components/MarketingObjectiveCatalog'
import { CAMPAIGN_MODES, CAMPAIGN_MODE_ORDER } from '../data/campaignModes'
import { CAMPAIGN_TEMPLATES } from '../data/campaignTemplates'
import { TEMPLATE_CATALOG } from '../data/templateCatalog'
import { MARKETING_OBJECTIVES, SMART_CAMPAIGN_OBJECTIVES, getSelectedTemplatesFromObjectiveIds } from '../data/marketingObjectives'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DADOS ESTÃTICOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const CATEGORIAS = [
  { id: 'alto_padrao',    nome: 'Alto PadrÃ£o',   icon: 'ðŸ’Ž', cor: 'from-amber-500 to-yellow-400',   ring: 'ring-amber-400',   badge: 'bg-amber-100 text-amber-800',   desc: 'Luxo e exclusividade' },
  { id: 'medio_padrao',   nome: 'MÃ©dio PadrÃ£o',  icon: 'ðŸ ', cor: 'from-blue-500 to-blue-400',      ring: 'ring-blue-400',    badge: 'bg-blue-100 text-blue-800',     desc: 'Custo-benefÃ­cio' },
  { id: 'popular_mcmv',   nome: 'Popular/MCMV',  icon: 'ðŸ¤', cor: 'from-green-500 to-emerald-400',  ring: 'ring-green-400',   badge: 'bg-green-100 text-green-800',   desc: 'Casa prÃ³pria' },
  { id: 'lancamento',     nome: 'LanÃ§amento',    icon: 'ðŸš€', cor: 'from-purple-500 to-violet-400',  ring: 'ring-purple-400',  badge: 'bg-purple-100 text-purple-800', desc: 'Na planta' },
  { id: 'em_construcao',  nome: 'Em ConstruÃ§Ã£o', icon: 'ðŸ—ï¸', cor: 'from-orange-500 to-amber-400',  ring: 'ring-orange-400',  badge: 'bg-orange-100 text-orange-800', desc: 'Em obra' },
]

const TIPOS = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado', 'Outro']

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const PRODUCT_CONTEXTS = {
  hero: {
    label: 'Hero IA',
    sourcePath: '/hero',
    headerTitle: 'Cadastro padrÃ£o do imÃ³vel',
    headerSubtitle: 'O contexto do Hero IA serÃ¡ preservado neste fluxo.',
    propertyEyebrow: 'Hero IA',
    propertyTitle: 'Cadastro padrÃ£o do imÃ³vel',
    propertySubtitle: 'Use os mesmos dados oficiais do SmartCorretorAI. Nenhum cadastro paralelo serÃ¡ criado.',
    uploadEyebrow: 'Upload do Hero IA',
    uploadTitle: 'Envie as fotos do imÃ³vel',
    photosSubtitle: 'As fotos serÃ£o usadas como base visual do Hero IA.',
    uploadHelp: 'Fotos obrigatÃ³rias para gerar materiais Hero IA. VÃ­deo Ã© opcional nesta etapa.',
    photoRequired: true,
    videoRequired: false,
    allowOptionalPhotos: true,
    allowVideo: true,
    reviewTitle: 'RevisÃ£o do Hero IA',
    reviewSubtitle: 'Confira o imÃ³vel e as fotos antes da etapa de geraÃ§Ã£o do Hero IA.',
    costTitle: 'Hero IA preparado',
    costSubtitle: 'O cadastro Ãºnico foi preservado. A geraÃ§Ã£o real do Hero IA serÃ¡ conectada na prÃ³xima fase.',
    nextLabel: 'GeraÃ§Ã£o do Hero IA em preparaÃ§Ã£o',
  },
  transformar_video: {
    label: 'Transformar Meu VÃ­deo',
    sourcePath: '/transformar-video',
    headerTitle: 'Cadastro padrÃ£o do imÃ³vel',
    headerSubtitle: 'O contexto do Transformar Meu VÃ­deo serÃ¡ preservado neste fluxo.',
    propertyEyebrow: 'Transformar Meu VÃ­deo',
    propertyTitle: 'Cadastro padrÃ£o do imÃ³vel',
    propertySubtitle: 'Use os mesmos dados oficiais do SmartCorretorAI. O vÃ­deo serÃ¡ obrigatÃ³rio apenas neste produto.',
    uploadEyebrow: 'Upload do Transformar Meu VÃ­deo',
    uploadTitle: 'Envie seu vÃ­deo',
    photosSubtitle: 'Fotos podem apoiar o material. O envio de vÃ­deo serÃ¡ obrigatÃ³rio para este produto na etapa final.',
    uploadHelp: 'VÃ­deo obrigatÃ³rio para Transformar Meu VÃ­deo. Fotos sÃ£o opcionais como apoio visual.',
    photoRequired: false,
    videoRequired: true,
    allowOptionalPhotos: true,
    allowVideo: true,
    reviewTitle: 'RevisÃ£o do Transformar Meu VÃ­deo',
    reviewSubtitle: 'Confira o imÃ³vel e os arquivos antes da etapa de transformaÃ§Ã£o do vÃ­deo.',
    costTitle: 'Transformar Meu VÃ­deo preparado',
    costSubtitle: 'O cadastro Ãºnico foi preservado. A geraÃ§Ã£o real de vÃ­deo serÃ¡ conectada na prÃ³xima fase.',
    nextLabel: 'GeraÃ§Ã£o do vÃ­deo em preparaÃ§Ã£o',
  },
  campanha_completa: {
    label: 'Gerar Campanha',
    headerTitle: 'Gerar Campanhas Profissionais',
    headerSubtitle: 'Escolha, informe os dados e gere tudo em um clique',
    propertyEyebrow: 'Dados do imÃ³vel',
    propertyTitle: 'Informe o imÃ³vel',
    propertySubtitle: 'Esses dados ajudam a IA a criar uma campanha mais Ãºtil e persuasiva.',
    uploadEyebrow: 'Fotos do imÃ³vel',
    uploadTitle: 'Envie as fotos',
    photosSubtitle: 'As imagens ajudam a personalizar os materiais da campanha.',
    uploadHelp: 'Fotos obrigatÃ³rias para a Campanha Completa.',
    photoRequired: true,
    videoRequired: false,
    allowOptionalPhotos: true,
    allowVideo: false,
    reviewTitle: 'AnÃ¡lise Inteligente do ImÃ³vel',
    reviewSubtitle: 'Esta leitura Ã© visual e local nesta etapa, sem nova chamada de backend.',
    costTitle: 'Revise e gere em um clique',
    costSubtitle: 'O servidor continua validando o consumo real de crÃ©ditos.',
  },
}

const SUBPRODUCT_LABELS = {
  hero_completo: 'Hero Completo',
  pecas_individuais: 'PeÃ§as Individuais',
  video_rapido: 'VÃ­deo RÃ¡pido',
  video_premium_cinematografico: 'VÃ­deo Premium/CinematogrÃ¡fico',
  campanha_por_objetivo: 'Campanha por Objetivo',
  monte_sua_campanha: 'Monte Sua Campanha',
}

const MSGS_POR_CAT = {
  alto_padrao:   ['Analisando o perfil de luxo...', 'Criando texto sofisticado...', 'Elaborando roteiro cinematogrÃ¡fico...', 'Refinando detalhes exclusivos...'],
  medio_padrao:  ['Analisando os pontos fortes...', 'Criando texto para Instagram...', 'Preparando mensagem de WhatsApp...', 'Quase pronto...'],
  popular_mcmv:  ['Pensando no sonho da casa prÃ³pria...', 'Criando texto acolhedor...', 'Destacando FGTS e financiamento...', 'Finalizando...'],
  lancamento:    ['Analisando o potencial do lanÃ§amento...', 'Criando texto de urgÃªncia...', 'Elaborando estratÃ©gia de prÃ©-venda...', 'Quase lÃ¡...'],
  em_construcao: ['Analisando o progresso da obra...', 'Criando conteÃºdo transparente...', 'Mostrando valorizaÃ§Ã£o...', 'Finalizando...'],
}

const TEXT_FORMATS_FIXOS = [
  { nome: 'Instagram',           desc: 'Legenda para redes' },
  { nome: 'WhatsApp',            desc: 'Mensagem completa' },
  { nome: 'Facebook',            desc: 'Texto do post' },
  { nome: 'TikTok',              desc: 'Roteiro cena a cena' },
  { nome: 'LinkedIn',            desc: 'Texto profissional' },
  { nome: 'YouTube',             desc: 'TÃ­tulo + descriÃ§Ã£o' },
  { nome: 'ApresentaÃ§Ã£o do imÃ³vel', desc: 'Ficha completa para divulgaÃ§Ã£o' },
  { nome: 'Roteiro de LocuÃ§Ã£o',  desc: 'Script para narraÃ§Ã£o' },
  { nome: 'PÃºblico Google Ads',  desc: 'SegmentaÃ§Ã£o + palavras-chave' },
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
  story: 'Stories, Status e comunicaÃ§Ãµes rÃ¡pidas',
  reels: 'Instagram Reels, TikTok e Shorts',
  video: 'YouTube, WhatsApp, sites e apresentaÃ§Ãµes',
  card: 'Portais, feed e envio direto',
  detailed: 'Portais e materiais de comparaÃ§Ã£o',
  carousel: 'Instagram e Facebook',
  social: 'WhatsApp, feed e prova social',
}

const CAMPAIGN_USE_OPTIONS = {
  feed: { id: 'feed', icon: 'ðŸ“±', label: 'Feed / Redes Sociais' },
  vertical: { id: 'vertical', icon: 'ðŸŽ¬', label: 'Stories / Reels / TikTok / Status' },
  horizontal: { id: 'horizontal', icon: 'ðŸŒ', label: 'Google Ads / Landing Page / VÃ­deo' },
  whatsapp: { id: 'whatsapp', icon: 'ðŸ’¬', label: 'WhatsApp / Envio Direto' },
  portais: { id: 'portais', icon: 'ðŸ ', label: 'Portais ImobiliÃ¡rios' },
}

const MAX_VISUAL_PIECES_PER_GENERATION = 5

const CAMPAIGN_MODEL_LIBRARY = [
  {
    id: 'anuncio_premium',
    icon: '\u{1F3C6}',
    name: 'Anuncio Premium',
    previewUrl: '/previews/modelos-produto3/anuncio-premium.svg',
    description: 'Arte de impacto para apresentar o imovel com forca comercial.',
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
    description: 'Modelo direto para gerar atencao em publicacoes rapidas.',
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
    description: 'Card objetivo para mostrar dados importantes com clareza.',
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
    description: 'Modelo informativo para destacar dados e diferenciais do imovel.',
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
    description: 'Prova social para reforcar confianca e autoridade.',
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
    description: 'Peca com linguagem de conversa para estimular contato do lead.',
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
    description: 'Modelo visual para valorizar ambientes e criar sensacao de visita.',
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
    description: 'Criativo para destacar uma oportunidade com linguagem sofisticada.',
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
    description: 'Video curto para aumentar alcance e destacar o imovel com movimento.',
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
    description: 'Sequencia para apresentar fotos e ambientes do imovel.',
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
    description: 'Sequencia visual para destacar fotos, detalhes e chamada comercial.',
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
    description: 'Apresentacao em video para valorizar ambientes e aumentar percepcao de valor.',
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
    description: 'Carrossel premium para apresentar diferenciais e criar uma narrativa visual.',
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

const formatCreditRange = (templates = []) => {
  const credits = templates.map(template => template.creditWeight).filter(value => Number.isFinite(value))
  if (!credits.length) return '0 crÃ©ditos'
  const min = Math.min(...credits)
  const max = Math.max(...credits)
  return min === max ? `${min} crÃ©ditos por peÃ§a` : `${min}-${max} crÃ©ditos por peÃ§a`
}

const RENDER_READY_STATUSES = new Set(['succeeded', 'completed'])
const RENDER_ERROR_STATUSES = new Set(['failed', 'error', 'canceled', 'timeout'])
const RENDER_FINAL_STATUSES = new Set([...RENDER_READY_STATUSES, ...RENDER_ERROR_STATUSES])
const RENDER_STATUS_LABELS = {
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
const getRenderDebugPayload = (render) => ({
  render_id: render?.render_id || null,
  template_id: render?.template_id || null,
  status: render?.status || null,
  erro: render?.erro || null,
  error_message: render?.error_message || null,
  url: render?.url || null,
  snapshot_url: render?.snapshot_url || null,
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
    label: 'ðŸš€ Campanhas Recomendadas',
    description: 'O sistema sugere os produtos de marketing ideais para o objetivo da campanha.',
  },
  {
    id: 'manual',
    label: 'ðŸŽ¯ Monte Sua Campanha',
    description: 'Escolha exatamente quais produtos de marketing deseja gerar e acompanhe o custo.',
  },
]

const WIZARD_STEPS = [
  {
    id: 'welcome',
    title: 'ConheÃ§a',
    description: 'Veja o que o SmartCorretorAI pode criar.',
  },
  {
    id: 'products',
    title: 'Escolha',
    description: 'Selecione campanhas ou produtos de marketing.',
  },
  {
    id: 'credits',
    title: 'CrÃ©ditos',
    description: 'Confira consumo estimado e saldo.',
  },
  {
    id: 'property',
    title: 'ImÃ³vel',
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
    title: 'Venda RÃ¡pida',
    description: 'Campanha direta para gerar contatos em imÃ³veis prontos.',
    benefits: ['Mais velocidade para captar leads', 'Ã“tima para oportunidade de preÃ§o', 'Formatos essenciais para redes sociais'],
    smartTip: 'Publique os Stories diariamente e alterne os Banners no Feed durante a semana para aumentar o alcance.',
  },
  {
    id: 'luxo_premium',
    title: 'Luxo Premium',
    description: 'ApresentaÃ§Ã£o sofisticada para imÃ³veis de alto padrÃ£o.',
    benefits: ['Valoriza acabamento e exclusividade', 'Visual mais refinado', 'Ideal para fotos fortes e imÃ³veis premium'],
    smartTip: 'Use o vÃ­deo premium para abrir a campanha e reforce os diferenciais com carrossÃ©is ao longo da semana.',
  },
  {
    id: 'lancamento',
    title: 'LanÃ§amento',
    description: 'Campanha para gerar expectativa, urgÃªncia e prÃ©-venda.',
    benefits: ['Boa para planta e obra', 'Destaque para oportunidade', 'Ajuda a comunicar escassez e novidade'],
    smartTip: 'Comece pelos Stories para criar expectativa e use o carrossel para explicar planta, lazer e condiÃ§Ãµes.',
  },
  {
    id: 'mcmv',
    title: 'Minha Casa Minha Vida',
    description: 'ComunicaÃ§Ã£o clara para financiamento, entrada e WhatsApp.',
    benefits: ['Linguagem acessÃ­vel', 'Foco em conversa e simulaÃ§Ã£o', 'Boa para primeiro imÃ³vel'],
    smartTip: 'Priorize chamadas simples e envie o material no WhatsApp para estimular simulaÃ§Ãµes e conversas rÃ¡pidas.',
  },
  {
    id: 'airbnb_temporada',
    title: 'Airbnb / Temporada',
    description: 'Campanha focada em experiÃªncia, lazer e reservas.',
    benefits: ['Valoriza ambientes e lifestyle', 'Boa para imÃ³veis mobiliados', 'Ideal para diÃ¡ria e temporada'],
    smartTip: 'Mostre primeiro a experiÃªncia do imÃ³vel e depois use Stories para reforÃ§ar datas, localizaÃ§Ã£o e reservas.',
  },
  {
    id: 'comercial',
    hidden: true,
    title: 'Comercial',
    description: 'Campanha objetiva para salas, lojas, terrenos e galpÃµes.',
    benefits: ['Foco em localizaÃ§Ã£o e metragem', 'ComunicaÃ§Ã£o mais racional', 'Boa para decisÃ£o B2B'],
    smartTip: 'Destaque localizaÃ§Ã£o, metragem e uso ideal no Feed, depois envie o material pelo WhatsApp para leads qualificados.',
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
    purpose: 'divulgar o imÃ³vel no feed e gerar interesse imediato.',
  },
  stories: {
    title: 'Story',
    where: 'Instagram Stories, Facebook Stories e Status do WhatsApp',
    purpose: 'aumentar visualizaÃ§Ãµes rÃ¡pidas e gerar contatos.',
  },
  carousels: {
    title: 'Carrossel',
    where: 'Instagram e Facebook',
    purpose: 'mostrar vÃ¡rios ambientes do imÃ³vel em uma Ãºnica publicaÃ§Ã£o.',
  },
  videos: {
    title: 'VÃ­deo/Reels',
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
    purpose: 'compartilhar o imÃ³vel rapidamente e iniciar conversas.',
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

const getCampaignCardDetails = (campaignId, modeId, isDemoPlan = false) => {
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
  { id: 'seg', nome: 'Seg', label: 'Segunda' }, { id: 'ter', nome: 'Ter', label: 'TerÃ§a' },
  { id: 'qua', nome: 'Qua', label: 'Quarta' },  { id: 'qui', nome: 'Qui', label: 'Quinta' },
  { id: 'sex', nome: 'Sex', label: 'Sexta' },   { id: 'sab', nome: 'SÃ¡b', label: 'SÃ¡bado' },
  { id: 'dom', nome: 'Dom', label: 'Domingo' },
]

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SUB-COMPONENTES â€” FORMULÃRIO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function Counter({ label, value, onChange, max = 9 }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-bold">âˆ’</button>
        <span className="w-6 text-center text-base font-bold text-gray-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-bold">+</button>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SUB-COMPONENTE â€” POPUP DE AGENDAMENTO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const PECAS_AGENDA = [
  { id: 'ig_feed',    nome: 'Instagram Feed',    icon: 'ðŸ“¸' },
  { id: 'ig_stories', nome: 'Instagram Stories', icon: 'ðŸ“±' },
  { id: 'fb_feed',    nome: 'Facebook Feed',      icon: 'ðŸ‘' },
  { id: 'whatsapp',   nome: 'Mensagem WhatsApp',  icon: 'ðŸ’¬' },
  { id: 'tiktok',     nome: 'TikTok / Reels',    icon: 'ðŸŽµ' },
  { id: 'linkedin',   nome: 'LinkedIn',           icon: 'ðŸ’¼' },
  { id: 'portal_zap', nome: 'ZAP ImÃ³veis',        icon: 'ðŸ ' },
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
    const txt = cronograma.map(c => `${c.dia} Ã s ${c.horario} â€” ${c.peca.icon} ${c.peca.nome}`).join('\n')
    await navigator.clipboard.writeText(`ðŸ“… CRONOGRAMA â€” ${titulo}\n\n${txt}`)
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
      ics += `BEGIN:VEVENT\r\nDTSTART:${fmt(dt)}\r\nDTEND:${fmt(dtEnd)}\r\nSUMMARY:${peca.icon} ${peca.nome} â€” ${titulo}\r\nDESCRIPTION:Publicar conteÃºdo gerado pelo SmartCorretorAI\r\nEND:VEVENT\r\n`
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
            <h3 className="font-bold text-gray-900 text-lg">Agendar distribuiÃ§Ã£o ðŸ“…</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Quer que eu distribua essas peÃ§as ao longo da semana?
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">HorÃ¡rio de publicaÃ§Ã£o</label>
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
                Agora nÃ£o
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SUB-COMPONENTES â€” RESULTADO VISUAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        {[['â¤ï¸', '2,3k'], ['ðŸ’¬', '84'], ['â†—ï¸', '412']].map(([icon, count]) => (
          <div key={icon} className="flex flex-col items-center gap-0.5">
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-white/70 text-xs">{count}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-5 left-3 right-12 flex items-center justify-center gap-2.5">
        <button onClick={() => goTo(idx - 1)} className="w-7 h-7 bg-white/15 rounded-full text-white text-xs flex items-center justify-center hover:bg-white/25">â®</button>
        <button onClick={() => setPlaying(p => !p)} className="w-9 h-9 bg-white/25 rounded-full text-white text-sm flex items-center justify-center hover:bg-white/35">
          {playing ? 'â¸' : 'â–¶'}
        </button>
        <button onClick={() => goTo(idx + 1)} className="w-7 h-7 bg-white/15 rounded-full text-white text-xs flex items-center justify-center hover:bg-white/25">â­</button>
      </div>
      <div className="absolute top-8 right-3 text-white/50 text-xs">{idx + 1}/{cenas.length}</div>
    </div>
  )
}

function InstagramFeedCard({ dados, gradiente }) {
  return (
    <div className="max-w-xs mx-auto rounded-2xl overflow-hidden shadow-xl border border-gray-100">
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradiente} flex items-center justify-center text-lg`}>ðŸ </div>
        <div className="flex-1"><p className="text-sm font-semibold text-gray-900">seu.perfil</p><p className="text-xs text-gray-400">Patrocinado</p></div>
        <span className="text-gray-400 text-lg font-bold">Â·Â·Â·</span>
      </div>
      <div className={`aspect-square bg-gradient-to-br ${gradiente} flex flex-col items-center justify-center p-6 text-white text-center`}>
        <span className="text-7xl mb-3">ðŸ </span>
        <p className="text-base font-bold uppercase tracking-wide">ImÃ³vel Ã  Venda</p>
        <p className="text-xs text-white/70 mt-1">Deslize para mais â†’</p>
      </div>
      <div className="px-4 py-2.5 bg-white flex justify-between">
        <div className="flex gap-3 text-2xl">â¤ï¸ ðŸ’¬ ðŸ“¤</div>
        <span className="text-2xl">ðŸ”–</span>
      </div>
      <div className="px-4 pb-4 bg-white">
        <p className="text-xs font-semibold text-gray-900 mb-1">seu.perfil</p>
        <p className="text-xs text-gray-800 leading-relaxed">{removeHashtagsFromText(dados.legenda)}</p>
        {dados.cta && <p className="text-xs font-semibold text-primary-600 mt-2">ðŸ‘‰ {dados.cta}</p>}
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
          <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-xs">ðŸ </div>
          <span className="text-white text-xs font-bold">seu.perfil</span>
        </div>
        <div className="absolute inset-x-4 top-[35%] text-center">
          <p className="text-white text-xs font-bold leading-relaxed" style={{ textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>
            {removeHashtagsFromText(dados.texto_principal)}
          </p>
        </div>
        <div className="absolute bottom-8 left-3 right-3">
          <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-full py-2 text-center">
            <span className="text-white text-xs font-bold">â†‘ {dados.cta || 'Ver mais'}</span>
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
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">ðŸ </div>
        <div><p className="text-white text-sm font-bold">Corretor</p><p className="text-green-200 text-xs">online agora â—</p></div>
      </div>
      <div className="bg-[#e5ddd5] p-4 flex justify-end">
        <div className="bg-[#dcf8c6] rounded-tl-2xl rounded-tr-none rounded-br-2xl rounded-bl-2xl max-w-[90%] px-4 py-3 shadow-sm">
          <p className="text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">{removeHashtagsFromText(dados.mensagem)}</p>
          <div className="flex justify-end items-center gap-1 mt-1.5">
            <span className="text-gray-400 text-xs">18:42</span>
            <span className="text-blue-400 text-sm">âœ“âœ“</span>
          </div>
        </div>
      </div>
      <div className="bg-[#e5ddd5] pb-4 flex justify-center">
        <div className="bg-white rounded-full px-5 py-2 text-xs text-gray-500 shadow-sm">ðŸ“Ž  Enviar mensagem</div>
      </div>
    </div>
  )
}

function FacebookCard({ dados }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl max-w-xs mx-auto bg-white border border-gray-200">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xl">ðŸ </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Seu Perfil ImÃ³veis</p>
          <p className="text-xs text-gray-400">Agora Â· ðŸŒ</p>
        </div>
        <span className="text-gray-400 font-bold">Â·Â·Â·</span>
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-800 leading-relaxed">{removeHashtagsFromText(dados.texto)}</p>
        {dados.cta && <p className="text-xs text-blue-600 font-semibold mt-2">ðŸ‘‰ {dados.cta}</p>}
      </div>
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 h-28 flex items-center justify-center">
        <span className="text-white text-5xl">ðŸ </span>
      </div>
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-400">
        <div>ðŸ‘â¤ï¸ðŸ˜ <span className="ml-1">1,2 mil</span></div>
        <div className="flex gap-3"><span>84 comentÃ¡rios</span><span>320 compart.</span></div>
      </div>
      <div className="border-t border-gray-100 px-4 py-2 flex justify-around">
        {['ðŸ‘ Curtir', 'ðŸ’¬ Comentar', 'â†—ï¸ Compartilhar'].map(a => (
          <button key={a} className="text-xs text-gray-600 font-medium">{a}</button>
        ))}
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  UTILITÃRIOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Redimensiona e comprime a foto no browser (canvas) antes do upload.
// - Lado maior cap em 1920px (preserva proporÃ§Ã£o; imagens menores passam direto).
// - JPEG qualidade 0.80 â€” equilÃ­brio entre nitidez e peso.
// O corretor nÃ£o precisa pensar em tamanho/peso: sempre normalizamos aqui.
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  COMPONENTE PRINCIPAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  const [telefone, setTelefone] = useState('')

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
  const [gerandoBanners, setGerandoBanners] = useState(false)
  const renderPollRef = useRef(null)

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
  const campaignObjectiveInfo = SMART_CAMPAIGNS.find(campaign => campaign.id === campaignObjectiveId)
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
      return selectedUses.length > 0 ? { ...model, selectedUses } : null
    })
    .filter(Boolean)
  const selectedModelCount = selectedModelSummaries.length
  const selectedUseCount = selectedModelSummaries.reduce((sum, model) => sum + model.selectedUses.length, 0)
  const isSmartCampaignSelection = false
  const estimatedCreditConsumption = selectedCatalogItems.reduce((sum, item) => sum + item.creditWeight, 0)
  const balanceAfterGeneration = simulatedCreditBalance - estimatedCreditConsumption
  const hasInsufficientCredits = balanceAfterGeneration < 0
  const economySuggestion = selectedCatalogItems.some(item => ['video', 'reels'].includes(item.type))
    ? 'Remova VÃ­deo/Reels para economizar crÃ©ditos e manter artes + textos IA.'
    : 'Escolha apenas Banner Feed e Story para uma geraÃ§Ã£o mais econÃ´mica.'
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
      toast.error(`Para garantir a geraÃ§Ã£o correta, selecione atÃ© ${MAX_VISUAL_PIECES_PER_GENERATION} peÃ§as por vez neste momento.`)
      return
    }

    setSelectedSmartCampaign(null)
    setCreditBuilderMode('manual')
    setCampaignObjective('monte_sua_campanha')
    applySelectedModelUses(next)
  }

  const applySmartCampaign = (campaignId, modeId = visualCreditMode) => {
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
        console.error('[IBGE] falha ao carregar municÃ­pios:', err)
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
      toast.error('Envie um arquivo de vÃ­deo vÃ¡lido.')
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
  const podaGerar = categoria && dadosImovelValidos

  const resetCampaignState = (targetStep = 'campaign-choice') => {
    setFase('form'); setCategoria(null); setTipo(''); setFinalidade('Venda')
    setQuartos(2); setBanheiros(1); setSuites(0); setVagas(1); setArea(''); setPreco('')
    setBairro(''); setCidade(''); setEstado(''); setDiferenciais([]); setDifCustom(''); setFotos([]); setVideoArquivo(null); setTelefone('')
    setResultado(null); setCampanhaId(null); setIgPostado(false)
    setShowAgendamento(false)
    setRenders(null); setGerandoBanners(false); setProductFlowStep(targetStep); setCampaignFlowType(null); setSelectedSmartCampaign(null); setActiveCampaignModelId(null); setSelectedModelUses({}); setCampaignObjective('')
    clearInterval(renderPollRef.current)
  }

  const voltarResultadoParaCusto = () => {
    setFase('form')
    setProductFlowStep('cost')
  }

  const confirmarGeracao = () => {
    if (isProductEntry) {
      toast('A geraÃ§Ã£o real deste produto serÃ¡ conectada na prÃ³xima fase.')
      return
    }
    if (!dadosImovelValidos) { toast.error('Preencha os campos obrigatÃ³rios'); return }
    if (campaignFlowType === 'manual' && !campaignObjective) { toast.error('Escolha o objetivo da campanha.'); return }
    if (!categoria) setCategoria('medio_padrao')
    if (isDemoPlan && demoUsed) {
      toast.error('Sua campanha demonstrativa jÃ¡ foi utilizada. Escolha um plano para continuar.')
      return
    }
    if (isDemoPlan && selectedSmartCampaign && selectedSmartCampaign !== DEMO_CAMPAIGN_ID) {
      toast.error('No plano demonstrativo, somente Venda RÃ¡pida estÃ¡ disponÃ­vel.')
      return
    }
    if (isDemoPlan && !selectedSmartCampaign) {
      applySmartCampaign(DEMO_CAMPAIGN_ID)
    }
    setShowConfirm(true)
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  GERAÃ‡ÃƒO â€” CORRIGIDA
  //  Upload de fotos nÃ£o trava mais o processo.
  //  Se falhar, continua sem fotos e avisa o usuÃ¡rio.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const gerarAnuncios = async () => {
    setShowConfirm(false)
    setFase('gerando')
    setMsgIdx(0)

    try {
      console.log('[gerarAnuncios] iniciado | authedUser.id =', authedUser?.id)

      const todosDisferenciais = [
        ...diferenciais,
        ...(difCustom.trim() ? [difCustom.trim()] : []),
      ]

      // AutenticaÃ§Ã£o â€” APENAS via AuthContext. Zero chamadas a
      // supabase.auth.getSession()/refreshSession() (eles davam timeout).
      // O JWT vem do contexto e Ã© repassado EXPLICITAMENTE no header
      // Authorization de cada invoke â€” assim o supabase-js nÃ£o tenta
      // recuperar sessÃ£o sozinho.
      if (authLoading) {
        toast.error('Aguarde â€” carregando sessÃ£o...')
        setFase('form')
        return
      }
      const userId = authedUser?.id
      const token = accessToken
      if (!userId || !token) {
        toast.error('Sua sessÃ£o expirou. FaÃ§a login novamente.')
        setFase('form')
        navigate('/login', { replace: true })
        return
      }
      console.log('[gerarAnuncios] sessÃ£o OK via contexto', { userId, hasToken: true })

      if (selectedTemplatePayload.length > MAX_VISUAL_PIECES_PER_GENERATION) {
        toast.error(`Para garantir a geraÃ§Ã£o correta, selecione atÃ© ${MAX_VISUAL_PIECES_PER_GENERATION} peÃ§as por vez neste momento.`)
        setFase('form')
        return
      }

      // â”€â”€ Upload das fotos: sequencial, timeout 120s por tentativa, retry 1x â”€â”€
      // Cada foto tem atÃ© 2 tentativas; se ambas falharem/expirarem, segue sem ela.
      // invoke da Edge Function Ã© OBRIGATÃ“RIO â€” uploads nÃ£o podem bloquear o fluxo.
      const uploadComTimeout = (path, blob, contentType, ms = 180000) =>
        Promise.race([
          supabase.storage
            .from('smartcorretor-assets')
            .upload(path, blob, { contentType, upsert: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`upload timeout ${ms}ms`)), ms)),
        ])

      const fotos_urls = []
      console.log('[gerarAnuncios] iniciando upload de', fotos.length, 'fotos')
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
            console.log('[upload] OK foto', i + 1, tentativa > 1 ? `(tentativa ${tentativa})` : '')
            break
          } catch (uploadErr) {
            console.error(`[upload] foto ${i + 1} tentativa ${tentativa} erro/timeout:`, uploadErr)
          }
        }
        if (url) fotos_urls.push(url)
      }
      console.log('[gerarAnuncios] fim do upload loop. fotos_urls:', fotos_urls.length)

      // â”€â”€ Templates escolhidos pelo usuÃ¡rio (somente os marcados) â”€â”€
      // Bloqueia qualquer geraÃ§Ã£o automÃ¡tica de templates nÃ£o escolhidos.
      const selectedTemplates = selectedTemplatePayload
      console.log('[gerarAnuncios] selectedTemplates:', selectedTemplates)
      const idempotencyKey = createGenerationIdempotencyKey(userId)
      const creditPayload = {
        credit_cost: generationCreditCost,
        generation_mode: generationModeForCredits,
        video_ia_premium: generationHasPremiumVideo,
        idempotency_key: idempotencyKey,
      }
      console.log('[gerarAnuncios] creditPayload:', {
        credit_cost: creditPayload.credit_cost,
        generation_mode: creditPayload.generation_mode,
        video_ia_premium: creditPayload.video_ia_premium,
        has_idempotency_key: Boolean(creditPayload.idempotency_key),
      })

      // â”€â”€ Disparar gerar-campanha E gerar-banners EM PARALELO (mesmo clique) â”€â”€
      console.log('[gerarAnuncios] >>> DISPARANDO invoke(gerar-campanha) + invoke(gerar-banners) em paralelo')

      // Inputs derivados do formulÃ¡rio para o gerar-banners (nÃ£o dependem do AI ainda)
      const enderecoCompleto = [bairro, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')
      const tituloPreliminar = `${tipo || 'ImÃ³vel'} ${quartos ? quartos + 'q ' : ''}em ${bairro || cidade || ''}`.trim()
      const descricaoPreliminar = [
        campaignObjectiveLabel ? `Objetivo da campanha: ${campaignObjectiveLabel}` : '',
        `${tipo || 'ImÃ³vel'} ${categoria ? '(' + categoria + ')' : ''}`,
        `${quartos} quarto${quartos !== 1 ? 's' : ''}, ${banheiros} banheiro${banheiros !== 1 ? 's' : ''}, ${vagas} vaga${vagas !== 1 ? 's' : ''}`,
        area ? `${area}mÂ²` : '',
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
      ].filter(Boolean).join('. ')

      // Foto do corretor: se o perfil nÃ£o tem avatar cadastrado, forÃ§a REMOVER_ELEMENTO
      // (assim o template nÃ£o renderiza a mulher fictÃ­cia padrÃ£o).
      const tituloComercial = `${tipo || 'ImÃ³vel'} ${finalidade === 'Venda' ? 'Ã  Venda' : finalidade ? `para ${finalidade}` : 'em destaque'}`.trim()
      const headlineComercial = campaignObjectiveLabel || tituloComercial || `${tipo || 'ImÃ³vel'} em destaque`
      const especificacoesPrincipais = [
        formatQuantityLabel(quartos, 'DormitÃ³rio'),
        suites > 0 ? formatQuantityLabel(suites, 'SuÃ­te') : '',
        formatQuantityLabel(vagas, 'Vaga'),
        area ? `${area}mÂ²` : '',
      ].filter(Boolean).join(', ')
      const descricaoComercial = [
        headlineComercial,
        `${tipo || 'ImÃ³vel'} em ${bairro || cidade || 'destaque'}`,
        especificacoesPrincipais,
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
      ].filter(Boolean).join('. ')

      const avatarPerfil = authedUser?.avatar_url || authedUser?.foto_url || authedUser?.photo_url || ''
      const corretorAvatarUrl = avatarPerfil ? avatarPerfil : 'REMOVER_ELEMENTO'

      // fotos_urls vai EM ORDEM â€” a primeira Ã© a principal do imÃ³vel, demais sÃ£o secundÃ¡rias.
      const fotosOrdenadas = fotos_urls.slice(0, 10)
      const fotoPrincipal = fotosOrdenadas[0] || null

      setGerandoBanners(true)
      setRenders(null)

      // SÃ³ dispara gerar-banners se o usuÃ¡rio escolheu pelo menos 1 template.
      const bannersInvoke = selectedTemplates.length > 0
        ? supabase.functions.invoke('gerar-banners', {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              // campaign_id Ã© opcional agora; vamos linkar depois
              user_id: userId,
              selectedTemplates,
              selected_templates: selectedTemplates,
              pieces: selectedTemplates,
              fotos_urls: fotosOrdenadas,
              foto_principal: fotoPrincipal,
              titulo: tituloComercial,
              descricao: descricaoComercial,
              preco: precoParaPayload,
              suites,
              quartos,
              vagas,
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
              finalidade, quartos, banheiros, suites, vagas,
              area: area || null, preco: precoParaPayload, bairro, cidade, estado,
              diferenciais: todosDisferenciais,
              telefone_contato: telefone,
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

      console.log('[gerarAnuncios] resultados paralelos:', { campaignResult, bannersResult })

      // â”€â”€ Processar resultado da CAMPANHA (textos) â”€â”€
      if (campaignResult.status === 'rejected') {
        const err = campaignResult.reason
        try {
          const errBody = await err?.context?.json?.()
          throw new Error(errBody?.error || err?.message || 'Erro ao gerar campanha')
        } catch {
          throw err
        }
      }
      const { data, error } = campaignResult.value
      if (error) {
        try {
          const errBody = await error.context?.json?.()
          throw new Error(errBody?.error || error.message || 'Erro desconhecido')
        } catch {
          throw error
        }
      }
      if (!data) throw new Error('Resposta vazia da Edge Function (gerar-campanha)')

      const camp = data.campanha
      if (!camp) throw new Error('Dados da campanha nÃ£o retornados: ' + JSON.stringify(data))

      setResultado(camp)
      setCampanhaId(camp.id)
      setIgPostado(false)
      if (isDemoPlan && demoStorageKey) {
        localStorage.setItem(demoStorageKey, 'true')
        setDemoUsed(true)
      }
      setFase('resultado')

      // â”€â”€ Processar resultado dos BANNERS (renders) â”€â”€
      if (bannersResult.status === 'fulfilled') {
        const { data: bData, error: bError } = bannersResult.value
        if (bError) {
          const edgeErrorBody = await readFunctionErrorBody(bError)
          console.error('[gerar-banners] erro:', bError)
          console.error('[gerar-banners] resposta:', edgeErrorBody)
          toast.error(edgeErrorBody?.error || 'Falha ao gerar banners (textos OK)')
        } else if (bData?.renders?.length) {
          const rs = bData.renders
          setRenders(rs)
          if (bData.warning) toast(bData.warning, { icon: 'âš ï¸' })
          toast.success(`${rs.length} ${rs.length > 1 ? 'materiais em produÃ§Ã£o' : 'material em produÃ§Ã£o'}. Processando...`)
          iniciarPollingRenders(rs, camp.id)
          // Linkar renders Ã  campanha recÃ©m-criada (gerar-banners rodou sem campaign_id)
          supabase
            .from('campaigns')
            .update({ banners: rs })
            .eq('id', camp.id)
            .then(({ error: updErr }) => {
              if (updErr) console.warn('[link banners] falhou:', updErr.message)
            })
        } else {
          console.warn('[gerar-banners] sem renders no retorno', bData)
        }
      } else {
        const edgeErrorBody = await readFunctionErrorBody(bannersResult.reason)
        console.error('[gerar-banners] rejeitado:', bannersResult.reason)
        console.error('[gerar-banners] resposta:', edgeErrorBody)
        toast.error(edgeErrorBody?.error || 'Falha ao gerar banners (textos OK)')
      }

      setGerandoBanners(false)
      setTimeout(() => setShowAgendamento(true), 1800)

    } catch (err) {
      console.error('[gerarAnuncios] erro:', err)
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
    const REDES = { instagram_feed: ['ðŸ“¸ INSTAGRAM FEED', 'legenda'], instagram_stories: ['ðŸ“± STORIES', 'texto_principal'], whatsapp: ['ðŸ’¬ WHATSAPP', 'mensagem'], facebook: ['ðŸ‘ FACEBOOK', 'texto'], tiktok: ['ðŸŽµ TIKTOK / REELS', 'roteiro'], youtube: ['â–¶ï¸ YOUTUBE', 'descricao'], linkedin: ['ðŸ’¼ LINKEDIN', 'texto'] }
    let txt = `âœ… ANÃšNCIOS â€” ${resultado.titulo}\n${catAtual ? `ðŸ“‚ ${catAtual.nome}\n` : ''}${'â”€'.repeat(50)}\n\n`
    Object.entries(resultado.textos_gerados).forEach(([rede, dados]) => {
      const [label, campo] = REDES[rede] || ['', 'texto']
      txt += `${label}\n${'â”€'.repeat(30)}\n${removeHashtagsFromText(dados[campo] || Object.values(dados)[0] || '')}\n`
      txt += '\n\n'
    })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })), download: `anuncios-${resultado.titulo?.replace(/\s+/g, '-').toLowerCase() || 'imovel'}.txt` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const postarNoInstagram = async () => {
    toast('PublicaÃ§Ã£o no Instagram chega em breve.', { icon: 'ðŸš§' })
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

  const iniciarPollingRenders = (iniciais, campaignIdForPolling = campanhaId) => {
    clearInterval(renderPollRef.current)
    renderPollRef.current = null
    setRenders(iniciais)
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
        const currentList = Array.isArray(current) ? current : []
        const updatesById = new Map(updates.map(item => [item.render_id, item]))
        return currentList.map(item => {
          if (!item?.render_id) return item
          const update = updatesById.get(item.render_id)
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
            console.warn('[renders] timeout get-render-status erro:', error)
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
          console.warn('[renders] get-render-status erro:', error)
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
        console.warn('[renders] polling falhou:', error)
      } finally {
        inFlight = false
      }
    }

    poll()
    renderPollRef.current = setInterval(poll, 5000)
  }

  const gerarBanners = async () => {
    if (!campanhaId) return toast.error('Campanha nÃ£o encontrada â€” gere os textos primeiro')
    if (gerandoBanners) return

    // Token direto do AuthContext (sem getSession/refreshSession).
    const token = accessToken
    if (!token) {
      toast.error('Sua sessÃ£o expirou. FaÃ§a login novamente.')
      navigate('/login', { replace: true })
      return
    }

    const selectedTemplates = selectedTemplatePayload
    if (selectedTemplates.length === 0) {
      toast.error('Selecione ao menos um banner ou vÃ­deo no formulÃ¡rio')
      return
    }
    if (selectedTemplates.length > MAX_VISUAL_PIECES_PER_GENERATION) {
      toast.error(`Para garantir a geraÃ§Ã£o correta, selecione atÃ© ${MAX_VISUAL_PIECES_PER_GENERATION} peÃ§as por vez neste momento.`)
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

      // Sem avatar do corretor â†’ remove o slot pra evitar a mulher fictÃ­cia padrÃ£o.
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
          suites,
          quartos,
          vagas,
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
      if (rs.length === 0) throw new Error('Nenhuma peÃ§a visual foi enviada para processamento')

      setRenders(rs)
      if (data?.warning) toast(data.warning, { icon: 'âš ï¸' })
      toast.success(`${rs.length} ${rs.length > 1 ? 'materiais em produÃ§Ã£o' : 'material em produÃ§Ã£o'}. Processando...`)

      iniciarPollingRenders(rs, campanhaId)
    } catch (err) {
      console.error('[gerarBanners] erro:', err)
      toast.error(err.message || 'Falha ao gerar banners')
    } finally {
      setGerandoBanners(false)
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (fase === 'form') {
    const selectedCampaign = SMART_CAMPAIGNS.find(campaign => campaign.id === selectedSmartCampaign)
    const selectedProductNames = selectedMarketingObjectives.map(item => item.publicName)
    const simpleCost = generationCreditCost
    const simpleBalance = isUnlimitedTestAdmin ? 'Ilimitado' : simulatedCreditBalance
    const simpleStatus = isUnlimitedTestAdmin || simpleCost <= simulatedCreditBalance
      ? 'Saldo suficiente para gerar.'
      : 'CrÃ©ditos insuficientes para esta geraÃ§Ã£o.'
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
        toast.error(`Para garantir a geraÃ§Ã£o correta, selecione atÃ© ${MAX_VISUAL_PIECES_PER_GENERATION} peÃ§as por vez neste momento.`)
        return
      }
      setCampaignFlowType('manual')
      setCampaignObjective('monte_sua_campanha')
      setProductFlowStep('property')
    }
    const continueFromProperty = () => {
      if (!dadosImovelValidos) {
        toast.error('Preencha os campos obrigatÃ³rios do imÃ³vel.')
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
        toast.error(isProductEntry ? 'Envie ao menos uma foto para continuar.' : 'Envie ao menos uma foto do imÃ³vel.')
        return
      }
      if (productContext.videoRequired && !videoArquivo) {
        toast.error('Envie o vÃ­deo do imÃ³vel/corretor para continuar.')
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
              Este fluxo reutiliza o cadastro Ãºnico do imÃ³vel. A geraÃ§Ã£o real deste produto ainda nÃ£o serÃ¡ iniciada aqui.
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
        <h2 className="text-base font-bold text-gray-900">Dados do imÃ³vel</h2>

        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Objetivo da campanha <span className="text-red-400">*</span>
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {campaignFlowType === 'smart'
                  ? 'Objetivo definido pela campanha escolhida.'
                  : 'Escolha o foco de marketing para adaptar textos, CTA, linguagem e estratÃƒÂ©gia.'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              Marketing
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SMART_CAMPAIGNS.filter(campaign => !campaign.hidden).map(campaign => {
              const active = campaignObjectiveId === campaign.id
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Quantidade</label>
          <div className="flex gap-6 flex-wrap">
            <Counter label="Quartos" value={quartos} onChange={setQuartos} />
            <Counter label="SuÃ­tes" value={suites} onChange={setSuites} />
            <Counter label="Vagas" value={vagas} onChange={setVagas} />
          </div>
        </div>

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
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">PreÃ§o (R$) <span className="text-gray-400 font-normal">opcional</span></label>
            <input value={preco} onChange={e => setPreco(e.target.value)} type="number" placeholder="Ex: 1200000 ou deixe em branco"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ãrea (mÂ²) <span className="text-gray-400 font-normal">opcional</span></label>
            <input value={area} onChange={e => setArea(e.target.value)} type="number" placeholder="Ex: 110"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <label htmlFor="destaques-imovel-novo" className="block text-sm font-bold text-gray-900">
                âœ¨ O que vocÃª deseja destacar neste imÃ³vel?
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Descreva livremente os diferenciais, localizaÃ§Ã£o, acabamento, lazer ou qualquer ponto forte. A IA irÃ¡ organizar e melhorar o texto automaticamente.
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
            placeholder="Exemplo: apartamento reformado, vista livre, varanda gourmet, prÃ³ximo ao metrÃ´, acabamento premium, lazer completo e excelente iluminaÃ§Ã£o natural."
            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-gray-400">
            <span>Escreva do seu jeito. A IA cuida da apresentaÃ§Ã£o.</span>
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
            <h2 className="text-base font-bold text-gray-900">Arquivos do imÃ³vel</h2>
            <span className="text-xs text-gray-400 font-medium">{fotos.length}/10 fotos</span>
          </div>
          <p className="text-xs text-gray-500">{productContext.uploadHelp}</p>
        </div>

        {productContext.allowVideo && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">VÃ­deo do imÃ³vel/corretor</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {productContext.videoRequired ? 'ObrigatÃ³rio para Transformar Meu VÃ­deo.' : 'Opcional neste produto.'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                productContext.videoRequired ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {productContext.videoRequired ? 'ObrigatÃ³rio' : 'Opcional'}
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
                  Remover vÃ­deo
                </button>
              </div>
            ) : (
              <div onClick={() => videoRef.current.click()} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleVideo(e.dataTransfer.files) }}
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 p-5 text-center transition-all hover:border-primary-300 hover:bg-primary-50/30">
                <input ref={videoRef} type="file" accept="video/*" className="hidden"
                  onChange={e => handleVideo(e.target.files)} />
                <Video className="mx-auto mb-2 h-7 w-7 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">Clique ou arraste o vÃ­deo aqui</p>
                <p className="mt-1 text-xs text-gray-400">MP4, MOV ou arquivo de vÃ­deo compatÃ­vel</p>
              </div>
            )}
          </div>
        )}

        {productContext.allowOptionalPhotos && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Fotos do imÃ³vel</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {productContext.photoRequired
                    ? 'ObrigatÃ³rias para este produto.'
                    : 'Opcionais como apoio visual.'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                productContext.photoRequired ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {productContext.photoRequired ? 'ObrigatÃ³rias' : 'Opcionais'}
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
                <p className="text-xs text-gray-400 mt-1">JPG, PNG Â· atÃ© 10 fotos Â· a primeira Ã© a principal</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
    const analysisItems = [
      'Tipo e padrÃ£o do imÃ³vel identificados',
      'LocalizaÃ§Ã£o considerada na estratÃ©gia',
      'Diferenciais organizados para a campanha',
      'Fotos serÃ£o usadas para personalizar os materiais',
      'EstratÃ©gia sugerida conforme objetivo escolhido',
    ]
    const strategyLabel = campaignFlowType === 'smart'
      ? selectedCampaign?.title || 'Campanha Inteligente'
      : campaignObjectiveLabel
        ? `${campaignObjectiveLabel} com ${selectedProductNames.length ? selectedProductNames.join(', ') : 'produtos selecionados'}`
        : selectedProductNames.length ? selectedProductNames.join(', ') : 'Produtos selecionados'

    return (
      <>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Confirmar geraÃ§Ã£o</h3>
                <p className="text-xs text-gray-500">Sua campanha completa serÃ¡ gerada em um clique.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Custo desta geraÃ§Ã£o</span>
                <span className="font-black text-gray-900">{simpleCost} crÃ©ditos</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Saldo disponÃ­vel</span>
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
            {productFlowStep === 'campaign-choice' && (<>
              {renderFlowHeader('Gerar Campanha', 'Escolha o subproduto da campanha', 'Use uma campanha por objetivo ou monte sua prÃ³pria combinaÃ§Ã£o de produtos de marketing.')}
              {renderStepActions(goHome)}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button type="button" onClick={startSmartFlow}
                  className="rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-lg">
                  <span className="text-4xl">ðŸš€</span>
                  <h2 className="mt-5 text-2xl font-black text-gray-950">Campanha por Objetivo</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">Escolha uma sugestÃ£o pronta conforme o objetivo de divulgaÃ§Ã£o do imÃ³vel.</p>
                  <span className="mt-6 inline-flex rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white">Escolher objetivo</span>
                </button>
                <button type="button" onClick={startManualFlow}
                  className="rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-lg">
                  <span className="text-4xl">ðŸŽ¨</span>
                  <h2 className="mt-5 text-2xl font-black text-gray-950">Monte Sua Campanha</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">Escolha exatamente quais produtos de marketing deseja gerar.</p>
                  <span className="mt-6 inline-flex rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white">Montar campanha</span>
                </button>
              </div>
            </>)}

            {productFlowStep === 'smart-campaigns' && (<>
              {renderFlowHeader('Campanha por Objetivo', 'Escolha uma sugestÃ£o pronta', 'Cada card mostra o objetivo, resultado esperado e custo estimado.')}
              {renderStepActions(goToCampaignChoice)}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SMART_CAMPAIGNS.filter(campaign => !campaign.hidden).map(campaign => {
                  const locked = isDemoPlan && campaign.id !== DEMO_CAMPAIGN_ID
                  const cardDetails = getCampaignCardDetails(campaign.id, visualCreditMode, isDemoPlan)
                  return (
                    <article key={campaign.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${locked ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-gray-950">{campaign.title}</h3>
                          <p className="mt-1 text-xs font-black uppercase tracking-wide text-primary-600">Ideal para</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
                          {cardDetails.creditCost} crÃ©ditos
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-500">{campaign.description}</p>
                      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-black text-gray-800">Receba:</p>
                        <div className="mt-2 space-y-1">
                          {cardDetails.deliverables.map(item => (
                            <p key={item.key} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                              <span>{item.count ? `${item.count} ` : ''}{item.title}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-black text-gray-700">Resultado esperado</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">{campaign.benefits[0]}</p>
                      <details className="mt-4 rounded-xl bg-gray-50 p-3">
                        <summary className="cursor-pointer text-xs font-black text-primary-700">Ver detalhes</summary>
                        <div className="mt-3 space-y-2 text-xs text-gray-600">
                          {campaign.benefits.map(benefit => (
                            <p key={benefit} className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary-500" />{benefit}</p>
                          ))}
                          <p className="rounded-lg bg-amber-50 p-2 text-amber-900">{campaign.smartTip}</p>
                        </div>
                      </details>
                      <button type="button" disabled={locked} onClick={() => selectSmartCampaignAndContinue(campaign.id)}
                        className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">
                        {locked ? 'DisponÃ­vel nos planos pagos' : 'Selecionar Campanha'}
                      </button>
                    </article>
                  )
                })}
              </div>
            </>)}

            {productFlowStep === 'manual-catalog' && (<>
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
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-primary-600">Biblioteca de modelos</p>
                      <h2 className="mt-1 text-lg font-black text-gray-950">Modelos principais disponÃ­veis</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Use os Ã­cones para escolher onde cada modelo serÃ¡ usado. O sistema cuida dos formatos internamente.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-700">
                        {selectedModelCount} modelo{selectedModelCount === 1 ? '' : 's'} selecionado{selectedModelCount === 1 ? '' : 's'}
                      </span>
                      <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-black text-primary-700">
                        Total: {estimatedCreditConsumption} crÃ©ditos
                      </span>
                      {selectedCatalogItems.length > 0 && (
                        <button type="button" onClick={() => applySelectedModelUses({})}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">
                          Limpar seleÃ§Ã£o
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
                      const modelTemplates = model.compatibleUses
                        .map(useId => TEMPLATE_CATALOG_BY_TEMPLATE_ID[model.useTemplates?.[useId]])
                        .filter(Boolean)
                      const creditValues = modelTemplates
                        .map(template => template.creditWeight || 0)
                        .filter(value => value > 0)
                      const minCredit = creditValues.length ? Math.min(...creditValues) : 0
                      const maxCredit = creditValues.length ? Math.max(...creditValues) : 0
                      const creditLabel = minCredit === maxCredit
                        ? `${minCredit} crÃ©ditos por peÃ§a`
                        : `${minCredit}-${maxCredit} crÃ©ditos por peÃ§a`
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
                                src={model.previewUrl}
                                alt={`Preview do modelo ${model.name}`}
                                className="aspect-[4/3] w-full object-cover"
                                loading="lazy"
                              />
                            </div>

                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-sm font-black text-gray-950">{model.name}</h3>
                                <p className="mt-1 text-xs leading-relaxed text-gray-500">{model.description}</p>
                              </div>
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                                selected ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-white'
                              }`}>
                                {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                                {model.compatibleUses.length} usos compatÃ­veis
                              </span>
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                {creditLabel}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Onde deseja usar?</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {model.compatibleUses.map(useId => {
                                const use = CAMPAIGN_USE_OPTIONS[useId]
                                const checked = useIds.includes(useId)
                                const blockedByLimit = !checked && selectedTemplatePayload.length >= MAX_VISUAL_PIECES_PER_GENERATION
                                return (
                                  <button
                                    key={`${model.id}-${useId}-${model.useTemplates?.[useId]}`}
                                    type="button"
                                    title={blockedByLimit ? `Limite de ${MAX_VISUAL_PIECES_PER_GENERATION} peÃ§as atingido` : use.label}
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
                        Escolha pelo menos um modelo e marque onde deseja usÃ¡-lo.
                      </p>
                    )}

                    <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-primary-900">Modelos</span>
                        <span className="text-sm font-black text-primary-900">{selectedModelCount}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-primary-900">Usos escolhidos</span>
                        <span className="text-sm font-black text-primary-900">{selectedUseCount}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-primary-900">PeÃ§as serÃ£o geradas</span>
                        <span className="text-sm font-black text-primary-900">{selectedCatalogItems.length}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-primary-100 pt-3">
                        <span className="text-xs font-semibold text-gray-600">CrÃ©ditos</span>
                        <span className="text-xl font-black text-gray-950">{estimatedCreditConsumption}</span>
                      </div>
                    </div>

                    {selectedCatalogItems.length > 0 && (
                      <button type="button" onClick={() => applySelectedModelUses({})}
                        className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-600 hover:bg-gray-50">
                        Limpar seleÃ§Ã£o
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

            <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-gray-950 via-primary-950 to-gray-900 p-6 text-white shadow-xl shadow-primary-950/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-200">Liberdade total</p>
                  <h2 className="mt-1 text-xl font-black">ðŸŽ¨ Monte Sua PrÃ³pria Campanha</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-200">
                    Escolha exatamente os produtos que deseja gerar. VocÃª pode combinar formatos livremente e pagar apenas pelos crÃ©ditos utilizados.
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Escolha apenas o que precisa',
                      'Controle total dos crÃ©ditos',
                      'Combine produtos livremente',
                      'Crie campanhas exclusivas para cada imÃ³vel',
                    ].map(item => (
                      <div key={item} className="flex items-start gap-2 rounded-xl bg-white/8 px-3 py-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                        <span className="text-xs font-semibold text-gray-100">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreditBuilderMode('manual')}
                  className="shrink-0 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-gray-950 hover:bg-amber-200 transition-colors"
                >
                  Montar Minha Campanha
                </button>
              </div>
            </div>

            {isDemoPlan ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                <h2 className="text-base font-bold text-amber-950">Plano demonstrativo</h2>
                <p className="text-sm text-amber-800 mt-1">
                  Sem crÃ©ditos nesta etapa: sua demonstraÃ§Ã£o libera uma campanha Ãºnica com formatos fixos.
                </p>
              </div>
            ) : (
              <CreditSummary
                simulatedBalance={simulatedCreditBalance}
                modeId={visualCreditMode}
                selectedTemplateIds={selectedTemplateIds}
                isUnlimited={isUnlimitedTestAdmin}
              />
            )}

            <div className="card p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Seu WhatsApp <span className="text-gray-400 font-normal">(opcional â€” aparece nos textos)</span>
                </label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} type="tel" placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
              </div>

              <button onClick={confirmarGeracao} disabled={!podaGerar || (isDemoPlan && demoUsed)}
                className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all ${
                  podaGerar && !(isDemoPlan && demoUsed) ? 'gradient-primary text-white shadow-lg shadow-primary-500/30 hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                <Sparkles className="w-5 h-5" />
                Gerar campanha
              </button>

              {!isUnlimitedTestAdmin && !isDemoPlan && creditos && creditos.total_disponivel > 0 && (
                <p className="text-center text-xs text-gray-500">
                  VocÃª estÃ¡ usando <strong>1 anÃºncio</strong> â€”{' '}
                  <span className={creditos.total_disponivel <= 3 ? 'text-amber-600 font-semibold' : ''}>
                    {creditos.total_disponivel - 1} anÃºncio{creditos.total_disponivel - 1 !== 1 ? 's' : ''} restante{creditos.total_disponivel - 1 !== 1 ? 's' : ''} apÃ³s esta geraÃ§Ã£o
                  </span>
                </p>
              )}

              {!isDemoPlan && creditos && creditos.total_disponivel === 0 && (
                <p className="text-center text-xs text-red-500 font-medium">
                  Sem anÃºncios disponÃ­veis Â· <a href="/planos" className="underline">Ver planos</a>
                </p>
              )}

              {!podaGerar && (
                <p className="text-center text-xs text-amber-600 font-medium">
                  Preencha: tipo do imÃ³vel Â· bairro Â· cidade
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPreviousWizardStep}
                  disabled={wizardStep === 0}
                  className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-colors ${
                    wizardStep === 0
                      ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Voltar etapa
                </button>
                <button
                  type="button"
                  onClick={goToNextWizardStep}
                  disabled={wizardStep === WIZARD_STEPS.length - 1}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                    wizardStep === WIZARD_STEPS.length - 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-950 text-white hover:bg-gray-800'
                  }`}
                >
                  PrÃ³xima etapa
                </button>
              </div>
            </div>

        {fase === 'gerando' && (
          <div className="card p-14 text-center animate-fade-in">
            <div className={`w-24 h-24 bg-gradient-to-br ${catAtual?.cor || 'from-primary-500 to-primary-400'} rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-2xl`}>
              <span className="text-5xl">{catAtual?.icon || 'âœ¨'}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Criando sua campanha...</h2>
            <p className="text-primary-600 font-semibold text-lg min-h-[28px]" key={msgIdx}>{msgs[msgIdx]}</p>
            <p className="text-gray-400 text-sm mt-3">A IA estÃ¡ pesquisando o bairro e criando textos personalizados</p>
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
          const visualPieces = Array.isArray(renders) ? renders : []
          const visualPiecesReady = visualPieces.filter(r => RENDER_READY_STATUSES.has(normalizeRenderStatus(r.status))).length
          const visualPiecesFailed = visualPieces.filter(r => RENDER_ERROR_STATUSES.has(normalizeRenderStatus(r.status)) || !!r.erro).length
          const visualPiecesProcessing = Math.max(visualPieces.length - visualPiecesReady - visualPiecesFailed, 0)
          const getCreditAmount = (render) => {
            const value = Number(render?.credit_amount || 0)
            return Number.isFinite(value) ? Math.max(0, value) : 0
          }
          const visualCreditsConsumed = visualPieces
            .filter(r => (
              r.credit_status === 'consumed'
              || (RENDER_READY_STATUSES.has(normalizeRenderStatus(r.status)) && r.credit_status !== 'cancelled')
            ))
            .reduce((sum, render) => sum + getCreditAmount(render), 0)
          const visualCreditsRefunded = visualPieces
            .filter(r => (
              r.credit_status === 'cancelled'
              || RENDER_ERROR_STATUSES.has(normalizeRenderStatus(r.status))
              || !!r.erro
            ))
            .reduce((sum, render) => sum + getCreditAmount(render), 0)

          const textosEdge = [
            { key: 'titulo_campanha',         icon: 'ðŸ·ï¸', titulo: 'TÃ­tulo da Campanha' },
            { key: 'descricao_portal',        icon: 'ðŸ ', titulo: 'DescriÃ§Ã£o para Portal' },
            { key: 'post_instagram',          icon: 'ðŸ“¸', titulo: 'Post Instagram' },
            { key: 'script_video_reels',      icon: 'ðŸŽ¬', titulo: 'Script VÃ­deo / Reels' },
            { key: 'carrossel_passo_a_passo', icon: 'ðŸŽ ', titulo: 'Carrossel Passo a Passo' },
            { key: 'mensagem_whatsapp',       icon: 'ðŸ’¬', titulo: 'Mensagem WhatsApp' },
          ]
          const getTextoEdge = (k) => {
            const v = resultado[k] ?? tg[k]
            if (v == null) return ''
            if (Array.isArray(v)) {
              return v
                .map((item) => `ðŸ“ ${typeof item === 'string' ? item : JSON.stringify(item)}`)
                .join('\n')
            }
            return typeof v === 'string' ? removeHashtagsFromText(v) : JSON.stringify(v, null, 2)
          }

          return (
            <div className="space-y-6">

              {isDemoPlan && (
                <AnimatedCard delay={0}>
                  <div className="card p-5 border-primary-200 bg-primary-50">
                    <h2 className="text-lg font-extrabold text-gray-900">Campanha demonstrativa concluÃ­da.</h2>
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
                        <h2 className="font-extrabold text-gray-900 text-xl">Campanha pronta! ðŸŽ‰</h2>
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
                      <div className="flex items-center gap-2"><span className="text-2xl">ðŸ“¸</span><h3 className="font-bold text-gray-900 text-lg">Instagram Feed</h3></div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => copiar(removeHashtagsFromText([tg.instagram_feed.legenda, tg.instagram_feed.cta ? `ðŸ‘‰ ${tg.instagram_feed.cta}` : ''].filter(Boolean).join('\n\n')), 'ig_feed')}
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
                      <div className="flex items-center gap-2"><span className="text-2xl">ðŸ“±</span><h3 className="font-bold text-gray-900 text-lg">Instagram Stories</h3></div>
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
                      <div className="flex items-center gap-2"><span className="text-2xl">ðŸ’¬</span><h3 className="font-bold text-gray-900 text-lg">WhatsApp</h3></div>
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
                      <div className="flex items-center gap-2"><span className="text-2xl">ðŸ‘</span><h3 className="font-bold text-gray-900 text-lg">Facebook</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => copiar(removeHashtagsFromText([tg.facebook.texto, tg.facebook.cta ? `ðŸ‘‰ ${tg.facebook.cta}` : ''].filter(Boolean).join('\n\n')), 'fb')}
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
                      <div className="flex items-center gap-2"><span className="text-2xl">ðŸŽµ</span><h3 className="font-bold text-gray-900 text-lg">TikTok / Reels</h3><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">â–¶ AutomÃ¡tico</span></div>
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

              {renders && renders.length > 0 && (
                <AnimatedCard delay={2700}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">ðŸ–¼ï¸</span>
                        <h3 className="font-bold text-gray-900 text-lg">PeÃ§as visuais geradas</h3>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-bold">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">{visualPieces.length} solicitadas</span>
                        <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">{visualPiecesReady} prontas</span>
                        {visualPiecesProcessing > 0 && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">{visualPiecesProcessing} processando</span>}
                        {visualPiecesFailed > 0 && <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">{visualPiecesFailed} falharam</span>}
                      </div>
                    </div>
                    <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                      <p className="text-sm font-black text-primary-900">Resumo da geraÃ§Ã£o</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">PeÃ§as prontas</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualPiecesReady}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">PeÃ§as com falha</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualPiecesFailed}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">CrÃ©ditos consumidos</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualCreditsConsumed}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">CrÃ©ditos devolvidos</p>
                          <p className="mt-1 text-xl font-black text-gray-950">{visualCreditsRefunded}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-bold text-primary-800">
                        VocÃª sÃ³ paga pelas peÃ§as geradas com sucesso.
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {renders.map((r, i) => {
                        const status = normalizeRenderStatus(r.status)
                        const ok = RENDER_READY_STATUSES.has(status)
                        const falhou = RENDER_ERROR_STATUSES.has(status) || !!r.erro
                        const ehVideo = r.url && /\.(mp4|webm|mov)$/i.test(r.url)
                        const nomePeca = r.template_nome && !/template|creatomate|uuid/i.test(r.template_nome)
                          ? r.template_nome
                          : 'PeÃ§a visual'
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
                                  {falhou ? 'arquivo indisponÃ­vel' : 'aguardandoâ€¦'}
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
                  <p className="text-gray-500 text-sm mb-4">Quer criar campanha para outro imÃ³vel?</p>
                  <button
                    onClick={() => resetCampaignState('campaign-choice')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" />
                    Criar campanha para outro imÃ³vel
                  </button>
                </div>
              </AnimatedCard>

            </div>
          )
        })()}
          </main>
        </div>
      </>
    )
  }
}
