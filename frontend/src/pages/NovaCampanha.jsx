import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, MessageCircle, Copy, Download, CheckCircle2, Plus, Camera, X, Send, AlertCircle, Zap, Video, Instagram, Youtube, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { TEMPLATE_CATALOG, TEMPLATE_MODEL_CREDIT_WEIGHTS, TEMPLATE_MODEL_PREVIEWS } from '../data/templateCatalog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import CampaignPackage from '../components/campaign/CampaignPackage'
import { buildProduct3CampaignOptions, normalizeProduct3CampaignFiles } from '../components/campaign/buildProduct3CampaignPackage'
import { getProduct3Highlights, isProduct3CommercialType, PRODUCT_3_PROPERTY_TYPES } from '../data/product3Campaign'
import SmartCarouselCitySelect, { SmartCarouselStateSelect } from '../components/location/SmartCarouselCitySelect'
import { downloadFileFromPrivateUrl, getDownloadErrorMessage } from '../lib/download-file'
import { formatBrazilianPhone, formatProduct3Price as formatCanonicalProduct3Price, formatProduct3PropertyTag, getProduct3PurposeBadge } from '../../../supabase/functions/_shared/product3-contract.ts'
import { ProductCard } from '../components/design-system'
import { ConversationAssistantBubble, ConversationHeader, ConversationQuestionCard, ConversationUserBubble } from '../components/conversation/ConversationPrimitives'

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

const TIPOS = PRODUCT_3_PROPERTY_TYPES

const isCommercialPropertyType = (type) => {
  if (isProduct3CommercialType(type)) return true
  const normalized = String(type || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  return [
    'SALA COMERCIAL',
    'LAJE CORPORATIVA',
    'LOJA',
    'PONTO COMERCIAL',
    'CONJUNTO COMERCIAL',
    'COMERCIAL',
    'GALPAO',
  ].some((keyword) => normalized.includes(keyword))
}

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const MVP_FINALIDADE = 'sale'
const FINALIDADE_OPTIONS = [
  { id: 'sale', label: 'Venda', icon: '🏡' },
  { id: 'rental', label: 'Locação', icon: '🔑' },
]

const PRODUCT_3_PROGRESS_STEPS = [
  { title: 'Escolha os modelos', subtitle: 'Selecione até 5 modelos' },
  { title: 'Informe os dados', subtitle: 'Conte sobre o imóvel' },
  { title: 'Suba as imagens', subtitle: 'Envie as fotos do imóvel' },
  { title: 'Revise', subtitle: 'Confira as informações' },
  { title: 'Gere e baixe', subtitle: 'Receba seus banners e campanha' },
]

const PRODUCT_3_SITUATIONS = {
  sale: [
    { id: 'lancamento', label: 'Lançamento', category: 'lancamento' },
    { id: 'em_construcao', label: 'Em construção', category: 'em_construcao' },
    { id: 'pronto_para_morar', label: 'Pronto para morar', category: 'medio_padrao' },
  ],
  rental: [
    { id: 'disponivel_imediatamente', label: 'Disponível agora', category: 'medio_padrao' },
    { id: 'pronto_para_mudar', label: 'Pronto para mudar', category: 'medio_padrao' },
    { id: 'pronto_para_ocupacao', label: 'Pronto para ocupação', category: 'medio_padrao', commercialOnly: true },
    { id: 'disponibilidade_a_combinar', label: 'Disponibilidade a combinar', category: 'medio_padrao', commercialOnly: true },
  ],
}

const MAX_DESTAQUES_FLUXO = 20
const MAX_DESTAQUES_BANNERS_PRODUTO_3 = 8
const MAX_DESTAQUES_CHAT_PRODUTO_3 = 10
const MIN_FOTOS_PRODUTO_3 = 3
const MAX_FOTOS_PRODUTO_3 = 5
const MAX_FOTOS_OUTROS_PRODUTOS = 10
const PRODUCT_3_TYPEWRITER_INITIAL_DELAY_MS = 350
const PRODUCT_3_TYPEWRITER_CHAR_DELAY_MS = 30
const PRODUCT_3_TYPEWRITER_FINAL_CURSOR_MS = 400
const PRODUCT_3_CTA_OPTIONS = ['Saiba Mais', 'Agende sua visita', 'Entre em contato agora']
const PRODUCT_3_BEDROOM_OPTIONS = [0, 1, 2, 3, 4, 5]
const PRODUCT_3_SUITE_AND_PARKING_OPTIONS = [0, 1, 2, 3, 4]

const DESTAQUE_CATEGORIES = [
  {
    title: 'Localização e conveniência',
    items: [
      'Próximo ao metrô',
      'Próximo ao trem',
      'Próximo ao shopping',
      'Próximo a escolas',
      'Próximo a universidades',
      'Próximo a hospitais',
      'Próximo a mercados',
      'Fácil acesso às principais vias',
      'Bairro valorizado',
      'Região em crescimento',
      'Vista livre',
    ],
  },
  {
    title: 'Condomínio e lazer',
    items: [
      'Lazer completo',
      'Piscina',
      'Academia',
      'Salão de festas',
      'Espaço gourmet',
      'Churrasqueira',
      'Coworking',
      'Pet place',
      'Playground',
      'Brinquedoteca',
      'Quadra esportiva',
      'Quadra de tênis ou beach tennis',
      'Bicicletário',
      'Portaria 24h',
      'Segurança 24h',
      'Lounge',
      'Mini mercado',
      'Lavanderia',
      'Piscina aquecida ou climatizada',
      'Conveniência',
      'Áreas verdes',
      'Rooftop',
      'Espaço delivery',
      'Locker para encomendas',
      'Espaço wellness',
      'Spa ou sauna',
    ],
  },
  {
    title: 'Serviços e facilidades',
    items: [
      'Serviços tipo hotelaria',
      'Manobrista',
      'Ponto de carregamento para carros elétricos',
      'Depósito privativo por unidade',
      'Vagas demarcadas',
    ],
  },
  {
    title: 'Características do imóvel',
    items: [
      'Varanda',
      'Varanda gourmet',
      'Suíte',
      'Closet',
      'Planta inteligente',
      'Ambientes integrados',
      'Cozinha americana',
      'Acabamento premium',
      'Iluminação natural',
      'Vista panorâmica',
    ],
  },
  {
    title: 'Condição comercial simples',
    items: [
      'Aceita financiamento',
      'Usa FGTS',
      'Entrada facilitada',
      'Subsídio do governo',
      'Documentação em ordem',
      'Últimas unidades',
      'Condições especiais',
      'Alto potencial de valorização',
    ],
  },
]

const PRODUCT_CONTEXTS = {
  hero: {
    label: 'Banner Imobiliário',
    sourcePath: '/hero',
    headerTitle: 'Cadastro padrão do imóvel',
    headerSubtitle: 'O contexto do Banner Imobiliário será preservado neste fluxo.',
    propertyEyebrow: 'Banner Imobiliário',
    propertyTitle: 'Cadastro padrão do imóvel',
    propertySubtitle: 'Use os mesmos dados oficiais do SmartCorretorAI. Nenhum cadastro paralelo será criado.',
    uploadEyebrow: 'Upload do Banner Imobiliário',
    uploadTitle: 'Envie as fotos do imóvel',
    photosSubtitle: 'As fotos serão usadas como base visual do Banner Imobiliário.',
    uploadHelp: 'Fotos obrigatórias para gerar materiais do Banner Imobiliário. Vídeo é opcional nesta etapa.',
    photoRequired: true,
    videoRequired: false,
    allowOptionalPhotos: true,
    allowVideo: true,
    reviewTitle: 'Revisão do Banner Imobiliário',
    reviewSubtitle: 'Confira o imóvel e as fotos antes da etapa de geração do Banner Imobiliário.',
    costTitle: 'Banner Imobiliário preparado',
    costSubtitle: 'O cadastro único foi preservado. A geração real do Banner Imobiliário será conectada na próxima fase.',
    nextLabel: 'Geração do Banner Imobiliário em preparação',
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
    label: 'Gerador de Banners',
    headerTitle: 'Gerador de Banners Imobiliários',
    headerSubtitle: 'Escolha os modelos, informe o imóvel e gere peças prontas para divulgar.',
    propertyEyebrow: 'Dados do imóvel',
    propertyTitle: 'Informe o imóvel',
    propertySubtitle: 'Esses dados ajudam a personalizar os banners e textos do imóvel.',
    uploadEyebrow: 'Fotos do imóvel',
    uploadTitle: 'Envie as fotos',
    photosSubtitle: 'As imagens serão usadas para personalizar os banners.',
    uploadHelp: 'Envie de 3 a 5 fotos do imóvel para gerar banners mais leves e estáveis.',
    photoRequired: true,
    videoRequired: false,
    allowOptionalPhotos: true,
    allowVideo: false,
    reviewTitle: 'Revisão dos Banners',
    reviewSubtitle: 'Esta leitura é visual e local nesta etapa, sem nova chamada de backend.',
    costTitle: 'Revise e gere seus banners',
    costSubtitle: 'A geração será validada com segurança no servidor.',
  },
}

const SUBPRODUCT_LABELS = {
  hero_completo: 'Banner Imobiliário Completo',
  pecas_individuais: 'Peças Individuais',
  video_rapido: 'Vídeo Rápido',
  video_premium_cinematografico: 'Vídeo Premium/Cinematográfico',
  campanha_por_objetivo: 'Banners Rápidos',
  monte_sua_campanha: 'Gerador de Banners',
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

const CAMPAIGN_USE_OPTIONS = {
  feed: { id: 'feed', icon: '📱', label: 'Feed / Redes Sociais', visualLabel: 'Instagram', description: 'Feed, Stories, Reels e Status', brand: 'instagram' },
  vertical: { id: 'vertical', icon: '🎬', label: 'Stories / Reels / TikTok / Status', visualLabel: 'YouTube / Vídeos', description: 'Vídeos, Shorts e apresentações', brand: 'youtube' },
  horizontal: { id: 'horizontal', icon: '🌐', label: 'Google Ads / Landing Page / Vídeo', visualLabel: 'Google Ads', description: 'Anúncios e campanhas de alta conversão', brand: 'google-ads' },
  whatsapp: { id: 'whatsapp', icon: '💬', label: 'WhatsApp / Envio Direto', visualLabel: 'WhatsApp', description: 'Envio direto, catálogo e Status', brand: 'whatsapp' },
  portais: { id: 'portais', icon: '🏠', label: 'Portais Imobiliários', visualLabel: 'Portais Imobiliários', description: 'Peças otimizadas para portais', brand: 'portais' },
}

const CAMPAIGN_USE_DISPLAY_ORDER = ['feed', 'horizontal', 'whatsapp', 'vertical', 'portais']

function CampaignUseBrandIcon({ use }) {
  if (use.brand === 'instagram') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 via-pink-500 to-orange-400 text-white shadow-lg shadow-pink-100">
        <Instagram className="h-8 w-8" strokeWidth={2.2} />
      </span>
    )
  }
  if (use.brand === 'google-ads') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-blue-100 ring-1 ring-blue-100">
        <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true">
          <path d="M19 7c2.6-1.5 5.9-.6 7.4 2l14.8 25.6a5.4 5.4 0 0 1-9.4 5.4L17 14.4A5.4 5.4 0 0 1 19 7Z" fill="#4285F4" />
          <path d="M21.5 10.7 7 35.8a5.4 5.4 0 1 0 9.4 5.4l10.1-17.5-5-13Z" fill="#34A853" />
          <circle cx="11.7" cy="38.5" r="5.4" fill="#FBBC04" />
        </svg>
      </span>
    )
  }
  if (use.brand === 'whatsapp') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-emerald-100">
        <MessageCircle className="h-8 w-8" strokeWidth={2.3} />
      </span>
    )
  }
  if (use.brand === 'youtube') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-lg shadow-red-100">
        <Youtube className="h-9 w-9" fill="currentColor" strokeWidth={1.6} />
      </span>
    )
  }
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-100">
      <Building2 className="h-8 w-8" strokeWidth={2.1} />
    </span>
  )
}

const MAX_VISUAL_PIECES_PER_GENERATION = 5
const MVP_ACTIVE_MODEL_IDS = new Set([
  'anuncio_premium',
  'story_premium',
  'card_imobiliario_premium',
  'imovel_detalhes',
  'avaliacao_do_cliente',
  'chat_imobiliario',
  'momentos_do_imovel',
  'reels_moderno',
  'galeria_imobiliaria',
  'slides_premium',
  'video_tour',
  'triple_slide_carousel',
])

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

const CAMPAIGN_MODEL_LIBRARY = CAMPAIGN_MODEL_LIBRARY_BASE.filter(model => (
  MVP_ACTIVE_MODEL_IDS.has(model.id)
)).map(model => {
  const preview = TEMPLATE_MODEL_PREVIEWS[model.id] || {}
  const previewSource = preview.previewAssetUrl || preview.previewUrl || model.previewUrl || null
  return {
    ...model,
    posterUrl: preview.posterUrl || null,
    previewAssetUrl: previewSource,
    previewUrl: previewSource,
    previewType: preview.previewType || 'image/svg+xml',
    previewStatus: preview.previewStatus || (preview.previewAssetUrl || preview.previewUrl ? 'ready' : 'missing'),
    previewFormat: preview.previewFormat || null,
    previewTemplateId: preview.previewTemplateId || null,
    previewTitle: preview.previewTitle || model.name,
    previewDescription: preview.previewDescription || model.description,
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

function PreviewMedia({ model, variant = 'card', controls = false }) {
  const [failed, setFailed] = useState(false)
  const source = model.previewAssetUrl || model.previewUrl
  const ready = model.previewStatus === 'ready' && source && !failed
  const previewType = model.previewType || ''
  const isImage = previewType === 'image' || previewType.startsWith('image/')
  const isVideo = previewType === 'video' || previewType.startsWith('video/')
  const isModal = variant === 'modal'
  const wrapperClassName = isModal
    ? 'mx-auto w-full max-w-[70vh]'
    : 'mb-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm'
  const mediaClassName = isModal
    ? 'mx-auto aspect-square max-h-[70vh] w-full rounded-2xl bg-black object-contain'
    : 'aspect-[4/3] w-full object-cover'
  const fallbackClassName = isModal
    ? 'flex aspect-square w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-center text-sm font-semibold text-gray-200'
    : 'flex aspect-[4/3] w-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 text-center'

  return (
    <div
      className={wrapperClassName}
      onClick={(event) => event.stopPropagation()}
    >
      {ready && isImage ? (
        <img
          src={source}
          alt={model.previewAlt}
          className={mediaClassName}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : ready && isVideo ? (
        <video
          key={source}
          src={source}
          poster={model.posterUrl || undefined}
          className={mediaClassName}
          controls={controls}
          muted
          loop
          playsInline
          autoPlay={!controls}
          preload="metadata"
          aria-label={model.previewAlt}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={fallbackClassName}>
          {!isModal && (
            <span className="rounded-full border border-blue-100 bg-primary-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-primary-800">
              Preview
            </span>
          )}
          {!isModal && <p className="mt-3 text-sm font-black text-gray-900">{model.name}</p>}
          <p className={`mt-1 text-xs font-semibold ${isModal ? 'text-gray-200' : 'text-gray-500'}`}>
            Preview em preparação. Este modelo já está disponível para geração.
          </p>
        </div>
      )}
    </div>
  )
}

function CampaignModelPreview({ model }) {
  return <PreviewMedia model={model} variant="card" />
}

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
const CAMPAIGN_GENERATION_ERROR = 'Não foi possível concluir a geração agora. Revise os dados e tente novamente.'
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
const getRenderFinalUrl = (render) => [
  render?.download_url,
  render?.downloadUrl,
  render?.video_url,
  render?.videoUrl,
  render?.url,
].find(value => typeof value === 'string' && value.trim())?.trim() || ''
const getMediaUrlExtension = (url) => String(url || '')
  .split(/[?#]/, 1)[0]
  .match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || ''
const isRenderVideo = (render) => {
  const extension = getMediaUrlExtension(getRenderFinalUrl(render))
  return ['mp4', 'webm', 'mov'].includes(extension)
    || String(render?.type || render?.media_type || '').toLowerCase().includes('video')
}
const getRenderDownloadName = (render, index) => {
  const label = String(render?.template_nome || render?.model_name || render?.label || `peca-${index + 1}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || `peca-${index + 1}`
  const extension = getMediaUrlExtension(getRenderFinalUrl(render)) || (isRenderVideo(render) ? 'mp4' : 'png')
  return `smartcorretorai-${label}-${index + 1}.${extension}`
}
const getRenderDebugPayload = (render) => ({
  render_id: render?.render_id || null,
  template_id: render?.template_id || null,
  template_name: render?.template_name || render?.template_nome || null,
  model_id: render?.model_id || render?.modelId || null,
  model_name: render?.model_name || render?.modelName || null,
  use_id: render?.use_id || render?.useId || null,
  use_label: render?.use_label || render?.useLabel || null,
  status: render?.status || null,
  error_stage: render?.error_stage || null,
  error_code: render?.error_code || null,
  erro: render?.erro || null,
  error_message: render?.error_message || null,
  error_details: render?.error_details || render?.details || null,
  error_stack: render?.error_stack || render?.stack || null,
  payload_enviado: render?.payload_enviado || render?.request_payload || null,
  resposta_http: render?.resposta_http || render?.response_http || null,
  corpo_resposta: render?.corpo_resposta || render?.response_body || null,
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
const sanitizePriceDigits = value => String(value ?? '').replace(/\D/g, '').slice(0, 12)
const formatProduct3Price = (value, mode = '', purpose = MVP_FINALIDADE) => (
  formatCanonicalProduct3Price(sanitizePriceDigits(value), purpose, mode)
)
const sanitizeAreaInput = (value) => {
  const normalized = String(value ?? '').replace(',', '.').replace(/[^\d.]/g, '')
  const [integerPart = '', ...decimalParts] = normalized.split('.')
  const integerDigits = integerPart.slice(0, 7)
  const decimalDigits = decimalParts.join('').slice(0, 2)
  if (!integerDigits && !decimalDigits) return ''
  return decimalDigits ? `${integerDigits || '0'}.${decimalDigits}` : integerDigits
}
const formatAreaLabel = value => {
  const normalized = sanitizeAreaInput(value)
  return normalized ? `${normalized.replace('.', ',')} m²` : ''
}
const formatProduct3CountChoice = (value, plusAt) => Number(value) === plusAt ? `${plusAt}+` : String(Number(value) || 0)
const normalizeSpaces = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const capitalizePtWord = (word) => {
  if (!word) return ''
  return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')
}
const normalizeBairro = (value) => {
  const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return normalizeSpaces(value)
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase('pt-BR')
      return index > 0 && connectors.has(lower) ? lower : capitalizePtWord(lower)
    })
    .join(' ')
}
const normalizeShortFreeText = (value, maxLength = 120) => {
  const cleaned = normalizeSpaces(value).slice(0, maxLength)
  return cleaned ? cleaned.charAt(0).toLocaleUpperCase('pt-BR') + cleaned.slice(1) : ''
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
    hidden: true,
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

const DIAS_SEMANA = [
  { id: 'seg', nome: 'Seg', label: 'Segunda' }, { id: 'ter', nome: 'Ter', label: 'Terça' },
  { id: 'qua', nome: 'Qua', label: 'Quarta' },  { id: 'qui', nome: 'Qui', label: 'Quinta' },
  { id: 'sex', nome: 'Sex', label: 'Sexta' },   { id: 'sab', nome: 'Sáb', label: 'Sábado' },
  { id: 'dom', nome: 'Dom', label: 'Domingo' },
]

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTES — FORMULÁRIO
// ═══════════════════════════════════════════════════════════════

function Product3Progress({ activeStep = 0 }) {
  return (
    <nav className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5" aria-label="Etapas para criar banners">
      <ol className="grid gap-2 sm:grid-cols-5">
        {PRODUCT_3_PROGRESS_STEPS.map((step, index) => {
          const active = index === activeStep
          const complete = index < activeStep
          return (
            <li key={step.title} className={`min-w-0 rounded-xl border px-3 py-3 ${active ? 'border-primary-200 bg-primary-50' : complete ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
              <div className="flex items-start gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${active ? 'bg-primary-700 text-white' : complete ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black leading-4 text-slate-900">{step.title}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-500">{step.subtitle}</span>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ))

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = event => setPrefersReducedMotion(event.matches)
    setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  return prefersReducedMotion
}

function Product3ProgressiveQuestion({ text, onComplete, prefersReducedMotion }) {
  const [phase, setPhase] = useState(prefersReducedMotion ? 'complete' : 'indicator')
  const [visibleText, setVisibleText] = useState(prefersReducedMotion ? text : '')
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    let indicatorTimerId = null
    let intervalId = null
    let finalTimerId = null

    if (prefersReducedMotion) {
      setPhase('complete')
      setVisibleText(text)
      onCompleteRef.current?.()
      return undefined
    }

    let index = 0
    setPhase('indicator')
    setVisibleText('')

    indicatorTimerId = window.setTimeout(() => {
      setPhase('writing')
      intervalId = window.setInterval(() => {
        index += 1
        setVisibleText(text.slice(0, index))
        if (index >= text.length) {
          window.clearInterval(intervalId)
          intervalId = null
          finalTimerId = window.setTimeout(() => {
            setPhase('complete')
            onCompleteRef.current?.()
          }, PRODUCT_3_TYPEWRITER_FINAL_CURSOR_MS)
        }
      }, PRODUCT_3_TYPEWRITER_CHAR_DELAY_MS)
    }, PRODUCT_3_TYPEWRITER_INITIAL_DELAY_MS)

    return () => {
      if (indicatorTimerId) window.clearTimeout(indicatorTimerId)
      if (intervalId) window.clearInterval(intervalId)
      if (finalTimerId) window.clearTimeout(finalTimerId)
    }
  }, [prefersReducedMotion, text])

  if (phase === 'indicator') {
    return (
      <span role="status" aria-label="Smart está digitando" className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-primary-50 px-3 py-2 align-middle">
        {[0, 1, 2].map(index => (
          <span
            key={index}
            className="h-2 w-2 animate-bounce rounded-full bg-primary-600 motion-reduce:animate-none"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </span>
    )
  }

  return (
    <>
      {visibleText}
      {phase === 'writing' && <span className="ml-1 inline-block h-5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary-700 motion-reduce:animate-none" />}
    </>
  )
}

function BannerConversation({
  step,
  onStepChange,
  finalidade,
  onFinalidadeChange,
  situacao,
  onSituacaoChange,
  onCategoriaChange,
  tipo,
  onTipoChange,
  cidade,
  onCidadeChange,
  estado,
  onEstadoChange,
  bairro,
  onBairroChange,
  preco,
  onPrecoChange,
  precoModo,
  onPrecoModoChange,
  condominio,
  onCondominioChange,
  iptu,
  onIptuChange,
  area,
  onAreaChange,
  quartos,
  onQuartosChange,
  suites,
  onSuitesChange,
  vagas,
  onVagasChange,
  diferenciais,
  onToggleDestaque,
  cta,
  onCtaChange,
  useProfessionalPhone,
  onUseProfessionalPhoneChange,
  professionalPhone,
  selectedModelSummaries,
  selectedUseCount,
  photosCount,
  onEditModels,
  onContinue,
}) {
  const [readyStep, setReadyStep] = useState('')
  const interactionGuardRef = useRef(true)
  const activeQuestionRef = useRef(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const commercialProperty = isCommercialPropertyType(tipo)
  const isRental = finalidade === 'rental'
  const sequence = [
    'purpose',
    'type',
    'situation',
    'city',
    'district',
    'price',
    ...(isRental ? ['condominium', 'iptu'] : []),
    'area',
    ...(!commercialProperty ? ['bedrooms', 'suites'] : []),
    'parking',
    'highlights',
    'cta',
    'phone',
    'done',
  ]
  const activeIndex = Math.max(sequence.indexOf(step), 0)
  const questionReady = readyStep === step
  const nextStep = sequence[Math.min(activeIndex + 1, sequence.length - 1)]
  const confirmations = ['Perfeito', 'Ótimo', 'Excelente']
  const situationOptions = (PRODUCT_3_SITUATIONS[finalidade] || PRODUCT_3_SITUATIONS.sale)
    .filter(option => !option.commercialOnly || commercialProperty)
  const situationLabel = Object.values(PRODUCT_3_SITUATIONS).flat().find(item => item.id === situacao)?.label || ''
  const purposeLabel = FINALIDADE_OPTIONS.find(item => item.id === finalidade)?.label || ''
  const modelNames = selectedModelSummaries.map(model => model.name)
  const priceLabel = formatProduct3Price(preco, precoModo, finalidade)
  const areaLabel = formatAreaLabel(area)
  const answers = {
    purpose: purposeLabel,
    situation: situationLabel,
    type: tipo,
    city: cidade,
    district: bairro,
    price: priceLabel || 'Preço não informado',
    condominium: condominio ? formatProduct3Price(condominio, '', 'rental') : 'Não informado',
    iptu: iptu ? formatProduct3Price(iptu, '', 'sale') : 'Não informado',
    area: areaLabel || 'Área não informada',
    bedrooms: `${formatProduct3CountChoice(quartos, 5)} dormitório${Number(quartos) === 1 ? '' : 's'}`,
    suites: `${formatProduct3CountChoice(suites, 4)} suíte${Number(suites) === 1 ? '' : 's'}`,
    parking: `${formatProduct3CountChoice(vagas, 4)} vaga${Number(vagas) === 1 ? '' : 's'}`,
    highlights: diferenciais.length ? diferenciais.join(', ') : 'Sem destaques selecionados',
    cta,
    phone: useProfessionalPhone === 'yes' ? 'Sim' : useProfessionalPhone === 'no' ? 'Não' : '',
  }
  const questionLabels = {
    purpose: 'Vamos divulgar um imóvel para:',
    situation: 'Qual é a situação do imóvel?',
    type: 'Que tipo de imóvel vamos divulgar?',
    city: 'Em qual cidade fica o imóvel?',
    district: 'Em qual bairro ele está localizado?',
    price: isRental ? 'Qual é o valor mensal da locação?' : 'Qual é o preço do imóvel?',
    condominium: 'Qual é o valor do condomínio? (opcional)',
    iptu: 'Qual é o valor do IPTU? (opcional)',
    area: 'Qual é a área aproximada do imóvel?',
    bedrooms: 'Quantos dormitórios o imóvel possui?',
    suites: 'Quantas suítes o imóvel possui?',
    parking: 'Quantas vagas o imóvel possui?',
    highlights: 'Quais são os principais destaques?',
    cta: 'Qual chamada deseja usar no final?',
    phone: 'Deseja divulgar este telefone na campanha?',
    done: 'Excelente. Os dados estão prontos para a próxima etapa.',
  }
  const history = sequence
    .slice(0, activeIndex)
    .filter(key => key !== 'done' && answers[key])
    .map((key, index) => ({ key, question: questionLabels[key], answer: answers[key], confirmation: confirmations[index % confirmations.length] }))

  useEffect(() => {
    interactionGuardRef.current = !questionReady
  }, [questionReady, step])

  useEffect(() => {
    if (!questionReady) return undefined

    let frameId = 0
    let layoutFrameId = 0
    frameId = window.requestAnimationFrame(() => {
      layoutFrameId = window.requestAnimationFrame(() => {
        const activeQuestion = activeQuestionRef.current
        if (!activeQuestion) return

        const rect = activeQuestion.getBoundingClientRect()
        const viewportHeight = window.visualViewport?.height || window.innerHeight
        const safeTop = Math.min(140, Math.max(72, viewportHeight * 0.16))
        const comfortableBottomSpace = viewportHeight <= 700 ? 120 : 160
        const availableHeight = viewportHeight - safeTop - comfortableBottomSpace
        const centeredTop = (viewportHeight - rect.height) / 2 - 24
        const targetTop = rect.height <= availableHeight
          ? Math.max(safeTop, centeredTop)
          : safeTop
        const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - viewportHeight)
        const targetScrollTop = Math.min(
          maxScrollTop,
          Math.max(0, window.scrollY + rect.top - targetTop),
        )

        window.scrollTo({
          top: targetScrollTop,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(layoutFrameId)
    }
  }, [prefersReducedMotion, questionReady, step])

  const handleQuestionComplete = useCallback(() => {
    interactionGuardRef.current = false
    setReadyStep(step)
  }, [step])

  const advance = (callback) => {
    if (interactionGuardRef.current) return
    interactionGuardRef.current = true
    callback?.()
    onStepChange(nextStep)
  }

  const finishConversation = () => {
    if (interactionGuardRef.current) return
    interactionGuardRef.current = true
    onContinue()
  }

  const resetAnswersAfter = (targetStep) => {
    const targetIndex = sequence.indexOf(targetStep)
    const laterSteps = new Set(sequence.slice(targetIndex + 1))
    if (laterSteps.has('situation')) {
      onSituacaoChange('')
      onCategoriaChange(null)
    }
    if (laterSteps.has('type')) onTipoChange('')
    if (laterSteps.has('city')) {
      onCidadeChange('')
      onEstadoChange('')
    }
    if (laterSteps.has('district')) onBairroChange('')
    if (laterSteps.has('price')) {
      onPrecoChange('')
      onPrecoModoChange('')
    }
    if (laterSteps.has('condominium')) onCondominioChange('')
    if (laterSteps.has('iptu')) onIptuChange('')
    if (laterSteps.has('area')) onAreaChange('')
    if (laterSteps.has('bedrooms')) onQuartosChange(0)
    if (laterSteps.has('suites')) onSuitesChange(0)
    if (laterSteps.has('parking')) onVagasChange(0)
    if (laterSteps.has('highlights')) diferenciais.forEach(item => onToggleDestaque(item))
    if (laterSteps.has('cta')) onCtaChange('')
    if (laterSteps.has('phone')) onUseProfessionalPhoneChange('')
  }

  const editStep = (targetStep) => {
    if (interactionGuardRef.current) return
    interactionGuardRef.current = true
    resetAnswersAfter(targetStep)
    setReadyStep('')
    onStepChange(targetStep)
  }
  const textForm = ({ value, onChange, placeholder, optional = false, normalize }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (interactionGuardRef.current) return
        const normalized = normalize ? normalize(value) : String(value || '').trim()
        if (!normalized && !optional) {
          toast.error('Informe uma resposta para continuar.')
          return
        }
        if (normalized !== value) onChange(normalized)
        advance()
      }}
      className="space-y-3"
    >
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-xl bg-primary-800 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">Continuar</button>
        {optional && <button type="button" onClick={() => advance()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Pular</button>}
      </div>
    </form>
  )
  const optionButton = (key, label, active, onClick) => (
    <button
      key={key}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${active ? 'border-primary-600 bg-primary-700 text-white shadow-md shadow-primary-100' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50'}`}
    >
      {label}
    </button>
  )

  let questionContent = null
  if (step === 'purpose') {
    questionContent = <div className="grid gap-2 sm:grid-cols-2">{FINALIDADE_OPTIONS.map(option => optionButton(option.id, `${option.icon} ${option.label}`, finalidade === option.id, () => advance(() => {
      onFinalidadeChange(option.id)
      onSituacaoChange('')
      onCategoriaChange(null)
    })))}</div>
  } else if (step === 'situation') {
    questionContent = <div className="grid gap-2 sm:grid-cols-2">{situationOptions.map(option => optionButton(option.id, option.label, situacao === option.id, () => advance(() => {
      onSituacaoChange(option.id)
      onCategoriaChange(option.category)
    })))}</div>
  } else if (step === 'type') {
    questionContent = <div className="grid gap-2 sm:grid-cols-2">{TIPOS.map(option => optionButton(option, option, tipo === option, () => advance(() => {
      onTipoChange(option)
      onQuartosChange(0)
      onSuitesChange(0)
      onVagasChange(0)
    })))}</div>
  } else if (step === 'city') {
    questionContent = (
      <div className="space-y-3">
        <SmartCarouselStateSelect value={estado} onChange={(nextUf) => {
          onEstadoChange(nextUf)
          onCidadeChange('')
        }} />
        {estado && (
          <SmartCarouselCitySelect
            uf={estado}
            value={cidade}
            onChange={(nextCity) => {
              if (nextCity) advance(() => onCidadeChange(nextCity))
            }}
          />
        )}
      </div>
    )
  } else if (step === 'district') {
    questionContent = textForm({ value: bairro, onChange: onBairroChange, placeholder: 'Ex: Moema', normalize: normalizeBairro })
  } else if (step === 'price') {
    questionContent = (
      <div className="space-y-4">
        {!isRental && <div className="flex flex-wrap gap-2">
          {[
            { id: 'fixed', label: 'Preço fixo' },
            { id: 'starting_at', label: 'A partir de' },
          ].map(option => optionButton(option.id, option.label, precoModo === option.id, () => onPrecoModoChange(option.id)))}
        </div>}
        <input
          value={formatProduct3Price(preco)}
          onChange={event => onPrecoChange(sanitizePriceDigits(event.target.value))}
          inputMode="numeric"
          placeholder={isRental ? 'R$ 3.000/mês' : 'R$ 450.000'}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!preco || (!isRental && !precoModo)} onClick={() => advance(() => { if (isRental) onPrecoModoChange('monthly') })} className="rounded-xl bg-primary-800 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-45">Continuar</button>
          {!isRental && <button type="button" onClick={() => advance(() => { onPrecoModoChange(''); onPrecoChange('') })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Continuar sem informar preço</button>}
        </div>
      </div>
    )
  } else if (step === 'condominium') {
    questionContent = textForm({ value: condominio, onChange: value => onCondominioChange(sanitizePriceDigits(value)), placeholder: 'R$ 650', optional: true })
  } else if (step === 'iptu') {
    questionContent = textForm({ value: iptu, onChange: value => onIptuChange(sanitizePriceDigits(value)), placeholder: 'R$ 180', optional: true })
  } else if (step === 'area') {
    questionContent = (
      <div className="space-y-3">
        <div className="relative">
          <input
            value={area}
            onChange={event => onAreaChange(sanitizeAreaInput(event.target.value))}
            inputMode="decimal"
            placeholder="Ex: 110"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">m²</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!area} onClick={() => advance()} className="rounded-xl bg-primary-800 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-45">Continuar</button>
          <button type="button" onClick={() => advance(() => onAreaChange(''))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Continuar sem informar área</button>
        </div>
      </div>
    )
  } else if (step === 'bedrooms') {
    questionContent = <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{PRODUCT_3_BEDROOM_OPTIONS.map(option => optionButton(option, formatProduct3CountChoice(option, 5), quartos === option, () => advance(() => onQuartosChange(option))))}</div>
  } else if (step === 'suites') {
    questionContent = <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{PRODUCT_3_SUITE_AND_PARKING_OPTIONS.map(option => optionButton(option, formatProduct3CountChoice(option, 4), suites === option, () => advance(() => onSuitesChange(option))))}</div>
  } else if (step === 'parking') {
    questionContent = <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{PRODUCT_3_SUITE_AND_PARKING_OPTIONS.map(option => optionButton(option, formatProduct3CountChoice(option, 4), vagas === option, () => advance(() => onVagasChange(option))))}</div>
  } else if (step === 'highlights') {
    questionContent = <div className="space-y-4">
      <p className="text-xs font-semibold leading-relaxed text-slate-500 sm:text-sm">
        Escolha até 10 características que realmente diferenciam este imóvel. A IA utilizará as mais relevantes para enriquecer os textos da campanha e os banners compatíveis.
      </p>
      <div className="flex flex-wrap gap-2">{getProduct3Highlights(finalidade, tipo).map(item => {
        const active = diferenciais.includes(item)
        const disabled = !active && diferenciais.length >= MAX_DESTAQUES_CHAT_PRODUTO_3
        return <button key={item} type="button" aria-pressed={active} disabled={disabled} onClick={() => onToggleDestaque(item)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-slate-600'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>{item}</button>
      })}</div>
      <p className="text-xs font-semibold text-slate-500">{diferenciais.length} de {MAX_DESTAQUES_CHAT_PRODUTO_3} destaques selecionados</p>
      <button type="button" onClick={() => advance()} className="rounded-xl bg-primary-800 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">Confirmar destaques</button>
    </div>
  } else if (step === 'cta') {
    questionContent = <div className="grid gap-2 sm:grid-cols-3">{PRODUCT_3_CTA_OPTIONS.map(option => optionButton(option, option, cta === option, () => advance(() => onCtaChange(option))))}</div>
  } else if (step === 'phone') {
    questionContent = <div className="space-y-3">
      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-black text-slate-900">{formatBrazilianPhone(professionalPhone) || 'Telefone não cadastrado'}</p>
      <div className="grid gap-2 sm:grid-cols-2">
      {optionButton('yes', 'Sim, divulgar este telefone', useProfessionalPhone === 'yes', () => {
        if (!professionalPhone) {
          toast.error('Cadastre um telefone no Cadastro Profissional para utilizar esta opção.')
          return
        }
        advance(() => onUseProfessionalPhoneChange('yes'))
      })}
      {optionButton('no', 'Não divulgar', useProfessionalPhone === 'no', () => advance(() => onUseProfessionalPhoneChange('no')))}
      </div>
      {!professionalPhone && <p className="text-xs font-semibold text-amber-700">Corrija ou cadastre o número no Cadastro Profissional antes de divulgá-lo.</p>}
    </div>
  } else {
    questionContent = <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-sm font-bold leading-6 text-emerald-900">Conversa concluída. Seus dados e modelos foram preservados.</p><button type="button" onClick={finishConversation} className="mt-4 rounded-xl bg-primary-800 px-5 py-3 text-sm font-black text-white hover:bg-primary-700">Continuar para as imagens</button></div>
  }

  const summaryItems = [
    { label: 'Modelos selecionados', value: modelNames.length ? modelNames.join(', ') : `${selectedUseCount} peça(s)`, edit: onEditModels },
    { label: 'Finalidade', value: purposeLabel, step: 'purpose' },
    { label: 'Situação', value: situationLabel, step: 'situation' },
    { label: 'Tipo', value: tipo, step: 'type' },
    { label: 'Cidade', value: cidade, step: 'city' },
    { label: 'Bairro', value: bairro, step: 'district' },
    { label: 'Preço', value: priceLabel, step: 'price' },
    { label: 'Condomínio', value: condominio ? formatProduct3Price(condominio, '', 'rental') : '', step: 'condominium' },
    { label: 'IPTU', value: iptu ? formatProduct3Price(iptu) : '', step: 'iptu' },
    { label: 'Área', value: areaLabel, step: 'area' },
    { label: 'Dormitórios', value: sequence.includes('bedrooms') && activeIndex > sequence.indexOf('bedrooms') ? formatProduct3CountChoice(quartos, 5) : '', step: 'bedrooms' },
    { label: 'Suítes', value: sequence.includes('suites') && activeIndex > sequence.indexOf('suites') ? formatProduct3CountChoice(suites, 4) : '', step: 'suites' },
    { label: 'Vagas', value: activeIndex > sequence.indexOf('parking') ? formatProduct3CountChoice(vagas, 4) : '', step: 'parking' },
    { label: 'Destaques', value: diferenciais.length ? diferenciais.join(', ') : '', step: 'highlights' },
    { label: 'CTA', value: cta, step: 'cta' },
    { label: 'Telefone profissional', value: useProfessionalPhone === 'yes' ? formatBrazilianPhone(professionalPhone) : useProfessionalPhone === 'no' ? 'Não divulgar' : '', step: 'phone' },
    { label: 'Imagens enviadas', value: photosCount ? `${photosCount}` : 'Ainda não enviadas' },
  ].filter(item => item.value)

  return (
    <ProductCard data-smart-conversation className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6">
        <ConversationHeader eyebrow="Etapa 2" title="Converse com a IA" description="Uma pergunta por vez para preparar seus banners." />
      </div>
      <div className="grid min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8">
        <div className="min-w-0 space-y-4">
          {history.map(item => <div key={item.key} className="space-y-3"><ConversationAssistantBubble>{item.question}</ConversationAssistantBubble><ConversationUserBubble actions={<button type="button" aria-label={`Editar ${item.question}`} disabled={!questionReady} onClick={() => editStep(item.key)} className="ml-3 text-xs font-black text-cyan-200 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Editar</button>}>{item.answer}</ConversationUserBubble><ConversationAssistantBubble confirmation>{item.confirmation}.</ConversationAssistantBubble></div>)}
          <div ref={activeQuestionRef} aria-live="polite" aria-busy={!questionReady} className="scroll-mt-6">
            <ConversationQuestionCard
              label={step === 'done' ? 'Resumo concluído' : `Pergunta ${activeIndex + 1}`}
              title={<span className="min-h-7"><Product3ProgressiveQuestion key={step} text={questionLabels[step] || questionLabels.done} onComplete={handleQuestionComplete} prefersReducedMotion={prefersReducedMotion} /></span>}
            >
              {questionReady && <div className="animate-fade-in motion-reduce:animate-none">{questionContent}</div>}
            </ConversationQuestionCard>
          </div>
        </div>
        <aside className="min-w-0 rounded-3xl border border-primary-100 bg-[linear-gradient(145deg,#eff6ff,#ffffff)] p-5 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-700">Resumo da campanha</p>
          <div className="mt-4 space-y-2">
            {summaryItems.map(item => <div key={item.label} className="rounded-xl bg-white/80 px-3 py-2.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{item.label}</p><p className="mt-1 break-words text-sm font-bold text-slate-700">{item.value}</p></div>{(item.step || item.edit) && <button type="button" aria-label={`Editar ${item.label}`} disabled={!questionReady} onClick={item.edit || (() => editStep(item.step))} className="shrink-0 text-[11px] font-black text-primary-700 disabled:cursor-not-allowed disabled:opacity-50">Editar</button>}</div></div>)}
          </div>
        </aside>
      </div>
    </ProductCard>
  )
}

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
  const { user: authedUser, accessToken, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const produtoParamRaw = new URLSearchParams(location.search).get('produto') || location.state?.produto || ''
  const produtoParam = PRODUCT_CONTEXTS[produtoParamRaw] ? produtoParamRaw : ''
  const productContext = PRODUCT_CONTEXTS[produtoParam] || PRODUCT_CONTEXTS.campanha_completa
  const subprodutoParam = new URLSearchParams(location.search).get('subproduto') || location.state?.subproduto || ''
  const subprodutoLabel = SUBPRODUCT_LABELS[subprodutoParam] || ''
  const isProductEntry = ['hero', 'transformar_video'].includes(produtoParam)
  const defaultCampaignStep = isProductEntry ? 'property' : 'manual-catalog'
  const defaultCampaignFlowType = isProductEntry ? null : 'manual'
  const defaultCampaignObjective = ''
  const [fase, setFase] = useState('form')

  const [categoria, setCategoria] = useState(null)
  const [tipo, setTipo] = useState('')
  const [finalidade, setFinalidade] = useState(MVP_FINALIDADE)
  const [situacao, setSituacao] = useState('')
  const [quartos, setQuartos] = useState(2)
  const [banheiros, setBanheiros] = useState(1)
  const [suites, setSuites] = useState(0)
  const [vagas, setVagas] = useState(1)
  const [area, setArea] = useState('')
  const [preco, setPreco] = useState('')
  const [precoModo, setPrecoModo] = useState('')
  const [condominio, setCondominio] = useState('')
  const [iptu, setIptu] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cidades, setCidades] = useState([])
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [diferenciais, setDiferenciais] = useState([])
  const [difCustom, setDifCustom] = useState('')
  const [product3Cta, setProduct3Cta] = useState('')
  const [product3UseProfessionalPhone, setProduct3UseProfessionalPhone] = useState('')
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
  const [generationError, setGenerationError] = useState('')
  const [generationInFlight, setGenerationInFlight] = useState(false)
  const generationInFlightRef = useRef(false)
  const [downloadingRenderKey, setDownloadingRenderKey] = useState('')
  const [downloadingAllRenders, setDownloadingAllRenders] = useState(false)
  const renderPollRef = useRef(null)
  const [activePreviewModel, setActivePreviewModel] = useState(null)

  const closePreviewModal = useCallback(() => {
    setActivePreviewModel(null)
  }, [])

  const openPreviewModal = useCallback((model, event) => {
    event?.stopPropagation?.()
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
    const nextModelUses = Object.fromEntries(
      CAMPAIGN_MODEL_LIBRARY.map(model => [model.id, [model.compatibleUses[0]]])
    )
    setSelectedModelUses(nextModelUses)
    setSelectedTemplateIds(getTemplateIdsFromModelUses(nextModelUses))
  }

  const [creditos, setCreditos] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [productFlowStep, setProductFlowStep] = useState(defaultCampaignStep)
  const [bannerChatStep, setBannerChatStep] = useState('purpose')
  const [activeCampaignModelId, setActiveCampaignModelId] = useState(null)
  const [selectedModelUses, setSelectedModelUses] = useState({})
  const [campaignObjective, setCampaignObjective] = useState(defaultCampaignObjective)

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

  const catAtual = CATEGORIAS.find(c => c.id === categoria)
  const msgs = MSGS_POR_CAT[categoria] || MSGS_POR_CAT.medio_padrao
  const selectedCampaignPieces = getCampaignPiecesFromModelUses(selectedModelUses)
  const selectedTemplateIds = selectedCampaignPieces.map(piece => piece.template_id)
  const selectedTemplateIdSet = new Set(selectedTemplateIds)
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
  const estimatedCreditConsumption = selectedCatalogItems.reduce((sum, item) => sum + item.creditWeight, 0)
  const generationModeForCredits = 'manual'
  const generationCreditCost = estimatedCreditConsumption
  const generationHasPremiumVideo = selectedCatalogItems.some(item => ['video', 'reels'].includes(item.type))
  const minFotosImovel = isProductEntry ? (productContext.photoRequired ? 1 : 0) : MIN_FOTOS_PRODUTO_3
  const maxFotosImovel = isProductEntry ? MAX_FOTOS_OUTROS_PRODUTOS : MAX_FOTOS_PRODUTO_3

  const setSelectedTemplateIds = (templateIds = []) => {
    setSelectedModelUses(getModelUsesFromTemplateIds(templateIds))
  }

  const applySelectedModelUses = (modelUses = {}) => {
    const normalized = normalizeModelUses(modelUses)
    setSelectedModelUses(normalized)
    setSelectedTemplateIds(getTemplateIdsFromModelUses(normalized))
  }

  const toggleTemplateCatalogItem = (templateId) => {
    const next = new Set(selectedTemplateIds)
    if (next.has(templateId)) next.delete(templateId)
    else next.add(templateId)
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
      toast.error(`Selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} modelos.`)
      return
    }

    applySelectedModelUses(next)
  }

  useEffect(() => {
    if (fase !== 'gerando') return
    const iv = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2500)
    return () => clearInterval(iv)
  }, [fase, msgs.length])

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(renderPollRef.current) }, [])

  // Carrega cidades do IBGE quando o estado muda
  useEffect(() => {
    if (!isProductEntry) return undefined
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
  }, [estado, isProductEntry])

  const handleFotos = async (files) => {
    const disponiveis = Math.max(maxFotosImovel - fotos.length, 0)
    if (disponiveis <= 0) {
      toast.error(`Você pode enviar até ${maxFotosImovel} fotos do imóvel.`)
      return
    }
    const recebidas = Array.from(files || [])
    const novos = recebidas.slice(0, disponiveis)
    if (recebidas.length > disponiveis) {
      toast.error(`Para este produto, use no máximo ${maxFotosImovel} fotos do imóvel.`)
    }
    const processadas = await Promise.all(novos.map(async f => ({
      preview: URL.createObjectURL(f),
      ...(await resizeFoto(f)),
    })))
    setFotos(prev => [...prev, ...processadas].slice(0, maxFotosImovel))
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
  const bairroNormalizado = normalizeBairro(bairro)
  const destaquePersonalizado = isProductEntry ? normalizeShortFreeText(difCustom, 120) : ''
  const destaquesSelecionados = diferenciais.map(item => normalizeShortFreeText(item, 80)).filter(Boolean)
  const todosDestaques = [
    ...destaquesSelecionados,
    ...(destaquePersonalizado ? [destaquePersonalizado] : []),
  ]
  const destaquesProduto3 = todosDestaques.slice(0, MAX_DESTAQUES_BANNERS_PRODUTO_3)
  const dadosImovelValidos = tipo
    && bairroNormalizado
    && cidade.trim()
    && (isProductEntry || situacao)
    && (isProductEntry ? estado : (product3Cta && product3UseProfessionalPhone))
    && (finalidade === 'rental' ? Boolean(preco) : (!preco || precoModo))
  const profileWhatsapp = authedUser?.whatsapp || authedUser?.telefone || authedUser?.phone || authedUser?.phone_number || ''
  const product3PublicPhone = !isProductEntry && product3UseProfessionalPhone === 'yes' ? formatBrazilianPhone(profileWhatsapp) : ''
  const product3PhonePayload = !isProductEntry && product3UseProfessionalPhone === 'no'
    ? 'REMOVER_ELEMENTO'
    : (isProductEntry ? profileWhatsapp : product3PublicPhone)
  const product3SaleBadge = getProduct3PurposeBadge(finalidade)
  const product3PropertyTag = formatProduct3PropertyTag(situacao)
  const isLandProperty = ['Terreno / Lote', 'Loteamento'].includes(tipo)
  const isCommercialProperty = isCommercialPropertyType(tipo)
  const quartosParaPayload = isProductEntry && (isLandProperty || isCommercialProperty) ? 0 : quartos
  const suitesParaPayload = isProductEntry && (isLandProperty || isCommercialProperty) ? 0 : suites
  const vagasParaPayload = isProductEntry && isLandProperty ? 0 : vagas
  const podaGerar = categoria && dadosImovelValidos
  const maxDestaquesAtivos = isProductEntry ? MAX_DESTAQUES_FLUXO : MAX_DESTAQUES_CHAT_PRODUTO_3

  const toggleDestaque = (item) => {
    setDiferenciais(current => {
      if (current.includes(item)) return current.filter(value => value !== item)
      if (current.length >= maxDestaquesAtivos) {
        toast.error(`Selecione até ${maxDestaquesAtivos} destaques para esta campanha.`)
        return current
      }
      return [...current, item]
    })
  }

  const buildCampaignPropertyInput = (fotosUrls = []) => ({
    schema_version: 'campaign_property_input_v1',
    produto_origem: produtoParam || 'campanha_completa',
    subproduto_origem: subprodutoParam || null,
    finalidade,
    sale_badge: product3SaleBadge,
    property_tag: product3PropertyTag,
    broker_whatsapp: product3PhonePayload,
    tipo,
    estado,
    cidade,
    bairro: bairroNormalizado,
    situacao: situacao || (categoria === 'lancamento'
      ? 'lançamento'
      : categoria === 'em_construcao'
        ? 'em construção'
        : 'pronto'),
    padrao: categoria === 'popular_mcmv'
      ? 'popular'
      : categoria === 'alto_padrao'
        ? 'alto padrão'
        : 'médio',
    preco: precoParaPayload,
    preco_modo: precoModo || null,
    preco_exibicao: formatProduct3Price(preco, precoModo, finalidade) || 'Consulte',
    condominio: condominio || null,
    condominio_exibicao: condominio ? formatProduct3Price(condominio, '', 'rental') : null,
    iptu: iptu || null,
    iptu_exibicao: iptu ? formatProduct3Price(iptu) : null,
    area: area || null,
    dormitorios: quartosParaPayload,
    quartos: quartosParaPayload,
    suites: suitesParaPayload,
    vagas: vagasParaPayload,
    fotos_imovel: fotosUrls,
    destaques_selecionados: destaquesSelecionados,
    destaque_personalizado: destaquePersonalizado || null,
    destaques: todosDestaques,
    destaques_produto_3: destaquesProduto3,
    cta: !isProductEntry ? product3Cta : null,
    cta_text: !isProductEntry ? product3Cta : null,
    telefone_contato: product3PhonePayload,
    corretor_publico: {
      whatsapp: product3PhonePayload || null,
    },
  })

  const resetCampaignState = (targetStep = defaultCampaignStep) => {
    setFase('form'); setCategoria(null); setTipo(''); setFinalidade(MVP_FINALIDADE); setSituacao('')
    setQuartos(2); setBanheiros(1); setSuites(0); setVagas(1); setArea(''); setPreco(''); setPrecoModo(''); setCondominio(''); setIptu('')
    setBairro(''); setCidade(''); setEstado(''); setDiferenciais([]); setDifCustom(''); setProduct3Cta(''); setProduct3UseProfessionalPhone(''); setFotos([]); setVideoArquivo(null)
    setResultado(null); setCampanhaId(null); setIgPostado(false)
    setShowAgendamento(false)
    setRenders(null); setRequestedVisualPieces([]); setGerandoBanners(false); setGenerationNotice(''); setGenerationError(''); setProductFlowStep(targetStep); setBannerChatStep('purpose'); setActiveCampaignModelId(null); setSelectedModelUses({}); setCampaignObjective(defaultCampaignObjective)
    clearInterval(renderPollRef.current)
  }

  const startAnotherBannerGeneration = () => {
    setFase('form')
    setProductFlowStep('manual-catalog')
    setBannerChatStep('done')
    setSelectedModelUses({})
    setActiveCampaignModelId(null)
    setResultado(null)
    setCampanhaId(null)
    setRenders(null)
    setRequestedVisualPieces([])
    setGerandoBanners(false)
    setGenerationNotice('')
    setGenerationError('')
    clearInterval(renderPollRef.current)
  }

  const voltarResultadoParaCusto = () => {
    setFase('form')
    setProductFlowStep('manual-catalog')
  }

  const confirmarGeracao = () => {
    if (isProductEntry) {
      toast('A geração real deste produto será conectada na próxima fase.')
      return
    }
    if (!dadosImovelValidos) { toast.error('Preencha os campos obrigatórios'); return }
    if (!isProductEntry && fotos.length < MIN_FOTOS_PRODUTO_3) {
      toast.error(`Envie de ${MIN_FOTOS_PRODUTO_3} a ${MAX_FOTOS_PRODUTO_3} fotos do imóvel antes de gerar.`)
      setProductFlowStep('photos')
      return
    }
    if (!categoria) setCategoria('medio_padrao')
    setShowConfirm(true)
  }

  // ══════════════════════════════════════════════════════════
  //  GERAÇÃO — CORRIGIDA
  //  Upload de fotos não trava mais o processo.
  //  Se falhar, continua sem fotos e avisa o usuário.
  // ══════════════════════════════════════════════════════════
  const gerarAnuncios = async () => {
    if (generationInFlightRef.current) return
    generationInFlightRef.current = true
    setGenerationInFlight(true)
    setShowConfirm(false)
    setFase('gerando')
    setMsgIdx(0)
    setGenerationNotice('')
    setGenerationError('')

    try {
      const todosDisferenciais = destaquesProduto3

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
        toast.error(`Selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} modelos.`)
        setFase('form')
        return
      }
      if (!isProductEntry && fotos.length < MIN_FOTOS_PRODUTO_3) {
        toast.error(`Envie de ${MIN_FOTOS_PRODUTO_3} a ${MAX_FOTOS_PRODUTO_3} fotos do imóvel para gerar os banners.`)
        setFase('form')
        setProductFlowStep('photos')
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
      const fotosParaUpload = fotos.slice(0, maxFotosImovel)
      for (let i = 0; i < fotosParaUpload.length; i++) {
        const f = fotosParaUpload[i]
        const bin = Uint8Array.from(atob(f.dados), (c) => c.charCodeAt(0))
        const blob = new Blob([bin], { type: f.tipo })
        const path = `${userId}/campaigns/${Date.now()}_${i}.jpg`
        let url = null
        for (let tentativa = 1; tentativa <= 2; tentativa++) {
          try {
            const { error: upErr } = await uploadComTimeout(path, blob, f.tipo)
            if (upErr) {
              if (import.meta.env.DEV) console.error(`[upload] foto ${i + 1} tentativa ${tentativa} falhou`)
              continue
            }
            if (!path.startsWith(`${userId}/`)) {
              if (import.meta.env.DEV) console.error(`[upload] foto ${i + 1} caminho inválido`)
              continue
            }
            const { data: signed, error: signedErr } = await supabase.storage
              .from('smartcorretor-assets')
              .createSignedUrl(path, 60 * 60 * 24)
            if (signedErr) {
              if (import.meta.env.DEV) console.error(`[upload] foto ${i + 1} assinatura falhou`)
              continue
            }
            url = signed.signedUrl
            break
          } catch {
            if (import.meta.env.DEV) console.error(`[upload] foto ${i + 1} tentativa ${tentativa} falhou ou expirou`)
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
      // Inputs derivados do formulário para o gerar-banners (não dependem do AI ainda)
      const enderecoCompleto = [bairroNormalizado, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')
      const tituloPreliminar = `${tipo || 'Imóvel'} ${quartosParaPayload ? quartosParaPayload + 'q ' : ''}em ${bairroNormalizado || cidade || ''}`.trim()
      const descricaoPreliminar = [
        `${tipo || 'Imóvel'} ${categoria ? '(' + categoria + ')' : ''}`,
        isLandProperty ? '' : `${quartosParaPayload} quarto${quartosParaPayload !== 1 ? 's' : ''}, ${banheiros} banheiro${banheiros !== 1 ? 's' : ''}, ${vagasParaPayload} vaga${vagasParaPayload !== 1 ? 's' : ''}`,
        area ? `${area}m²` : '',
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
        product3Cta ? `Chamada final: ${product3Cta}` : '',
      ].filter(Boolean).join('. ')

      // Foto do corretor: se o perfil não tem avatar cadastrado, força REMOVER_ELEMENTO
      // (assim o template não renderiza a mulher fictícia padrão).
      const tituloComercial = `${tipo || 'Imóvel'} ${finalidade === 'rental' ? 'para locação' : 'à venda'}`.trim()
      const headlineComercial = tituloComercial || `${tipo || 'Imóvel'} em destaque`
      const especificacoesPrincipais = [
        formatQuantityLabel(quartosParaPayload, 'Dormitório'),
        suitesParaPayload > 0 ? formatQuantityLabel(suitesParaPayload, 'Suíte') : '',
        formatQuantityLabel(vagasParaPayload, 'Vaga'),
        area ? `${area}m²` : '',
      ].filter(Boolean).join(', ')
      const descricaoComercial = [
        headlineComercial,
        `${tipo || 'Imóvel'} em ${bairroNormalizado || cidade || 'destaque'}`,
        especificacoesPrincipais,
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
        product3Cta ? `Chamada final: ${product3Cta}` : '',
      ].filter(Boolean).join('. ')

      const avatarPerfil = authedUser?.avatar_url || authedUser?.foto_url || authedUser?.photo_url || ''
      const corretorAvatarUrl = avatarPerfil ? avatarPerfil : 'REMOVER_ELEMENTO'

      // fotos_urls vai EM ORDEM — a primeira é a principal do imóvel, demais são secundárias.
      const fotosOrdenadas = fotos_urls.slice(0, maxFotosImovel)
      const fotoPrincipal = fotosOrdenadas[0] || null
      const campaignPropertyInput = buildCampaignPropertyInput(fotosOrdenadas)

      setRenders(null)
      setRequestedVisualPieces(selectedTemplates)

      // A criação visual só é iniciada depois que a campanha indispensável é validada.
      const invokeBanners = () => selectedTemplates.length > 0
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
              preco_modo: precoModo || null,
              preco_exibicao: formatProduct3Price(preco, precoModo, finalidade) || 'Consulte',
              finalidade,
              sale_badge: product3SaleBadge,
              property_tag: product3PropertyTag,
              broker_whatsapp: product3PhonePayload,
              cta: product3Cta,
              cta_text: product3Cta,
              suites: suitesParaPayload,
              quartos: quartosParaPayload,
              vagas: vagasParaPayload,
              area: area || null,
              endereco: enderecoCompleto,
              tipo_imovel: tipo,
              dados_imovel: campaignPropertyInput,
              corretor_nome: authedUser?.displayName || authedUser?.full_name || authedUser?.nome || authedUser?.email?.split('@')[0] || '',
              corretor_avatar_url: corretorAvatarUrl,
              marca_imovel: authedUser?.imobiliaria || authedUser?.marca || authedUser?.nome_imobiliaria || '',
              ...creditPayload,
            },
          })
        : Promise.resolve({ data: { renders: [], skipped: true }, error: null })

      const [campaignResult] = await Promise.allSettled([
        supabase.functions.invoke('gerar-campanha', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            user_id: userId,
            categoria,
            tipo,
            dados: {
              finalidade, situacao, quartos: quartosParaPayload, banheiros, suites: suitesParaPayload, vagas: vagasParaPayload,
              area: area || null, preco: precoParaPayload, bairro: bairroNormalizado, cidade, estado,
              preco_modo: precoModo || null,
              preco_exibicao: formatProduct3Price(preco, precoModo, finalidade) || 'Consulte',
              condominio: condominio || null,
              iptu: iptu || null,
              cta: product3Cta,
              cta_text: product3Cta,
              diferenciais: todosDestaques,
              destaques_selecionados: destaquesSelecionados,
              destaque_personalizado: destaquePersonalizado || null,
              telefone_contato: product3PublicPhone,
              sale_badge: product3SaleBadge,
              property_tag: product3PropertyTag,
              broker_whatsapp: product3PhonePayload,
              formatos_selecionados: selectedModelUses,
              selectedTemplates,
              selected_templates: selectedTemplates,
              pieces: selectedTemplates,
            },
            fotos_urls: fotosOrdenadas,
            foto_principal: fotoPrincipal,
            redes_sociais: ['instagram_feed', 'instagram_stories', 'whatsapp', 'facebook', 'tiktok'],
          },
        }),
      ])

      // ── Processar resultado da CAMPANHA (textos) ──
      let campaignData = null
      let partialCampaignWarning = ''
      if (campaignResult.status === 'rejected') {
        const errBody = await readFunctionErrorBody(campaignResult.reason)
        if (import.meta.env.DEV) console.error('[gerar-campanha] falha controlada')
        if (errBody?.textos) {
          campaignData = { textos: errBody.textos, error: errBody.error }
          partialCampaignWarning = 'Os textos foram gerados, mas a campanha não foi salva automaticamente.'
        } else {
          throw new Error(errBody?.error || campaignResult.reason?.message || 'Erro ao gerar campanha')
        }
      } else {
        const { data, error } = campaignResult.value
        if (error) {
          const errBody = await readFunctionErrorBody(error)
          if (import.meta.env.DEV) console.error('[gerar-campanha] resposta de erro controlada')
          if (errBody?.textos) {
            campaignData = { textos: errBody.textos, error: errBody.error }
            partialCampaignWarning = 'Os textos foram gerados, mas a campanha não foi salva automaticamente.'
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
          ...campaignPropertyInput,
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
      setFase('resultado')

      setGerandoBanners(selectedTemplates.length > 0)
      const [bannersResult] = await Promise.allSettled([invokeBanners()])

      // ── Processar resultado dos BANNERS (renders) ──
      if (bannersResult.status === 'fulfilled') {
        const { data: bData, error: bError } = bannersResult.value
        if (bError) {
          if (import.meta.env.DEV) console.error('[gerar-banners] resposta de erro controlada')
          setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
            missingStatus: 'failed',
            missingErrorMessage: BANNER_BATCH_ERROR,
          }))
          setGenerationNotice('Textos IA gerados. Materiais visuais não foram iniciados agora; tente gerar novamente em alguns instantes.')
          toast.error('Textos gerados, mas os materiais visuais não foram iniciados.')
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
          // Linkar renders à campanha recém-criada (gerar-banners rodou sem campaign_id)
          if (camp.id) {
            const { error: linkError } = await supabase
              .from('campaigns')
              .update({ banners: rs })
              .eq('id', camp.id)
            if (linkError && import.meta.env.DEV) console.warn('[link banners] falha controlada')
          }
          iniciarPollingRenders(rs, camp.id || null, selectedTemplates)
        } else {
          if (import.meta.env.DEV) console.warn('[gerar-banners] retorno sem renders')
          setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
            missingStatus: 'failed',
            missingErrorMessage: MISSING_RENDER_ERROR,
          }))
          setGenerationNotice('Textos IA gerados. Nenhum material visual foi retornado ainda.')
        }
      } else {
        if (import.meta.env.DEV) console.error('[gerar-banners] falha controlada')
        setRenders(mergeRequestedVisualPieces(selectedTemplates, [], {
          missingStatus: 'failed',
          missingErrorMessage: BANNER_BATCH_ERROR,
        }))
        setGenerationNotice('Textos IA gerados. Materiais visuais não foram iniciados agora; tente gerar novamente em alguns instantes.')
        toast.error('Textos gerados, mas os materiais visuais não foram iniciados.')
      }

      setGerandoBanners(false)
      setTimeout(() => setShowAgendamento(true), 1800)

    } catch {
      if (import.meta.env.DEV) console.error('[gerarAnuncios] falha controlada')
      setGenerationError(CAMPAIGN_GENERATION_ERROR)
      toast.error(CAMPAIGN_GENERATION_ERROR)
    } finally {
      generationInFlightRef.current = false
      setGenerationInFlight(false)
      setGerandoBanners(false)
    }
  }

  const copiar = async (texto, id) => {
    await navigator.clipboard.writeText(texto)
    setCopiadoId(id); toast.success('Copiado!')
    setTimeout(() => setCopiadoId(null), 2000)
  }
  const baixarTextosDaCampanha = () => {
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
    const objectUrl = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: objectUrl, download: `anuncios-${resultado.titulo?.replace(/\s+/g, '-').toLowerCase() || 'imovel'}.txt` })
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  const renovarUrlRender = async (render) => {
    const renderId = render?.renderId || render?.render_id
    if (!renderId) throw new Error('download_url_missing')
    if (!accessToken) throw new Error('download_request_failed')

    console.info('[renders] signed URL refresh requested', { render_id: renderId, at: new Date().toISOString(), restart_render: false })
    const { data, error } = await supabase.functions.invoke('get-render-status', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        render_ids: [renderId],
        renders: [render],
        campaign_id: campanhaId || null,
        refresh_urls: true,
      },
    })
    if (error) throw new Error(error.message || 'download_request_failed')
    const update = Array.isArray(data?.renders) ? data.renders[0] : null
    const status = normalizeRenderStatus(update?.status)
    const renewedUrl = getRenderFinalUrl(update)
    if (!RENDER_READY_STATUSES.has(status) || !renewedUrl) throw new Error('download_url_missing')

    setRenders(current => (Array.isArray(current) ? current : []).map(item => (
      item?.render_id === renderId ? { ...item, ...update } : item
    )))
    console.info('[renders] signed URL refreshed', {
      render_id: renderId,
      status,
      at: new Date().toISOString(),
      preview_source_equals_download_source: true,
      download_enabled: true,
    })
    return renewedUrl
  }

  const baixarPecaVisual = async (render, index) => {
    const finalUrl = getRenderFinalUrl(render)
    const downloadKey = render?.piece_id || render?.render_id || `render-${index}`
    if (!finalUrl) {
      toast.error('O arquivo final desta peça ainda não está disponível.')
      return
    }

    setDownloadingRenderKey(downloadKey)
    try {
      await downloadFileFromPrivateUrl(finalUrl, getRenderDownloadName(render, index))
      toast.success('Download iniciado.')
    } catch (error) {
      const refreshable = ['download_url_expired', 'download_request_blocked', 'download_url_invalid'].includes(error?.code || error?.message)
      if (refreshable) {
        try {
          const renewedUrl = await renovarUrlRender(render)
          await downloadFileFromPrivateUrl(renewedUrl, getRenderDownloadName(render, index))
          toast.success('Download iniciado com um novo link seguro.')
        } catch (refreshError) {
          toast.error(getDownloadErrorMessage(refreshError))
        }
      } else {
        toast.error(getDownloadErrorMessage(error))
      }
    } finally {
      setDownloadingRenderKey('')
    }
  }

  const baixarTudo = async (visualPieces = []) => {
    if (downloadingAllRenders) return
    const readyPieces = visualPieces.filter(render => (
      RENDER_READY_STATUSES.has(normalizeRenderStatus(render?.status))
      && getRenderFinalUrl(render)
    ))

    if (!readyPieces.length) {
      baixarTextosDaCampanha()
      toast.error('Nenhuma peça visual concluída está disponível para download.')
      return
    }

    setDownloadingAllRenders(true)
    let completed = 0
    let firstError = null
    try {
      for (const [index, render] of readyPieces.entries()) {
        try {
          await downloadFileFromPrivateUrl(getRenderFinalUrl(render), getRenderDownloadName(render, index))
          completed += 1
        } catch (error) {
          const refreshable = ['download_url_expired', 'download_request_blocked', 'download_url_invalid'].includes(error?.code || error?.message)
          if (refreshable) {
            try {
              const renewedUrl = await renovarUrlRender(render)
              await downloadFileFromPrivateUrl(renewedUrl, getRenderDownloadName(render, index))
              completed += 1
            } catch (refreshError) {
              firstError ||= refreshError
            }
          } else {
            firstError ||= error
          }
        }
      }
      baixarTextosDaCampanha()
      if (completed === readyPieces.length) {
        toast.success(`${completed} ${completed === 1 ? 'peça baixada' : 'peças baixadas'} com os textos da campanha.`)
      } else {
        toast.error(`${completed} de ${readyPieces.length} peças foram baixadas. ${getDownloadErrorMessage(firstError)}`)
      }
    } finally {
      setDownloadingAllRenders(false)
    }
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
    const structuredError = {
      source,
      ...debugPayload,
    }
    console.error(`[renders] render falhou:\n${JSON.stringify(structuredError, null, 2)}`)
    console.dir(structuredError, { depth: null })
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
        updates.forEach(render => console.info('[renders] polling', {
          render_id: render.render_id,
          status: normalizeRenderStatus(render.status),
          at: new Date().toISOString(),
          final_url_requested_at: render.final_url_requested_at || null,
          final_url_available: Boolean(getRenderFinalUrl(render)),
        }))
        updates.forEach(render => logFailedRender(render, 'get-render-status'))
        mergeRenderUpdates(updates)

        const updatesById = new Map(updates.map(item => [item.render_id, item]))
        const allDone = renderIds.every(renderId => {
          const update = updatesById.get(renderId)
          const status = normalizeRenderStatus(update?.status)
          return RENDER_ERROR_STATUSES.has(status)
            || (RENDER_READY_STATUSES.has(status) && Boolean(getRenderFinalUrl(update)))
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
      toast.error(`Selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} modelos.`)
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
      const fotosOrdenadas = (Array.isArray(fotosBrutas) ? fotosBrutas : []).slice(0, maxFotosImovel)
      const fotoPrincipal = fotosOrdenadas[0] || null

      const enderecoCompleto = [bairroNormalizado, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')
      const campaignPropertyInput = buildCampaignPropertyInput(fotosOrdenadas)

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
          preco_modo: precoModo || null,
          preco_exibicao: formatProduct3Price(preco, precoModo, finalidade) || 'Consulte',
          finalidade,
          sale_badge: product3SaleBadge,
          property_tag: product3PropertyTag,
          broker_whatsapp: product3PhonePayload,
          cta: product3Cta,
          cta_text: product3Cta,
          suites: suitesParaPayload,
          quartos: quartosParaPayload,
          vagas: vagasParaPayload,
          area: area || null,
          endereco: enderecoCompleto,
          tipo_imovel: tipo,
          dados_imovel: campaignPropertyInput,
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
    const goHome = () => {
      navigate('/dashboard')
    }
    const goBackFromProperty = () => {
      if (isProductEntry) {
        navigate(productContext.sourcePath)
        return
      }
      setProductFlowStep('manual-catalog')
    }
    const startManualFlow = () => {
      setActiveCampaignModelId(null)
      setCampaignObjective(defaultCampaignObjective)
      setProductFlowStep('manual-catalog')
    }
    const continueFromManual = () => {
      if (selectedTemplateIds.length === 0) {
        toast.error('Selecione pelo menos um produto de marketing.')
        return
      }
      if (selectedTemplatePayload.length > MAX_VISUAL_PIECES_PER_GENERATION) {
        toast.error(`Selecione até ${MAX_VISUAL_PIECES_PER_GENERATION} modelos.`)
        return
      }
      setProductFlowStep('property')
    }
    const continueFromProperty = () => {
      if (!dadosImovelValidos) {
        toast.error('Preencha os campos obrigatórios do imóvel.')
        return
      }
      if (!categoria) setCategoria('medio_padrao')
      setProductFlowStep('photos')
    }
    const continueFromUploads = () => {
      if (productContext.photoRequired && fotos.length < minFotosImovel) {
        toast.error(isProductEntry
          ? 'Envie ao menos uma foto para continuar.'
          : `Envie de ${MIN_FOTOS_PRODUTO_3} a ${MAX_FOTOS_PRODUTO_3} fotos do imóvel para continuar.`)
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

        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Foco dos textos
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Escolha um foco para adaptar textos, CTA e linguagem dos banners.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              Marketing
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SMART_CAMPAIGNS.filter(campaign => !campaign.hidden).map(campaign => {
              const active = campaignObjective === campaign.id
              return (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => setCampaignObjective(campaign.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? 'gradient-primary text-white border-transparent shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
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
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipo(t)
                  if (isCommercialPropertyType(t)) {
                    setQuartos(0)
                    setSuites(0)
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${tipo === t ? 'gradient-primary text-white border-transparent shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Finalidade</label>
          <div className="inline-flex gap-2 rounded-2xl bg-gray-50 p-1.5 ring-1 ring-gray-200">
            {FINALIDADE_OPTIONS.map(option => {
              const active = finalidade === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFinalidade(option.id)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    active
                      ? 'bg-primary-800 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  <span aria-hidden="true" className="text-base">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {!isLandProperty && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Quantidade</label>
            <div className="flex gap-6 flex-wrap">
              {!isCommercialProperty && (
                <>
                  <Counter label="Quartos" value={quartos} onChange={setQuartos} />
                  <Counter label="Suítes" value={suites} onChange={setSuites} />
                </>
              )}
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
            <input value={bairro} onChange={e => setBairro(e.target.value)} onBlur={() => setBairro(normalizeBairro(bairro))} placeholder="Ex: Moema, Jardins, Copacabana"
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
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isCommercialProperty ? 'Área útil (m²)' : 'Área (m²)'} <span className="text-gray-400 font-normal">opcional</span></label>
            <input value={area} onChange={e => setArea(e.target.value)} type="number" placeholder="Ex: 110"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Destaques do imóvel
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Selecione os principais diferenciais do imóvel. Para banners, usaremos apenas os mais relevantes.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              {diferenciais.length}/{MAX_DESTAQUES_FLUXO}
            </span>
          </div>

          <div className="space-y-3">
            {DESTAQUE_CATEGORIES.map(category => (
              <div key={category.title} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">{category.title}</p>
                <div className="flex flex-wrap gap-2">
                  {category.items.map(item => {
                    const active = diferenciais.includes(item)
                    const disabled = !active && diferenciais.length >= MAX_DESTAQUES_FLUXO
                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDestaque(item)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                        } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label htmlFor="destaque-personalizado" className="block text-sm font-bold text-gray-900">
              Destaque personalizado
            </label>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Opcional — até 120 caracteres.
            </p>
            <input
              id="destaque-personalizado"
              value={difCustom}
              onChange={e => setDifCustom(e.target.value.slice(0, 120))}
              onBlur={() => setDifCustom(normalizeShortFreeText(difCustom, 120))}
              maxLength={120}
              placeholder="Ex: sol da manhã, prédio recém-entregue, rua tranquila"
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-gray-400">
              <span>Não substitui os destaques selecionados.</span>
              <span className={difCustom.length >= 110 ? 'font-bold text-amber-600' : ''}>{difCustom.length}/120</span>
            </div>
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
            <span className="text-xs text-gray-400 font-medium">{fotos.length}/{maxFotosImovel} fotos</span>
          </div>
          <p className="text-xs text-gray-500">{productContext.uploadHelp}</p>
          {!isProductEntry && (
            <p className="mt-1 text-xs font-semibold text-gray-600">
              Envie de {MIN_FOTOS_PRODUTO_3} a {MAX_FOTOS_PRODUTO_3} fotos do imóvel. A primeira será usada como principal.
            </p>
          )}
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

            {fotos.length < maxFotosImovel && (
              <div onClick={() => fileRef.current.click()} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFotos(e.dataTransfer.files) }}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleFotos(e.target.files)} />
                <Camera className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Clique ou arraste as fotos aqui</p>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG · {isProductEntry ? `até ${maxFotosImovel} fotos` : `${MIN_FOTOS_PRODUTO_3} a ${MAX_FOTOS_PRODUTO_3} fotos`} · a primeira é a principal
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    )
    const reviewSituationLabel = Object.values(PRODUCT_3_SITUATIONS).flat().find(item => item.id === situacao)?.label || ''
    const analysisItems = [
      finalidade ? `Finalidade: ${FINALIDADE_OPTIONS.find(item => item.id === finalidade)?.label || finalidade}` : '',
      reviewSituationLabel ? `Situação: ${reviewSituationLabel}` : '',
      tipo ? `Tipo: ${tipo}` : '',
      [bairroNormalizado, cidade].filter(Boolean).length ? `Localização: ${[bairroNormalizado, cidade].filter(Boolean).join(', ')}` : '',
      preco ? `${finalidade === 'rental' ? 'Valor da locação' : 'Preço'}: ${formatProduct3Price(preco, precoModo, finalidade)}` : 'Preço não informado',
      finalidade === 'rental' && condominio ? `Condomínio: ${formatProduct3Price(condominio, '', 'rental')}` : '',
      finalidade === 'rental' && iptu ? `IPTU: ${formatProduct3Price(iptu)}` : '',
      area ? `Área: ${formatAreaLabel(area)}` : 'Área não informada',
      `Dormitórios: ${formatProduct3CountChoice(quartos, 5)}`,
      `Suítes: ${formatProduct3CountChoice(suites, 4)}`,
      `Vagas: ${formatProduct3CountChoice(vagas, 4)}`,
      `Destaques: ${todosDestaques.length ? todosDestaques.join(', ') : 'Nenhum selecionado'}`,
      `CTA: ${product3Cta}`,
      `Telefone profissional: ${product3UseProfessionalPhone === 'yes' ? 'Sim' : 'Não'}`,
      `Imagens: ${fotos.length}`,
      `Modelos: ${selectedModelCount} · Peças: ${selectedUseCount}`,
    ].filter(Boolean)
    const strategyLabel = 'Banners selecionados'

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
                <p className="text-xs font-black uppercase tracking-wide text-primary-600">Preview do modelo</p>
                <h3 className="mt-1 text-lg font-black text-gray-950">{activePreviewModel.previewTitle || activePreviewModel.name}</h3>
                {activePreviewModel.previewDescription && (
                  <p className="mt-1 text-sm font-semibold text-gray-500">{activePreviewModel.previewDescription}</p>
                )}
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
              <PreviewMedia model={activePreviewModel} variant="modal" controls />
            </div>
          </div>
        </div>
      )}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-base">Confirmar geração</h3>
              <p className="text-xs text-gray-500">Sua campanha completa será gerada em um clique.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Peças selecionadas</span>
                <span className="font-black text-gray-900">{selectedCatalogItems.length}</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-500">
                A geração será validada com segurança no servidor.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={gerarAnuncios} disabled={generationInFlight}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
                <Sparkles className="w-4 h-4" />
                Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-full bg-slate-50/70 [&>header]:h-auto [&>header]:min-h-16 [&>header]:py-3">
          <Header
            title={fase === 'form' && productFlowStep === 'manual-catalog' ? 'Banners Rápidos' : productContext.headerTitle}
            subtitle={fase === 'form' && productFlowStep === 'manual-catalog' ? 'Crie banners profissionais em poucos cliques' : productContext.headerSubtitle}
          />
          <main className={`mx-auto px-5 sm:px-8 ${fase === 'form' && productFlowStep === 'manual-catalog' ? 'max-w-7xl py-4' : 'max-w-5xl py-6'}`}>
            {fase === 'form' && productFlowStep === 'manual-catalog' && (<>
              <div className="w-full">
                <section className="relative mb-8 grid items-center gap-10 overflow-hidden px-7 py-10 sm:px-10 lg:min-h-[305px] lg:grid-cols-[.96fr_1.04fr] lg:px-8 lg:py-8 xl:px-10">
                  <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" aria-hidden="true" />
                  <div className="relative z-10">
                    <h1 className="max-w-2xl text-4xl font-black leading-[1.06] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[3rem] xl:text-[3.25rem]">
                      <span className="block lg:whitespace-nowrap">Crie banners incríveis</span>
                      <span className="mt-1 block text-primary-600 lg:whitespace-nowrap">para divulgar seus imóveis <span aria-hidden="true">⚡</span></span>
                    </h1>
                    <p className="mt-7 max-w-xl text-base font-medium leading-[1.75] text-slate-600 sm:text-lg">
                      Escolha um modelo, personalize as informações e gere banners profissionais em segundos.
                    </p>
                  </div>

                  <div className="relative min-h-[290px] lg:min-h-[275px]">
                    <div className="absolute inset-y-2 right-0 w-[78%] opacity-30 [background-image:radial-gradient(circle_at_center,#3b82f6_1.5px,transparent_1.5px)] [background-size:18px_18px]" aria-hidden="true" />
                    <div className="absolute left-[7%] top-[5%] h-[84%] w-[84%] rotate-[-3deg] rounded-2xl border border-blue-100 bg-blue-100/70" aria-hidden="true" />
                    <div className="absolute left-[11%] top-[10%] h-[84%] w-[84%] rotate-[2deg] rounded-2xl border border-blue-100 bg-white/80 shadow-sm" aria-hidden="true" />
                    <div className="absolute left-0 top-[15%] h-[80%] w-[92%] -rotate-2 overflow-hidden rounded-2xl border-4 border-white bg-primary-950 shadow-[0_28px_60px_-18px_rgba(15,23,42,0.68)]">
                      <img src="/banners-rapidos/hero-imovel.jpg" alt="Imóvel de alto padrão em um exemplo de banner" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/35 to-transparent" aria-hidden="true" />
                      <div className="absolute inset-y-0 left-0 flex w-[48%] flex-col justify-center p-5 text-white sm:p-7">
                        <p className="text-base font-bold sm:text-lg">Seu próximo</p>
                        <p className="mt-1 text-2xl font-black leading-none sm:text-3xl">IMÓVEL</p>
                        <p className="mt-1 text-lg font-black sm:text-xl">está aqui!</p>
                        <span className="mt-4 w-fit rounded-md bg-white px-3 py-1.5 text-[10px] font-black uppercase text-primary-950">Saiba mais</span>
                      </div>
                    </div>
                    <div className="absolute right-0 top-[22%] flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg ring-4 ring-white">
                      <Zap className="h-5 w-5" />
                    </div>
                  </div>
                </section>

                <Product3Progress activeStep={0} />

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
                <section className="rounded-3xl bg-white p-6 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 sm:p-7">
                  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Escolha o modelo ideal para você</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
                        Selecionamos os formatos mais usados pelos corretores para você divulgar com mais impacto.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
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

                  <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      {CAMPAIGN_USE_DISPLAY_ORDER.map(useId => CAMPAIGN_USE_OPTIONS[useId]).map(use => (
                        <span
                          key={use.id}
                          title={use.label}
                          className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-4 py-6 text-center shadow-[0_16px_36px_-28px_rgba(15,23,42,0.5)] transition-transform hover:-translate-y-0.5"
                        >
                          <CampaignUseBrandIcon use={use} />
                          <span className="mt-4 text-sm font-black text-slate-900">{use.visualLabel}</span>
                          <span className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{use.description}</span>
                        </span>
                      ))}
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {CAMPAIGN_MODEL_LIBRARY.map(model => {
                      const useIds = selectedModelUses[model.id] || []
                      const selected = useIds.length > 0
                      return (
                        <article key={model.id}
                          className={`group flex h-full flex-col rounded-3xl bg-white p-4 transition-all duration-200 ${
                            selected
                              ? 'shadow-[0_20px_45px_-24px_rgba(30,64,175,0.65)] ring-2 ring-primary-500'
                              : 'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-26px_rgba(15,23,42,0.5)] hover:ring-primary-200'
                          }`}>
                          <div className="text-left">
                            <CampaignModelPreview model={model} />

                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="overflow-hidden text-base font-black leading-tight text-slate-950 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{model.name}</h3>
                                <p className="mt-2 overflow-hidden text-sm leading-relaxed text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{model.description}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => openPreviewModal(model, event)}
                                  className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-black text-primary-800 hover:bg-primary-100"
                                >
                                  {model.previewLabel || 'Ver'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 border-t border-slate-100 pt-4">
                            <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Selecione onde usar</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {model.compatibleUses.map(useId => {
                                const use = CAMPAIGN_USE_OPTIONS[useId]
                                const checked = useIds.includes(useId)
                                const blockedByLimit = !checked && selectedTemplatePayload.length >= MAX_VISUAL_PIECES_PER_GENERATION
                                return (
                                  <button
                                    key={`${model.id}-${useId}-${model.useTemplates?.[useId]}`}
                                    type="button"
                                    title={blockedByLimit ? `Limite de ${MAX_VISUAL_PIECES_PER_GENERATION} modelos atingido` : use.label}
                                    aria-label={`${checked ? 'Remover' : 'Selecionar'} ${use.label} para ${model.name}`}
                                    onClick={() => toggleCampaignModelUse(model.id, useId)}
                                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border bg-white transition-all ${
                                      checked
                                        ? 'border-primary-500 shadow-primary-100 ring-2 ring-primary-100'
                                        : blockedByLimit
                                          ? 'cursor-not-allowed border-gray-200 opacity-40 grayscale'
                                          : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                                    }`}
                                  >
                                    <CampaignUseBrandIcon use={use} />
                                    {checked && (
                                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                            <p className="mt-3 text-xs font-semibold text-slate-400">
                              {selected ? `${useIds.length} ${useIds.length === 1 ? 'canal selecionado' : 'canais selecionados'}` : 'Toque nos canais para selecionar'}
                            </p>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
                <aside className="lg:sticky lg:top-6 lg:self-start">
                  <div className="rounded-3xl bg-white/80 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70 backdrop-blur-sm">
                    <h3 className="text-base font-black text-gray-900">Resumo da criação</h3>

                    <div className="mt-4 rounded-2xl bg-slate-50/90 p-4">
                      <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-700">Modelos selecionados</span>
                          <span className="text-base font-black text-primary-600">{selectedModelCount}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-700">Peças selecionadas</span>
                        <span className="text-base font-black text-primary-600">{selectedUseCount}</span>
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-900">Total de peças</span>
                          <span className="text-base font-black text-primary-600">{selectedUseCount}</span>
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={continueFromManual} disabled={selectedCatalogItems.length === 0}
                      className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-black transition-all ${
                        selectedCatalogItems.length > 0
                          ? 'bg-primary-800 text-white shadow-lg shadow-primary-200 hover:bg-primary-700'
                          : 'cursor-not-allowed bg-gray-100 text-gray-400'
                      }`}>
                      Criar banners
                    </button>

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
                      <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-2xl bg-slate-50/70 px-4 text-center">
                        <p className="text-sm font-bold leading-relaxed text-slate-500">Selecione um modelo<br />para começar</p>
                        <Camera className="mt-4 h-7 w-7 text-slate-300" />
                      </div>
                    )}

                    {selectedCatalogItems.length >= MAX_VISUAL_PIECES_PER_GENERATION - 1 && (
                      <p className="mt-3 rounded-xl border border-blue-100 bg-primary-50 p-3 text-xs font-semibold leading-relaxed text-primary-900">
                        Selecione até {MAX_VISUAL_PIECES_PER_GENERATION} modelos. Depois de receber os resultados, poderá gerar mais materiais para este mesmo imóvel.
                      </p>
                    )}

                    {selectedCatalogItems.length > 0 && (
                      <button type="button" onClick={() => applySelectedModelUses({})}
                        className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-600 hover:bg-gray-50">
                        Limpar seleção
                      </button>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                      <button type="button" onClick={goHome} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        Voltar
                      </button>
                      <button type="button" onClick={goHome} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                        Cancelar
                      </button>
                    </div>
                  </div>
                </aside>
                </div>
              </div>
            </>)}

            {fase === 'form' && productFlowStep === 'property' && (<>
              {!isProductEntry && <Product3Progress activeStep={1} />}
              {renderFlowHeader(
                isProductEntry ? productContext.propertyEyebrow : 'Etapa 2 de 5',
                isProductEntry ? productContext.propertyTitle : 'Informe os dados',
                isProductEntry ? productContext.propertySubtitle : 'Conte sobre o imóvel em uma conversa rápida.',
              )}
              {renderStepActions(goBackFromProperty)}
              {renderProductContextNotice()}
              {isProductEntry ? (<>
                {propertyForm}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={continueFromProperty}
                    className="rounded-xl bg-primary-800 px-5 py-3 text-sm font-black text-white hover:bg-primary-700"
                  >
                    Continuar
                  </button>
                </div>
              </>) : (<>
                <BannerConversation
                  step={bannerChatStep}
                  onStepChange={setBannerChatStep}
                  finalidade={finalidade}
                  onFinalidadeChange={setFinalidade}
                  situacao={situacao}
                  onSituacaoChange={setSituacao}
                  onCategoriaChange={setCategoria}
                  tipo={tipo}
                  onTipoChange={setTipo}
                  cidade={cidade}
                  onCidadeChange={setCidade}
                  estado={estado}
                  onEstadoChange={setEstado}
                  bairro={bairro}
                  onBairroChange={setBairro}
                  preco={preco}
                  onPrecoChange={setPreco}
                  precoModo={precoModo}
                  onPrecoModoChange={setPrecoModo}
                  condominio={condominio}
                  onCondominioChange={setCondominio}
                  iptu={iptu}
                  onIptuChange={setIptu}
                  area={area}
                  onAreaChange={setArea}
                  quartos={quartos}
                  onQuartosChange={setQuartos}
                  suites={suites}
                  onSuitesChange={setSuites}
                  vagas={vagas}
                  onVagasChange={setVagas}
                  diferenciais={diferenciais}
                  onToggleDestaque={toggleDestaque}
                  cta={product3Cta}
                  onCtaChange={setProduct3Cta}
                  useProfessionalPhone={product3UseProfessionalPhone}
                  onUseProfessionalPhoneChange={setProduct3UseProfessionalPhone}
                  professionalPhone={profileWhatsapp}
                  selectedModelSummaries={selectedModelSummaries}
                  selectedUseCount={selectedUseCount}
                  photosCount={fotos.length}
                  onEditModels={() => setProductFlowStep('manual-catalog')}
                  onContinue={continueFromProperty}
                />
                <div aria-hidden="true" className="h-36 sm:h-44" />
              </>)}
            </>)}

            {fase === 'form' && productFlowStep === 'photos' && (<>
              {!isProductEntry && <Product3Progress activeStep={2} />}
              {renderFlowHeader(
                isProductEntry ? productContext.uploadEyebrow : 'Etapa 3 de 5',
                isProductEntry ? productContext.uploadTitle : 'Suba as imagens',
                isProductEntry ? productContext.photosSubtitle : 'Envie as fotos do imóvel',
              )}
              {renderStepActions(() => setProductFlowStep('property'))}
              {photoUpload}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={continueFromUploads}
                  className="rounded-xl bg-primary-800 px-5 py-3 text-sm font-black text-white hover:bg-primary-700"
                >
                  Continuar
                </button>
              </div>
            </>)}

            {fase === 'form' && productFlowStep === 'analysis' && (<>
              {!isProductEntry && <Product3Progress activeStep={3} />}
              {renderFlowHeader(
                isProductEntry ? productContext.reviewTitle : 'Etapa 4 de 5',
                isProductEntry ? 'Confirmar banners selecionados' : 'Revise sua campanha',
                isProductEntry ? productContext.reviewSubtitle : 'Confira as informações antes de iniciar a geração.',
              )}
              {renderStepActions(() => setProductFlowStep('photos'))}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-primary-700">Resumo antes de gerar</p>
                  <h2 className="mt-1 text-xl font-black text-gray-950">{strategyLabel}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {analysisItems.map(item => (
                      <div key={item} className="flex items-start gap-2 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBannerChatStep('purpose')
                      setProductFlowStep('property')
                    }}
                    className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
                  >
                    Corrigir informações
                  </button>
                  {product3UseProfessionalPhone === 'yes' && !profileWhatsapp && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-primary-50 p-4 text-sm text-primary-900">
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
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-gray-400">Modelos escolhidos</p>
                      <p className="mt-1 text-sm font-bold leading-5 text-gray-700">
                        {selectedModelSummaries.map(model => model.name).join(', ') || 'Nenhum modelo selecionado'}
                      </p>
                    </div>
                    <p className="rounded-2xl bg-gray-50 p-3 text-xs font-semibold leading-relaxed text-gray-500">
                      Cada modelo utiliza automaticamente apenas as informações compatíveis com seu layout. As demais informações serão utilizadas na criação completa da campanha.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={confirmarGeracao}
                    disabled={!podaGerar}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-colors ${
                      podaGerar
                        ? 'bg-primary-800 text-white hover:bg-primary-700'
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
            {generationError ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">A geração não foi concluída</h2>
                <p className="text-gray-600 font-semibold text-base">{generationError}</p>
                <button
                  type="button"
                  onClick={() => { setGenerationError(''); setFase('form') }}
                  className="mt-8 rounded-xl bg-primary-700 px-5 py-3 text-sm font-bold text-white hover:bg-primary-800"
                >
                  Voltar e revisar dados
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {fase === 'resultado' && resultado && (() => {
          const tg = resultado.textos_gerados || {}
          const grad = catAtual?.cor || 'from-primary-500 to-primary-400'
          const returnedVisualPieces = Array.isArray(renders) ? renders : []
          const missingVisualPieceStatus = gerandoBanners || renders === null ? 'pending' : 'failed'
          const visualPieces = requestedVisualPieces.length
            ? mergeRequestedVisualPieces(requestedVisualPieces, returnedVisualPieces, {
                missingStatus: missingVisualPieceStatus,
                missingErrorMessage: MISSING_RENDER_ERROR,
                requireProcessingEvidence: true,
              })
            : returnedVisualPieces
          const visualPiecesReady = visualPieces.filter(r => (
            RENDER_READY_STATUSES.has(normalizeRenderStatus(r.status)) && Boolean(getRenderFinalUrl(r))
          )).length
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
          const allVisualPiecesFailed = visualPieces.length > 0
            && visualPiecesReady === 0
            && visualPiecesProcessing === 0
            && visualPiecesPending === 0
            && visualPiecesFailed > 0
          const resultTitle = allVisualPiecesFailed
            ? 'Textos prontos. Materiais visuais com problema.'
            : 'Resumo da campanha'

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
          const packageProperty = resultado.dados_imovel || {}

          if (!isProductEntry) {
            return (
              <CampaignPackage
                data={{
                  sourceProduct: 'Banners Rápidos',
                  mediaType: 'images',
                  files: normalizeProduct3CampaignFiles(visualPieces),
                  purpose: packageProperty.finalidade || finalidade,
                  propertyStage: packageProperty.situacao || situacao,
                  propertyType: packageProperty.tipo || tipo,
                  district: packageProperty.bairro || bairroNormalizado,
                  city: packageProperty.cidade || cidade,
                  state: packageProperty.estado || estado,
                  bedrooms: packageProperty.dormitorios ?? packageProperty.quartos ?? quartos,
                  suites: packageProperty.suites ?? suites,
                  parkingSpaces: packageProperty.vagas ?? vagas,
                  area: packageProperty.area || area,
                  price: packageProperty.preco_exibicao || formatProduct3Price(preco, precoModo, finalidade),
                  description: getTextoEdge('descricao_portal'),
                  highlights: packageProperty.destaques || todosDestaques,
                  cta: packageProperty.cta || product3Cta,
                  contactAuthorized: product3UseProfessionalPhone === 'yes',
                  phone: product3UseProfessionalPhone === 'yes' ? profileWhatsapp : '',
                  aiCampaigns: buildProduct3CampaignOptions({
                    generatedTexts: tg,
                    property: packageProperty,
                    cta: packageProperty.cta || product3Cta,
                  }),
                }}
                onRefreshMedia={renovarUrlRender}
                onCreateNew={() => resetCampaignState()}
                createNewLabel="Criar banners para outro imóvel"
              />
            )
          }

          return (
            <CampaignPackage
              preserveExistingContent
              data={{
                sourceProduct: 'Banners Rápidos',
                mediaType: 'images',
                files: visualPieces,
                purpose: packageProperty.finalidade || finalidade,
                propertyStage: packageProperty.situacao,
                propertyType: packageProperty.tipo || tipo,
                district: packageProperty.bairro || bairroNormalizado,
                city: packageProperty.cidade || cidade,
                state: packageProperty.estado || estado,
                bedrooms: packageProperty.dormitorios ?? packageProperty.quartos,
                suites: packageProperty.suites,
                parkingSpaces: packageProperty.vagas,
                area: packageProperty.area,
                highlights: packageProperty.destaques || todosDestaques,
                contactAuthorized: false,
                existingTexts: tg,
              }}
            >
              <div className="space-y-6">

              <AnimatedCard delay={0}>
                <div className="card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-gray-900 text-xl">{resultTitle}</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-gray-500">{resultado.titulo}</p>
                          {catAtual && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${catAtual.badge}`}>{catAtual.icon} {catAtual.nome}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      type="button"
                      onClick={voltarResultadoParaCusto}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={startAnotherBannerGeneration}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
                    >
                      <Plus className="w-4 h-4" />
                      Criar novos banners
                    </button>
                    <button
                      type="button"
                      onClick={goHome}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Voltar para Home
                    </button>
                    <button
                      type="button"
                      onClick={() => baixarTudo(visualPieces)}
                      disabled={downloadingAllRenders || Boolean(downloadingRenderKey)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-wait disabled:opacity-60">
                      <Download className="w-4 h-4" />
                      {downloadingAllRenders ? 'Baixando peças...' : 'Baixar tudo'}
                    </button>
                  </div>
                </div>
              </AnimatedCard>

              {generationNotice && (
                <AnimatedCard delay={80}>
                  <div className="rounded-2xl border border-blue-100 bg-primary-50 p-4 text-sm font-semibold leading-relaxed text-primary-900">
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
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {visualPieces.map((r, i) => {
                        const status = normalizeRenderStatus(r.status)
                        const ok = RENDER_READY_STATUSES.has(status)
                        const falhou = RENDER_ERROR_STATUSES.has(status) || !!r.erro
                        const finalUrl = ok ? getRenderFinalUrl(r) : ''
                        const previewUrl = finalUrl
                        const viewUrl = finalUrl
                        const ehVideo = isRenderVideo(r)
                        const downloadKey = r.piece_id || r.render_id || `render-${i}`
                        const isDownloading = downloadingRenderKey === downloadKey
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
                              {ok && ehVideo && finalUrl ? (
                                <video src={finalUrl} controls playsInline className="w-full h-full object-contain bg-black" />
                              ) : ok && previewUrl ? (
                                <img src={previewUrl} alt={nomePeca} draggable="false" onContextMenu={e => e.preventDefault()} className="w-full h-full object-contain pointer-events-none select-none" />
                              ) : (
                                <div className="text-xs text-gray-500 px-3 py-6 text-center">
                                  {falhou ? (r.erro || 'Falhou') : 'Processando...'}
                                </div>
                              )}
                            </div>
                            <div className="p-3 pt-2">
                              {ok && finalUrl ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                                    className="block text-xs font-bold text-center py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                    Visualizar
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => baixarPecaVisual(r, i)}
                                    disabled={downloadingAllRenders || Boolean(downloadingRenderKey)}
                                    className="block w-full text-xs font-bold text-center py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-wait disabled:opacity-60">
                                    <Download className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                                    {isDownloading ? 'Baixando...' : 'Baixar'}
                                  </button>
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
                  <p className="text-gray-500 text-sm mb-4">Quer criar banners para outro imóvel?</p>
                  <button
                    onClick={() => resetCampaignState()}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" />
                    Criar banners para outro imóvel
                  </button>
                </div>
              </AnimatedCard>

              </div>
            </CampaignPackage>
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
                    className="rounded-xl bg-primary-800 px-4 py-2.5 text-sm font-black text-white hover:bg-primary-700"
                  >
                    Voltar e tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={startAnotherBannerGeneration}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Criar novos banners
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
