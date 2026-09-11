import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  Image,
  MessageSquareText,
  Send,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import Header from '../components/layout/Header'
import CampaignPackage from '../components/campaign/CampaignPackage'
import SmartTokenEstimate from '../components/economy/SmartTokenEstimate'
import { buildCampaignPackage } from '../components/campaign/buildCampaignPackage'
import { ProductButton, ProductCard, ProductHero, ProductSteps, SMART_UI } from '../components/design-system'
import { ConversationAssistantBubble, ConversationHeader, ConversationUserBubble, ConversationQuestionCard } from '../components/conversation/ConversationPrimitives'
import { SmartLocationSelect, SmartLocationTextInput } from '../components/location/SmartCarouselCitySelect'
import HeroShowcase from '../components/hero/HeroShowcase'
import { useProductDraft } from '../hooks/useProductDraft'
import { useAccountAnalytics } from '../hooks/useAccountAnalytics'
import { useAuth } from '../lib/auth-context'
import { ACCOUNT_ANALYTICS_PRODUCTS as PRODUCTS, ACCOUNT_ANALYTICS_STEPS as STEPS } from '../lib/account-analytics'
import { buildCampaignTextFile } from '../lib/campaign-text-file'
import { downloadFileFromPrivateUrl } from '../lib/download-file'
import { supabase } from '../lib/supabase'
import { guestBannerRequest, guestResultForBanner, GUEST_CLAIM_PENDING } from '../lib/guest-banner-client'
import { getSmartTokenErrorMessage, SMART_TOKEN_COSTS } from '../lib/smart-tokens'
import { getMetaConnectionStatus, redirectToMetaOAuth } from '../lib/meta-oauth-connection'
import { clearPendingBannerPublication, preservePendingBannerPublication, publishBannerPublication, readPendingBannerPublication, recoverBannerPublication } from '../lib/banner-social-publish'
import { buildHeroNextCampaignPackageData } from '../lib/hero-next-recovery'
import { buildPublicationGoogleAds, buildPublicationPackage, formatAreaForDisplay, formatCurrencyForDisplay, normalizeContactPhoneForDisplay } from '../../../core/copy-engine'

const GOALS = [
  { id: 'sale', label: 'Venda de imóvel', description: 'Campanha para divulgar um imóvel à venda.' },
  { id: 'rent', label: 'Locação de imóvel', description: 'Campanha para anunciar um imóvel para locação.' },
  { id: 'property_capture', label: 'Captação de Imóveis', description: 'Campanha para atrair proprietários interessados em vender, alugar ou administrar imóveis.' },
  { id: 'broker_capture', label: 'Captação de Corretores', description: 'Campanha para atrair corretores e profissionais para sua equipe.' },
]

const GOAL_LABELS = {
  sale: 'Venda de imóvel',
  rent: 'Locação de imóvel',
  property_capture: 'Captação de Imóveis',
  broker_capture: 'Captação de Corretores',
}

const getGoalLabel = (goal) => GOAL_LABELS[goal] || 'Campanha IA'

const COMMERCIAL_PROPERTY_KEYWORDS = [
  'SALA COMERCIAL',
  'LAJE CORPORATIVA',
  'LOJA',
  'PONTO COMERCIAL',
  'CONJUNTO COMERCIAL',
  'COMERCIAL',
  'GALPAO',
  'GALPÃO',
]

const isCommercialPropertyType = (propertyType) => {
  const normalized = normalizeComparable(propertyType).toUpperCase()
  return COMMERCIAL_PROPERTY_KEYWORDS.some((keyword) => normalized.includes(normalizeComparable(keyword).toUpperCase()))
}

const shouldShowChatQuestion = (question, currentAnswers) => {
  if (question.id === 'contactPhone') {
    return false
  }
  return true
}

const getChatFlowForAnswers = (baseFlow, currentAnswers) => {
  if (!isCommercialPropertyType(currentAnswers.propertyType)) return baseFlow

  const areaQuestion = {
    id: 'area',
    question: 'Qual é a área útil do imóvel?',
    type: 'text',
    placeholder: 'Ex: 120 m²',
    optionalLabel: 'Não informar área',
  }

  const filteredFlow = baseFlow.filter((question) => !['bedrooms', 'suites', 'area'].includes(question.id))
  const parkingIndex = filteredFlow.findIndex((question) => question.id === 'parking')
  if (parkingIndex === -1) return filteredFlow

  return [
    ...filteredFlow.slice(0, parkingIndex),
    areaQuestion,
    ...filteredFlow.slice(parkingIndex),
  ]
}

const PROPERTY_TYPE_OPTIONS = [
  'Apartamento',
  'Studio',
  'Casa',
  'Sobrado',
  'Cobertura',
  'Garden',
  'Kitnet',
  'Terreno/Lote',
  'Sala comercial',
  'Loja',
  'Galpão',
  'Comercial',
]

const COMMERCIAL_PROFILE_OPTIONS = [
  'Minha Casa Minha Vida',
  'Econômico',
  'Alto padrão',
  'Luxo',
  'Investimento',
  'Comercial',
]

const PROPERTY_STAGE_OPTIONS = [
  'Pré-lançamento',
  'Lançamento',
  'Em obras',
  'Pronto para morar',
]

const BEDROOM_OPTIONS = ['0', '1', '2', '3', '4', '5+', 'Não informar']
const SUITE_OPTIONS = ['0', '1', '2', '3', '4+', 'Não informar']
const PARKING_OPTIONS = ['0', '1', '2', '3+', 'Não informar']

const HERO_STATE_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const BANNER_CREATION_STEPS = [
  { title: 'Objetivo', subtitle: 'Conte sobre a campanha' },
  { title: 'Formatos', subtitle: 'Escolha as entregas' },
  { title: 'Revisão', subtitle: 'Confira as informações' },
  { title: 'Imagens', subtitle: 'Envie seus arquivos' },
  { title: 'Criação', subtitle: 'Acompanhe o resultado' },
]

const BANNER_STEP_BY_PHASE = {
  goal: 1,
  chat: 1,
  values: 1,
  destination: 2,
  ideas: 2,
  prompt: 3,
  images: 4,
  processing: 5,
}

const formatHeroPrice = (digits) => digits
  ? new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(Number(digits))
  : ''

const HERO_NEXT_RESULT_STORAGE_KEY = 'smartcorretorai:hero-ia-next:last-result'

function readStoredHeroNextResult() {
  try {
    const raw = window.sessionStorage.getItem(HERO_NEXT_RESULT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const hasImage = Boolean(parsed?.imageUrl) || parsed?.jobs?.some((job) => job?.imageUrl)
    return hasImage ? parsed : null
  } catch {
    return null
  }
}

function writeStoredHeroNextResult(result) {
  try {
    if (result?.imageUrl || result?.jobs?.some((job) => job?.imageUrl)) {
      window.sessionStorage.setItem(HERO_NEXT_RESULT_STORAGE_KEY, JSON.stringify(result))
    } else {
      window.sessionStorage.removeItem(HERO_NEXT_RESULT_STORAGE_KEY)
    }
  } catch {
    // Session persistence is a convenience; generation must not depend on it.
  }
}

const downloadImageFile = downloadFileFromPrivateUrl

async function getEdgeFunctionErrorMessage(error, fallback) {
  const response = error?.context
  if (response?.clone) {
    try {
      const body = await response.clone().json()
      return body?.message || body?.error || error?.message || fallback
    } catch {
      try {
        const text = await response.clone().text()
        if (text) return text.slice(0, 400)
      } catch {
        // Fall back to the SDK error message below.
      }
    }
  }
  return error?.message || fallback
}

const CTA_OPTIONS = [
  'Fale comigo',
  'Saiba mais',
  'Agende sua visita',
  'Conheça as condições',
  'Faça sua simulação',
  'Quero informações',
  'Chamar no WhatsApp',
]
const CONTACT_PHONE_OPTIONS = ['Sim, quero divulgar', 'Não, continuar sem telefone']

const SALE_CONDITION_OPTIONS = [
  'Entrada facilitada',
  'Usa FGTS',
  'Subsídio do governo',
  'Aceita financiamento',
  'Condições especiais',
  'Parcelamento durante a obra',
  'Últimas unidades',
  'Unidades limitadas',
]

const COMMERCIAL_TERMS_STAGES = new Set(['Pré-lançamento', 'Lançamento', 'Em obras'])
const COMMERCIAL_TERM_FIELDS = [
  { id: 'entry_amount', label: 'Entrada', prefix: 'Entrada de' },
  { id: 'monthly_amount', label: 'Mensais', prefix: 'Mensais a partir de' },
  { id: 'annual_amount', label: 'Anuais', prefix: 'Anuais de' },
]
const EMPTY_COMMERCIAL_TERMS = {
  entry_amount: '',
  monthly_amount: '',
  annual_amount: '',
}

const normalizeCommercialTerms = (value) => Object.fromEntries(
  COMMERCIAL_TERM_FIELDS
    .map(({ id }) => [id, String(value?.[id] || '').replace(/\D/g, '').slice(0, 12)])
    .filter(([, amount]) => amount),
)

const formatCommercialTermCalls = (value) => {
  const terms = normalizeCommercialTerms(value)
  return COMMERCIAL_TERM_FIELDS
    .map(({ id, prefix }) => terms[id] ? `${prefix} ${formatHeroPrice(terms[id])}` : '')
    .filter(Boolean)
}

const RENT_GUARANTEE_OPTIONS = [
  { id: 'seguro_fianca', label: 'Seguro-fiança' },
  { id: 'fiador', label: 'Fiador' },
  { id: 'caucao', label: 'Caução' },
  { id: 'titulo_capitalizacao', label: 'Título de capitalização' },
  { id: 'a_combinar', label: 'A combinar' },
  { id: 'nao_informar', label: 'Não informar garantia' },
]

const getRentalGuaranteeLabel = (id) => (
  RENT_GUARANTEE_OPTIONS.find((item) => item.id === id)?.label || ''
)

const DIFFERENTIAL_GROUPS = [
  {
    title: 'Localização',
    options: [
      'Próximo ao metrô',
      'Próximo à CPTM/trem',
      'Próximo ao shopping',
      'Comércio próximo',
      'Parque próximo',
      'Escolas próximas',
      'Hospital próximo',
      'Universidade próxima',
      'Fácil acesso às principais vias',
      'Bairro valorizado',
      'Região em crescimento',
      'Gastronomia',
      'Mobilidade',
    ],
  },
  {
    title: 'Condomínio e lazer',
    options: [
      'Lazer completo',
      'Piscina',
      'Academia',
      'Salão de festas',
      'Espaço gourmet',
      'Churrasqueira',
      'Playground',
      'Brinquedoteca',
      'Pet place',
      'Coworking',
      'Quadra',
      'Rooftop',
      'Lounge',
      'Mini mercado',
      'Lavanderia',
      'Bicicletário',
      'Áreas verdes',
      'Spa ou sauna',
      'Espaço delivery',
    ],
  },
  {
    title: 'Características do imóvel',
    options: [
      'Varanda',
      'Varanda gourmet',
      'Planta inteligente',
      'Ambientes integrados',
      'Cozinha americana',
      'Suíte',
      'Closet',
      'Acabamento premium',
      'Iluminação natural',
      'Vista livre',
      'Vista panorâmica',
      'Mobiliado',
      'Reformado',
    ],
  },
  {
    title: 'Condições comerciais',
    options: [
      'Aceita financiamento',
      'Usa FGTS',
      'Subsídio do governo',
      'Entrada facilitada',
      'Condições especiais',
      'Documentação em ordem',
      'Últimas unidades',
      'Unidades limitadas',
      'Alto potencial de valorização',
    ],
  },
]

const RENT_DIFFERENTIAL_GROUPS = [
  DIFFERENTIAL_GROUPS[0],
  DIFFERENTIAL_GROUPS[1],
  DIFFERENTIAL_GROUPS[2],
  {
    title: 'Facilidades para locação',
    options: [
      'Mobiliado',
      'Aceita pet',
      'Pronto para morar',
      'Condomínio seguro',
      'Boa iluminação',
      'Disponibilidade imediata',
      'Fácil visita',
      'Contrato facilitado',
    ],
  },
]

const SALE_CHAT_FLOW = [
  {
    id: 'propertyType',
    question: 'Que tipo de imóvel vamos divulgar?',
    type: 'chips',
    options: PROPERTY_TYPE_OPTIONS,
  },
  {
    id: 'profile',
    question: 'Qual é o perfil deste imóvel?',
    type: 'chips',
    options: COMMERCIAL_PROFILE_OPTIONS,
  },
  {
    id: 'stage',
    question: 'Em que estágio ele está?',
    type: 'chips',
    options: PROPERTY_STAGE_OPTIONS,
  },
  { id: 'city', question: 'Em qual cidade fica o imóvel?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhood', question: 'E o bairro?', type: 'text', placeholder: 'Ex: Vila Mariana' },
  { id: 'bedrooms', question: 'Quantos dormitórios?', type: 'chips', options: BEDROOM_OPTIONS },
  { id: 'suites', question: 'Quantas suítes?', type: 'chips', options: SUITE_OPTIONS },
  { id: 'parking', question: 'Quantas vagas?', type: 'chips', options: PARKING_OPTIONS },
  {
    id: 'differentials',
    question: 'Quais diferenciais merecem destaque?',
    type: 'multiGrouped',
    groups: DIFFERENTIAL_GROUPS,
  },
  {
    id: 'cta',
    question: 'Qual chamada deve conduzir a campanha?',
    type: 'chips',
    options: CTA_OPTIONS,
  },
  {
    id: 'contactPhoneChoice',
    question: 'Quer divulgar um telefone de contato na campanha?',
    type: 'chips',
    options: CONTACT_PHONE_OPTIONS,
  },
  {
    id: 'contactPhone',
    question: 'Qual telefone deseja exibir?',
    type: 'text',
    placeholder: 'Ex: (11) 99999-9999',
  },
]

const RENT_CHAT_FLOW = [
  {
    id: 'propertyType',
    question: 'Que tipo de imóvel será anunciado para locação?',
    type: 'chips',
    options: PROPERTY_TYPE_OPTIONS,
  },
  { id: 'city', question: 'Em qual cidade fica o imóvel?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhood', question: 'E o bairro?', type: 'text', placeholder: 'Ex: Pinheiros' },
  { id: 'bedrooms', question: 'Quantos dormitórios?', type: 'chips', options: BEDROOM_OPTIONS },
  { id: 'suites', question: 'Quantas suítes?', type: 'chips', options: SUITE_OPTIONS },
  { id: 'parking', question: 'Quantas vagas?', type: 'chips', options: PARKING_OPTIONS },
  { id: 'area', question: 'Deseja informar a área?', type: 'text', placeholder: 'Ex: 72 m²', optionalLabel: 'Não informar área' },
  {
    id: 'differentials',
    question: 'Quais diferenciais devem aparecer na campanha?',
    type: 'multiGrouped',
    groups: RENT_DIFFERENTIAL_GROUPS,
  },
  {
    id: 'cta',
    question: 'Qual chamada deve conduzir a campanha?',
    type: 'chips',
    options: CTA_OPTIONS,
  },
  {
    id: 'contactPhoneChoice',
    question: 'Quer divulgar um telefone de contato na campanha?',
    type: 'chips',
    options: CONTACT_PHONE_OPTIONS,
  },
  {
    id: 'contactPhone',
    question: 'Qual telefone deseja exibir?',
    type: 'text',
    placeholder: 'Ex: (11) 99999-9999',
  },
]

const PROPERTY_CAPTURE_SERVICES = [
  'Venda de imóveis',
  'Locação de imóveis',
  'Administração de imóveis',
]

const PROPERTY_CAPTURE_TYPES = [
  'Apartamentos',
  'Casas',
  'Terrenos',
  'Comerciais',
  'Alto padrão',
  'Todos',
]

const PROPERTY_CAPTURE_AUDIENCES = [
  'Proprietários de apartamentos',
  'Proprietários de casas',
  'Proprietários de imóveis comerciais',
  'Proprietários de terrenos',
  'Proprietários de alto padrão',
  'Todos os proprietários',
]

const MARKET_EXPERIENCE_OPTIONS = [
  'Até 1 ano',
  '1 a 3 anos',
  '3 a 5 anos',
  '5 a 10 anos',
  'Mais de 10 anos',
  'Mais de 20 anos',
  'Mais de 30 anos',
]

const BROKER_CAPTURE_EXPERIENCE_OPTIONS = [
  ...MARKET_EXPERIENCE_OPTIONS,
  'Com ou sem experiência',
]

const PROPERTY_CAPTURE_SPECIALTIES = [
  'Venda de imóveis',
  'Locação',
  'Administração de imóveis',
  'Imóveis comerciais',
  'Alto padrão',
  'Lançamentos',
  'Avaliação imobiliária',
  'Regularização documental',
  'Investimentos imobiliários',
]

const PROPERTY_CAPTURE_DIFFERENTIALS = [
  'Equipe especializada',
  'Corpo jurídico próprio',
  'Avaliação imobiliária profissional',
  'Atendimento personalizado',
  'Carteira ativa de clientes',
  'Divulgação em redes sociais',
  'Fotos profissionais',
  'Vídeos profissionais',
  'Marketing digital',
  'Tecnologia e IA',
  'Outro',
]

const PROPERTY_CAPTURE_MESSAGES = [
  'Quero vender meu imóvel',
  'Quero alugar meu imóvel',
  'Quero vender ou alugar meu imóvel',
  'Preciso de administração imobiliária',
  'Solicitar avaliação imobiliária profissional',
  'Quero que a IA sugira',
]

const PROPERTY_CAPTURE_CTA_OPTIONS = [
  'Solicitar contato',
  'Fale conosco',
  'Saiba mais',
  'Chamar no WhatsApp',
]

const BROKER_CAPTURE_PROFILES = [
  'Corretores de imóveis',
  'Captadores de imóveis',
  'Gerentes comerciais',
  'Coordenadores de vendas',
  'Profissionais do mercado imobiliário',
  'Quero que a IA sugira',
]

const BROKER_CAPTURE_DIFFERENTIALS = [
  'Leads qualificados',
  'Carteira de imóveis',
  'Marketing e tecnologia',
  'Treinamento comercial',
  'Suporte jurídico',
  'Estrutura de atendimento',
  'Comissões atrativas',
  'Equipe colaborativa',
  'Outro',
]

const BROKER_CAPTURE_MESSAGES = [
  'Faça parte do nosso time',
  'Oportunidade para corretores',
  'Cresça no mercado imobiliário',
  'Mais estrutura para vender',
  'Recrutamento de profissionais',
  'Quero que a IA sugira',
]

const BROKER_CAPTURE_CTA_OPTIONS = [
  'Fale conosco',
  'Saiba mais',
  'Enviar currículo',
  'Chamar no WhatsApp',
  'Quero conversar',
]

const PROPERTY_CAPTURE_CHAT_FLOW = [
  {
    id: 'services',
    question: 'Quais serviços deseja captar?',
    type: 'multi',
    options: PROPERTY_CAPTURE_SERVICES,
    confirmLabel: 'Confirmar serviços',
    customPlaceholder: 'Outro serviço, se necessário',
  },
  { id: 'city', question: 'Em qual cidade deseja captar imóveis?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhoods', question: 'Quais bairros deseja atender?', type: 'text', placeholder: 'Ex: Moema, Vila Mariana e Brooklin' },
  {
    id: 'propertyKinds',
    question: 'Quais imóveis deseja captar?',
    type: 'multi',
    options: PROPERTY_CAPTURE_TYPES,
    confirmLabel: 'Confirmar tipos de imóveis',
    customPlaceholder: 'Outro tipo de imóvel',
  },
  {
    id: 'ownerAudience',
    question: 'Quem você deseja atingir?',
    type: 'multi',
    options: PROPERTY_CAPTURE_AUDIENCES,
    confirmLabel: 'Confirmar público',
    customPlaceholder: 'Outro perfil de proprietário',
  },
  {
    id: 'marketExperience',
    question: 'Qual sua experiência no mercado?',
    type: 'chips',
    options: MARKET_EXPERIENCE_OPTIONS,
  },
  {
    id: 'specialties',
    question: 'Quais são suas especialidades?',
    type: 'multi',
    options: PROPERTY_CAPTURE_SPECIALTIES,
    confirmLabel: 'Confirmar especialidades',
    customPlaceholder: 'Outra especialidade',
  },
  {
    id: 'businessDifferentials',
    question: 'Quais diferenciais deseja destacar?',
    type: 'multi',
    options: PROPERTY_CAPTURE_DIFFERENTIALS,
    confirmLabel: 'Confirmar diferenciais',
    customPlaceholder: 'Outro diferencial',
  },
  {
    id: 'mainMessage',
    question: 'Qual mensagem principal deseja usar?',
    type: 'multi',
    options: PROPERTY_CAPTURE_MESSAGES,
    confirmLabel: 'Confirmar mensagem principal',
    customPlaceholder: 'Outra mensagem',
  },
  {
    id: 'cta',
    question: 'Qual CTA deve conduzir a campanha?',
    type: 'chips',
    options: PROPERTY_CAPTURE_CTA_OPTIONS,
  },
  {
    id: 'contactPhoneChoice',
    question: 'Quer divulgar um telefone de contato na campanha?',
    type: 'chips',
    options: CONTACT_PHONE_OPTIONS,
  },
  {
    id: 'contactPhone',
    question: 'Qual telefone deseja exibir?',
    type: 'text',
    placeholder: 'Ex: (11) 99999-9999',
  },
]

const BROKER_CAPTURE_CHAT_FLOW = [
  {
    id: 'professionalProfile',
    question: 'Qual profissional deseja atrair?',
    type: 'multi',
    options: BROKER_CAPTURE_PROFILES,
    confirmLabel: 'Confirmar perfil',
    customPlaceholder: 'Outro perfil profissional',
  },
  { id: 'city', question: 'Em qual cidade deseja recrutar profissionais?', type: 'text', placeholder: 'Ex: São Paulo' },
  {
    id: 'neighborhoods',
    question: 'Quais regiões ou bairros deseja atender?',
    type: 'text',
    placeholder: 'Ex: Moema, Vila Mariana e Brooklin',
    optional: true,
    optionalLabel: 'Continuar somente com a cidade',
  },
  {
    id: 'marketExperience',
    question: 'Qual experiência deseja priorizar?',
    type: 'chips',
    options: BROKER_CAPTURE_EXPERIENCE_OPTIONS,
  },
  {
    id: 'businessDifferentials',
    question: 'Quais diferenciais deseja destacar?',
    type: 'multi',
    options: BROKER_CAPTURE_DIFFERENTIALS,
    confirmLabel: 'Confirmar diferenciais',
    customPlaceholder: 'Outro diferencial',
  },
  {
    id: 'mainMessage',
    question: 'Qual mensagem principal deseja usar?',
    type: 'multi',
    options: BROKER_CAPTURE_MESSAGES,
    confirmLabel: 'Confirmar mensagem principal',
    customPlaceholder: 'Outra mensagem',
  },
  {
    id: 'cta',
    question: 'Qual CTA deve conduzir a campanha?',
    type: 'chips',
    options: BROKER_CAPTURE_CTA_OPTIONS,
  },
  {
    id: 'contactPhoneChoice',
    question: 'Quer divulgar um telefone de contato na campanha?',
    type: 'chips',
    options: CONTACT_PHONE_OPTIONS,
  },
  {
    id: 'contactPhone',
    question: 'Qual telefone deseja exibir?',
    type: 'text',
    placeholder: 'Ex: (11) 99999-9999',
  },
]

const PROCESSING_STEPS = [
  'Analisando briefing...',
  'Gerando visual...',
  'Finalizando entrega...',
  'Preparando sua campanha...',
]

const MAX_HERO_NEXT_IMAGES = 4
const MAX_HERO_NEXT_PIECES = 6
const HERO_NEXT_PIECE_LIMIT_MESSAGE = 'Para manter a qualidade da campanha, escolha até 6 peças por geração. Você poderá expandir a campanha depois.'

const DESTINATIONS = [
  { id: 'instagram_feed', label: 'Feed Instagram', format_group: 'square_feed' },
  { id: 'story_reels', label: 'Story/Reels', format_group: 'vertical' },
  { id: 'whatsapp', label: 'WhatsApp', format_group: 'square_feed' },
  { id: 'facebook', label: 'Facebook', format_group: 'landscape' },
  { id: 'google_ads', label: 'Google Ads', format_group: 'landscape' },
  { id: 'landing_page', label: 'Landing Page', format_group: 'landscape' },
  { id: 'portal_imobiliario', label: 'Portal Imobiliário', format_group: 'landscape' },
]

const CREATIVE_IDEAS = [
  {
    number: 1,
    title: 'Direta/Comercial',
    description: 'Foco em dados, valor, condições e CTA.',
    publicTitle: 'Criação essencial',
    publicDescription: 'Uma peça por formato, seguindo a estratégia da campanha.',
    visualAngle: 'direct_commercial',
  },
  {
    number: 2,
    title: 'Lifestyle/Emocional',
    description: 'Foco em bairro, desejo, rotina, conforto e qualidade de vida.',
    publicTitle: 'Duas alternativas visuais',
    publicDescription: 'Receba duas versões diferentes para comparar.',
    visualAngle: 'lifestyle_emotional',
  },
  {
    number: 3,
    title: 'Oportunidade/Conversão',
    description: 'Foco em urgência, facilidade, diferenciais e ação rápida.',
    publicTitle: 'Três propostas completas',
    publicDescription: 'Mais variedade de estilo, composição e chamada.',
    visualAngle: 'opportunity_conversion',
  },
]

const normalizeList = (value) => {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

const isCaptureGoal = (goal) => goal === 'property_capture' || goal === 'broker_capture'

const getHeroNextObjectiveLabel = (goal) => {
  if (goal === 'rent') return 'Locação de imóvel'
  if (goal === 'property_capture') return 'Captação de imóveis'
  if (goal === 'broker_capture') return 'Captação de Corretores'
  return 'Venda de imóvel'
}

const getHeroNextCampaignObjective = (goal) => {
  if (goal === 'rent') return 'locacao'
  if (goal === 'property_capture') return 'captacao_imoveis'
  if (goal === 'broker_capture') return 'captacao_corretores'
  return 'venda'
}

const getHeroNextCaptureFeatures = (goal, answers) => {
  if (goal === 'broker_capture') {
    return [
      ...normalizeList(answers.professionalProfile),
      ...normalizeList(answers.businessDifferentials),
      ...normalizeList(answers.mainMessage),
    ]
  }

  if (goal === 'property_capture') {
    return [
      ...normalizeList(answers.services),
      ...normalizeList(answers.propertyKinds),
      ...normalizeList(answers.ownerAudience),
      ...normalizeList(answers.specialties),
      ...normalizeList(answers.businessDifferentials),
      ...normalizeList(answers.mainMessage),
    ]
  }

  return normalizeList(answers.differentials)
}

const getHeroNextDefaultCta = (goal) => (
  isCaptureGoal(goal) ? 'Solicitar contato' : 'Fale comigo'
)

function buildHeroNextCopyInput(goal, answers, valueCondition) {
  const objectiveLabel = getHeroNextObjectiveLabel(goal)
  const features = getHeroNextCaptureFeatures(goal, answers)

  return {
    objective: goal,
    objectiveLabel,
    propertyType: answers.propertyType || normalizeList(answers.propertyKinds)[0] || normalizeList(answers.professionalProfile)[0] || 'Imóvel',
    stage: answers.stage || '',
    city: answers.city || '',
    district: answers.neighborhood || answers.neighborhoods || '',
    features,
    bedrooms: answers.bedrooms || '',
    suites: answers.suites || '',
    parking: answers.parking || '',
    area: formatAreaForDisplay(answers.area || ''),
    displayArea: formatAreaForDisplay(answers.area || ''),
    value: valueCondition?.details || '',
    displayPrice: valueCondition?.details || '',
    showValue: !['hidden', 'no_values'].includes(valueCondition?.mode || ''),
    contactPhone: answers.contactPhoneChoice === 'Sim, quero divulgar' ? normalizeContactPhoneForDisplay(answers.contactPhone || '') : '',
    displayPhone: answers.contactPhoneChoice === 'Sim, quero divulgar' ? normalizeContactPhoneForDisplay(answers.contactPhone || '') : '',
    cta: answers.cta || getHeroNextDefaultCta(goal),
  }
}

function buildHeroNextCampaignCopy(goal, answers, valueCondition) {
  return buildPublicationPackage(buildHeroNextCopyInput(goal, answers, valueCondition))
}

const normalizeComparable = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s/-]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const LOCATION_CORRECTIONS = {
  'sao paulo': 'São Paulo',
  'vila das merces': 'Vila das Mercês',
  moema: 'Moema',
  pirituba: 'Pirituba',
  lapa: 'Lapa',
  'vila mariana': 'Vila Mariana',
  perdizes: 'Perdizes',
  tatuape: 'Tatuapé',
  ipiranga: 'Ipiranga',
  paraiso: 'Paraíso',
}

const SMALL_LOCATION_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

const capitalizeLocation = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .split(' ')
  .map((word, index) => {
    if (index > 0 && SMALL_LOCATION_WORDS.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  })
  .join(' ')

const normalizeLocation = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const key = normalizeComparable(text)
  return LOCATION_CORRECTIONS[key] || capitalizeLocation(text)
}

const TERM_CORRECTIONS = {
  cowork: 'Coworking',
  coworking: 'Coworking',
  'perto do metro': 'Próximo ao metrô',
  'proximo ao metro': 'Próximo ao metrô',
  'próximo ao metrô': 'Próximo ao metrô',
  'sao paulo': 'São Paulo',
  'vila das merces': 'Vila das Mercês',
  mcmv: 'Minha Casa Minha Vida',
}

const normalizeTerm = (value) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const key = normalizeComparable(text)
  return TERM_CORRECTIONS[key] || text.replace(/\bdorms?\b/gi, 'dormitórios')
}

const normalizeValueText = (value) => {
  const text = normalizeTerm(value)
  if (!text || normalizeComparable(text) === 'nao informar') return ''
  return text
}

const normalizeAnswerValue = (questionId, value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeTerm).filter(Boolean)
  }

  if (questionId === 'city' || questionId === 'neighborhood') {
    return normalizeLocation(value)
  }

  if (['area', 'rentPrice', 'condoFee', 'iptu'].includes(questionId)) {
    return normalizeValueText(value) || 'Não informar'
  }

  if (questionId === 'contactPhone') {
    return String(value || '').trim()
  }

  return normalizeTerm(value)
}

const formatCountLabel = (value, singular, plural) => {
  const text = String(value || '').trim()
  if (!text || text === 'Não informar') return ''
  if (text === '0') return ''
  if (text.endsWith('+')) return `${text.replace('+', ' ou mais')} ${plural}`
  return `${text} ${text === '1' ? singular : plural}`
}

const formatAnswer = (answer) => {
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer || '').trim()
}

const buildValueCondition = (goal, saleValues, rentValues) => {
  if (goal === 'rent') {
    const guaranteeLabel = rentValues.guarantee && rentValues.guarantee !== 'nao_informar'
       ? getRentalGuaranteeLabel(rentValues.guarantee)
      : ''
    const details = [
      rentValues.rentMode === 'show' && normalizeValueText(rentValues.rentPrice) ? `Aluguel: ${formatCurrencyForDisplay(normalizeValueText(rentValues.rentPrice), 'locacao')}` : '',
      rentValues.condoMode === 'show' && normalizeValueText(rentValues.condoFee) ? `Condomínio: ${normalizeValueText(rentValues.condoFee)}` : '',
      rentValues.iptuMode === 'show' && normalizeValueText(rentValues.iptu) ? `IPTU: ${formatCurrencyForDisplay(normalizeValueText(rentValues.iptu), 'locacao')}` : '',
      guaranteeLabel ? `Garantia: ${guaranteeLabel}` : '',
    ].filter(Boolean)

    return {
      mode: details.length ? 'rental_values' : 'no_values',
      label: details.length ? 'Valores de locação informados' : 'Não mostrar valores',
      details: details.join(' | '),
      promptLines: details.length
        ? [
          `Valores e condições de locação: ${details.join(', ')}.`,
          'Use apenas esses valores e condições. Não inventar aluguel, condomínio, IPTU ou garantia não informados.',
        ]
        : ['Não mostrar valores na campanha. Não inventar aluguel, condomínio, IPTU ou garantia.'],
    }
  }

  const commercialTerms = normalizeCommercialTerms(saleValues.commercialTerms)
  const commercialTermCalls = formatCommercialTermCalls(commercialTerms)
  const commercialTermsContract = commercialTermCalls.length > 0
    ? { commercial_terms: commercialTerms }
    : {}

  if (saleValues.mode === 'price') {
    const conditions = normalizeList(saleValues.conditions).map(normalizeTerm)
    return {
      mode: 'price',
      label: 'Valor do imóvel informado',
      details: [
        normalizeValueText(saleValues.price) ? `Valor: ${formatCurrencyForDisplay(normalizeValueText(saleValues.price), 'venda')}` : '',
        conditions.length ? `Condições: ${conditions.join(', ')}` : '',
        ...commercialTermCalls,
      ].filter(Boolean).join(' | '),
      promptLines: [
        `Valor informado: ${formatCurrencyForDisplay(normalizeValueText(saleValues.price), 'venda')}.`,
        conditions.length ? `Condições comerciais informadas: ${conditions.join(', ')}.` : '',
        commercialTermCalls.length ? `Chamadas comerciais informadas: ${commercialTermCalls.join(', ')}.` : '',
        commercialTermCalls.length ? 'Use somente essas chamadas comerciais. Não invente valores ou condições ausentes.' : '',
        'Pode mostrar o valor informado na campanha. Não inventar outras condições comerciais.',
      ].filter(Boolean),
      ...commercialTermsContract,
    }
  }

  if (saleValues.mode === 'conditions') {
    const conditions = normalizeList(saleValues.conditions).map(normalizeTerm)
    return {
      mode: 'conditions',
      label: 'Apenas condições comerciais',
      details: [...conditions, ...commercialTermCalls].join(', '),
      promptLines: [
        conditions.length ? `Condições comerciais informadas: ${conditions.join(', ')}.` : '',
        commercialTermCalls.length ? `Chamadas comerciais informadas: ${commercialTermCalls.join(', ')}.` : '',
        commercialTermCalls.length ? 'Use somente essas chamadas comerciais. Não invente valores ou condições ausentes.' : '',
        'Não mostrar preço e não inventar valor do imóvel.',
      ].filter(Boolean),
      ...commercialTermsContract,
    }
  }

  if (commercialTermCalls.length > 0) {
    return {
      mode: 'commercial_terms',
      label: 'Condições comerciais informadas',
      details: commercialTermCalls.join(', '),
      promptLines: [
        `Chamadas comerciais informadas: ${commercialTermCalls.join(', ')}.`,
        'Use somente essas chamadas comerciais. Não invente preço, valores ou condições ausentes.',
      ],
      ...commercialTermsContract,
    }
  }

  return {
    mode: 'hidden',
    label: 'Não mostrar valores',
    details: '',
    promptLines: ['Não mostrar valores na campanha. Não inventar preço ou condições comerciais.'],
  }
}

const getFormatInstruction = (destination) => {
  const label = destination?.label || 'o destino escolhido'
  const id = destination?.id || ''
  const formatGroup = destination?.format_group || ''

  if (id === 'story_reels' || formatGroup === 'vertical') {
    return `Formato principal da peça: ${label}.\nCrie UMA única peça vertical final para ${label}, com leitura rápida, poucos textos e CTA forte.`
  }

  if (id === 'whatsapp') {
    return `Formato principal da peça: ${label}.\nCrie UMA única peça direta para envio em WhatsApp, com leitura rápida e CTA claro.`
  }

  return `Formato principal da peça: ${label}.\nCrie UMA única peça publicitária final para ${label}.`
}

const uploadedImagesInstructionText = (imageCount) => {
  if (imageCount > 1) {
    return 'Use todas as imagens anexadas sempre que um layout multi-imagem for apropriado. Não ignore imagens enviadas, salvo se o formato ficar visualmente poluído. Prefira uma colagem imobiliária profissional com uma imagem principal e imagens secundárias de apoio.'
  }

  if (imageCount === 1) {
    return 'Há apenas uma imagem anexada: ela pode ser reutilizada, mas varie recorte, composição, hierarquia, posição do CTA, quantidade de texto e tratamento visual.'
  }

  return 'Não há imagens anexadas: explore uma intenção visual própria para este formato com base na Estratégia da Campanha, bairro, benefícios e características informadas, sem inventar dados reais específicos.'
}

const getFormatVisualStrategy = (destination, imageCount = 0) => {
  const id = destination?.id || ''
  const label = destination?.label || 'o destino escolhido'
  const hasMultipleImages = imageCount > 1
  const generousSupportImageLimit = hasMultipleImages ? Math.min(3, Math.max(1, imageCount - 1)) : 0
  const baseImageStrategy = hasMultipleImages
     ? 'Use o conjunto de imagens anexadas como contexto e varie a imagem de destaque conforme o formato.'
    : imageCount === 1
       ? 'Use a imagem anexada como base visual, variando recorte, hierarquia, CTA e composição.'
      : 'Sem imagens anexadas: crie uma composição coerente com a campanha, sem inventar dados reais específicos.'

  const strategies = {
    instagram_feed: {
      visualAngle: 'balanced_social_feed',
      imageUsageStrategy: hasMultipleImages
         ? 'Usar a melhor imagem do imóvel como hero e usar todas as imagens secundárias como apoio visual se o layout comportar.'
        : baseImageStrategy,
      compositionInstruction: 'Peça completa e equilibrada para Feed Instagram, com leitura social forte, dados principais, diferenciais e CTA.',
      supportImageLimit: generousSupportImageLimit,
    },
    story_reels: {
      visualAngle: 'emotional_vertical',
      imageUsageStrategy: hasMultipleImages
         ? 'Escolher uma imagem de maior impacto vertical ou emocional como destaque, sem repetir automaticamente a primeira; usar no máximo 1 apoio se não poluir.'
        : baseImageStrategy,
      compositionInstruction: 'Peça vertical para Story/Reels, leitura rápida, menos texto, CTA grande e composição diferente das peças horizontais ou quadradas.',
      supportImageLimit: hasMultipleImages ? 1 : 0,
    },
    whatsapp: {
      visualAngle: 'direct_contact',
      imageUsageStrategy: hasMultipleImages
         ? 'Usar a imagem mais clara e confiável para contato rápido, com até 2 apoios pequenos se ajudarem na decisão.'
        : baseImageStrategy,
      compositionInstruction: 'Peça direta para WhatsApp, poucos blocos, foco em contato rápido, leitura simples e CTA muito claro.',
      supportImageLimit: hasMultipleImages ? 2 : 0,
    },
    facebook: {
      visualAngle: 'informative_social',
      imageUsageStrategy: hasMultipleImages
         ? 'Usar imagem principal com imagens secundárias como apoio visual para uma peça mais informativa.'
        : baseImageStrategy,
      compositionInstruction: 'Peça para Facebook, mais informativa, equilibrando imagem, dados, valores, diferenciais e CTA.',
      supportImageLimit: generousSupportImageLimit,
    },
    google_ads: {
      visualAngle: 'conversion_clean',
      imageUsageStrategy: hasMultipleImages
         ? 'Escolher a imagem mais limpa e com menos ruído; usar apoios somente se não prejudicarem leitura e conversão.'
        : baseImageStrategy,
      compositionInstruction: 'Peça objetiva para Google Ads, pouco texto, foco em clique/conversão e CTA forte.',
      supportImageLimit: hasMultipleImages ? 1 : 0,
    },
    landing_page: {
      visualAngle: 'wide_hero_promise',
      imageUsageStrategy: hasMultipleImages
         ? 'Usar imagem ampla ou mais impactante como hero horizontal; apoios podem entrar apenas se não prejudicarem a promessa principal.'
        : baseImageStrategy,
      compositionInstruction: 'Peça horizontal para Landing Page, imagem hero ampla, promessa principal forte e CTA claro.',
      supportImageLimit: generousSupportImageLimit,
    },
    portal_imobiliario: {
      visualAngle: 'objective_listing',
      imageUsageStrategy: hasMultipleImages
         ? 'Usar a imagem real mais clara do imóvel e apoiar com fotos que comprovem ambiente, metragem percebida ou diferenciais.'
        : baseImageStrategy,
      compositionInstruction: 'Peça para Portal Imobiliário, objetiva e confiável, com imagem clara do imóvel e dados essenciais.',
      supportImageLimit: generousSupportImageLimit,
    },
  }

  return {
    formatId: id,
    formatLabel: label,
    visualAngle: 'single_campaign_piece',
    imageUsageStrategy: baseImageStrategy,
    compositionInstruction: `Crie uma única peça final para ${label}, com composição própria deste formato.`,
    supportImageLimit: generousSupportImageLimit,
    ...(strategies[id] || {}),
  }
}

const getCreativeIdea = (number = 1) => CREATIVE_IDEAS.find((idea) => idea.number === Number(number)) || CREATIVE_IDEAS[0]

const formatCreativeIdeaCount = (count) => `${count} ${count === 1 ? 'ideia' : 'ideias'}`
const formatCreationOptionCount = (count) => `${count} ${count === 1 ? 'opção' : 'opções'}`
const getCreationOptionLabel = (number = 1, compact = false) => {
  const option = getCreativeIdea(number)
  if (compact) return `Opção ${option.number}`
  if (option.number === 1) return 'Opção 1 — Criação essencial'
  if (option.number === 2) return 'Opção 2 — Alternativa visual'
  return 'Opção 3 — Proposta destaque'
}

const getTotalPieceCount = (destinations, ideaCount) => {
  const destinationCount = Array.isArray(destinations) ? destinations.length : Math.max(0, Number(destinations) || 0)
  return destinationCount * Math.max(1, Number(ideaCount) || 1)
}

const createCampaignBatchId = () => `hero-next-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const getEconomicResolution = (destination) => (
  destination.format_group === 'vertical'
    ? '1024x1536'
    : destination.format_group === 'landscape'
      ? '1536x1024'
      : '1024x1024'
)

const buildHumanPrompt = (goal, answers, destinations, valueCondition, creativeIdeaCount = 1) => {
  const isRent = goal === 'rent'
  const isPropertyCapture = goal === 'property_capture'
  const isBrokerCapture = goal === 'broker_capture'
  const selectedDestinations = Array.isArray(destinations) ? destinations : []
  const primaryDestination = selectedDestinations[0] || null
  if (isBrokerCapture) {
    const professionalProfiles = normalizeList(answers.professionalProfile)
    const businessDifferentials = normalizeList(answers.businessDifferentials)
    const mainMessages = normalizeList(answers.mainMessage)
    const contactPhone = answers.contactPhoneChoice === 'Sim, quero divulgar' ? String(answers.contactPhone || '').trim() : ''
    const displayPhone = normalizeContactPhoneForDisplay(contactPhone)
    const region = [
      answers.city ? `Cidade: ${answers.city}` : '',
      answers.neighborhoods ? `Regiões/bairros: ${answers.neighborhoods}` : '',
    ].filter(Boolean).join(' | ')

    return [
      `Crie uma campanha imobiliária profissional, moderna e de alto impacto visual para ${primaryDestination?.label || 'o destino escolhido'}.`,
      '',
      'Objetivo: captação de corretores e profissionais do mercado imobiliário.',
      'A campanha deve atrair profissionais interessados em fazer parte de uma equipe, imobiliária ou operação comercial.',
      `Quantidade de opções de criação: ${formatCreationOptionCount(creativeIdeaCount)}.`,
      getFormatInstruction(primaryDestination),
      '',
      professionalProfiles.length ? `Profissionais desejados: ${professionalProfiles.join(', ')}.` : '',
      region || '',
      answers.marketExperience ? `Experiência desejada: ${answers.marketExperience}.` : '',
      businessDifferentials.length ? `Diferenciais reais da equipe ou imobiliária: ${businessDifferentials.join(', ')}.` : '',
      mainMessages.length ? `Mensagem principal desejada: ${mainMessages.join(', ')}.` : '',
      '',
      'Promessa principal:',
      'mostrar que o profissional pode encontrar mais estrutura, parceria, oportunidades e crescimento no mercado imobiliário.',
      '',
      'Direção visual:',
      'usar estética de autoridade, confiança, equipe, crescimento profissional e recrutamento imobiliário. Não parecer anúncio de imóvel à venda; parecer campanha para atrair profissionais.',
      '',
      contactPhone ? `Telefone de contato informado pelo usuário: ${contactPhone}. Use exatamente este número junto ao CTA quando houver telefone. Não inventar, completar, trocar DDD ou reformatar o telefone.` : 'Nenhum telefone informado. Não exibir telefone, WhatsApp, site, Instagram ou e-mail.',
      `CTA: ${answers.cta || 'Solicitar contato'}${contactPhone ? `\n${contactPhone}` : ''}.`,
      contactPhone ? `Telefone original como fato imutavel: ${contactPhone}. Telefone para exibicao visual: ${displayPhone}.` : '',
      displayPhone ? `CTA completo para exibicao visual:\n${answers.cta || 'Solicitar contato'}\n${displayPhone}` : '',
      displayPhone ? 'Nunca juntar CTA e telefone em frase corrida. Nunca colocar ponto final depois do telefone.' : '',
      'Use exatamente este CTA. Não substitua por outro.',
      '',
      `Crie UMA única peça publicitária final para ${primaryDestination?.label || 'o destino escolhido'}.`,
      'Não criar mosaico.',
      'Não criar múltiplos formatos dentro da mesma imagem.',
      'Não repetir a mesma arte em formatos diferentes dentro da imagem.',
      'A saída deve ser uma única arte final pronta para publicação.',
      'Não invente CRECI, telefone, e-mail, endereço, prêmios, números de vendas, porcentagens, salários, comissões ou garantias não informadas.',
      'Evite texto pequeno, torto, ilegível, cortado ou com aparência de arte automática antiga.',
    ].filter(Boolean).join('\n')
  }

  if (isPropertyCapture) {
    const services = normalizeList(answers.services)
    const propertyKinds = normalizeList(answers.propertyKinds)
    const ownerAudience = normalizeList(answers.ownerAudience)
    const specialties = normalizeList(answers.specialties)
    const businessDifferentials = normalizeList(answers.businessDifferentials)
    const mainMessages = normalizeList(answers.mainMessage)
    const contactPhone = answers.contactPhoneChoice === 'Sim, quero divulgar' ? String(answers.contactPhone || '').trim() : ''
    const displayPhone = normalizeContactPhoneForDisplay(contactPhone)
    const region = [
      answers.city ? `Cidade: ${answers.city}` : '',
      answers.neighborhoods ? `Bairros: ${answers.neighborhoods}` : '',
    ].filter(Boolean).join(' | ')

    return [
      `Crie uma campanha imobiliária profissional, moderna e de alto impacto visual para ${primaryDestination?.label || 'o destino escolhido'}.`,
      '',
      'Objetivo: captação de imóveis.',
      'A campanha deve atrair proprietários interessados em vender, alugar ou administrar imóveis.',
      `Quantidade de opções de criação: ${formatCreationOptionCount(creativeIdeaCount)}.`,
      getFormatInstruction(primaryDestination),
      '',
      services.length ? `Serviços a captar: ${services.join(', ')}.` : '',
      region || '',
      propertyKinds.length ? `Tipos de imóveis desejados: ${propertyKinds.join(', ')}.` : '',
      ownerAudience.length ? `Público desejado: ${ownerAudience.join(', ')}.` : '',
      answers.marketExperience ? `Experiência no mercado: ${answers.marketExperience}.` : '',
      specialties.length ? `Especialidades: ${specialties.join(', ')}.` : '',
      businessDifferentials.length ? `Diferenciais reais do corretor ou imobiliária: ${businessDifferentials.join(', ')}.` : '',
      mainMessages.length ? `Mensagem principal desejada: ${mainMessages.join(', ')}.` : '',
      '',
      'Promessa principal:',
      'mostrar que o proprietário pode receber orientação profissional, avaliação, divulgação e atendimento para vender, alugar ou administrar o imóvel com mais segurança.',
      '',
      'Direção visual:',
      'usar estética de autoridade, confiança, proximidade e marketing imobiliário profissional. Não parecer anúncio de imóvel à venda; parecer campanha de captação para proprietários.',
      '',
      contactPhone ? `Telefone de contato informado pelo usuário: ${contactPhone}. Use exatamente este número junto ao CTA quando houver telefone. Não inventar, completar, trocar DDD ou reformatar o telefone.` : 'Nenhum telefone informado. Não exibir telefone, WhatsApp, site, Instagram ou e-mail.',
      `CTA: ${answers.cta || 'Solicitar contato'}${contactPhone ? `\n${contactPhone}` : ''}.`,
      contactPhone ? `Telefone original como fato imutavel: ${contactPhone}. Telefone para exibicao visual: ${displayPhone}.` : '',
      displayPhone ? `CTA completo para exibicao visual:\n${answers.cta || 'Solicitar contato'}\n${displayPhone}` : '',
      displayPhone ? 'Nunca juntar CTA e telefone em frase corrida. Nunca colocar ponto final depois do telefone.' : '',
      'Use exatamente este CTA. Não substitua por outro.',
      '',
      `Crie UMA única peça publicitária final para ${primaryDestination?.label || 'o destino escolhido'}.`,
      'Não criar mosaico.',
      'Não criar múltiplos formatos dentro da mesma imagem.',
      'Não repetir a mesma arte em formatos diferentes dentro da imagem.',
      'A saída deve ser uma única arte final pronta para publicação.',
      'Não invente CRECI, telefone, e-mail, endereço, prêmios, números de vendas, número de clientes, porcentagens ou garantias não informadas.',
      'Evite texto pequeno, torto, ilegível, cortado ou com aparência de arte automática antiga.',
    ].filter(Boolean).join('\n')
  }
  const location = [answers.neighborhood, answers.city].filter(Boolean).join(', ')
  const isCommercialProperty = isCommercialPropertyType(answers.propertyType)
  const featureDetails = [
    ...(!isCommercialProperty ? [
      formatCountLabel(answers.bedrooms, 'dormitório', 'dormitórios'),
      formatCountLabel(answers.suites, 'suíte', 'suítes'),
    ] : []),
    answers.area && answers.area !== 'Não informar' ? formatAreaForDisplay(answers.area) : '',
    formatCountLabel(answers.parking, 'vaga', 'vagas'),
  ].filter(Boolean).join(', ')
  const differentials = normalizeList(answers.differentials)
  const profile = isRent ? 'Locação' : answers.profile || 'não informado'
  const contactPhone = answers.contactPhoneChoice === 'Sim, quero divulgar' ? String(answers.contactPhone || '').trim() : ''
  const displayPhone = normalizeContactPhoneForDisplay(contactPhone)
  const lines = [
    `Crie uma campanha imobiliária profissional, moderna e de alto impacto visual para ${primaryDestination?.label || 'o destino escolhido'}.`,
    '',
    `Objetivo: ${isRent ? 'locação de imóvel' : 'venda de imóvel'}.`,
    `Família da campanha para direção criativa: ${profile}.`,
    'Perfil não é texto obrigatório, mas pode aparecer como selo curto quando fizer sentido comercial explícito: Minha Casa Minha Vida, Alto padrão, Investimento ou Comercial. Usar Luxo com cuidado e evitar Econômico como texto principal. Nunca escrever "Perfil comercial".',
    `Quantidade de opções de criação: ${formatCreationOptionCount(creativeIdeaCount)}.`,
    getFormatInstruction(primaryDestination),
    '',
    `${answers.propertyType || 'Imóvel'}${!isRent && answers.stage ? ` em ${answers.stage.toLowerCase()}` : ''}${location ? ` em ${location}` : ''}.`,
    featureDetails ? `O imóvel possui ${featureDetails}.` : '',
    ...(valueCondition.promptLines || []),
    differentials.length ? `Diferenciais reais:\n${differentials.join(', ')}.` : '',
    '',
    'Promessa principal:',
    isRent ? 'facilitar a decisão de visita e contato para locação.' : 'destacar a oportunidade real deste imóvel com clareza e força comercial.',
    '',
    'Direção visual:',
    'usar estética adequada ao perfil comercial informado, com leitura rápida, dados reais e composição de campanha imobiliária profissional.',
    '',
    contactPhone ? `Telefone de contato informado pelo usuário: ${contactPhone}. Use exatamente este número junto ao CTA quando houver telefone. Não inventar, completar, trocar DDD ou reformatar o telefone.` : 'Nenhum telefone informado. Não exibir telefone, WhatsApp, site, Instagram ou e-mail.',
    `CTA: ${answers.cta || 'Fale comigo'}${contactPhone ? `\n${contactPhone}` : ''}.`,
    contactPhone ? `Telefone original como fato imutavel: ${contactPhone}. Telefone para exibicao visual: ${displayPhone}.` : '',
    displayPhone ? `CTA completo para exibicao visual:\n${answers.cta || 'Fale comigo'}\n${displayPhone}` : '',
    displayPhone ? 'Nunca juntar CTA e telefone em frase corrida. Nunca colocar ponto final depois do telefone.' : '',
    'Use exatamente este CTA. Não substitua por outro.',
    '',
    `Crie UMA única peça publicitária final para ${primaryDestination?.label || 'o destino escolhido'}.`,
    'Não criar mosaico.',
    'Não criar múltiplos formatos dentro da mesma imagem.',
    'Não repetir a mesma arte em formatos diferentes dentro da imagem.',
    'A saída deve ser uma única arte final pronta para publicação.',
    'Use headline forte, CTA destacado e dados reais informados na conversa.',
    'Não invente imóvel, fachada, planta, lazer, metrô, preço, telefone, e-mail, vista, condições comerciais ou dados não fornecidos.',
    'Evite texto pequeno, torto, ilegível, cortado ou com aparência de arte automática antiga.',
  ]

  return lines.filter(Boolean).join('\n')
}

const buildFormatSpecificPrompt = (basePrompt, destination, imageCount = 0, creativeIdea = getCreativeIdea(1), ideaCount = 1) => {
  const strategy = getFormatVisualStrategy(destination, imageCount)

  return [
  String(basePrompt || '')
    .replace(/^Formatos desejados para adaptação futura:.*$/gmi, '')
    .replace(/^Formato principal da peça:.*$/gmi, '')
    .replace(/^Crie UMA única peça.*$/gmi, '')
    .trim(),
  '',
  'REGRA DO FORMATO DESTA GERAÇÃO:',
  getFormatInstruction(destination),
  '',
  'IDEIA CRIATIVA DESTA GERACAO:',
  `Esta é a Ideia ${creativeIdea.number} de ${ideaCount} da campanha.`,
  `Direção criativa: ${creativeIdea.title}.`,
  creativeIdea.description,
  ideaCount > 1 ? 'Esta ideia deve ser diferente das outras ideias criativas, mantendo os dados reais, cidade, bairro, CTA, valor e condições informadas.' : 'Esta é a única ideia criativa da campanha; preserve a mesma promessa e linguagem nos formatos selecionados.',
  '',
  'ESTRATEGIA VISUAL DESTE FORMATO:',
  `Angulo visual: ${strategy.visualAngle}.`,
  strategy.compositionInstruction,
  strategy.imageUsageStrategy,
  uploadedImagesInstructionText(imageCount),
  'Mantenha a mesma campanha, dados e CTA, mas crie uma composição própria para este formato.',
  'Não copie diretamente layout, recorte, hierarquia ou imagem principal de outros formatos selecionados.',
  'Esta geração deve criar apenas uma peça para este formato específico.',
  'Não criar campanha em vários formatos.',
  'Não criar mosaico, mockup, prancha de apresentação ou múltiplas versões dentro da mesma imagem.',
  ].filter(Boolean).join('\n')
}

const formatFileSlug = (label) => normalizeComparable(label)
  .replace(/\s+/g, '-')
  .replace(/\//g, '-')
  .replace(/-+/g, '-')
  || 'campanha'

const downloadPlainTextFile = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

const formatPieceCount = (count) => `${count} ${count === 1 ? 'peça' : 'peças'}`

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Não foi possível ler uma das imagens.'))
  reader.readAsDataURL(file)
})

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms)
})

function TextBlock({ title, content, filename }) {
  const [copied, setCopied] = useState(false)

  if (!content) return null

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-gray-950">{title}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyText}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-700 hover:bg-gray-50"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={() => downloadPlainTextFile(filename, content)}
            className="rounded-full bg-primary-800 px-3 py-1.5 text-xs font-black text-white hover:bg-primary-700"
          >
            Baixar .txt
          </button>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-gray-600">
        {content}
      </p>
    </div>
  )
}

function AssistantBubble({ children }) {
  return <ConversationAssistantBubble accent="emerald">{children}</ConversationAssistantBubble>
}

function UserBubble({ children, actions }) {
  return <ConversationUserBubble actions={actions}>{children}</ConversationUserBubble>
}

export default function HeroNext({ guestMode = false } = {}) {
  const { user, reloadProfile } = useAuth()
  // This fixed draft owner is only a local storage namespace, never an auth/user_id
  // or server credential. The guest session remains exclusively in HttpOnly cookies.
  const bannerDraft = useProductDraft({ productKey: guestMode ? 'banner-imobiliario-guest' : 'banner-imobiliario', schemaVersion: 1, userId: guestMode ? 'guest-local-draft' : user?.id })
  const restoredBannerDraft = bannerDraft.restoredDraft || {}
  const [phase, setPhase] = useState(() => (guestMode ? (['result', 'processing'].includes(restoredBannerDraft.phase) ? 'goal' : restoredBannerDraft.phase || 'goal') : readStoredHeroNextResult() ? 'result' : restoredBannerDraft.phase || 'intro'))
  const startCampaign = () => setPhase('goal')
  const [goal, setGoal] = useState(() => restoredBannerDraft.goal || '')
  const [answers, setAnswers] = useState(() => restoredBannerDraft.answers || {})
  const [chatIndex, setChatIndex] = useState(() => restoredBannerDraft.chatIndex || 0)
  const [textDraft, setTextDraft] = useState(() => restoredBannerDraft.textDraft || '')
  const [multiDraft, setMultiDraft] = useState(() => restoredBannerDraft.multiDraft || [])
  const [customDifferential, setCustomDifferential] = useState(() => restoredBannerDraft.customDifferential || '')
  const [cityUf, setCityUf] = useState(() => restoredBannerDraft.cityUf || '')
  const [citySelection, setCitySelection] = useState(() => restoredBannerDraft.citySelection || '')
  const [cities, setCities] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [saleValueMode, setSaleValueMode] = useState(() => restoredBannerDraft.saleValueMode || '')
  const [salePrice, setSalePrice] = useState(() => restoredBannerDraft.salePrice || '')
  const [salePricePresentationMode, setSalePricePresentationMode] = useState(() => restoredBannerDraft.salePricePresentationMode || '')
  const [salePriceDigits, setSalePriceDigits] = useState(() => restoredBannerDraft.salePriceDigits || '')
  const [saleConditions, setSaleConditions] = useState(() => restoredBannerDraft.saleConditions || [])
  const [commercialTermsChoice, setCommercialTermsChoice] = useState(() => restoredBannerDraft.commercialTermsChoice || '')
  const [commercialTerms, setCommercialTerms] = useState(() => restoredBannerDraft.commercialTerms || EMPTY_COMMERCIAL_TERMS)
  const [rentMode, setRentMode] = useState(() => restoredBannerDraft.rentMode || '')
  const [rentPrice, setRentPrice] = useState(() => restoredBannerDraft.rentPrice || '')
  const [condoMode, setCondoMode] = useState(() => restoredBannerDraft.condoMode || '')
  const [condoFee, setCondoFee] = useState(() => restoredBannerDraft.condoFee || '')
  const [iptuMode, setIptuMode] = useState(() => restoredBannerDraft.iptuMode || '')
  const [iptuValue, setIptuValue] = useState(() => restoredBannerDraft.iptuValue || '')
  const [rentGuarantee, setRentGuarantee] = useState(() => restoredBannerDraft.rentGuarantee || '')
  const [promptTouched, setPromptTouched] = useState(() => restoredBannerDraft.promptTouched === true)
  const [humanPrompt, setHumanPrompt] = useState(() => restoredBannerDraft.humanPrompt || '')
  const [destinationIds, setDestinationIds] = useState(() => guestMode ? (restoredBannerDraft.destinationIds || []).slice(0,1) : restoredBannerDraft.destinationIds || [])
  const [creativeIdeaCount, setCreativeIdeaCount] = useState(() => guestMode ? 1 : restoredBannerDraft.creativeIdeaCount || 1)
  const [imageChoice, setImageChoice] = useState(() => restoredBannerDraft.imageChoice || '')
  const [uploadedImages, setUploadedImages] = useState([])
  const [missingImageMetadata, setMissingImageMetadata] = useState(() => restoredBannerDraft.imageMetadata || [])
  const [generationLoading, setGenerationLoading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloadAllLoading, setDownloadAllLoading] = useState(false)
  const [goalNotice, setGoalNotice] = useState('')
  const [pieceLimitNotice, setPieceLimitNotice] = useState('')
  const [generationResult, setGenerationResult] = useState(() => guestMode ? null : readStoredHeroNextResult())
  const [generationJobs, setGenerationJobs] = useState(() => guestMode ? [] : readStoredHeroNextResult()?.jobs || [])
  const [expandedPreview, setExpandedPreview] = useState(null)
  const [processingMessage, setProcessingMessage] = useState(PROCESSING_STEPS[0])
  const activeQuestionRef = useRef(null)
  const economicRequestIdRef = useRef(null)
  const guestBusyRef = useRef(false)
  const [guestSignupGate, setGuestSignupGate] = useState(false)
  const [guestConsumed, setGuestConsumed] = useState(false)
  const requireGuestAccount = () => setGuestSignupGate(true)
  useEffect(() => {
    if (!guestMode) return
    let active=true
    guestBannerRequest('status').then(async initial=>{
      let result=initial
      for(let attempt=0;active && attempt<150 && ['processing','dispatching','reserved'].includes(result.status);attempt++) {
        setPhase('processing')
        await wait(4000)
        if(!active)return
        result=await guestBannerRequest('status')
      }
      if(!active)return
      if(result.status==='completed') {
        setGenerationResult(guestResultForBanner(result));setPhase('result');setGuestConsumed(true)
      } else if(result.status==='failed' || result.status==='cancelled') {
        economicRequestIdRef.current=null
        setGuestConsumed(false);setPhase('images')
      } else if(['processing','dispatching','unknown'].includes(result.status)) {
        setGenerationError('Seu anúncio ainda está sendo verificado. Aguarde para evitar uma criação duplicada.')
      }
    }).catch(()=>{})
    return()=>{active=false}
  },[guestMode])
  const expandedPreviewCloseRef = useRef(null)
  const expandedPreviewTriggerRef = useRef(null)
  const reachedStep = phase === 'goal'
    ? STEPS.FLOW_STARTED
    : phase === 'images' ? STEPS.REVIEW
      : ['chat', 'values', 'destination', 'ideas', 'prompt'].includes(phase) ? STEPS.DETAILS : null
  const { trackStep, trackGenerationClicked } = useAccountAnalytics(guestMode ? null : PRODUCTS.BANNER_IMOBILIARIO, reachedStep)

  const isRentGoal = goal === 'rent'
  const isPropertyCaptureGoal = goal === 'property_capture'
  const isBrokerCaptureGoal = goal === 'broker_capture'
  const isAnyCaptureGoal = isPropertyCaptureGoal || isBrokerCaptureGoal
  const profilePhoneRaw = String(guestMode ? answers.contactPhone || '' : user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || '').trim()
  const profilePhone = normalizeContactPhoneForDisplay(profilePhoneRaw)

  useEffect(() => {
    if (!guestMode) writeStoredHeroNextResult(generationResult)
  }, [generationResult, guestMode])

  useEffect(() => {
    if (uploadedImages.length) trackStep(STEPS.UPLOAD)
  }, [trackStep, uploadedImages.length])

  useEffect(() => {
    if (phase === 'result' || generationResult) return
    const imageMetadata = uploadedImages.length
      ? uploadedImages.map(({ name, size, contentType, lastModified }, order) => ({ name, size, type: contentType, lastModified, order }))
      : missingImageMetadata
    const draft = { phase, goal, answers, chatIndex, textDraft, multiDraft, customDifferential, cityUf, citySelection, saleValueMode, salePrice, salePricePresentationMode, salePriceDigits, saleConditions, commercialTermsChoice, commercialTerms, rentMode, rentPrice, condoMode, condoFee, iptuMode, iptuValue, rentGuarantee, promptTouched, humanPrompt, destinationIds, creativeIdeaCount, imageChoice, imageMetadata }
    if (phase === 'intro' && !goal && !imageMetadata.length) { bannerDraft.clear(); return }
    bannerDraft.save(draft)
  }, [answers, bannerDraft, chatIndex, citySelection, cityUf, commercialTerms, commercialTermsChoice, condoFee, condoMode, creativeIdeaCount, customDifferential, destinationIds, generationResult, goal, humanPrompt, imageChoice, iptuMode, iptuValue, missingImageMetadata, multiDraft, phase, promptTouched, rentGuarantee, rentMode, rentPrice, saleConditions, salePrice, salePriceDigits, salePricePresentationMode, saleValueMode, textDraft, uploadedImages])

  const closeExpandedPreview = () => {
    setExpandedPreview(null)
    window.requestAnimationFrame(() => expandedPreviewTriggerRef.current?.focus())
  }

  const openExpandedPreview = (preview, trigger) => {
    expandedPreviewTriggerRef.current = trigger
    setExpandedPreview(preview)
  }

  useEffect(() => {
    if (!expandedPreview) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    expandedPreviewCloseRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeExpandedPreview()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [expandedPreview])

  useEffect(() => {
    if (!cityUf) {
      setCities([])
      setCitiesLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setCitiesLoading(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cityUf}/municipios?orderBy=nome`, { signal: controller.signal })
      .then((response) => response.json())
      .then((items) => setCities(Array.isArray(items) ? items.map((item) => item?.nome).filter(Boolean) : []))
      .catch((error) => {
        if (error?.name !== 'AbortError') setCities([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setCitiesLoading(false)
      })

    return () => controller.abort()
  }, [cityUf])

  useEffect(() => {
    if (phase !== 'chat' || !activeQuestionRef.current) return undefined
    const frame = window.requestAnimationFrame(() => {
      activeQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [phase, chatIndex])

  const baseChatFlow = isRentGoal
    ? RENT_CHAT_FLOW
    : isPropertyCaptureGoal
      ? PROPERTY_CAPTURE_CHAT_FLOW
      : isBrokerCaptureGoal
        ? BROKER_CAPTURE_CHAT_FLOW
      : SALE_CHAT_FLOW
  const chatFlow = getChatFlowForAnswers(baseChatFlow, answers).filter((question) => question.id === 'contactPhone' && guestMode ? answers.contactPhoneChoice === 'Sim, quero divulgar' : shouldShowChatQuestion(question, answers))
  const currentQuestion = chatFlow[chatIndex]
  const selectedDestinations = destinationIds
    .map((id) => DESTINATIONS.find((item) => item.id === id))
    .filter(Boolean)
  const selectedDestination = selectedDestinations[0] || null
  const totalPieceCount = getTotalPieceCount(selectedDestinations, creativeIdeaCount)
  const pieceLimitExceeded = totalPieceCount > MAX_HERO_NEXT_PIECES
  const commercialTermsAvailable = goal === 'sale' && COMMERCIAL_TERMS_STAGES.has(answers.stage)
  const commercialTermsEnabled = commercialTermsAvailable && commercialTermsChoice === 'yes'
  const commercialTermCalls = formatCommercialTermCalls(commercialTermsEnabled ? commercialTerms : {})
  const valueCondition = useMemo(() => buildValueCondition(goal, {
    mode: saleValueMode,
    price: salePrice,
    conditions: saleConditions,
    commercialTerms: commercialTermsEnabled ? commercialTerms : {},
  }, {
    rentMode,
    rentPrice,
    condoMode,
    condoFee,
    iptuMode,
    iptu: iptuValue,
    guarantee: rentGuarantee,
  }), [goal, saleValueMode, salePrice, saleConditions, commercialTermsEnabled, commercialTerms, rentMode, rentPrice, condoMode, condoFee, iptuMode, iptuValue, rentGuarantee])
  const formattedSalePrice = formatHeroPrice(salePriceDigits)
  const saleValueReady = goal !== 'sale'
    || saleValueMode === 'hidden'
    || (saleValueMode === 'price' && Boolean(salePricePresentationMode) && Boolean(salePriceDigits) && Boolean(normalizeValueText(salePrice)))
    || (saleValueMode === 'conditions' && (saleConditions.length > 0 || commercialTermsEnabled))
  const rentValueReady = goal !== 'rent' || (
    ['show', 'hide'].includes(rentMode)
    && ['show', 'hide', 'na'].includes(condoMode)
    && ['show', 'hide', 'na'].includes(iptuMode)
    && Boolean(rentGuarantee)
    && (rentMode !== 'show' || Boolean(normalizeValueText(rentPrice)))
    && (condoMode !== 'show' || Boolean(normalizeValueText(condoFee)))
    && (iptuMode !== 'show' || Boolean(normalizeValueText(iptuValue)))
  )
  const suggestedPrompt = useMemo(() => buildHumanPrompt(goal, answers, selectedDestination ? [selectedDestination] : [], valueCondition, creativeIdeaCount), [goal, answers, selectedDestination, valueCondition, creativeIdeaCount])
  const effectivePrompt = promptTouched ? humanPrompt : suggestedPrompt
  const canGenerate = Boolean(
    effectivePrompt.trim()
    && selectedDestinations.length > 0
    && imageChoice
    && (!imageChoice.startsWith('yes') || uploadedImages.length > 0)
    && !pieceLimitExceeded
    && !generationLoading,
  )

  const resetForGoal = (nextGoal) => {
    bannerDraft.clear()
    setGoalNotice('')
    setGoal(nextGoal)
    setAnswers({})
    setChatIndex(0)
    setTextDraft('')
    setMultiDraft([])
    setCustomDifferential('')
    setCityUf('')
    setCitySelection('')
    setCities([])
    setCitiesLoading(false)
    setSaleValueMode('')
    setSalePrice('')
    setSalePricePresentationMode('')
    setSalePriceDigits('')
    setSaleConditions([])
    setCommercialTermsChoice('')
    setCommercialTerms(EMPTY_COMMERCIAL_TERMS)
    setRentMode('')
    setRentPrice('')
    setCondoMode('')
    setCondoFee('')
    setIptuMode('')
    setIptuValue('')
    setRentGuarantee('')
    setPromptTouched(false)
    setHumanPrompt('')
    setDestinationIds([])
    setCreativeIdeaCount(1)
    setImageChoice('')
    setUploadedImages([])
    setGenerationResult(null)
    setGenerationJobs([])
    setGenerationError('')
    setDownloadError('')
    setDownloadAllLoading(false)
    setPieceLimitNotice('')
    setPhase('chat')
  }

  const commitAnswer = (questionId, value) => {
    const normalizedValue = normalizeAnswerValue(questionId, value)
    const isEmpty = !normalizedValue || (Array.isArray(normalizedValue) && normalizedValue.length === 0)
    const allowsEmpty = baseChatFlow.find((question) => question.id === questionId)?.optional === true
    if (isEmpty && !allowsEmpty) return

    const updatedAnswers = { ...answers }
    if (isEmpty) delete updatedAnswers[questionId]
    else updatedAnswers[questionId] = normalizedValue
    if (questionId === 'contactPhoneChoice') {
      if (normalizedValue === 'Sim, quero divulgar' && profilePhone) {
        updatedAnswers.contactPhone = profilePhoneRaw
      } else {
        delete updatedAnswers.contactPhone
      }
    }
    if (questionId === 'propertyType') {
      delete updatedAnswers.bedrooms
      delete updatedAnswers.suites
      delete updatedAnswers.parking
      delete updatedAnswers.area
    }
    const updatedChatFlow = getChatFlowForAnswers(baseChatFlow, updatedAnswers).filter((question) => question.id === 'contactPhone' && guestMode ? updatedAnswers.contactPhoneChoice === 'Sim, quero divulgar' : shouldShowChatQuestion(question, updatedAnswers))
    const currentUpdatedIndex = updatedChatFlow.findIndex((question) => question.id === questionId)
    const nextMissingIndex = updatedChatFlow.findIndex((question, index) => (
      index > currentUpdatedIndex && !updatedAnswers[question.id]
    ))

    setAnswers(updatedAnswers)
    setTextDraft('')
    setMultiDraft([])
    setCustomDifferential('')
    setGenerationResult(null)
    setGenerationError('')
    setPromptTouched(false)
    setHumanPrompt('')
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()

    if (nextMissingIndex === -1) {
      setPhase(isAnyCaptureGoal ? 'destination' : 'values')
    } else {
      setChatIndex(nextMissingIndex)
    }
  }

  const goToQuestion = (index) => {
    const safeIndex = Math.max(0, Math.min(index, chatFlow.length - 1))
    const question = chatFlow[safeIndex]
    const currentValue = answers[question.id]

    setChatIndex(safeIndex)
    setPhase('chat')
    setTextDraft(typeof currentValue === 'string' ? currentValue : '')
    if (question.id === 'city') setCitySelection(typeof currentValue === 'string' ? currentValue : '')
    setMultiDraft(Array.isArray(currentValue) ? currentValue : [])
    setCustomDifferential('')
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationResult(null)
    setGenerationError('')
  }

  const goBackInChat = () => {
    if (chatIndex > 0) {
      goToQuestion(chatIndex - 1)
      return
    }
    setPhase('goal')
  }

  const toggleDestination = (id) => {
    if(guestMode){setDestinationIds([id]);setCreativeIdeaCount(1);setPromptTouched(false);return}
    setDestinationIds((current) => {
      if (current.includes(id)) {
        setPieceLimitNotice('')
        return current.filter((item) => item !== id)
      }

      const next = [...current, id]
      if (getTotalPieceCount(next.length, creativeIdeaCount) > MAX_HERO_NEXT_PIECES) {
        setPieceLimitNotice(HERO_NEXT_PIECE_LIMIT_MESSAGE)
        return current
      }

      setPieceLimitNotice('')
      return next
    })
    setCreativeIdeaCount((current) => Math.max(1, Math.min(3, current)))
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
  }

  const toggleSaleCondition = (condition) => {
    setSaleConditions((current) => (
      current.includes(condition)
         ? current.filter((item) => item !== condition)
        : [...current, condition]
    ))
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
  }

  const updateCommercialTerm = (field, value) => {
    const amount = String(value || '').replace(/\D/g, '').slice(0, 12)
    setCommercialTerms((current) => ({ ...current, [field]: amount }))
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
  }

  const goToDestinationStep = () => {
    if (goal === 'sale' && !saleValueReady) return
    if (goal === 'rent' && !rentValueReady) return
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
    setPhase('destination')
  }

  const handlePromptChange = (value) => {
    setPromptTouched(true)
    setHumanPrompt(value)
    setGenerationResult(null)
    setGenerationError('')
  }

  const selectCreativeIdeaCount = (count) => {
    if (getTotalPieceCount(selectedDestinations.length, count) > MAX_HERO_NEXT_PIECES) {
      setPieceLimitNotice(HERO_NEXT_PIECE_LIMIT_MESSAGE)
      return
    }

    setPieceLimitNotice('')
    setCreativeIdeaCount(count)
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
  }

  const handleFiles = async (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
      .filter((file) => !uploadedImages.some((item) => item.id === `${file.name}-${file.size}-${file.lastModified}`))
    if (uploadedImages.length + imageFiles.length > MAX_HERO_NEXT_IMAGES) {
      setGenerationError('Você pode enviar até 4 imagens. Remova uma imagem antes de adicionar outra.')
      return
    }
    if (imageFiles.length === 0) return

    try {
      const parsed = await Promise.all(imageFiles.map(async (file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        contentType: file.type || 'image/jpeg',
        lastModified: file.lastModified,
        data: await fileToDataUrl(file),
      })))
      setUploadedImages([...uploadedImages, ...parsed])
      setMissingImageMetadata([])
      setGenerationError('')
    } catch (error) {
      setGenerationError(getSmartTokenErrorMessage(error, 'Não foi possível carregar as imagens.'))
    }
  }

  const pollGeneration = async (generationId) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      setProcessingMessage(PROCESSING_STEPS[attempt % PROCESSING_STEPS.length])
      await wait(4000)

      const { data, error } = await supabase.functions.invoke('gerar-hero-ia', {
        body: {
          action: 'status',
          generation_id: generationId,
        },
      })

      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, 'Nao foi possivel consultar a campanha.'))
      if (!data.success && data.status !== 'failed') throw new Error(data.message || data.error || 'Não foi possível consultar a campanha.')

      if (data.status === 'completed') {
        const imageUrl = data.image_url || data.imageUrl || ''
        if (!imageUrl) {
          throw new Error(data.message || data.error || 'Banner Imobiliário não retornou a imagem gerada.')
        }

        setGenerationResult({
          ...data,
          sourceId: economicRequestIdRef.current || '',
          imageUrl,
          texts: data.texts || {},
          campaignCopy: buildHeroNextCampaignCopy(goal, answers, valueCondition),
        })
        setPhase('result')
        return
      }

      if (data.status === 'failed' || data.success === false) {
        throw new Error(data.message || data.error || 'Não foi possível concluir a campanha.')
      }
    }

    throw new Error('A campanha ainda está em criação. Tente consultar novamente em alguns instantes.')
  }

  const updateGenerationJob = (jobId, patch) => {
    setGenerationJobs((current) => current.map((job) => (
      job.jobId === jobId || job.formatId === jobId ? { ...job, ...patch } : job
    )))
  }

  const pollGenerationJob = async (generationId, destination, creativeIdea = getCreativeIdea(1)) => {
    const formatId = destination.id
    const jobId = `idea-${creativeIdea.number}-${formatId}`

    for (let attempt = 0; attempt < 90; attempt += 1) {
      setProcessingMessage(PROCESSING_STEPS[attempt % PROCESSING_STEPS.length])
      await wait(4000)

      const { data, error } = await supabase.functions.invoke('gerar-hero-ia', {
        body: {
          action: 'status',
          generation_id: generationId,
        },
      })

      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, `Nao foi possivel consultar ${destination.label}.`))

      if (data.status === 'completed') {
        const imageUrl = data.image_url || data.imageUrl || ''
        if (!imageUrl) {
          throw new Error(data.message || data.error || `Banner Imobiliário não retornou a imagem de ${destination.label}.`)
        }

        const completedJob = {
          formatId,
          jobId,
          formatLabel: destination.label,
          ideaNumber: creativeIdea.number,
          creativeDirection: creativeIdea.title,
          generationId,
          status: 'completed',
          imageUrl,
          texts: data.texts || {},
          error: null,
          visualAngle: getFormatVisualStrategy(destination, uploadedImages.length).visualAngle,
          imageUsageStrategy: getFormatVisualStrategy(destination, uploadedImages.length).imageUsageStrategy,
        }
        updateGenerationJob(jobId, completedJob)
        return completedJob
      }

      if (data.status === 'failed' || data.success === false) {
        throw new Error(data.message || data.error || `Não foi possível concluir ${destination.label}.`)
      }

      updateGenerationJob(jobId, { status: 'processing' })
    }

    throw new Error(`${destination.label} ainda está em criação. Tente novamente em alguns instantes.`)
  }

  const startGenerationJob = async (destination, creativeIdea, campaignBatchId, formatIndex, totalFormats, jobIndex, totalJobs, economicContext) => {
    const formatId = destination.id
    const jobId = `idea-${creativeIdea.number}-${formatId}`
    const formatStrategy = getFormatVisualStrategy(destination, uploadedImages.length)
    const promptForFormat = promptTouched
       ? buildFormatSpecificPrompt(effectivePrompt, destination, uploadedImages.length, creativeIdea, creativeIdeaCount)
      : buildFormatSpecificPrompt(buildHumanPrompt(goal, answers, [destination], valueCondition, creativeIdeaCount), destination, uploadedImages.length, creativeIdea, creativeIdeaCount)
    const publicationOptions = buildHeroNextCampaignCopy(goal, answers, valueCondition).slice(0, 3).map((item, index) => ({
      id: `banner-caption-option-${index + 1}`,
      label: item.label || `Texto ${index + 1}`,
      text: item.text,
    }))

    updateGenerationJob(jobId, {
      status: 'starting',
      error: null,
      visualAngle: formatStrategy.visualAngle,
      imageUsageStrategy: formatStrategy.imageUsageStrategy,
    })

    console.info('[HeroNext] generation job', {
      campaign_batch_id: campaignBatchId,
      format_id: formatId,
      idea_number: creativeIdea.number,
      creative_direction: creativeIdea.title,
      visual_angle: formatStrategy.visualAngle,
      image_usage_strategy: formatStrategy.imageUsageStrategy,
      received_image_count: uploadedImages.length,
      sent_image_count: Math.min(uploadedImages.length, MAX_HERO_NEXT_IMAGES),
      primary_image: uploadedImages.length > 0 ? 'image_1' : null,
      support_images: uploadedImages.slice(1).map((_, index) => `image_${index + 2}`),
    })

    const invokeGeneration = guestMode ? async ({body}) => {
      let result=await guestBannerRequest('generate',{clientRequestId:economicContext.clientRequestId,banner:body})
      for(let attempt=0;attempt<150 && result.status!=='completed';attempt++) {
        if(['failed','unknown','cancelled'].includes(result.status)){
          const failure=Error(result.status==='unknown' ? 'Seu anúncio ainda está sendo verificado. Aguarde para evitar uma criação duplicada.' : 'Não foi possível concluir seu anúncio. Seu teste grátis continua disponível.')
          failure.code=result.status==='failed' || result.status==='cancelled' ? 'guest_generation_failed' : 'guest_processing'
          throw failure
        }
        await wait(4000)
        result=await guestBannerRequest('status')
      }
      if(result.status!=='completed')throw Error('Seu anúncio ainda está sendo criado. Volte em instantes.')
      return {data:{success:true,status:'completed',generation_id:result.requestId,image_url:result.imageUrl,texts:result.texts}}
    } : (options) => supabase.functions.invoke('gerar-hero-ia',options)
    const { data, error } = await invokeGeneration({
      body: {
        human_prompt: promptForFormat.trim(),
        image_mode: uploadedImages.length > 0 ? 'reference_photos' : 'new_image',
        image_mode_label: uploadedImages.length > 0
          ? (isCaptureGoal(goal) ? 'Marca ou foto institucional anexada' : 'Imagens reais anexadas')
          : 'Campanha sem imagens anexadas',
        inline_images: uploadedImages.map((item) => ({
          name: item.name,
          content_type: item.contentType,
          data: item.data,
        })),
        hero_next_experimental: true,
        campaign_objective: getHeroNextCampaignObjective(goal),
        publication_options: publicationOptions,
        property_type: answers.propertyType || normalizeList(answers.propertyKinds).join(', '),
        property_profile: answers.profile || (goal === 'rent' ? 'Locação' : goal === 'property_capture' ? 'Captação de Imóveis' : goal === 'broker_capture' ? 'Captação de Corretores' : ''),
        property_stage: answers.stage || '',
        city: answers.city || '',
        district: answers.neighborhood || answers.neighborhoods || '',
        bedrooms: answers.bedrooms || '',
        suites: answers.suites || '',
        parking: answers.parking || '',
        area: answers.area || '',
        display_area: formatAreaForDisplay(answers.area || ''),
        rent_price: rentMode === 'show' ? normalizeValueText(rentPrice) : '',
        display_rent_price: rentMode === 'show' ? formatCurrencyForDisplay(normalizeValueText(rentPrice), 'locacao') : '',
        condo_fee: condoMode === 'show' ? normalizeValueText(condoFee) : '',
        display_condo_fee: condoMode === 'show' ? formatCurrencyForDisplay(normalizeValueText(condoFee), 'locacao') : '',
        iptu: iptuMode === 'show' ? normalizeValueText(iptuValue) : '',
        display_iptu: iptuMode === 'show' ? formatCurrencyForDisplay(normalizeValueText(iptuValue), 'locacao') : '',
        guarantee_id: rentGuarantee,
        guarantee: rentGuarantee !== 'nao_informar' ? rentGuarantee : '',
        guarantee_label: rentGuarantee !== 'nao_informar' ? getRentalGuaranteeLabel(rentGuarantee) : '',
        highlights: getHeroNextCaptureFeatures(goal, answers),
        cta: answers.cta || (isCaptureGoal(goal) ? 'Solicitar contato' : 'Fale com o corretor'),
        contact_phone: answers.contactPhoneChoice === 'Sim, quero divulgar' ? answers.contactPhone || '' : '',
        display_phone: answers.contactPhoneChoice === 'Sim, quero divulgar' ? normalizeContactPhoneForDisplay(answers.contactPhone || '') : '',
        campaign_contact_phone: answers.contactPhoneChoice === 'Sim, quero divulgar' ? answers.contactPhone || '' : '',
        deliverables: {
          hero_image: true,
          instagram_text: true,
          hashtags: true,
          cta: true,
          whatsapp: true,
          portal_description: true,
        },
        value_condition: valueCondition,
        primary_destination: destination,
        compatible_destinations: [],
        campaign_batch_id: campaignBatchId,
        format_generation: {
          index: formatIndex,
          total: totalFormats,
          job_index: jobIndex,
          total_jobs: totalJobs,
          format_id: formatId,
          format_label: destination.label,
        },
        creative_idea: {
          number: creativeIdea.number,
          title: creativeIdea.title,
          description: creativeIdea.description,
          visual_angle: creativeIdea.visualAngle,
        },
        format_strategy: formatStrategy,
        additional_info: '',
        client_request_id: economicContext.clientRequestId,
        economic_claim_token: economicContext.claimToken,
        economic_item_id: economicContext.itemId,
      },
    })

    if (error) throw new Error(await getEdgeFunctionErrorMessage(error, `Nao foi possivel iniciar ${destination.label}.`))
    if (!data.success) throw new Error(data.message || data.error || `Não foi possível iniciar ${destination.label}.`)

    const generationId = data.generation_id || data.hero_generation_id
    const returnedImageUrl = data.image_url || data.imageUrl || ''
    updateGenerationJob(jobId, {
      generationId,
      status: data.status === 'processing' ? 'processing' : 'completed',
      texts: data.texts || {},
      imageUrl: returnedImageUrl || null,
      visualAngle: formatStrategy.visualAngle,
      imageUsageStrategy: formatStrategy.imageUsageStrategy,
    })

    if (data.status === 'processing') {
      return pollGenerationJob(generationId, destination, creativeIdea)
    }

    if (!returnedImageUrl) {
      throw new Error(data.message || data.error || `Banner Imobiliário não retornou a imagem de ${destination.label}.`)
    }

    return {
      formatId,
      jobId,
      formatLabel: destination.label,
      ideaNumber: creativeIdea.number,
      creativeDirection: creativeIdea.title,
      generationId,
      status: 'completed',
      imageUrl: returnedImageUrl,
      texts: data.texts || {},
      error: null,
      visualAngle: formatStrategy.visualAngle,
      imageUsageStrategy: formatStrategy.imageUsageStrategy,
    }
  }

  const handleGenerate = async () => {
      // Guest uses only the promotional backend, never authenticated ST routines.
    if (guestMode) {
      if(guestBusyRef.current || !canGenerate)return
      if(guestConsumed){setGenerationError('Seu teste grátis já foi utilizado. Crie sua conta para continuar criando.');return}
      guestBusyRef.current=true;setGenerationLoading(true);setGenerationError('');setPhase('processing')
      const clientRequestId=economicRequestIdRef.current || crypto.randomUUID()
      economicRequestIdRef.current=clientRequestId
      try {
        const job=await startGenerationJob(selectedDestinations[0],CREATIVE_IDEAS[0],clientRequestId,1,1,1,1,{clientRequestId})
        setGenerationResult({sourceId:clientRequestId,jobs:[job],imageUrl:job.imageUrl,texts:job.texts,campaignCopy:buildHeroNextCampaignCopy(goal,answers,valueCondition)})
        setGuestConsumed(true);setPhase('result')
      } catch(error) {
          if(error.code==='promotion_used'){setGuestConsumed(true);requireGuestAccount()}
          if(['preprovider_cancelled','guest_generation_failed'].includes(error.code))economicRequestIdRef.current=null
          setPhase('images')
        setGenerationError(error.message || 'Não foi possível concluir seu anúncio.')
      } finally {guestBusyRef.current=false;setGenerationLoading(false)}
      return
    }
    if (pieceLimitExceeded) {
      setGenerationError(HERO_NEXT_PIECE_LIMIT_MESSAGE)
      return
    }
    if (!canGenerate) return

    trackGenerationClicked()
    setGenerationLoading(true)
    setGenerationError('')
    setDownloadError('')
    setGenerationResult(null)
    const campaignBatchId = createCampaignBatchId()
    const clientRequestId = economicRequestIdRef.current || crypto.randomUUID()
    economicRequestIdRef.current = clientRequestId
    const selectedIdeas = CREATIVE_IDEAS.slice(0, creativeIdeaCount)
    const jobRequests = selectedIdeas.flatMap((creativeIdea) => (
      selectedDestinations.map((destination, destinationIndex) => ({
        destination,
        creativeIdea,
        formatIndex: destinationIndex + 1,
        totalFormats: selectedDestinations.length,
      }))
    ))
    const initialJobs = jobRequests.map(({ destination, creativeIdea }) => {
      const formatStrategy = getFormatVisualStrategy(destination, uploadedImages.length)
      return {
        jobId: `idea-${creativeIdea.number}-${destination.id}`,
        formatId: destination.id,
        formatLabel: destination.label,
        ideaNumber: creativeIdea.number,
        creativeDirection: creativeIdea.title,
        generationId: null,
        status: 'queued',
        imageUrl: null,
        texts: {},
        error: null,
        visualAngle: formatStrategy.visualAngle,
        imageUsageStrategy: formatStrategy.imageUsageStrategy,
      }
    })
    setGenerationJobs(initialJobs)
    setPhase('processing')

    try {
      setProcessingMessage('Criando sua campanha...')
      const economicItems = jobRequests.map(({ destination, creativeIdea }) => ({
        piece_id: `idea-${creativeIdea.number}-${destination.id}`,
        format_id: destination.id,
        format_group: destination.format_group,
        creation_option: creativeIdea.number,
        resolution: getEconomicResolution(destination),
        reference_count: Math.min(uploadedImages.length, MAX_HERO_NEXT_IMAGES),
      }))
      const { data: economicBatch, error: economicError } = await supabase.functions.invoke('gerar-hero-ia', {
        body: {
          action: 'prepare_batch',
          client_request_id: clientRequestId,
          selected_format_count: selectedDestinations.length,
          creation_options: creativeIdeaCount,
          items: economicItems,
        },
      })
      if (economicError) throw new Error(await getEdgeFunctionErrorMessage(economicError, 'Não foi possível reservar os Smart Tokens.'))
      if (!economicBatch?.success || !economicBatch?.claim_token) {
        throw new Error(economicBatch?.code === 'INSUFFICIENT_SMART_TOKENS'
          ? 'Smart Tokens insuficientes para esta criação.'
          : economicBatch?.error || 'Não foi possível preparar a criação.')
      }
      const economicItemByPiece = new Map((economicBatch.items || []).map((item) => [item.piece_id, item]))
      const settledJobs = await Promise.all(jobRequests.map(async ({ destination, creativeIdea, formatIndex, totalFormats }, index) => {
        try {
          const pieceId = `idea-${creativeIdea.number}-${destination.id}`
          const economicItem = economicItemByPiece.get(pieceId)
          if (!economicItem?.id) throw new Error('A reserva econômica não contém esta peça.')
          return await startGenerationJob(destination, creativeIdea, campaignBatchId, formatIndex, totalFormats, index + 1, jobRequests.length, {
            clientRequestId,
            claimToken: economicBatch.claim_token,
            itemId: economicItem.id,
          })
        } catch (error) {
          const formatStrategy = getFormatVisualStrategy(destination, uploadedImages.length)
          const jobId = `idea-${creativeIdea.number}-${destination.id}`
          const failedJob = {
            jobId,
            formatId: destination.id,
            formatLabel: destination.label,
            ideaNumber: creativeIdea.number,
            creativeDirection: creativeIdea.title,
            generationId: null,
            status: 'failed',
            imageUrl: null,
            texts: {},
            error: error instanceof Error ? error.message : `Não foi possível gerar ${destination.label}.`,
          }
          updateGenerationJob(jobId, failedJob)
          return failedJob
        }
      }))

      const firstCompleted = settledJobs.find((job) => job.status === 'completed' && job.imageUrl)
      if (!firstCompleted) {
        const firstError = settledJobs.find((job) => job.status === 'failed')?.error
        throw new Error(firstError || 'Não foi possível gerar nenhuma imagem do Banner Imobiliário.')
      }
      const completedResult = {
        sourceId: clientRequestId,
        jobs: settledJobs,
        imageUrl: firstCompleted.imageUrl || '',
        texts: firstCompleted.texts || {},
        campaignCopy: buildHeroNextCampaignCopy(goal, answers, valueCondition),
      }
      setGenerationResult(completedResult)
      writeStoredHeroNextResult(completedResult)
      economicRequestIdRef.current = null
      setPhase('result')
    } catch (error) {
      setGenerationError(getSmartTokenErrorMessage(error, 'Não foi possível gerar a campanha.'))
    } finally {
      setGenerationLoading(false)
      await reloadProfile()
    }
  }

  const campaignCopy = generationResult
    ? (Array.isArray(generationResult.campaignCopy) && generationResult.campaignCopy.length > 0
        ? generationResult.campaignCopy
        : buildHeroNextCampaignCopy(goal, answers, valueCondition))
    : []

  const downloadTexts = () => {
    if(guestMode){requireGuestAccount();return}
    const content = buildCampaignTextFile(buildCampaignPackage(campaignPackageData))
    downloadPlainTextFile('campanha-hero-ia.txt', content)
  }

  const downloadAllImages = async () => {
    if(guestMode){requireGuestAccount();return}
    const completedJobs = (generationResult.jobs || []).filter((job) => job.status === 'completed' && job.imageUrl)
    setDownloadError('')
    setDownloadAllLoading(true)
    try {
      for (const job of completedJobs) {
        await downloadImageFile(
          job.imageUrl,
          `smartcorretorai-hero-ia-${job.ideaNumber || 1}-${formatFileSlug(job.formatLabel)}.png`,
        )
      }
    } catch {
      setDownloadError('Não foi possível baixar todas as artes. Verifique sua conexão e tente novamente.')
    } finally {
      setDownloadAllLoading(false)
    }
  }

  const resetCampaign = () => {
    if(guestMode){requireGuestAccount();return}
    bannerDraft.clear()
    setPhase('intro')
    setGoal('')
    setAnswers({})
    setCityUf('')
    setCitySelection('')
    setCities([])
    setCitiesLoading(false)
    setSaleValueMode('')
    setSalePrice('')
    setSalePricePresentationMode('')
    setSalePriceDigits('')
    setSaleConditions([])
    setCommercialTermsChoice('')
    setCommercialTerms(EMPTY_COMMERCIAL_TERMS)
    setRentMode('')
    setRentPrice('')
    setCondoMode('')
    setCondoFee('')
    setIptuMode('')
    setIptuValue('')
    setRentGuarantee('')
    setDestinationIds([])
    setCreativeIdeaCount(1)
    setPromptTouched(false)
    setHumanPrompt('')
    setImageChoice('')
    setUploadedImages([])
    setMissingImageMetadata([])
    setGoalNotice('')
    setPieceLimitNotice('')
    setGenerationResult(null)
    setGenerationJobs([])
    setDownloadError('')
    setDownloadAllLoading(false)
    economicRequestIdRef.current = null
  }

  const campaignPackageBuild = generationResult ? buildHeroNextCampaignPackageData({
    result: generationResult,
    campaignCopy,
    context: {
      purpose: getGoalLabel(goal),
      propertyType: isPropertyCaptureGoal ? formatAnswer(answers.propertyKinds) : isBrokerCaptureGoal ? formatAnswer(answers.professionalProfile) : answers.propertyType,
      neighborhood: answers.neighborhood || answers.neighborhoods,
      city: answers.city,
      bedrooms: answers.bedrooms,
      suites: answers.suites,
      parking: answers.parking,
      area: answers.area,
      highlights: isAnyCaptureGoal ? answers.businessDifferentials : answers.differentials,
      cta: answers.cta,
      contactAuthorized: answers.contactPhoneChoice === 'Sim, quero divulgar' && Boolean(profilePhone),
      phone: answers.contactPhoneChoice === 'Sim, quero divulgar' ? profilePhone : '',
    },
    buildGoogleAds: buildPublicationGoogleAds,
    googleAdsInput: buildHeroNextCopyInput(goal, answers, valueCondition),
    creationOptionLabel: getCreationOptionLabel,
  }) : { data: null, error: null, warning: '' }
  const campaignPackageData = campaignPackageBuild.data

  const renderQuestionControls = () => {
    if (!currentQuestion) return null

    if (currentQuestion.id === 'contactPhoneChoice') {
      return (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!guestMode && !profilePhone}
            aria-pressed={answers.contactPhoneChoice === 'Sim, quero divulgar'}
            onClick={() => commitAnswer(currentQuestion.id, 'Sim, quero divulgar')}
            className="rounded-3xl border border-emerald-200 bg-white p-5 text-left transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:opacity-70"
          >
            <p className="text-base font-black text-slate-950">Sim, divulgar meu telefone</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {profilePhone || (guestMode ? 'Informe o telefone que deseja exibir no anúncio.' : 'Cadastre um telefone no Cadastro Profissional para habilitar esta opção.')}
            </p>
          </button>
          <button
            type="button"
            onClick={() => commitAnswer(currentQuestion.id, 'Não, continuar sem telefone')}
            className="rounded-3xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-500 hover:bg-emerald-50"
          >
            <p className="text-base font-black text-slate-950">Não divulgar telefone</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">A campanha será criada sem contato telefônico.</p>
          </button>
        </div>
      )
    }

    if (currentQuestion.id === 'city') {
      return (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Estado</p>
            <SmartLocationSelect
              autoFocus
              accent="primary"
              ariaLabel="Estado"
              value={cityUf}
              onChange={(nextUf) => {
                setCityUf(nextUf)
                setCitySelection('')
              }}
            >
              <option value="">Selecione o estado</option>
              {HERO_STATE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </SmartLocationSelect>
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Cidade</p>
            <SmartLocationSelect
              accent="primary"
              ariaLabel="Cidade"
              value={citySelection}
              disabled={!cityUf || citiesLoading}
              onChange={(nextCity) => {
                setCitySelection(nextCity)
                if (nextCity) commitAnswer(currentQuestion.id, nextCity)
              }}
            >
              <option value="">{citiesLoading ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </SmartLocationSelect>
          </div>
        </div>
      )
    }

    if (currentQuestion.type === 'text') {
      return (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {['neighborhood', 'neighborhoods'].includes(currentQuestion.id) ? (
            <SmartLocationTextInput
              autoFocus
              accent="primary"
              ariaLabel={currentQuestion.id === 'neighborhood' ? 'Bairro' : 'Bairros'}
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitAnswer(currentQuestion.id, textDraft)
              }}
              placeholder={currentQuestion.placeholder}
            />
          ) : (
            <input
              autoFocus
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitAnswer(currentQuestion.id, textDraft)
              }}
              placeholder={currentQuestion.placeholder}
              className="min-h-12 flex-1 rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            />
          )}
          <ProductButton type="button" onClick={() => commitAnswer(currentQuestion.id, textDraft)} disabled={!textDraft.trim()}>
            <Send className="h-4 w-4" />
            Enviar
          </ProductButton>
          {currentQuestion.optionalLabel && (
            <ProductButton type="button" variant="secondary" onClick={() => commitAnswer(currentQuestion.id, '')}>
              {currentQuestion.optionalLabel}
            </ProductButton>
          )}
        </div>
      )
    }

    if (currentQuestion.type === 'multi' || currentQuestion.type === 'multiGrouped') {
      const groups = currentQuestion.groups || [{ title: '', options: currentQuestion.options || [] }]
      const selectedWithCustom = [
        ...multiDraft,
        ...(customDifferential.trim() ? [normalizeTerm(customDifferential).slice(0, 60)] : []),
      ].filter(Boolean)
      return (
        <div className="mt-4 space-y-4">
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.title || 'opcoes'}>
                {group.title && (
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-primary-700">{group.title}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const normalizedOption = normalizeTerm(option)
                    const active = multiDraft.includes(normalizedOption)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setMultiDraft((current) => (
                            current.includes(normalizedOption)
                               ? current.filter((item) => item !== normalizedOption)
                              : [...current, normalizedOption]
                          ))
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                          active ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {normalizedOption}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <input
            value={customDifferential}
            onChange={(event) => setCustomDifferential(event.target.value)}
            placeholder={currentQuestion.customPlaceholder || 'Outro diferencial importante'}
            maxLength={60}
            className="min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          <ProductButton type="button" onClick={() => commitAnswer(currentQuestion.id, selectedWithCustom)} disabled={selectedWithCustom.length === 0}>
            {currentQuestion.confirmLabel || 'Confirmar diferenciais'}
          </ProductButton>
        </div>
      )
    }

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {currentQuestion.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => commitAnswer(currentQuestion.id, option)}
            className={`rounded-full border px-4 py-2 text-sm font-black transition ${
              answers[currentQuestion.id] === option ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-900'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-smart-canvas">
      <Header title="Banner Imobiliário" subtitle="Nossa IA transforma as fotos e informações do imóvel em banners profissionais, prontos para divulgar seus imóveis com mais impacto." />

      <main className={SMART_UI.page}>
        <div data-smart-conversation>
        <ProductButton
          as={Link}
          to={guestMode ? '/' : '/dashboard'}
          variant="secondary"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {guestMode ? 'Conhecer a plataforma' : 'Voltar para Home'}
        </ProductButton>

        {phase === 'intro' && (
          <ProductHero
            id="banner-imobiliario-title"
            productName="Banner Imobiliário"
            headline="Sua campanha, criada com"
            highlight="direção profissional."
            description="Nossa IA transforma as fotos e informações do imóvel em banners profissionais, prontos para divulgar seus imóveis com mais impacto."
            actions={<ProductButton type="button" size="lg" onClick={startCampaign}>Começar minha campanha</ProductButton>}
            className="mt-6"
          />
        )}

        {phase === 'intro' && <HeroShowcase onStart={startCampaign} />}

        {BANNER_STEP_BY_PHASE[phase] && (
          <ProductSteps
            steps={BANNER_CREATION_STEPS}
            activeStep={BANNER_STEP_BY_PHASE[phase]}
            label="Etapas da criação do Banner Imobiliário"
            className="mt-6"
          />
        )}

        {phase === 'goal' && (
          <ProductCard variant="muted" className="mt-6 p-5 sm:p-8">
            <AssistantBubble>O que deseja divulgar</AssistantBubble>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    resetForGoal(item.id)
                  }}
                  className="rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-gray-950 hover:shadow-md"
                >
                  <Building2 className="h-7 w-7 text-primary-600" />
                  <p className="mt-4 text-xl font-black text-gray-950">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
                    {item.description || 'A conversa será adaptada para esse objetivo.'}
                  </p>
                </button>
              ))}
            </div>
            {goalNotice && (
              <p className="mt-4 rounded-2xl border border-blue-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                {goalNotice}
              </p>
            )}
          </ProductCard>
        )}

        {phase === 'chat' && (
          <section data-smart-conversation className="mt-6 overflow-visible">
            <div className="mb-5">
              <ConversationHeader
                eyebrow="Conversa guiada"
                title="Conte sobre sua campanha"
                description="Uma pergunta por vez. Você pode revisar qualquer resposta."
                accent="emerald"
                trailing={<span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{Math.min(chatIndex + 1, chatFlow.length)} de {chatFlow.length}</span>}
              />
            </div>
            <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-w-0">
                <div className="mb-4">
                  <ProductButton type="button" variant="secondary" onClick={goBackInChat}>Voltar</ProductButton>
                </div>
                <div className="min-w-0 space-y-4" aria-live="polite">
                  {chatFlow.slice(0, chatIndex).map((question, index) => (
                    <div key={question.id} className="space-y-4">
                      <AssistantBubble>{question.question}</AssistantBubble>
                      <UserBubble actions={<button type="button" onClick={() => goToQuestion(index)} className="mt-2 inline-flex items-center text-xs font-black text-emerald-200 hover:text-white">Editar</button>}>
                        {formatAnswer(answers[question.id])}
                      </UserBubble>
                    </div>
                  ))}
                  {currentQuestion && (
                    <div ref={activeQuestionRef} className="scroll-mt-6 space-y-4">
                      <ConversationQuestionCard
                        accent="emerald"
                        label={`${Math.min(chatIndex + 1, chatFlow.length)} de ${chatFlow.length}`}
                        title={currentQuestion.question}
                      >
                        {renderQuestionControls()}
                      </ConversationQuestionCard>
                    </div>
                  )}
                </div>
              </div>
              <aside className="rounded-3xl bg-white/80 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70 backdrop-blur-sm lg:sticky lg:top-6 lg:self-start">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Resumo ao vivo</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Sua campanha</h3>
                <div className="mt-4 space-y-2 rounded-2xl bg-slate-50/90 p-2">
                  <div className="rounded-xl px-2 py-2 text-sm"><strong className="text-slate-950">Objetivo</strong><p className="mt-1 font-semibold text-slate-600">{getGoalLabel(goal)}</p></div>
                  {chatFlow.slice(0, chatIndex).map((question, index) => answers[question.id] ? (
                    <div key={question.id} className="rounded-xl px-2 py-2 text-sm transition hover:bg-primary-50">
                      <div className="flex items-start justify-between gap-3"><p className="min-w-0"><strong className="text-slate-950">{question.question}</strong><span className="mt-1 block break-words font-semibold text-slate-600">{formatAnswer(answers[question.id])}</span></p><button type="button" onClick={() => goToQuestion(index)} className="shrink-0 text-xs font-black text-emerald-700">Editar</button></div>
                    </div>
                  ) : null)}
                </div>
              </aside>
            </div>
          </section>
        )}

        {phase === 'values' && (
          <ProductCard variant="muted" className="mt-6 p-5 sm:p-8">
            <AssistantBubble>{goal === 'rent' ? 'Quais valores deseja divulgar' : 'Deseja divulgar valor ou condições'}</AssistantBubble>

            {goal === 'sale' && (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {[
                    { id: 'price', title: 'Mostrar valor do imóvel', description: 'O valor informado poderá aparecer na campanha.' },
                    { id: 'conditions', title: 'Mostrar apenas condições', description: 'Sem preço. Apenas condições comerciais reais.' },
                    { id: 'hidden', title: 'Não mostrar valores', description: 'A campanha não deve mostrar preço nem condições.' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSaleValueMode(item.id)
                        if (item.id === 'hidden') {
                          setSalePrice('')
                          setSalePricePresentationMode('')
                          setSalePriceDigits('')
                          setSaleConditions([])
                          setCommercialTermsChoice('')
                          setCommercialTerms(EMPTY_COMMERCIAL_TERMS)
                        }
                        setPromptTouched(false)
                        setHumanPrompt('')
                        setGenerationError('')
                      }}
                      className={`rounded-3xl border p-5 text-left transition ${
                        saleValueMode === item.id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      <p className="text-lg font-black">{item.title}</p>
                      <p className={`mt-2 text-sm font-semibold leading-relaxed ${saleValueMode === item.id ? 'text-gray-300' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    </button>
                  ))}
                </div>

                {saleValueMode === 'price' && (
                  <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-black text-gray-950">Como deseja apresentar o valor?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ['fixed', 'Preço fixo'],
                        ['starting_at', 'A partir de'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setSalePricePresentationMode(id)
                            setSalePrice(salePriceDigits ? `${id === 'starting_at' ? 'A partir de ' : ''}${formatHeroPrice(salePriceDigits)}` : '')
                            setPromptTouched(false)
                            setHumanPrompt('')
                          }}
                          className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                            salePricePresentationMode === id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="mt-5 block text-sm font-black text-gray-950" htmlFor="sale-price">Valor</label>
                    <input
                      id="sale-price"
                      value={formattedSalePrice}
                      onChange={(event) => {
                        const nextDigits = event.target.value.replace(/\D/g, '').slice(0, 12)
                        setSalePriceDigits(nextDigits)
                        setSalePrice(nextDigits ? `${salePricePresentationMode === 'starting_at' ? 'A partir de ' : ''}${formatHeroPrice(nextDigits)}` : '')
                        setPromptTouched(false)
                        setHumanPrompt('')
                      }}
                      inputMode="numeric"
                      placeholder="R$ 0"
                      className="mt-3 min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                )}

                {(saleValueMode === 'price' || saleValueMode === 'conditions') && (
                  <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-black text-gray-950">
                      {saleValueMode === 'price' ? 'Condições adicionais, se quiser' : 'Condições comerciais reais'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SALE_CONDITION_OPTIONS.map((condition) => {
                        const active = saleConditions.includes(condition)
                        return (
                          <button
                            key={condition}
                            type="button"
                            onClick={() => toggleSaleCondition(condition)}
                            className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                              active ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            {condition}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {commercialTermsAvailable && (
                  <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-black text-gray-950">Quer destacar condições comerciais?</p>
                    <p className="mt-1 text-sm font-semibold text-gray-500">Adicione chamadas comerciais ao banner, se quiser.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ['yes', 'Sim'],
                        ['no', 'Não'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setCommercialTermsChoice(id)
                            if (id === 'no') setCommercialTerms(EMPTY_COMMERCIAL_TERMS)
                            setPromptTouched(false)
                            setHumanPrompt('')
                            setGenerationError('')
                          }}
                          className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                            commercialTermsChoice === id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {commercialTermsEnabled && (
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {COMMERCIAL_TERM_FIELDS.map(({ id, label }) => (
                          <label key={id} className="text-sm font-black text-gray-950">
                            {label} <span className="font-semibold text-gray-400">(opcional)</span>
                            <input
                              value={formatHeroPrice(commercialTerms[id])}
                              onChange={(event) => updateCommercialTerm(id, event.target.value)}
                              inputMode="numeric"
                              placeholder="R$ 0"
                              className="mt-2 min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                            />
                          </label>
                        ))}
                      </div>
                    )}

                    {commercialTermsEnabled && commercialTermCalls.length > 0 && (
                      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
                        {commercialTermCalls.map((call) => <p key={call}>{call}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {goal === 'rent' && (
              <div className="mt-5 space-y-5">
                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <p className="text-sm font-black text-gray-950">Aluguel</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ['show', 'Mostrar aluguel'],
                      ['hide', 'Não mostrar aluguel'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setRentMode(id)
                          if (id === 'hide') setRentPrice('')
                          setPromptTouched(false)
                          setHumanPrompt('')
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                          rentMode === id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {rentMode === 'show' && (
                    <input
                      value={rentPrice}
                      onChange={(event) => {
                        setRentPrice(event.target.value)
                        setPromptTouched(false)
                        setHumanPrompt('')
                      }}
                      placeholder="Valor do aluguel. Ex: R$ 3.500"
                      className="mt-3 min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                    />
                  )}
                </div>

                {[
                  {
                    title: 'Condomínio',
                    mode: condoMode,
                    setMode: setCondoMode,
                    value: condoFee,
                    setValue: setCondoFee,
                    placeholder: 'Valor do condomínio. Ex: R$ 780',
                    options: [
                      ['show', 'Mostrar condomínio'],
                      ['hide', 'Não mostrar condomínio'],
                      ['na', 'Não se aplica'],
                    ],
                  },
                  {
                    title: 'IPTU',
                    mode: iptuMode,
                    setMode: setIptuMode,
                    value: iptuValue,
                    setValue: setIptuValue,
                    placeholder: 'Valor do IPTU. Ex: R$ 120/mês',
                    options: [
                      ['show', 'Mostrar IPTU'],
                      ['hide', 'Não mostrar IPTU'],
                      ['na', 'Não se aplica'],
                    ],
                  },
                ].map((section) => (
                  <div key={section.title} className="rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-black text-gray-950">{section.title}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {section.options.map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            section.setMode(id)
                            if (id !== 'show') section.setValue('')
                            setPromptTouched(false)
                            setHumanPrompt('')
                          }}
                          className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                            section.mode === id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {section.mode === 'show' && (
                      <input
                        value={section.value}
                        onChange={(event) => {
                          section.setValue(event.target.value)
                          setPromptTouched(false)
                          setHumanPrompt('')
                        }}
                        placeholder={section.placeholder}
                        className="mt-3 min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                      />
                    )}
                  </div>
                ))}

                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <p className="text-sm font-black text-gray-950">Garantia</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RENT_GUARANTEE_OPTIONS.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setRentGuarantee(id)
                          setPromptTouched(false)
                          setHumanPrompt('')
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                          rentGuarantee === id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-600">
              <p><strong>Como os valores serão apresentados:</strong> {valueCondition.label}</p>
              {valueCondition.details && <p className="mt-1">{valueCondition.details}</p>}
              {valueCondition.mode === 'hidden' || valueCondition.mode === 'no_values' ? <p className="mt-1">Não mostrar valores na campanha.</p> : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <ProductButton type="button" variant="secondary" onClick={() => setPhase('chat')}>
                Voltar
              </ProductButton>
              <ProductButton type="button" onClick={goToDestinationStep} disabled={goal === 'sale' ? !saleValueReady : !rentValueReady}>
                Continuar
              </ProductButton>
            </div>
          </ProductCard>
        )}

        {phase === 'prompt' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <ProductCard className="p-5 sm:p-7">
              <div className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Revisão final</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Tudo certo para continuar</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">Confira o resumo antes de seguir para as imagens.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Objetivo definido', getGoalLabel(goal)],
                    ['Informações organizadas', `${chatFlow.filter((question) => answers[question.id]).length} respostas confirmadas`],
                    ['Formatos escolhidos', selectedDestinations.map((item) => item.label).join(', ')],
                    ['Opções criativas', formatCreationOptionCount(creativeIdeaCount)],
                  ].map(([title, detail]) => (
                    <div key={title} className="flex gap-3 rounded-2xl bg-emerald-50/70 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <p className="text-sm"><strong className="block text-slate-950">{title}</strong><span className="mt-1 block font-semibold text-slate-600">{detail}</span></p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm font-semibold leading-6 text-slate-600">A inteligência do Banner Imobiliário seguirá suas respostas internamente. Nenhuma instrução técnica precisa ser revisada por você.</p>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <ProductButton type="button" variant="secondary" onClick={() => setPhase('ideas')}>
                  Voltar
                </ProductButton>
                <ProductButton type="button" onClick={() => setPhase('images')} disabled={!effectivePrompt.trim()}>
                  Continuar para imagens
                </ProductButton>
              </div>
            </ProductCard>
            <ProductCard as="aside" variant="flat" className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Resumo da campanha</p>
              <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                <p><strong>Objetivo:</strong> {getGoalLabel(goal)}</p>
                {chatFlow.map((question, index) => answers[question.id] ? (
                  <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        <strong>{question.question}</strong><br />
                        {formatAnswer(answers[question.id])}
                      </p>
                      <button
                        type="button"
                        onClick={() => goToQuestion(index)}
                        className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ) : null)}
                {selectedDestinations.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        <strong>Formatos e opções</strong><br />
                        {selectedDestinations.map((item) => item.label).join(', ')}
                        <br />
                        {formatCreationOptionCount(creativeIdeaCount)} - Total: {formatPieceCount(totalPieceCount)} IA
                      </p>
                      <button
                        type="button"
                        onClick={() => setPhase('ideas')}
                        className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )}
                {!isAnyCaptureGoal && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        <strong>{goal === 'sale' && saleValueMode === 'price' ? 'Valor' : 'Valores e condições'}</strong><br />
                        {goal === 'sale' && saleValueMode === 'price' ? (
                          <>
                            {salePricePresentationMode === 'starting_at' ? 'A partir de' : 'Preço fixo'}<br />
                            {formattedSalePrice}
                          </>
                        ) : (
                          <>
                            {valueCondition.label}
                            {valueCondition.details ? `: ${valueCondition.details}` : ''}
                          </>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPhase('values')}
                        className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </ProductCard>
          </section>
        )}

        {phase === 'destination' && (
          <ProductCard variant="muted" className="mt-6 p-5 sm:p-8">
            <AssistantBubble>Quais formatos deseja gerar para esta campanha</AssistantBubble>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              Cada formato selecionado gera uma peça IA própria, otimizada para aquele canal.
            </p>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-primary-700">
              Limite: até {MAX_HERO_NEXT_PIECES} peças por geração.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DESTINATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleDestination(item.id)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    destinationIds.includes(item.id) ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-black">{item.label}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                      destinationIds.includes(item.id) ? 'bg-cyan-100 text-primary-900' : 'bg-gray-100 text-gray-600'
                    }`}>
                      1 geração
                    </span>
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${destinationIds.includes(item.id) ? 'text-gray-300' : 'text-gray-500'}`}>
                    {item.format_group === 'vertical' ? 'Formato vertical principal.' : item.format_group === 'landscape' ? 'Formato horizontal principal.' : 'Formato quadrado principal.'}
                  </p>
                </button>
              ))}
            </div>
            {selectedDestinations.length > 0 && (
              <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-600">
                <p><strong>Formatos selecionados:</strong> {selectedDestinations.map((item) => item.label).join(', ')}</p>
                <p className="mt-1"><strong>Próximo passo:</strong> escolher quantas opções de criação deseja receber.</p>
                <p className="mt-1"><strong>Total atual:</strong> {formatPieceCount(totalPieceCount)} IA</p>
              </div>
            )}
            {(pieceLimitNotice || pieceLimitExceeded) && (
              <p className="mt-4 rounded-2xl border border-blue-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                {HERO_NEXT_PIECE_LIMIT_MESSAGE}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <ProductButton type="button" variant="secondary" onClick={() => setPhase(goal === 'sale' || goal === 'rent' ? 'values' : 'chat')}>
                Voltar
              </ProductButton>
              <ProductButton type="button" onClick={() => setPhase('ideas')} disabled={!selectedDestination || pieceLimitExceeded}>
                Continuar
              </ProductButton>
            </div>
          </ProductCard>
        )}

        {phase === 'ideas' && (
          <ProductCard variant="muted" className="mt-6 p-5 sm:p-8">
            <AssistantBubble>Quantas opções de criação você quer receber?</AssistantBubble>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
              Você pode receber uma ou mais versões da mesma campanha para comparar antes de escolher.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {(guestMode ? CREATIVE_IDEAS.slice(0,1) : CREATIVE_IDEAS).map((idea) => (
                (() => {
                  const optionTotal = getTotalPieceCount(selectedDestinations.length, idea.number)
                  const optionBlocked = optionTotal > MAX_HERO_NEXT_PIECES
                  return (
                <button
                  key={idea.number}
                  type="button"
                  onClick={() => selectCreativeIdeaCount(idea.number)}
                  disabled={optionBlocked}
                  className={`rounded-3xl border p-5 text-left transition ${
                    creativeIdeaCount === idea.number
                      ? 'border-[#0E7490] bg-[#0E7490] text-white shadow-lg shadow-cyan-900/10'
                      : optionBlocked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#0E7490]'
                  }`}
                >
                  <p className="text-lg font-black">{formatCreationOptionCount(idea.number)}</p>
                  <p className={`mt-2 text-sm font-black ${creativeIdeaCount === idea.number ? 'text-cyan-50' : 'text-slate-900'}`}>{idea.publicTitle}</p>
                  <p className={`mt-2 text-sm font-semibold leading-relaxed ${creativeIdeaCount === idea.number ? 'text-cyan-50/90' : 'text-slate-500'}`}>
                    {idea.publicDescription}
                  </p>
                  <p className={`mt-3 text-xs font-black ${creativeIdeaCount === idea.number ? 'text-cyan-50/90' : optionBlocked ? 'text-slate-400' : 'text-primary-700'}`}>
                    Total: {formatPieceCount(optionTotal)}
                  </p>
                </button>
                  )
                })()
              ))}
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
              <p><strong>Formatos selecionados:</strong> {selectedDestinations.map((item) => item.label).join(', ')}</p>
              <p className="mt-1"><strong>Opções de criação:</strong> {formatCreationOptionCount(creativeIdeaCount)}</p>
              <p className="mt-1"><strong>Total previsto:</strong> {formatPieceCount(totalPieceCount)} IA</p>
              <p className="mt-1"><strong>Consumo previsto:</strong> {totalPieceCount} geração(ões)</p>
            </div>
            {(pieceLimitNotice || pieceLimitExceeded) && (
              <p className="mt-4 rounded-2xl border border-blue-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                {HERO_NEXT_PIECE_LIMIT_MESSAGE}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <ProductButton type="button" variant="secondary" onClick={() => setPhase('destination')}>
                Voltar
              </ProductButton>
              <ProductButton type="button" onClick={() => setPhase('prompt')} disabled={pieceLimitExceeded}>
                Continuar
              </ProductButton>
            </div>
          </ProductCard>
        )}

        {phase === 'images' && (
          <ProductCard className="mt-6 p-5 sm:p-8">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Etapa de imagens</p>
            <AssistantBubble>{isAnyCaptureGoal ? 'Deseja anexar logo ou foto institucional?' : 'Você possui imagens reais deste imóvel?'}</AssistantBubble>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setImageChoice('yes')}
                className={`rounded-3xl border p-6 text-left transition ${
                  imageChoice === 'yes' ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                }`}
              >
                <Upload className="h-7 w-7 text-primary-600" />
                <p className="mt-4 text-lg font-black">Sim, vou enviar agora</p>
                <p className={`mt-2 text-sm font-semibold leading-relaxed ${imageChoice === 'yes' ? 'text-gray-300' : 'text-gray-500'}`}>
                  {isAnyCaptureGoal
                    ? 'Sua marca será aplicada como referência visual. Logo e foto institucional são opcionais.'
                    : 'Uma imagem já é suficiente para este teste.'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageChoice('no')
                  setUploadedImages([])
                  setMissingImageMetadata([])
                }}
                className={`rounded-3xl border p-6 text-left transition ${
                  imageChoice === 'no' ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                }`}
              >
                <Image className="h-7 w-7 text-primary-600" />
                <p className="mt-4 text-lg font-black">{isAnyCaptureGoal ? 'Não, seguir sem arquivos' : 'Não, gerar campanha sem imagens'}</p>
                <p className={`mt-2 text-sm font-semibold leading-relaxed ${imageChoice === 'no' ? 'text-gray-300' : 'text-gray-500'}`}>
                  A campanha será criada a partir das informações que você confirmou.
                </p>
              </button>
            </div>

            {imageChoice === 'yes' && (
              <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl bg-gray-50 px-6 py-10 text-center transition hover:bg-gray-100">
                  <Upload className="h-8 w-8 text-gray-500" />
                  <span className="mt-3 text-sm font-black text-gray-950">{isAnyCaptureGoal ? 'Enviar logo ou foto institucional' : 'Enviar imagens do imóvel'}</span>
                  <span className="mt-1 text-xs font-semibold text-gray-500">
                    {isAnyCaptureGoal
                      ? 'JPG, PNG ou WebP. Até 2 arquivos: logo e foto institucional.'
                      : 'JPG, PNG ou WebP. Até 4 imagens. A primeira será a principal.'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => { handleFiles(event.target.files); event.target.value = '' }}
                  />
                </label>
                {missingImageMetadata.length > 0 && uploadedImages.length === 0 && (
                  <p role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Rascunho restaurado. Selecione novamente {missingImageMetadata.length} {missingImageMetadata.length === 1 ? 'imagem' : 'imagens'}; os arquivos físicos não são armazenados.</p>
                )}
                {uploadedImages.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {uploadedImages.map((item, index) => (
                      <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <div className="relative">
                          <img src={item.data} alt={item.name} className="aspect-square w-full object-cover" />
                          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                            index === 0 ? 'bg-cyan-100 text-primary-900' : 'bg-white/90 text-gray-700'
                          }`}>
                            {isAnyCaptureGoal ? (index === 0 ? 'Logo' : 'Institucional') : (index === 0 ? 'Principal' : 'Apoio')}
                          </span>
                        </div>
                        <p className="truncate px-3 py-2 text-xs font-bold text-gray-600">{item.name}</p>
                        <button type="button" className="px-3 pb-3 text-xs font-bold text-red-700" onClick={() => { setUploadedImages(uploadedImages.filter((image) => image.id !== item.id)); setGenerationError('') }}>Remover imagem {index + 1}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {generationError && (
              <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                {generationError}
              </p>
            )}
            {pieceLimitExceeded && (
              <p className="mt-4 rounded-2xl border border-blue-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                {HERO_NEXT_PIECE_LIMIT_MESSAGE}
              </p>
            )}

            {!guestMode && <SmartTokenEstimate
              cost={(totalPieceCount || 0) * SMART_TOKEN_COSTS.realEstateBannerItem}
              quantityLabel={`${formatPieceCount(totalPieceCount || 0)} selecionada${totalPieceCount === 1 ? '' : 's'}`}
              className="mt-6"
            />}
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <ProductButton type="button" variant="secondary" onClick={() => setPhase('prompt')}>
                Voltar
              </ProductButton>
              <ProductButton type="button" onClick={handleGenerate} disabled={!canGenerate || (guestMode && guestConsumed)} loading={generationLoading}>
                <Wand2 className="h-4 w-4" />
                {guestMode ? (generationLoading ? 'Criando anúncio...' : 'Criar anúncio') : generationLoading
                   ? `Gerando ${formatPieceCount(totalPieceCount)}...`
                  : `Gerar ${formatPieceCount(totalPieceCount || 1)} da campanha`}
              </ProductButton>
            </div>
          </ProductCard>
        )}

        {phase === 'processing' && (
          <ProductCard variant="muted" className="mt-6 p-6 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-800 text-white">
              <Wand2 className="h-7 w-7 animate-pulse" />
            </div>
            <h1 className="mt-5 text-3xl font-black text-gray-950">Criando sua campanha...</h1>
            <p className="mt-3 text-sm font-semibold text-gray-500">
              {processingMessage}
            </p>
            <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-400" />
            </div>
            <div className="mx-auto mt-6 grid max-w-3xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
              {generationJobs.map((job) => (
                <div key={job.jobId || job.formatId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-black text-gray-950">
                    {job.formatLabel}
                  </p>
                  {job.creativeDirection && (
                    <p className="mt-1 text-xs font-semibold text-slate-500">{getCreationOptionLabel(job.ideaNumber)}</p>
                  )}
                  <p className={`mt-2 text-xs font-black uppercase tracking-wide ${
                    job.status === 'completed'
                       ? 'text-emerald-700'
                      : job.status === 'failed'
                         ? 'text-red-700'
                        : 'text-primary-700'
                  }`}>
                    {job.status === 'completed'
                       ? 'Concluída'
                      : job.status === 'failed'
                         ? 'Falhou'
                        : job.status === 'starting'
                           ? 'Iniciando'
                          : 'Processando'}
                  </p>
                  {job.error && (
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-red-600">{job.error}</p>
                  )}
                </div>
              ))}
            </div>
            {generationError && (
              <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                {generationError}
              </p>
            )}
          </ProductCard>
        )}

        {phase === 'result' && generationResult && campaignPackageData && (
          <section className="mt-6 space-y-5">
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-black text-slate-950">Arquivos da sua campanha</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Pré-visualize ou baixe cada arte. Se preferir, reúna tudo em um único clique.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {campaignPackageData.files.length > 0 && (
                  <button type="button" disabled={downloadAllLoading} onClick={downloadAllImages} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" />{downloadAllLoading ? 'Baixando artes...' : 'Baixar todas as artes'}</button>
                )}
                {campaignCopy.length > 0 && (
                  <button type="button" onClick={downloadTexts} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Baixar todos os textos</button>
                )}
              </div>
            </div>
            {downloadError && <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{downloadError}</p>}
            <CampaignPackage
              onRequireAccount={guestMode ? requireGuestAccount : undefined}
              data={campaignPackageData}
              onCreateNew={resetCampaign}
              createNewLabel="Criar nova campanha"
              onOpenImage={openExpandedPreview}
              bannerPublish={{
                enabled: true,
                captionEditable: true,
                loadConnection: () => getMetaConnectionStatus(supabase),
                resumeIntent: user?.id ? readPendingBannerPublication(window.sessionStorage, user.id) : null,
                onPublish: (intent, destinations) => publishBannerPublication(supabase, intent, destinations),
                onRecover: (intent, destinations) => recoverBannerPublication(supabase, intent, destinations),
                onResumed: () => clearPendingBannerPublication(window.sessionStorage, user?.id),
                onConnect: async (intent) => {
                  if (!preservePendingBannerPublication(window.sessionStorage, user?.id, intent)) throw new Error('banner_publication_pending_not_saved')
                  await redirectToMetaOAuth(supabase, url => window.location.assign(url))
                },
              }}
            />
            {expandedPreview && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-2 backdrop-blur-md sm:p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeExpandedPreview()
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="hero-result-preview-title"
                  className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-7xl items-center justify-center sm:max-h-[calc(100dvh-2rem)]"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeExpandedPreview()
                  }}
                >
                  <h2 id="hero-result-preview-title" className="sr-only">Preview ampliado do Banner Imobiliário</h2>
                  <button
                    ref={expandedPreviewCloseRef}
                    type="button"
                    onClick={closeExpandedPreview}
                    className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-white transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 sm:right-3 sm:top-3"
                    aria-label="Fechar preview ampliado"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <img
                    src={expandedPreview.src}
                    alt={expandedPreview.alt || 'Banner Imobiliário ampliado'}
                    className="max-h-[calc(100dvh-1rem)] max-w-full object-contain sm:max-h-[calc(100dvh-2rem)]"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {false && phase === 'result' && generationResult && (
          <section className="mt-6 space-y-6">
            <div className="rounded-[2rem] bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-6 text-white shadow-xl shadow-primary-900/10 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Campanha IA</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Campanha criada com sucesso</h1>
                  <p className="mt-3 text-sm font-semibold text-gray-300">
                    Suas peças foram geradas nos formatos selecionados.
                  </p>
                </div>
                <ProductButton type="button" onClick={() => {
                  setPhase('intro')
                  setGoal('')
                  setAnswers({})
                  setCityUf('')
                  setCitySelection('')
                  setCities([])
                  setCitiesLoading(false)
                  setSaleValueMode('')
                  setSalePrice('')
                  setSalePricePresentationMode('')
                  setSalePriceDigits('')
                  setSaleConditions([])
                  setCommercialTermsChoice('')
                  setCommercialTerms(EMPTY_COMMERCIAL_TERMS)
                  setRentMode('')
                  setRentPrice('')
                  setCondoMode('')
                  setCondoFee('')
                  setIptuMode('')
                  setIptuValue('')
                  setRentGuarantee('')
                  setDestinationIds([])
                  setCreativeIdeaCount(1)
                  setPromptTouched(false)
                  setHumanPrompt('')
                  setImageChoice('')
                  setUploadedImages([])
                  setGoalNotice('')
                  setPieceLimitNotice('')
                  setGenerationResult(null)
                  setGenerationJobs([])
                }}>
                  Gerar outra campanha
                </ProductButton>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-950">Peças geradas</p>
                    <p className="text-xs font-semibold text-gray-500">
                      {(generationResult.jobs || []).filter((job) => job.status === 'completed').length} concluída(s) de {(generationResult.jobs || []).length}
                    </p>
                  </div>
                  {(generationResult.jobs || []).some((job) => job.status === 'completed' && job.imageUrl) && (
                    <button
                      type="button"
                      onClick={downloadAllImages}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-800 px-4 py-3 text-sm font-black text-white hover:bg-primary-700"
                    >
                      <Download className="h-4 w-4" />
                      Baixar todas
                    </button>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {(generationResult.jobs || []).map((job) => (
                    <div key={job.jobId || job.formatId} className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-gray-950">{job.formatLabel}</p>
                          {job.ideaNumber && (
                            <p className="text-xs font-semibold text-slate-500">{getCreationOptionLabel(job.ideaNumber)}</p>
                          )}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                          job.status === 'completed'
                             ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'failed'
                               ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}>
                          {job.status === 'completed' ? 'Concluída' : job.status === 'failed' ? 'Falhou' : 'Processando'}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-[1.5rem] bg-gray-100">
                        {job.imageUrl ? (
                          <img src={job.imageUrl} alt={`Campanha IA ${job.formatLabel}`} className="max-h-[620px] w-full object-contain" />
                       ) : (
                          <div className="flex min-h-72 items-center justify-center p-6 text-center">
                            <p className="text-sm font-bold text-gray-500">
                              {job.status === 'failed' ? job.error || 'Não foi possível gerar este formato.' : 'Imagem em preparação.'}
                            </p>
                          </div>
                        )}
                      </div>
                      {job.imageUrl && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={job.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-800 hover:bg-gray-50"
                          >
                            Visualizar
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadImageFile(
                              job.imageUrl,
                              `smartcorretorai-hero-ia-${job.ideaNumber || 1}-${formatFileSlug(job.formatLabel)}.png`,
                            )}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-800 px-4 py-3 text-sm font-black text-white hover:bg-primary-700"
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-gray-950">📦 CAMPANHA PRONTA PARA PUBLICAR</p>
                      <p className="mt-1 text-sm font-semibold text-gray-500">
                        Use os textos prontos para publicar, enviar ou adaptar nos seus canais.
                      </p>
                    </div>
                    {campaignCopy.length > 0 && (
                      <button
                        type="button"
                        onClick={downloadTexts}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-800 px-4 py-3 text-sm font-black text-white hover:bg-primary-700"
                      >
                        <Download className="h-4 w-4" />
                        Baixar todos os textos
                      </button>
                    )}
                  </div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {campaignCopy.map((item) => (
                      <TextBlock
                        key={item.label}
                        title={item.label}
                        filename={`${formatFileSlug(item.label)}.txt`}
                        content={item.text}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-5">
                <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-primary-700">Resumo</p>
                  <div className="mt-4 space-y-3 text-sm font-semibold text-gray-600">
                    <p><strong>Objetivo:</strong> {getGoalLabel(goal)}</p>
                    <p><strong>Tipo:</strong> {isPropertyCaptureGoal ? formatAnswer(answers.propertyKinds) : isBrokerCaptureGoal ? formatAnswer(answers.professionalProfile) : answers.propertyType}</p>
                    <p><strong>Local:</strong> {[answers.neighborhood || answers.neighborhoods, answers.city].filter(Boolean).join(', ')}</p>
                    {isPropertyCaptureGoal && <p><strong>Serviços:</strong> {formatAnswer(answers.services) || 'Não informado'}</p>}
                    <p><strong>Diferenciais:</strong> {formatAnswer(isAnyCaptureGoal ? answers.businessDifferentials : answers.differentials) || 'Não informado'}</p>
                    {!isAnyCaptureGoal && <p><strong>Valores/condições:</strong> {valueCondition.label}{valueCondition.details ? `: ${valueCondition.details}` : ''}</p>}
                    <p><strong>CTA:</strong> {answers.cta}</p>
                    {answers.contactPhoneChoice === 'Sim, quero divulgar' && answers.contactPhone && (
                      <p><strong>Telefone:</strong> {answers.contactPhone}</p>
                    )}
                    <p><strong>Formatos:</strong> {selectedDestinations.map((item) => item.label).join(', ') || 'Não informado'}</p>
                    <p><strong>Opções de criação:</strong> {formatCreationOptionCount(creativeIdeaCount)}</p>
                    <p><strong>Total:</strong> {formatPieceCount(generationResult.jobs.length || totalPieceCount || 0)} IA</p>
                    <p><strong>{isAnyCaptureGoal ? 'Arquivos de marca' : 'Imagens reais'}:</strong> {uploadedImages.length > 0 ? `${uploadedImages.length} anexada(s)` : 'Não utilizadas'}</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}
        </div>
      </main>
      {guestMode && guestSignupGate && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="guest-signup-title" className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900">
          <h2 id="guest-signup-title" className="text-xl font-bold">{generationResult ? 'Seu anúncio está pronto.' : 'Continue criando com sua conta'}</h2>
          <p className="mt-3">{generationResult ? 'Crie sua conta para baixar ou publicar.' : 'Seu teste grátis já foi utilizado. Crie sua conta para continuar criando.'}</p>
          <p className="mt-3 text-sm">Ao criar sua conta, você recebe 200 Smart Tokens para continuar criando no SmartCorretorAI.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/cadastro" onClick={()=>localStorage.setItem(GUEST_CLAIM_PENDING,'1')} className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">Criar minha conta</Link>
            <Link to="/login" onClick={()=>localStorage.setItem(GUEST_CLAIM_PENDING,'1')} className="rounded-xl border px-4 py-3 font-bold">Entrar</Link>
            <button type="button" onClick={()=>setGuestSignupGate(false)} className="px-3 py-2">Voltar ao anúncio</button>
          </div>
        </section>
      </div>}
    </div>
  )
}
