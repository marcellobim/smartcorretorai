import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  Film,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Pencil,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { Button } from '../components/ui/Button'
import { buildPublicationPackage } from '../../../core/copy-engine'

const BUCKET = 'studio-videos'
const MAX_DIFFERENTIALS = 1
const MAX_CAPTURE_DIFFERENTIALS = 3
const MAX_BROKER_BENEFITS = 3
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const PREMIUM_PLAN_IDS = new Set(['start', 'starter', 'pro', 'elite'])
const IS_DEV = import.meta.env.DEV
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TYPEWRITER_INITIAL_DELAY_MS = 350
const TYPEWRITER_CHAR_DELAY_MS = 30
const TYPEWRITER_FINAL_CURSOR_MS = 400
const STUDIO_HERO_MULTI_IMAGE_ENABLED = String(import.meta.env.VITE_STUDIO_HERO_MULTI_IMAGE_ENABLED || '').toLowerCase() === 'true'

function logStudioHero(level, event, payload) {
  if (!IS_DEV) return
  console[level](event, payload)
}

function sanitizeStudioHeroDiagnostic(value) {
  if (value === null || value === undefined) return value

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeStudioHeroDiagnostic(item))
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => {
        if (/authorization|apikey|access.?token|refresh.?token/i.test(key)) {
          return [key, '[redacted]']
        }
        if (/signed.*url|videoUrl|signedUrl/i.test(key) && typeof nested === 'string') {
          return [key, nested ? `[url:${nested.length}]` : '']
        }
        return [key, sanitizeStudioHeroDiagnostic(nested)]
      })
    )
  }

  if (typeof value === 'string' && value.length > 600) {
    return `${value.slice(0, 600)}...[truncated:${value.length}]`
  }

  return value
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim())
}

function extractJobIdFromResponse(data, fallbackJobId = '') {
  const jobId = data && typeof data === 'object'
    ? data.jobId || data.job_id
    : ''
  if (isUuid(jobId)) return jobId
  if (isUuid(fallbackJobId)) return fallbackJobId
  return ''
}

const IMAGE_SLOTS = [
  {
    key: 'image1',
    label: 'Imagem do imovel',
    helper: 'Envie a melhor foto do imovel.',
    fileName: 'input-1',
  },
]

const STUDIO_CREATION_MODES = [
  {
    id: 'cinematic',
    title: 'Comercial Cinematografico',
    description: 'Crie um comercial curto e impactante a partir das melhores imagens do imovel.',
    status: 'Ativo agora',
    Icon: Film,
    active: true,
    accent: 'cyan',
    cta: 'Criar comercial',
  },
  {
    id: 'free_ai',
    title: 'Comercial IA Livre',
    description: 'Crie um comercial do zero apenas conversando com a IA, sem enviar imagens.',
    status: 'Ativo agora',
    Icon: MessageSquareText,
    active: true,
    accent: 'violet',
    cta: 'Criar comercial livre',
  },
  {
    id: 'smart_carousel',
    title: 'Animacao Premium',
    description: 'Transforme suas fotos em videos animados profissionais, com textos comerciais ou em uma versao clean.',
    status: 'Ativo agora',
    Icon: ImagePlus,
    active: true,
    accent: 'green',
    cta: 'Animar imagens',
  },
  {
    id: 'improve_video',
    title: 'Transforme seu Vídeo',
    description: 'Envie um video gravado no celular e prepare uma versao mais profissional para divulgar.',
    status: 'Acesso liberado',
    Icon: PlayCircle,
    active: true,
    accent: 'amber',
    cta: 'Transformar video',
  },
]

const STUDIO_HERO_MULTI_IMAGE_MODE = {
  id: 'multi_image_tour',
  title: 'Animar uma imagem',
  description: 'Envie uma imagem do imóvel e receba um vídeo curto com movimento e efeitos visuais.',
  status: 'Teste controlado',
  Icon: Film,
  active: true,
  accent: 'blue',
  cta: 'Animar imagem',
}

const getStudioCreationModes = () => (
  STUDIO_HERO_MULTI_IMAGE_ENABLED
    ? [
      STUDIO_CREATION_MODES[0],
      STUDIO_HERO_MULTI_IMAGE_MODE,
      ...STUDIO_CREATION_MODES.slice(1).filter((mode) => mode.id !== 'smart_carousel'),
    ]
    : STUDIO_CREATION_MODES.filter((mode) => mode.id !== 'smart_carousel')
)

const STUDIO_MODE_EXAMPLES = [
  {
    id: 'cinematic',
    title: '🎬 Comercial Cinematográfico',
    label: 'Comercial com imagem',
    accent: 'cyan',
    send: [
      '📷 A principal imagem do seu imóvel',
    ],
    receive: [
      '🎬 Comercial cinematográfico',
      '🎙️ Narração profissional',
      '🎵 Trilha sonora sincronizada',
      '✨ Efeitos cinematográficos',
      '💡 Iluminação cinematográfica',
      '🎥 Movimentos de câmera',
      '📢 Chamada final para divulgação',
      '📦 Campanha pronta para publicar',
    ],
  },
  {
    id: 'free_ai',
    title: '✨ Comercial IA Livre',
    label: 'Criação por IA',
    accent: 'violet',
    send: [
      'Mesmo sem imagens, basta conversar com a IA.',
    ],
    receive: [
      '🎬 Comercial completo',
      '📝 Roteiro criado pela IA',
      '🎙️ Narração profissional',
      '🎵 Trilha sonora',
      '✨ Efeitos cinematográficos',
      '🎥 Movimentos de câmera',
      '📢 Chamada final para divulgação',
      '📦 Campanha pronta para publicar',
    ],
  },
  {
    id: 'smart_carousel',
    title: '🖼️ Carrossel Inteligente',
    label: 'Apresentação dinâmica',
    accent: 'green',
    send: [
      '🖼️ As imagens do imóvel',
    ],
    receive: [
      '🎬 Apresentação dinâmica',
      '🔄 Movimentos inteligentes',
      '✨ Transições profissionais',
      '🎙️ Narração',
      '🎵 Música',
      '📢 Chamada final para divulgação',
      '📦 Campanha pronta para publicar',
    ],
  },
  {
    id: 'improve_video',
    title: '🎥 Finalizar meu Vídeo',
    label: 'Acabamento final',
    accent: 'amber',
    send: [
      '🎥 Seu vídeo',
    ],
    receive: [
      '✨ Acabamento profissional',
      '🎨 Identidade visual',
      '🎵 Música',
      '📢 Chamada final para divulgação',
      '📦 Campanha pronta para publicar',
    ],
  },
]

const STUDIO_HERO_MULTI_IMAGE_EXAMPLE = {
  id: 'multi_image_tour',
  title: '✨ Animar uma imagem',
  label: 'Imagem animada',
  accent: 'blue',
  send: [
    '📷 Uma imagem do imóvel',
  ],
  receive: [
    '✨ Sua imagem ganha vida',
    '🎥 Vídeo de 8 segundos',
    '🌅 Movimentos e efeitos visuais criados por nossa IA',
    '📲 Pronto para publicar nas redes sociais',
  ],
}

const getStudioModeExamples = () => (
  STUDIO_HERO_MULTI_IMAGE_ENABLED
    ? [
      STUDIO_MODE_EXAMPLES[0],
      STUDIO_HERO_MULTI_IMAGE_EXAMPLE,
      ...STUDIO_MODE_EXAMPLES.slice(1).filter((example) => example.id !== 'smart_carousel'),
    ]
    : STUDIO_MODE_EXAMPLES.filter((example) => example.id !== 'smart_carousel')
)

const STUDIO_POSSIBILITY_EXAMPLES = [
  {
    id: 'sale',
    title: '🏠 Vender um imóvel',
    description: 'Ideal para apresentar imóveis, destacar diferenciais e atrair compradores.',
  },
  {
    id: 'rent',
    title: '🔑 Alugar um imóvel',
    description: 'Ideal para valorizar imóveis disponíveis para locação e aumentar o interesse de futuros inquilinos.',
  },
  {
    id: 'capture_property',
    title: '📈 Captar imóveis',
    description: 'Ideal para conquistar proprietários e ampliar sua carteira com apresentações profissionais.',
  },
  {
    id: 'capture_brokers',
    title: '🤝 Captar corretores',
    description: 'Ideal para divulgar oportunidades, fortalecer sua equipe e atrair novos profissionais.',
  },
]

const STUDIO_GUIDE_ITEMS_BY_MODE = {
  cinematic: [
    'Criar direção criativa para o comercial',
    'Usar a imagem principal do imóvel',
    'Gerar uma peça curta para redes sociais',
    'Entregar vídeo, chamada final e textos prontos para divulgação',
  ],
  free_ai: [
    'Criar direção criativa a partir da conversa',
    'Transformar sua ideia em um comercial completo',
    'Gerar uma peça curta para redes sociais',
    'Entregar vídeo, chamada final e textos prontos para divulgação',
  ],
  smart_carousel: [
    'Organizar as imagens em sequência',
    'Criar movimentos e transições',
    'Montar uma apresentação dinâmica',
    'Entregar vídeo, chamada final e textos prontos para divulgação',
  ],
  improve_video: [
    'Analisar o vídeo enviado',
    'Aplicar acabamento profissional',
    'Adicionar identidade visual e chamada final',
    'Entregar o vídeo pronto para publicar',
  ],
}

const STUDIO_MODE_ACCENTS = {
  cyan: {
    card: 'border-cyan-200 bg-white shadow-cyan-100/70 hover:border-cyan-400 hover:shadow-cyan-200/70',
    icon: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100',
    status: 'bg-emerald-50 text-emerald-700',
    cta: 'text-cyan-700',
    glow: 'from-cyan-400/20 via-transparent to-transparent',
  },
  violet: {
    card: 'border-violet-100 bg-white/85 shadow-violet-100/60 hover:border-violet-300 hover:shadow-violet-200/60',
    icon: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
    status: 'bg-violet-50 text-violet-700',
    cta: 'text-violet-700',
    glow: 'from-violet-400/20 via-transparent to-transparent',
  },
  green: {
    card: 'border-emerald-100 bg-white/85 shadow-emerald-100/60 hover:border-emerald-300 hover:shadow-emerald-200/60',
    icon: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    status: 'bg-emerald-50 text-emerald-700',
    cta: 'text-emerald-700',
    glow: 'from-emerald-400/20 via-transparent to-transparent',
  },
  blue: {
    card: 'border-sky-100 bg-white/85 shadow-sky-100/60 hover:border-sky-300 hover:shadow-sky-200/60',
    icon: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
    status: 'bg-sky-50 text-sky-700',
    cta: 'text-sky-700',
    glow: 'from-sky-400/20 via-transparent to-transparent',
  },
  amber: {
    card: 'border-amber-100 bg-white/85 shadow-amber-100/60 hover:border-amber-300 hover:shadow-amber-200/60',
    icon: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    status: 'bg-amber-50 text-amber-700',
    cta: 'text-amber-700',
    glow: 'from-amber-400/20 via-transparent to-transparent',
  },
}

const ASSISTANT_HINTS = {
  1: 'Perfeito. Vamos comecar pelo objetivo.',
  2: 'Otimo. Agora me diga qual imovel vamos apresentar.',
  3: 'Excelente. Isso define o tom do comercial.',
}

const OBJECTIVE_OPTIONS = [
  {
    id: 'sale',
    label: 'Comercial para vender um imovel',
    summaryLabel: 'Venda',
    oferta: 'A VENDA',
    description: 'Criar um comercial para atrair compradores.',
  },
  {
    id: 'rent',
    label: 'Comercial para alugar um imovel',
    summaryLabel: 'Locacao',
    oferta: 'PARA LOCACAO',
    description: 'Criar um comercial para encontrar locatarios.',
  },
  {
    id: 'property_capture',
    label: 'Comercial para captar imoveis',
    summaryLabel: 'Captacao de imoveis',
    oferta: 'CAPTACAO DE IMOVEIS',
    description: 'Atrair proprietarios que querem vender ou alugar.',
  },
  {
    id: 'broker_capture',
    label: 'Comercial para captar corretores',
    summaryLabel: 'Captacao de corretores',
    oferta: 'CAPTACAO DE CORRETORES',
    description: 'Atrair corretores e profissionais para sua equipe.',
  },
]

const RESIDENTIAL_PROPERTY_TYPES = ['APARTAMENTO', 'CASA']
const COMMERCIAL_PROPERTY_TYPES = ['SALA COMERCIAL', 'LOJA', 'LAJE CORPORATIVA', 'GALPAO']
const SALE_PROPERTY_TYPES = [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES]
const RENT_PROPERTY_TYPES = [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES]

const SALE_STAGES = ['PRE-LANCAMENTO', 'LANCAMENTO', 'PRONTO']

const RESIDENTIAL_PROFILES = ['MCMV', 'PRONTOS', 'ALTO PADRAO', 'LANCAMENTO']
const HOUSE_LOCATION_OPTIONS = ['CONDOMINIO FECHADO', 'BAIRRO ABERTO']

const UF_OPTIONS = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES', 'MT', 'MS']
const OTHER_CITY_OPTION = 'OUTRA_CIDADE'

const CITY_OPTIONS_BY_UF = {
  SP: ['São Paulo', 'Campinas', 'Santos', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Barueri', 'Guarulhos', 'Ribeirão Preto', 'Sorocaba'],
  RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis', 'Nova Iguaçu', 'Duque de Caxias'],
  MG: ['Belo Horizonte', 'Nova Lima', 'Contagem', 'Uberlândia', 'Juiz de Fora'],
  PR: ['Curitiba', 'Londrina', 'Maringa'],
  SC: ['Florianópolis', 'Balneário Camboriú', 'Joinville', 'Itajaí'],
  RS: ['Porto Alegre', 'Gramado', 'Caxias do Sul'],
  DF: ['Brasília'],
  GO: ['Goiânia'],
  BA: ['Salvador'],
  PE: ['Recife'],
  CE: ['Fortaleza'],
  ES: ['Vitória', 'Vila Velha'],
  MT: ['Cuiabá'],
  MS: ['Campo Grande'],
}

const BEDROOM_OPTIONS = ['1 DORMITORIO', '2 DORMITORIOS', '3 DORMITORIOS', '4 DORMITORIOS']
const SUITE_OPTIONS = ['SEM SUITE', '1 SUITE', '2 SUITES', '3 SUITES', '4 SUITES']
const PARKING_OPTIONS = ['SEM VAGA', '1 VAGA', '2 VAGAS', '3 VAGAS', '4 VAGAS']
const FREE_AI_BEDROOM_OPTIONS = ['STUDIO', '1', '2', '3', '4', '5+']
const FREE_AI_SUITE_OPTIONS = ['NENHUMA', '1', '2', '3', '4+']
const FREE_AI_PARKING_OPTIONS = ['NENHUMA', '1', '2', '3', '4+']
const AREA_OPTIONS = ['ATE 50 M2', '50 A 100 M2', '100 A 200 M2', 'ACIMA DE 200 M2']
const COMMERCIAL_ROOM_OPTIONS = ['1 SALA/CONJUNTO', '2 SALAS/CONJUNTOS', '3 SALAS/CONJUNTOS', 'ANDAR INTEIRO']
const BATHROOM_OPTIONS = ['1 BANHEIRO', '2 BANHEIROS', '3 BANHEIROS', '4 BANHEIROS OU MAIS']

const SALE_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'ESPACO INTERNO',
  'VARANDA / AREA EXTERNA',
  'ACABAMENTO',
  'LAZER',
  'VISTA',
  'OPORTUNIDADE',
]

const HOUSE_DIFFERENTIAL_OPTIONS = [
  'CONDOMINIO',
  'AREA EXTERNA',
  'ESPACO INTERNO',
  'SEGURANCA',
  'ACABAMENTO',
  'LOCALIZACAO',
  'OPORTUNIDADE',
]

const SALE_COMMERCIAL_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'INFRAESTRUTURA',
  'NEGOCIOS',
  'VISIBILIDADE',
]

const RENT_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'ESPACO INTERNO',
  'VARANDA / AREA EXTERNA',
  'ACABAMENTO',
  'LAZER',
  'VISTA',
  'OPORTUNIDADE',
]

const RENT_COMMERCIAL_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'INFRAESTRUTURA',
  'NEGOCIOS',
  'VISIBILIDADE',
]

const PROPERTY_CAPTURE_TYPES = ['APARTAMENTO', 'CASA', 'COMERCIAL', 'TODOS']
const BROKER_CAPTURE_PROFILES = ['CORRETORES', 'CAPTADORES DE IMOVEIS', 'PERITOS AVALIADORES', 'GERENTES COMERCIAIS', 'DIRETORES COMERCIAIS']
const FREE_AI_VISUAL_STYLE_OPTIONS = ['MODERNO', 'ELEGANTE', 'LUXUOSO', 'MINIMALISTA']
const FREE_AI_ATMOSPHERE_OPTIONS = ['DIA', 'GOLDEN HOUR', 'ENTARDECER', 'NOITE']
const FREE_AI_PACE_OPTIONS = ['CALMO', 'EQUILIBRADO', 'DINAMICO', 'IMPACTANTE']
const FREE_AI_FREEDOM_OPTIONS = ['MAIS REALISTA', 'EQUILIBRADO', 'MAIS CRIATIVO']
const FURNISHING_OPTIONS = [
  'SIM, JÁ ESTÁ MOBILIADA',
  'NÃO, ESTÁ VAZIA OU SEM DECORAÇÃO',
  'A IMAGEM TEM ÁREAS MOBILIADAS E VAZIAS',
]
const BROKER_CAMPAIGN_IMAGE_OPTIONS = [
  '🏢 Enviar o logotipo da empresa',
  '📸 Enviar uma imagem da empresa',
  '🖼️ Enviar outra imagem de sua preferência',
]
const DECORATION_POLICY_OPTIONS = [
  'NÃO, PRESERVAR EXATAMENTE COMO ESTÁ',
  'SIM, PODE SUGERIR DECORAÇÃO LEVE',
  'SIM, PODE MELHORAR LIVREMENTE A AMBIENTAÇÃO',
]
const BROKER_IMAGE_ADJUSTMENT_OPTIONS = [
  'Não, preservar a imagem como está',
  'Sim, permitir ajustes visuais leves',
  'Sim, permitir melhoria visual livre',
]

const PROPERTY_CAPTURE_DIFFERENTIAL_OPTIONS = [
  'AVALIACAO DE MERCADO',
  'DIVULGACAO PROFISSIONAL',
  'CARTEIRA DE CLIENTES',
  'ATENDIMENTO CONSULTIVO',
  'VENDA COM ESTRATEGIA',
]

const BROKER_CAPTURE_DIFFERENTIAL_OPTIONS = [
  'LEADS QUALIFICADOS',
  'TREINAMENTO',
  'AMBIENTE COLABORATIVO',
  'COMISSOES ATRATIVAS',
  'CRESCIMENTO PROFISSIONAL',
  'MARCA FORTE',
]

const BROKER_BENEFIT_OPTIONS = [
  'LEADS FORNECIDOS',
  'MARKETING DIGITAL',
  'TREINAMENTO',
  'PLANO DE CARREIRA',
  'ESTRUTURA MODERNA',
  'TECNOLOGIA',
  'AMBIENTE COLABORATIVO',
  'FLEXIBILIDADE',
  'OUTRO',
]

const SALE_CTA_OPTIONS = [
  'SAIBA MAIS',
  'AGENDE SUA VISITA',
  'ENTRE EM CONTATO',
  'SOLICITE MAIS INFORMACOES',
  'INFORMACOES NA BIO',
]

const RENT_CTA_OPTIONS = [
  'SAIBA MAIS',
  'AGENDE SUA VISITA',
  'ENTRE EM CONTATO',
  'SOLICITE MAIS INFORMACOES',
  'INFORMACOES NA BIO',
]

const CAPTURE_CTA_OPTIONS = [
  'ENTRE EM CONTATO',
  'FALE COMIGO',
  'SAIBA MAIS',
  'QUERO CONVERSAR',
  'CHAME NO WHATSAPP',
]

const MATRIX_ALLOWED_OPTIONS = {
  SELL_MCMV_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    ctas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  SELL_PRONTOS_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    ctas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  SELL_ALTO_PADRAO_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    ctas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  SELL_LANCAMENTO_V1: {
    highlights: ['LANCAMENTO', 'EXCLUSIVO', 'OPORTUNIDADE'],
    ctas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  RENT_MCMV_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'DISPONIVEL'],
    ctas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  RENT_PRONTOS_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'DISPONIVEL'],
    ctas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  RENT_ALTO_PADRAO_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'DISPONIVEL'],
    ctas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  CAPTURE_PROPERTY_V1: {
    highlights: ['EXCLUSIVO', 'QUER VENDER', 'QUER ALUGAR'],
    ctas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  CAPTURE_AGENT_V1: {
    highlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'CONTRATAMOS'],
    ctas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
}

const GENERATION_MESSAGES = [
  { Icon: Film, text: 'Estamos preparando seu comercial cinematografico.' },
  { Icon: ImagePlus, text: 'A IA esta analisando sua imagem.' },
  { Icon: PlayCircle, text: 'Criando movimento, luz e atmosfera.' },
  { Icon: MessageSquareText, text: 'Montando uma apresentacao com aparencia profissional.' },
  { Icon: ShieldCheck, text: 'Isso pode levar cerca de 1 minuto.' },
  { Icon: CheckCircle2, text: 'Assim que ficar pronto, o video aparece aqui.' },
]

const DELIVERY_PACKAGE_ITEMS = ['Instagram', 'WhatsApp', 'Facebook', 'Portal', 'LinkedIn quando aplicavel', 'Hashtags', 'Chamada final']

const ANIMATION_TEMPLATE_VARIANTS = {
  with_texts: {
    id: 'with_texts',
    label: 'Com textos',
    title: 'Com Informacoes',
    description: 'Inclui finalidade, status, localizacao, CTA e telefone quando informado.',
  },
  clean: {
    id: 'clean',
    label: 'Sem textos',
    title: 'Clean / Sem Textos',
    description: 'Valoriza apenas as imagens, com movimentos profissionais e sem textos na tela.',
  },
}

const ANIMATION_VARIANT_OPTIONS = Object.values(ANIMATION_TEMPLATE_VARIANTS)
const ANIMATION_PURPOSE_OPTIONS = ['A Venda', 'Locacao']
const ANIMATION_SALE_STATUS_OPTIONS = ['Pre-lancamento', 'Lancamento', 'Em Obras', 'Pronto para Morar', 'Exclusivo', 'Oportunidade']
const ANIMATION_RENT_STATUS_OPTIONS = ['Disponivel Ja', 'Exclusivo', 'Oportunidade']
const ANIMATION_CTA_OPTIONS = ['Saiba Mais', 'Entre em Contato', 'Chame no WhatsApp']
const ANIMATION_IMAGE_COUNT_OPTIONS = [1, 2, 3, 4]
const ANIMATION_OTHER_UF_OPTION = 'OUTRO'
const ANIMATION_UF_OPTIONS = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES', 'PA', 'AM', ANIMATION_OTHER_UF_OPTION]
const ANIMATION_FEATURE_FIELDS = [
  { key: 'bedrooms', label: 'Dormitorios', placeholder: 'Ex.: 3' },
  { key: 'suites', label: 'Suites', placeholder: 'Ex.: 2' },
  { key: 'parking', label: 'Vagas', placeholder: 'Ex.: 2' },
  { key: 'area', label: 'Area util (m²)', placeholder: 'Ex.: 145' },
]
const ANIMATION_IMAGE_SLOTS = [1, 2, 3, 4].map((number) => ({
  key: `image${number}`,
  label: `Imagem ${number}`,
  helper: number === 1 ? 'Envie a imagem principal.' : 'Envie uma imagem complementar.',
  fileName: `animation-${number}`,
}))
const MULTI_IMAGE_TOUR_IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const MULTI_IMAGE_TOUR_IMAGE_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => ({
  key: `image${number}`,
  label: `Imagem ${number}`,
  helper: number === 1 ? 'Comece pela imagem principal.' : 'Use a ordem desejada para o tour.',
  fileName: `multi-tour-${number}`,
}))

const initialAnswers = {
  objective: '',
  oferta: '',
  propertyType: '',
  stage: '',
  profile: '',
  city: '',
  cityOther: '',
  district: '',
  captureHasDistrict: '',
  bedrooms: '',
  suites: '',
  parking: '',
  area: '',
  commercialRooms: '',
  bathrooms: '',
  differentials: [],
  rentConditions: [],
  cta: '',
  houseLocationType: '',
  uf: '',
  imageCount: 1,
  furnishingStatus: '',
  decorationPolicy: '',
  brokerHasBenefits: '',
  brokerCommission: '',
  brokerBenefits: [],
  brokerBenefitOther: '',
  creativeMode: 'cinematic',
  visualStyle: '',
  atmosphere: '',
  pace: '',
  creativeFreedom: '',
}

const getStudioHeroAccess = (user) => {
  const plan = String(user?.plano || user?.plan || user?.subscription_plan || '').toLowerCase()
  const role = String(user?.role || '').toLowerCase()
  const email = String(user?.email || '').toLowerCase()
  const isAdmin = role === 'admin' || email === 'riccieri68@gmail.com'
  const isSubscriber = PREMIUM_PLAN_IDS.has(plan)
  const tokenBalance = Number(
    user?.smart_tokens_saldo
    ?? user?.tokens_saldo
    ?? user?.saldo_creditos
    ?? user?.creditos_avulsos
    ?? user?.total_disponivel
    ?? 0
  )
  const hasTokens = Number.isFinite(tokenBalance) && tokenBalance > 0

  return {
    isAdmin,
    isSubscriber,
    hasTokens,
    canGenerate: isAdmin || isSubscriber || hasTokens,
  }
}

function getUploadContentType(file) {
  const rawType = String(file?.type || '').toLowerCase()
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase()

  if (rawType === 'image/jpg') return 'image/jpeg'
  if (SUPPORTED_IMAGE_TYPES.has(rawType)) return rawType
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'

  return ''
}

function getFileExtensionFromContentType(contentType) {
  if (contentType === 'image/png') return 'png'
  return 'jpg'
}

function getImageErrorTarget(value) {
  const text = String(value || '').toLowerCase()

  if (text.includes('imagem 1') || text.includes('input-1')) return 'image1'
  if (text.includes('imagem') || text.includes('jpg') || text.includes('png')) return 'all'

  return ''
}

function normalizeFreeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 60)
}

const VIDEO_TEXT_TOKEN_DICTIONARY = {
  EXCLUSIVO: 'EXCLUSIVO',
  EXCLUIVO: 'EXCLUSIVO',
  OPORTUNIDADE: 'OPORTUNIDADE',
  LANCAMENTO: 'LANCAMENTO',
  PRELANCAMENTO: 'PRE-LANCAMENTO',
  'PRE LANCAMENTO': 'PRE-LANCAMENTO',
  'PRE-LANCAMENTO': 'PRE-LANCAMENTO',
  DISPONIVEL: 'DISPONIVEL',
  'SAIBA MAIS': 'SAIBA MAIS',
  QUERVENDER: 'QUER VENDER',
  'QUER VENDER': 'QUER VENDER',
  QUERALUGAR: 'QUER ALUGAR',
  'QUER ALUGAR': 'QUER ALUGAR',
  CONTRATAMOS: 'CONTRATAMOS',
}

function normalizeVideoTextToken(value, fallback = '') {
  const clean = normalizeFreeText(String(value || ''))
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const compact = clean.replace(/[\s-]+/g, '')
  return VIDEO_TEXT_TOKEN_DICTIONARY[clean] || VIDEO_TEXT_TOKEN_DICTIONARY[compact] || clean || fallback
}

function formatDisplayText(value) {
  const minorWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
  return String(value || '')
    .replace(/[^\p{L}0-9\s/-]/gu, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, 60)
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && minorWords.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function normalizeAnimationDistrict(value) {
  const clean = String(value || '')
    .replace(/[^\p{L}0-9\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

  if (!clean) return ''

  const minorWords = new Set(['da', 'de', 'do', 'das', 'dos'])
  return clean
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index > 0 && minorWords.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function normalizeAnimationUf(value) {
  return String(value || '').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2)
}

function normalizeAnimationLocation(value, ufValue = '') {
  if (ufValue) {
    return [normalizeAnimationDistrict(value), normalizeAnimationUf(ufValue)].filter(Boolean).join('-')
  }

  const clean = String(value || '')
    .replace(/[^\p{L}0-9\s/-]/gu, '')
    .replace(/\s*[-/]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

  if (!clean) return ''

  const parts = clean.split(/[\s-]+/).filter(Boolean)
  const maybeUf = parts.length > 1 ? parts[parts.length - 1] : ''
  const hasUf = /^[a-z]{2}$/i.test(maybeUf)
  const districtParts = hasUf ? parts.slice(0, -1) : parts
  return [
    normalizeAnimationDistrict(districtParts.join(' ')),
    hasUf ? normalizeAnimationUf(maybeUf) : '',
  ].filter(Boolean).join('-')
}

function cleanAnimationLocationInput(value) {
  return String(value || '')
    .replace(/[^\p{L}0-9\s]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function formatAnimationPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function cleanAnimationNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4)
}

function buildAnimationPropertyDetails(source) {
  const bedrooms = cleanAnimationNumber(source?.bedrooms)
  const suites = cleanAnimationNumber(source?.suites)
  const parking = cleanAnimationNumber(source?.parking)
  const area = cleanAnimationNumber(source?.area)
  return [
    bedrooms ? `${bedrooms} dorms` : '',
    suites ? `${suites} suíte${suites === '1' ? '' : 's'}` : '',
    parking ? `${parking} vaga${parking === '1' ? '' : 's'}` : '',
    area ? `${area} m²` : '',
  ].filter(Boolean).join(' • ')
}

function buildAnimationLocation(source) {
  const uf = source?.uf === ANIMATION_OTHER_UF_OPTION ? source?.ufOther : source?.uf
  return normalizeAnimationLocation(source?.location, uf)
}

function buildAnimationDescription(source) {
  return [
    buildAnimationLocation(source),
    buildAnimationPropertyDetails(source),
  ].filter(Boolean).join('\n')
}

const ANIMATION_READY_STATUSES = new Set(['succeeded', 'completed'])
const ANIMATION_FAILED_STATUSES = new Set(['failed', 'error', 'canceled', 'cancelled', 'timeout'])

function normalizeAnimationRenderStatus(status) {
  return String(status || '').trim().toLowerCase()
}

function getAnimationVideoUrl(source) {
  const candidates = [
    source?.url,
    source?.output_url,
    source?.output,
    source?.render?.url,
    source?.result?.url,
  ]
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || ''
}

function isAnimationMp4Url(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol) && /\.mp4$/i.test(url.pathname)
  } catch {
    return false
  }
}

function getSafeAnimationRenderLog(source) {
  const url = getAnimationVideoUrl(source)
  let urlHost = ''
  let urlPathEnding = ''
  try {
    const parsed = url ? new URL(url) : null
    urlHost = parsed?.host || ''
    urlPathEnding = parsed?.pathname ? parsed.pathname.slice(-32) : ''
  } catch {
    urlHost = 'invalid-url'
  }

  return {
    render_id: source?.render_id || source?.renderId || source?.id || null,
    status: source?.status || null,
    has_url: Boolean(url),
    url_type: typeof url,
    url_host: urlHost,
    url_path_ending: urlPathEnding,
    is_mp4_url: isAnimationMp4Url(url),
    has_snapshot_url: Boolean(source?.snapshot_url),
    keys: source && typeof source === 'object' ? Object.keys(source).slice(0, 20) : [],
  }
}

function getCityOptions(uf) {
  return [...(CITY_OPTIONS_BY_UF[uf] || []), OTHER_CITY_OPTION]
}

function getDisplayCityValue(answers) {
  if (answers.city === OTHER_CITY_OPTION) return formatDisplayText(answers.cityOther)
  return answers.city || ''
}

function getDisplayLocation({ district, city, uf, isCapture }) {
  const displayDistrict = formatDisplayText(district)
  const displayCity = formatDisplayText(city)
  const cityUf = [displayCity, uf].filter(Boolean).join('/')
  if (isCapture && !displayDistrict) return cityUf
  return [displayDistrict, cityUf].filter(Boolean).join(' — ')
}

function getNormalizedLocation({ district, city, uf, isCapture }) {
  const normalizedCity = normalizeFreeText(city)
  const normalizedUf = normalizeFreeText(uf)
  const normalizedDistrict = normalizeFreeText(district)
  const cityUf = [normalizedCity, normalizedUf].filter(Boolean).join('-')
  if (isCapture && !normalizedDistrict) return cityUf
  return [normalizedDistrict, cityUf].filter(Boolean).join('-')
}

function normalizeImpactText(value, fallback, maxWords = 1) {
  const words = normalizeVideoTextToken(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
  return normalizeVideoTextToken(words.join(' '), fallback)
}

function getCommercialImpactWord(answers) {
  const source = [
    answers.profile,
    answers.stage,
    answers.propertyType,
    answers.oferta,
    ...answers.differentials,
    ...answers.rentConditions,
  ].join(' ').toUpperCase()

  if (/PRAIA|MAR|VISTA|LITORAL/.test(source)) return 'PRAIA'
  if (/INVEST|RENDA|VALORIZ/.test(source)) return 'INVESTIMENTO'
  if (/COMERCIAL|SALA|LAJE|NEGOC/.test(source)) return 'NEGOCIOS'
  if (/LUXO/.test(source)) return 'LUXO'
  if (/ALTO|DESIGN|SOFISTIC/.test(source)) return 'DESIGN'
  if (/MCMV|ECONOM|POPULAR|SUBSID/.test(source)) return 'OPORTUNIDADE'
  if (/PRONTO/.test(source)) return 'MORAR'
  return 'EXCLUSIVO'
}

function getShortCtaPreview(cta) {
  const clean = normalizeVideoTextToken(cta)
  if (/SAIBA/.test(clean)) return normalizeVideoTextToken('SAIBA MAIS')
  if (/AGENDE|VISITA/.test(clean)) return normalizeVideoTextToken('AGENDE')
  if (/CONTATO|FALE|CORRETOR|WHATS/.test(clean)) return normalizeVideoTextToken('CONTATO')
  if (/VISITE|CONHECA|QUERO/.test(clean)) return normalizeVideoTextToken('VISITE')
  return normalizeImpactText(clean, 'SAIBA MAIS', 2)
}

function getCreativeProgressMessage(step, uploadStep, isFreeAiMode = false) {
  if (isFreeAiMode && step >= uploadStep) return 'Estamos quase la. Falta revisar a direcao criativa.'
  if (isFreeAiMode && step >= uploadStep - 3) return 'Agora estamos definindo estilo, atmosfera e ritmo.'
  if (step >= uploadStep) return 'Agora sua imagem entra como base visual do comercial.'
  if (step >= uploadStep - 1) return 'Estamos quase terminando. Falta escolher a imagem.'
  if (step >= 4) return 'O estilo do comercial ja esta ganhando forma.'
  if (step >= 2) return 'Otimo. Ja temos uma boa base para seguir.'
  return 'Vamos construir a direcao criativa em poucos passos.'
}

function getAssistantHint(number) {
  return ASSISTANT_HINTS[number] || 'Isso vai ajudar bastante a deixar o comercial mais certeiro.'
}

function buildStudioHeroFinalCta(answers) {
  return {
    label: answers.cta || '',
    channel: 'text',
    value: '',
  }
}

function formatStudioHeroFinalCta(finalCta) {
  return finalCta.label || 'SAIBA MAIS'
}

function isCommercialType(type) {
  return COMMERCIAL_PROPERTY_TYPES.includes(type)
}

function isResidentialType(type) {
  return RESIDENTIAL_PROPERTY_TYPES.includes(type)
}

function isPropertyCampaignObjective(objective) {
  return objective === 'sale' || objective === 'rent'
}

function isCaptureObjective(objective) {
  return objective === 'property_capture' || objective === 'broker_capture'
}

function getPropertyTypeOptions(objective) {
  if (objective === 'property_capture') return PROPERTY_CAPTURE_TYPES
  if (objective === 'broker_capture') return BROKER_CAPTURE_PROFILES
  return objective === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES
}

function getProfileOptions(answers) {
  if (answers.objective === 'rent') {
    return isResidentialType(answers.propertyType) ? ['PRONTOS', 'ALTO PADRAO'] : []
  }
  return isResidentialType(answers.propertyType) ? RESIDENTIAL_PROFILES : []
}

function getStudioHeroMatrixId(answers) {
  if (answers.objective === 'property_capture') return 'CAPTURE_PROPERTY_V1'
  if (answers.objective === 'broker_capture') return 'CAPTURE_AGENT_V1'

  const profile = normalizeFreeText(answers.profile)
  const group = /MCMV|ECONOMICO|POPULAR/.test(profile)
    ? 'MCMV'
    : /LANCAMENTO/.test(profile)
      ? 'LANCAMENTO'
      : /ALTO PADRAO|LUXO/.test(profile)
      ? 'ALTO_PADRAO'
      : 'PRONTOS'

  if (answers.objective === 'rent') {
    if (group === 'MCMV') return 'RENT_MCMV_V1'
    if (group === 'ALTO_PADRAO') return 'RENT_ALTO_PADRAO_V1'
    return 'RENT_PRONTOS_V1'
  }

  if (group === 'MCMV') return 'SELL_MCMV_V1'
  if (group === 'LANCAMENTO') return 'SELL_LANCAMENTO_V1'
  if (group === 'ALTO_PADRAO') return 'SELL_ALTO_PADRAO_V1'
  return 'SELL_PRONTOS_V1'
}

function getStageOptions(answers) {
  return SALE_STAGES
}

function getDifferentialOptions(answers) {
  const matrixId = getStudioHeroMatrixId(answers)
  if (MATRIX_ALLOWED_OPTIONS[matrixId]?.highlights) return MATRIX_ALLOWED_OPTIONS[matrixId].highlights

  if (answers.objective === 'property_capture') return PROPERTY_CAPTURE_DIFFERENTIAL_OPTIONS
  if (answers.objective === 'broker_capture') return BROKER_CAPTURE_DIFFERENTIAL_OPTIONS

  if (answers.objective === 'rent') {
    return isCommercialType(answers.propertyType)
      ? RENT_COMMERCIAL_DIFFERENTIAL_OPTIONS
      : RENT_DIFFERENTIAL_OPTIONS
  }

  if (answers.propertyType === 'CASA') return HOUSE_DIFFERENTIAL_OPTIONS
  if (answers.propertyType === 'GALPAO') return ['LOCALIZACAO', 'INFRAESTRUTURA', 'NEGOCIOS', 'LOGISTICA']
  if (answers.propertyType === 'LOJA') return ['LOCALIZACAO', 'INFRAESTRUTURA', 'NEGOCIOS', 'VISIBILIDADE']
  if (answers.propertyType === 'SALA COMERCIAL' || answers.propertyType === 'LAJE CORPORATIVA') {
    return ['LOCALIZACAO', 'INFRAESTRUTURA', 'NEGOCIOS', 'ESTRUTURA CORPORATIVA']
  }
  if (isCommercialType(answers.propertyType)) return SALE_COMMERCIAL_DIFFERENTIAL_OPTIONS
  return SALE_DIFFERENTIAL_OPTIONS
}

function getCtaOptions(answers) {
  const matrixId = getStudioHeroMatrixId(answers)
  if (MATRIX_ALLOWED_OPTIONS[matrixId]?.ctas) return MATRIX_ALLOWED_OPTIONS[matrixId].ctas

  if (isCaptureObjective(answers.objective)) return CAPTURE_CTA_OPTIONS
  if (answers.objective === 'rent') return RENT_CTA_OPTIONS
  return SALE_CTA_OPTIONS
}

function getConfiguration(answers) {
  if (isCommercialType(answers.propertyType)) {
    return [answers.commercialRooms, answers.bathrooms, answers.parking, answers.area].filter(Boolean).join(', ')
  }

  return [answers.bedrooms, answers.suites, answers.parking].filter(Boolean).join(', ')
}

function getFinalFeatureText(answers) {
  const objectiveLabel = getObjectiveSummaryLabel(answers.objective)
  const items = [
    objectiveLabel,
    answers.propertyType,
    answers.stage,
    answers.profile,
    answers.houseLocationType,
    answers.city,
    answers.district,
    answers.bedrooms,
    answers.suites,
    answers.parking,
    ...answers.differentials,
    ...answers.rentConditions,
    answers.brokerCommission ? `COMISSAO ${answers.brokerCommission}` : '',
    ...answers.brokerBenefits,
    answers.brokerBenefitOther,
  ].filter(Boolean)
  return [...new Set(items)].join(', ')
}

function getObjectiveLabel(objectiveId) {
  return OBJECTIVE_OPTIONS.find((item) => item.id === objectiveId)?.label || ''
}

function getObjectiveSummaryLabel(objectiveId) {
  return OBJECTIVE_OPTIONS.find((item) => item.id === objectiveId)?.summaryLabel || ''
}

const STUDIO_COPY_INTERNAL_TERMS = new Set([
  'TODOS',
  'TODAS',
  'QUER ALUGAR',
  'QUER VENDER',
  'CONTRATAMOS',
  'EXCLUSIVO',
  'OUTRO',
])

function getStudioCopyPropertyType(answers) {
  if (answers.objective === 'property_capture') return 'Imovel'
  return answers.propertyType
}

function getStudioCopyFeatures(answers) {
  return [
    ...answers.differentials,
    ...answers.rentConditions,
    answers.brokerCommission ? `comissao ${answers.brokerCommission}%` : '',
    ...answers.brokerBenefits,
    answers.brokerBenefitOther,
  ]
    .map((item) => String(item || '').trim())
    .filter((item) => item && !STUDIO_COPY_INTERNAL_TERMS.has(item.toUpperCase()))
}

function buildDeliveryTexts({ answers, districtValue, cityValue }) {
  return buildPublicationPackage({
    objective: answers.objective,
    objectiveLabel: getObjectiveSummaryLabel(answers.objective),
    propertyType: getStudioCopyPropertyType(answers),
    profile: answers.profile,
    city: cityValue,
    district: districtValue,
    location: getDisplayLocation({
      district: districtValue,
      city: cityValue,
      uf: answers.uf,
      isCapture: isCaptureObjective(answers.objective),
    }),
    features: getStudioCopyFeatures(answers),
    bedrooms: answers.bedrooms,
    suites: answers.suites,
    parking: answers.parking,
    area: answers.area,
    cta: formatStudioHeroFinalCta(buildStudioHeroFinalCta(answers)) || answers.cta || 'Entre em contato',
  })
}

async function invokeStudioFunction(name, body) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (sessionError) {
    logStudioHero('error', 'studio_hero_supabase_session_error', {
      functionName: name,
      message: sessionError.message,
    })
  }

  let response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    logStudioHero('error', 'studio_hero_function_fetch_error', {
      functionName: name,
      message: error instanceof Error ? error.message : String(error),
      requestBody: sanitizeStudioHeroDiagnostic(body),
    })
    throw error
  }

  const responseText = await response.text()
  let responseBody = null
  try {
    responseBody = responseText ? JSON.parse(responseText) : null
  } catch {
    responseBody = responseText
  }

  logStudioHero('info', 'studio_hero_function_response', {
    functionName: name,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    responseBody: sanitizeStudioHeroDiagnostic(responseBody),
  })

  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  }
}

export default function StudioHero() {
  const { user } = useAuth()
  const pollTimerRef = useRef(null)
  const uploadSectionRef = useRef(null)
  const [studioMode, setStudioMode] = useState('')
  const [modeNotice, setModeNotice] = useState('')
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState(initialAnswers)
  const [files, setFiles] = useState({ image1: null })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0)

  const isSale = answers.objective === 'sale'
  const isRent = answers.objective === 'rent'
  const isFreeAiMode = studioMode === 'free_ai'
  const isAnimationPremiumMode = studioMode === 'smart_carousel'
  const isMultiImageTourMode = studioMode === 'multi_image_tour'
  const studioCreationModes = getStudioCreationModes()
  const studioModeExamples = getStudioModeExamples()
  const guideItems = STUDIO_GUIDE_ITEMS_BY_MODE[studioMode] || STUDIO_GUIDE_ITEMS_BY_MODE.cinematic
  const isPropertyCampaign = isPropertyCampaignObjective(answers.objective)
  const isPropertyCapture = answers.objective === 'property_capture'
  const isBrokerCapture = answers.objective === 'broker_capture'
  const isCommercialProperty = isCommercialType(answers.propertyType)
  const isCapture = isCaptureObjective(answers.objective)
  const propertyTypeOptions = getPropertyTypeOptions(answers.objective)
  const profileOptions = getProfileOptions(answers)
  const stageOptions = getStageOptions(answers)
  const differentialOptions = getDifferentialOptions(answers)
  const ctaOptions = getCtaOptions(answers)
  const cityOptions = getCityOptions(answers.uf)
  const cityValue = getDisplayCityValue(answers)
  const districtValue = formatDisplayText(answers.district)
  const displayLocation = getDisplayLocation({ district: districtValue, city: cityValue, uf: answers.uf, isCapture })
  const normalizedLocation = getNormalizedLocation({ district: districtValue, city: cityValue, uf: answers.uf, isCapture })
  const configuration = getConfiguration(answers)
  const finalFeatures = getFinalFeatureText({
    ...answers,
    city: cityValue,
    district: districtValue,
  })
  const isGenerating = ['uploading', 'generating'].includes(status)
  const hasProfileStep = isPropertyCampaign && isResidentialType(answers.propertyType)
  const hasHouseLocationStep = isPropertyCampaign && answers.propertyType === 'CASA'
  const hasStageStep = false
  const hasFreeAiPropertyFeaturesStep = isFreeAiMode && isPropertyCampaign
  const profileStep = 3
  const houseLocationStep = profileStep + (hasProfileStep ? 1 : 0)
  const stageStep = houseLocationStep + (hasHouseLocationStep ? 1 : 0)
  const locationStep = isCapture ? 2 : stageStep + (hasStageStep ? 1 : 0)
  const captureTypeStep = isCapture ? 3 : null
  const differentialsStep = isCapture ? 4 : locationStep + 1
  const benefitQuestionStep = isBrokerCapture ? differentialsStep + 1 : null
  const benefitDetailsStep = isBrokerCapture && answers.brokerHasBenefits === 'yes' ? benefitQuestionStep + 1 : null
  const propertyFeaturesStep = hasFreeAiPropertyFeaturesStep ? differentialsStep + 1 : null
  const ctaStep = isBrokerCapture
    ? benefitQuestionStep + (answers.brokerHasBenefits === 'yes' ? 2 : 1)
    : differentialsStep + (hasFreeAiPropertyFeaturesStep ? 2 : 1)
  const furnishingStep = isFreeAiMode ? null : ctaStep + 1
  const decorationStep = isFreeAiMode ? null : ctaStep + 2
  const visualStyleStep = isFreeAiMode ? ctaStep + 1 : null
  const atmosphereStep = isFreeAiMode ? ctaStep + 2 : null
  const paceStep = isFreeAiMode ? ctaStep + 3 : null
  const creativeFreedomStep = isFreeAiMode ? ctaStep + 4 : null
  const imageCountStep = null
  const uploadStep = isFreeAiMode ? ctaStep + 5 : ctaStep + 3
  const imageErrorTarget = getImageErrorTarget(message)
  const studioHeroAccess = getStudioHeroAccess(user)
  const generationMessage = GENERATION_MESSAGES[generationMessageIndex % GENERATION_MESSAGES.length]
  const progressPercent = Math.min(100, Math.max(8, Math.round((Math.min(step, uploadStep) / uploadStep) * 100)))
  const progressMessage = getCreativeProgressMessage(step, uploadStep, isFreeAiMode)
  const propertyFeaturesSummary = isCommercialProperty
    ? [answers.area, answers.parking].filter(Boolean).join(', ')
    : [answers.bedrooms, answers.suites, answers.parking].filter(Boolean).join(', ')
  const stepSummaries = {
    1: answers.objective ? getObjectiveSummaryLabel(answers.objective) : '',
    2: isPropertyCampaign ? answers.propertyType : displayLocation,
    [profileStep]: hasProfileStep ? answers.profile : '',
    [houseLocationStep]: hasHouseLocationStep ? answers.houseLocationType : '',
    [stageStep]: hasStageStep ? answers.stage : '',
    [locationStep]: displayLocation,
    [captureTypeStep]: isCapture ? answers.propertyType : '',
    [differentialsStep]: answers.differentials.join(', '),
    [benefitQuestionStep]: isBrokerCapture ? (answers.brokerHasBenefits === 'yes' ? 'Sim' : answers.brokerHasBenefits === 'no' ? 'Nao' : '') : '',
    [benefitDetailsStep]: isBrokerCapture && answers.brokerHasBenefits === 'yes'
      ? [
        answers.brokerCommission ? `${answers.brokerCommission}%` : '',
        ...answers.brokerBenefits.filter((item) => item !== 'OUTRO'),
        answers.brokerBenefitOther,
      ].filter(Boolean).join(', ')
      : '',
    [propertyFeaturesStep]: hasFreeAiPropertyFeaturesStep
      ? propertyFeaturesSummary
      : '',
    [ctaStep]: answers.cta,
    [furnishingStep]: !isFreeAiMode ? answers.furnishingStatus : '',
    [decorationStep]: !isFreeAiMode ? answers.decorationPolicy : '',
    [visualStyleStep]: isFreeAiMode ? answers.visualStyle : '',
    [atmosphereStep]: isFreeAiMode ? answers.atmosphere : '',
    [paceStep]: isFreeAiMode ? answers.pace : '',
    [creativeFreedomStep]: isFreeAiMode ? answers.creativeFreedom : '',
    [uploadStep]: isFreeAiMode
      ? 'Criacao livre com IA'
      : IMAGE_SLOTS.every((slot) => files[slot.key])
        ? '1 imagem selecionada'
        : '',
  }

  const hasRequiredCinematicImage = IMAGE_SLOTS.every((slot) => files[slot.key])
  const hasRequiredFreeAiBriefing = Boolean(answers.visualStyle && answers.atmosphere && answers.pace && answers.creativeFreedom)
  const hasRequiredFreeAiPropertyFeatures = !hasFreeAiPropertyFeaturesStep
    || (isCommercialProperty ? Boolean(answers.area && answers.parking) : Boolean(answers.bedrooms && answers.suites && answers.parking))
  const hasRequiredModeInputs = isFreeAiMode
    ? Boolean(hasRequiredFreeAiBriefing && hasRequiredFreeAiPropertyFeatures)
    : Boolean(answers.furnishingStatus && answers.decorationPolicy && hasRequiredCinematicImage)

  const canGenerateBriefing = Boolean(
    answers.objective &&
    (!isPropertyCampaign || answers.propertyType) &&
    (!isCapture || answers.propertyType) &&
    (!hasProfileStep || answers.profile) &&
    (!hasHouseLocationStep || answers.houseLocationType) &&
    (!hasStageStep || answers.stage) &&
    answers.uf &&
    cityValue &&
    (!isCapture || answers.captureHasDistrict) &&
    (isCapture ? (answers.captureHasDistrict === 'no' || districtValue) : districtValue) &&
    answers.differentials.length > 0 &&
    (!isBrokerCapture || answers.brokerHasBenefits) &&
    answers.cta &&
    hasRequiredModeInputs
  )
  const canGenerate = canGenerateBriefing && (isFreeAiMode || studioHeroAccess.canGenerate)

  const updateObjective = (option) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      objective: option.id,
      oferta: option.oferta,
      propertyType: '',
      stage: '',
      profile: '',
      city: '',
      cityOther: '',
      uf: '',
      district: '',
      captureHasDistrict: '',
      bedrooms: '',
      suites: '',
      parking: '',
      area: '',
      commercialRooms: '',
      bathrooms: '',
      differentials: [],
      rentConditions: [],
      cta: '',
      houseLocationType: '',
      imageCount: 1,
      furnishingStatus: '',
      decorationPolicy: '',
      brokerHasBenefits: '',
      brokerCommission: '',
      brokerBenefits: [],
      brokerBenefitOther: '',
      creativeMode: studioMode === 'free_ai' ? 'free_ai' : 'cinematic',
      visualStyle: '',
      atmosphere: '',
      pace: '',
      creativeFreedom: '',
    }))
    setStep(2)
  }

  const updatePropertyType = (propertyType) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      propertyType,
      stage: '',
      profile: '',
      bedrooms: '',
      suites: '',
      parking: '',
      area: '',
      commercialRooms: '',
      bathrooms: '',
      differentials: [],
      rentConditions: [],
      cta: '',
      houseLocationType: '',
      imageCount: 1,
      furnishingStatus: '',
      decorationPolicy: '',
      brokerHasBenefits: '',
      brokerCommission: '',
      brokerBenefits: [],
      brokerBenefitOther: '',
      visualStyle: '',
      atmosphere: '',
      pace: '',
      creativeFreedom: '',
    }))
    if (isCapture) {
      setStep(differentialsStep)
      return
    }
    setStep(isResidentialType(propertyType) ? profileStep : locationStep)
  }

  const updateProfile = (profile) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      profile,
      differentials: normalizeFreeText(profile) === 'LANCAMENTO' ? ['LANCAMENTO'] : [],
      rentConditions: [],
      cta: '',
      houseLocationType: '',
      imageCount: 1,
      furnishingStatus: '',
      decorationPolicy: '',
      captureHasDistrict: '',
      brokerHasBenefits: '',
      brokerCommission: '',
      brokerBenefits: [],
      brokerBenefitOther: '',
      visualStyle: '',
      atmosphere: '',
      pace: '',
      creativeFreedom: '',
    }))
    setStep(answers.propertyType === 'CASA' ? houseLocationStep : (hasStageStep ? stageStep : locationStep))
  }

  const updateAnswer = (field, value, nextStep = step + 1) => {
    resetGenerationState()
    setAnswers((current) => ({ ...current, [field]: value }))
    if (nextStep) setStep(nextStep)
  }

  const toggleDifferential = (item) => {
    if (answers.differentials.includes(item)) return

    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      differentials: [item],
      cta: '',
      brokerHasBenefits: '',
      brokerCommission: '',
      brokerBenefits: [],
      brokerBenefitOther: '',
      visualStyle: '',
      atmosphere: '',
      pace: '',
      creativeFreedom: '',
      imageCount: 1,
      furnishingStatus: '',
      decorationPolicy: '',
    }))
  }

  const updateBrokerHasBenefits = (value) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      brokerHasBenefits: value,
      brokerCommission: value === 'yes' ? current.brokerCommission : '',
      brokerBenefits: value === 'yes' ? current.brokerBenefits : [],
      brokerBenefitOther: value === 'yes' ? current.brokerBenefitOther : '',
      cta: '',
      imageCount: 1,
      furnishingStatus: '',
      decorationPolicy: '',
    }))
    setStep(benefitQuestionStep + 1)
  }

  const updateBrokerCommission = (value) => {
    resetGenerationState()
    const clean = String(value || '').replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 5)
    setAnswers((current) => ({ ...current, brokerCommission: clean, cta: '', imageCount: 1, furnishingStatus: '', decorationPolicy: '' }))
  }

  const toggleBrokerBenefit = (item) => {
    resetGenerationState()
    setAnswers((current) => {
      const exists = current.brokerBenefits.includes(item)
      const nextBenefits = exists
        ? current.brokerBenefits.filter((selected) => selected !== item)
        : current.brokerBenefits.length >= MAX_BROKER_BENEFITS
          ? current.brokerBenefits
          : [...current.brokerBenefits, item]

      return {
        ...current,
        brokerBenefits: nextBenefits,
        brokerBenefitOther: nextBenefits.includes('OUTRO') ? current.brokerBenefitOther : '',
        cta: '',
        imageCount: 1,
        furnishingStatus: '',
        decorationPolicy: '',
      }
    })
  }

  const updateCtaLabel = (cta) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      cta,
      furnishingStatus: '',
      decorationPolicy: '',
      visualStyle: '',
      atmosphere: '',
      pace: '',
      creativeFreedom: '',
    }))
    setStep(isFreeAiMode ? visualStyleStep : furnishingStep)
  }

  const updatePropertyCharacteristic = (field, value) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      [field]: value,
      cta: '',
      visualStyle: '',
      atmosphere: '',
      pace: '',
      creativeFreedom: '',
    }))
  }

  const updateFurnishingStatus = (value) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      furnishingStatus: value,
      decorationPolicy: '',
    }))
    setStep(decorationStep)
  }

  const updateDecorationPolicy = (value) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      decorationPolicy: value,
    }))
    setStep(uploadStep)
  }

  const updateFreeAiAnswer = (field, value, nextStep) => {
    resetGenerationState()
    setAnswers((current) => ({ ...current, [field]: value, creativeMode: 'free_ai' }))
    setStep(nextStep)
  }

  const uploadImage = async (slot, file, jobDraftId) => {
    const contentType = getUploadContentType(file)

    if (!contentType) {
      logStudioHero('warn', 'studio_hero_invalid_image_type', {
        slot: slot.key,
        fileType: file?.type || '',
        fileName: file?.name || '',
        fileSize: file?.size || 0,
      })
      throw new Error(`${slot.label}: Para este teste, envie imagens JPG ou PNG.`)
    }

    const extension = getFileExtensionFromContentType(contentType)
    const path = `${user.id}/${jobDraftId}/${slot.fileName}.${extension}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType,
        upsert: true,
      })

    if (error) {
      logStudioHero('error', 'studio_hero_upload_error', {
        bucket: BUCKET,
        path,
        slot: slot.key,
        contentType,
        fileType: file.type || '',
        fileName: file.name || '',
        fileSize: file.size || 0,
        message: error.message,
      })
      throw new Error(`Falha no upload de ${slot.label}. Para este teste, envie imagens JPG ou PNG.`)
    }

    return path
  }

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => clearPolling(), [])

  useEffect(() => {
    if (!isGenerating) {
      setGenerationMessageIndex(0)
      return undefined
    }
    const timer = window.setInterval(() => {
      setGenerationMessageIndex((current) => (current + 1) % GENERATION_MESSAGES.length)
    }, 3200)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  function resetGenerationState() {
    clearPolling()
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
  }

  const goToUploadStep = () => {
    setStep(uploadStep)
  }

  const handleImageChange = (slotKey, file) => {
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    resetGenerationState()
    setFiles((current) => ({ ...current, [slotKey]: file }))

    window.requestAnimationFrame(() => {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' })
      window.requestAnimationFrame(() => {
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' })
      })
    })
  }

  useEffect(() => {
    if (status === 'failed' && imageErrorTarget) {
      setStep(uploadStep)
    }
  }, [status, imageErrorTarget])

  const pollVideoStatus = async (nextJobId, options = {}) => {
    const isRecovery = options.mode === 'recovery'
    const normalizedJobId = String(nextJobId || '').trim()
    const regexResult = UUID_PATTERN.test(normalizedJobId)

    if (!regexResult) {
      logStudioHero('error', 'studio_hero_invalid_poll_job_id', {
        receivedType: typeof nextJobId,
        length: typeof nextJobId === 'string' ? nextJobId.length : undefined,
        valueLength: normalizedJobId.length,
        trimmedValue: normalizedJobId,
        regexResult,
      })
      clearPolling()
      setStatus('failed')
      setMessage('Nao foi possivel preparar o comercial neste momento.')
      return
    }

    try {
      const result = await invokeStudioFunction('get-video-job-status', { jobId: normalizedJobId })
      const data = result.body

      logStudioHero('info', 'studio_hero_poll_status', {
        jobId: normalizedJobId,
        httpStatus: result.status,
        httpOk: result.ok,
        jobStatus: data?.status,
        hasSignedVideoUrl: Boolean(data?.signedVideoUrl || data?.signedUrl || data?.videoUrl),
        hasError: Boolean(data?.error || data?.errorMessage),
        error: data?.error || data?.errorMessage || '',
        responseBody: sanitizeStudioHeroDiagnostic(data),
      })

      if (!result.ok) throw new Error(data?.error || 'Falha ao consultar comercial.')
      if (!data?.ok) throw new Error(data?.error || 'Comercial ainda nao disponivel.')

      if (data.status === 'completed') {
        const nextVideoUrl = data.signedVideoUrl || data.signedUrl || data.videoUrl || ''
        if (!nextVideoUrl) {
          logStudioHero('error', 'studio_hero_completed_without_video_url', {
            jobId: normalizedJobId,
            status: data.status,
          })
          throw new Error('completed_without_video_url')
        }
        clearPolling()
        setStatus('completed')
        setVideoUrl(nextVideoUrl)
        setMessage('Seu comercial esta pronto.')
        return
      }

      if (data.status === 'failed') {
        const diagnosticMessage = String(data.errorMessage || data.error || '').trim()
        logStudioHero('error', 'studio_hero_poll_failed_job', {
          jobId: normalizedJobId,
          httpStatus: result.status,
          jobStatus: data.status,
          error: diagnosticMessage,
          responseBody: sanitizeStudioHeroDiagnostic(data),
        })
        clearPolling()
        setStatus('failed')
        setMessage(IS_DEV && diagnosticMessage
          ? `Erro tecnico da geracao: ${diagnosticMessage}`
          : 'Nao foi possivel criar o comercial neste momento.')
        return
      }

      setStatus('generating')
      setMessage(isRecovery ? 'Comercial ainda em preparacao. Tente novamente em alguns segundos.' : (data.message || 'Criando seu comercial...'))
      if (!isRecovery) {
        pollTimerRef.current = setTimeout(() => pollVideoStatus(normalizedJobId), 9000)
      }
    } catch (error) {
      clearPolling()
      logStudioHero('error', 'studio_hero_status_error', {
        jobId: normalizedJobId,
        message: error instanceof Error ? error.message : String(error),
      })
      setStatus('failed')
      setMessage('Nao foi possivel preparar o comercial neste momento.')
    }
  }

  const handleGenerate = async () => {
    if (!user?.id || !canGenerateBriefing) return
    if (!isFreeAiMode && !studioHeroAccess.canGenerate) {
      setStatus('failed')
      setMessage('Disponivel para assinantes ou usuarios com Smart Tokens suficientes. Veja o exemplo e ative quando quiser.')
      return
    }

    clearPolling()
    setStatus(isFreeAiMode ? 'generating' : 'uploading')
    setMessage(isFreeAiMode ? 'Criando seu comercial livre...' : 'Preparando seu comercial...')
    setVideoUrl('')

    try {
      const draftId = crypto.randomUUID()
      const requiresImages = !isFreeAiMode
      logStudioHero('info', 'studio_hero_generate_start', {
        mode: studioMode,
        requiresImages,
        canGenerate,
        canGenerateBriefing,
      })

      const inputImage1Path = requiresImages
        ? await uploadImage(IMAGE_SLOTS[0], files.image1, draftId)
        : ''

      setStatus('generating')
      setMessage(isFreeAiMode ? 'Criando seu comercial livre...' : 'Criando seu comercial...')

      const nativeVideoText = {
        offer: normalizeVideoTextToken(answers.oferta),
        feature: normalizeVideoTextToken(finalFeatures),
        cta: normalizeVideoTextToken(answers.cta),
      }

      const payload = {
        mode: isFreeAiMode ? 'free_ai' : 'cinematic',
        creativeMode: isFreeAiMode ? 'free_ai' : 'cinematic',
        style: answers.profile || 'ALTO PADRAO',
        bairro: normalizedLocation,
        caracteristica: nativeVideoText.feature,
        oferta: nativeVideoText.offer,
        cta: nativeVideoText.cta,
        briefing: {
          objective: answers.objective,
          objectiveLabel: getObjectiveSummaryLabel(answers.objective),
          propertyType: answers.propertyType,
          profile: answers.profile,
          stage: answers.stage,
          houseLocationType: answers.houseLocationType,
          uf: answers.uf,
          city: cityValue,
          district: districtValue,
          location: displayLocation,
          normalizedLocation,
          bedrooms: answers.bedrooms,
          suites: answers.suites,
          parking: answers.parking,
          differentials: answers.differentials,
          brokerHasBenefits: answers.brokerHasBenefits,
          brokerCommission: answers.brokerCommission,
          brokerBenefits: answers.brokerBenefits,
          brokerBenefitOther: answers.brokerBenefitOther,
          offer: nativeVideoText.offer,
          cta: nativeVideoText.cta,
          finalFeatures: nativeVideoText.feature,
          creativeMode: answers.creativeMode,
          furnishingStatus: answers.furnishingStatus,
          decorationPolicy: answers.decorationPolicy,
          visualStyle: answers.visualStyle,
          atmosphere: answers.atmosphere,
          pace: answers.pace,
          creativeFreedom: answers.creativeFreedom,
        },
        jobId: draftId,
        ...(requiresImages ? { inputImage1Path } : {}),
      }

      logStudioHero('info', 'studio_hero_generate_payload_ready', {
        mode: payload.mode,
        creativeMode: payload.creativeMode,
        requiresImages,
        hasInputImage1Path: Boolean(inputImage1Path),
        payload: sanitizeStudioHeroDiagnostic({
          jobId: payload.jobId,
          style: payload.style,
          bairro: payload.bairro,
          caracteristica: payload.caracteristica,
          oferta: payload.oferta,
          cta: payload.cta,
          briefing: {
            objective: payload.briefing.objective,
            objectiveLabel: payload.briefing.objectiveLabel,
            propertyType: payload.briefing.propertyType,
            profile: payload.briefing.profile,
            city: payload.briefing.city,
            district: payload.briefing.district,
            normalizedLocation: payload.briefing.normalizedLocation,
            finalFeatures: payload.briefing.finalFeatures,
            creativeMode: payload.briefing.creativeMode,
            visualStyle: payload.briefing.visualStyle,
            atmosphere: payload.briefing.atmosphere,
            pace: payload.briefing.pace,
            creativeFreedom: payload.briefing.creativeFreedom,
          },
        }),
      })

      const result = await invokeStudioFunction('criar-video-ia', payload)
      const data = result.body

      if (!result.ok) {
        throw new Error(data?.error || 'Falha ao iniciar comercial.')
      }
      if (!data?.ok && !data?.success) throw new Error(data?.error || 'Comercial ainda nao disponivel neste ambiente.')

      const nextJobId = extractJobIdFromResponse(data, draftId)
      if (!nextJobId) {
        throw new Error('invalid_job_id')
      }
      setVideoUrl('')
      setStatus('generating')
      setMessage(data.message || 'Criando seu comercial...')
      pollTimerRef.current = setTimeout(() => pollVideoStatus(nextJobId), 9000)
    } catch (error) {
      logStudioHero('error', 'studio_hero_generate_error', {
        message: error instanceof Error ? error.message : String(error),
        error: sanitizeStudioHeroDiagnostic(error),
      })
      setStatus('failed')
      const friendlyMessage = error instanceof Error && /JPG|PNG|imagem|assinantes|Smart Tokens/i.test(error.message)
        ? error.message
        : 'No momento, o servico de criacao esta temporariamente limitado pelo provedor de video. Seus Smart Tokens nao serao consumidos se a criacao nao for concluida. Tente novamente mais tarde.'
      setMessage(friendlyMessage)
    }
  }

  const resetFlow = (nextMode = studioMode) => {
    clearPolling()
    setAnswers({
      ...initialAnswers,
      creativeMode: nextMode === 'free_ai' ? 'free_ai' : 'cinematic',
    })
    setFiles({ image1: null })
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
    setStep(1)
  }

  const selectStudioMode = (mode) => {
    if (!mode.active) {
      setModeNotice('Este modo estara disponivel em breve.')
      return
    }
    setModeNotice('')
    setStudioMode(mode.id)
    resetFlow(mode.id)
  }

  if (!studioMode) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7fb_42%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_46%,#0e7490_100%)] text-white shadow-2xl shadow-cyan-950/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(103,232,249,0.26),transparent_28%),radial-gradient(circle_at_86%_20%,rgba(125,211,252,0.18),transparent_30%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
            <div className="relative grid gap-8 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100">
                  <Film className="h-4 w-4" />
                  Studio Hero
                </div>
                <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                  Studio Hero
                </h1>
                <p className="mt-4 max-w-2xl text-xl font-black leading-8 text-cyan-50">
                  Seu estudio inteligente de criacao de videos imobiliarios.
                </p>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200">
                  Crie comerciais cinematograficos, apresentacoes profissionais ou melhore videos gravados em poucos minutos com IA.
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
                <p className="text-sm font-black text-white">O que voce pode criar</p>
                <ul className="mt-4 space-y-3 text-sm font-bold leading-6 text-slate-100">
                  {[
                    'Comerciais cinematograficos',
                    'Comerciais criados apenas com IA',
                    'Carrosseis inteligentes',
                    'Melhoria automatica de videos',
                    'Novos modos chegando',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-100/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {modeNotice && (
            <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-sm font-bold text-primary-900">
              {modeNotice}
            </div>
          )}

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Soluções Studio Hero</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">✨ Descubra o que você pode criar</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Explore os exemplos abaixo e descubra as diferentes campanhas que a IA pode criar para você. Cada geração é única.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              {studioModeExamples.map((example) => {
                const accent = STUDIO_MODE_ACCENTS[example.accent] || STUDIO_MODE_ACCENTS.cyan
                return (
                  <div key={example.id} className={`overflow-hidden rounded-3xl border p-4 ${accent.card}`}>
                    <div className="mx-auto max-w-[190px] rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-xl shadow-slate-200/60">
                      <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.45rem] bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_48%,#0e7490_100%)]">
                        <div className={`absolute inset-0 bg-gradient-to-b ${accent.glow}`} />
                        <div className="relative px-4 text-center text-white">
                          <PlayCircle className="mx-auto h-9 w-9 opacity-90" />
                          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-white/70">{example.label}</p>
                          <p className="mt-2 text-base font-black leading-tight">{example.title}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-white/70 bg-white/90 px-3 py-3">
                        <p className="text-xs font-black text-slate-950">
                          {example.id === 'free_ai' ? '💬 Você conversa com a IA e:' : 'Você envia:'}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {example.send.map((item) => (
                            <li key={`${example.id}-${item}`} className="text-xs font-bold leading-5 text-slate-600">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/90 px-3 py-3">
                        <p className="text-xs font-black text-slate-950">✨ E recebe:</p>
                        <ul className="mt-2 space-y-1.5">
                          {example.receive.map((item) => (
                            <li key={`${example.id}-${item}`} className="text-xs font-bold leading-5 text-slate-600">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {studioCreationModes.map((mode) => {
              const ModeIcon = mode.Icon
              const accent = STUDIO_MODE_ACCENTS[mode.accent] || STUDIO_MODE_ACCENTS.cyan
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => selectStudioMode(mode)}
                  className={`relative flex min-h-[240px] flex-col overflow-hidden rounded-3xl border p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${accent.card}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent.glow}`} />
                  <div className="flex items-start justify-between gap-4">
                    <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${accent.icon}`}>
                      <ModeIcon className="h-5 w-5" />
                    </span>
                    <span className={`relative rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${accent.status}`}>
                      {mode.status}
                    </span>
                  </div>
                  <h2 className="relative mt-5 text-xl font-black text-slate-950">{mode.title}</h2>
                  <p className="relative mt-3 flex-1 text-sm font-semibold leading-6 text-slate-600">{mode.description}</p>
                  <span className={`relative mt-5 text-sm font-black ${accent.cta}`}>
                    {mode.active ? mode.cta : 'Em breve'}
                  </span>
                </button>
              )
            })}
          </section>
        </div>
      </main>
    )
  }

  if (isAnimationPremiumMode) {
    return (
      <AnimationPremiumMode
        user={user}
        onBack={() => {
          setStudioMode('')
          setModeNotice('')
        }}
      />
    )
  }

  if (isMultiImageTourMode) {
    return (
      <MultiImageTourMode
        user={user}
        onBack={() => {
          setStudioMode('')
          setModeNotice('')
        }}
      />
    )
  }

  return (
    <main className={`min-h-screen px-4 py-8 text-slate-900 sm:px-6 lg:px-8 ${isFreeAiMode ? 'bg-[linear-gradient(180deg,#faf5ff_0%,#f8fafc_46%,#eef7fb_100%)]' : 'bg-[linear-gradient(180deg,#f8fafc_0%,#eef7fb_38%,#f8fafc_100%)]'}`}>
      <div className="mx-auto max-w-7xl space-y-8">
        <section className={`relative overflow-hidden rounded-[2rem] text-white shadow-2xl ${isFreeAiMode ? 'bg-[linear-gradient(135deg,#4c1d95_0%,#111827_54%,#7c3aed_100%)] shadow-violet-950/20' : 'bg-[linear-gradient(135deg,#082f49_0%,#0f172a_48%,#0e7490_100%)] shadow-cyan-950/20'}`}>
          <div className={`absolute inset-0 ${isFreeAiMode ? 'bg-[radial-gradient(circle_at_20%_0%,rgba(216,180,254,0.28),transparent_30%),radial-gradient(circle_at_85%_22%,rgba(167,139,250,0.22),transparent_34%)]' : 'bg-[radial-gradient(circle_at_20%_0%,rgba(103,232,249,0.24),transparent_30%),radial-gradient(circle_at_84%_28%,rgba(56,189,248,0.16),transparent_34%)]'}`} />
          <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${isFreeAiMode ? 'via-violet-200/70' : 'via-cyan-200/70'} to-transparent`} />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide ${isFreeAiMode ? 'text-violet-100' : 'text-cyan-100'}`}>
                {isFreeAiMode ? <MessageSquareText className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                {isFreeAiMode ? 'Comercial IA Livre' : 'Comercial Cinematografico'}
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Vamos criar seu comercial.
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black text-white">
                {isFreeAiMode
                  ? 'O Studio Hero vai construir a direcao criativa a partir da conversa, sem pedir imagens.'
                  : 'O Studio Hero vai construir a direcao criativa a partir das suas escolhas e imagens.'}
              </p>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200">
                {isFreeAiMode
                  ? 'Um fluxo curto para imaginar estilo, atmosfera e ritmo antes da criacao.'
                  : 'Um fluxo curto para transformar suas escolhas e imagens em uma peca de divulgacao mais cinematografica.'}
              </p>
              <p className={`mt-3 max-w-2xl text-base font-medium leading-7 ${isFreeAiMode ? 'text-violet-50' : 'text-cyan-50'}`}>
                Suas respostas definem estilo, ritmo e atmosfera. O comercial final usa poucas palavras para ficar mais forte.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetFlow()
                  setStudioMode('')
                }}
                className="mt-6 rounded-2xl border border-white/15 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-white/10"
              >
                Escolher outro tipo de criacao
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <p className="font-black">Como vamos conduzir?</p>
              </div>
              <ul className="mt-5 space-y-4 text-sm font-bold leading-6 text-slate-100">
                {guideItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <StudioPossibilitiesShowcase />

        <section className="space-y-5 pb-12">
          <div className="rounded-3xl border border-cyan-100 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-700">
                  Direcao Criativa
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{progressMessage}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">
                <MessageSquareText className="h-4 w-4" />
                {progressPercent}%
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-primary-700 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <AssistantStep number={1} currentStep={step} summary={stepSummaries[1]} onEdit={() => setStep(1)} message="O que voce deseja criar?">
            <OptionGrid>
              {OBJECTIVE_OPTIONS.map((option) => (
                <ChoiceButton
                  key={option.id}
                  active={answers.objective === option.id}
                  title={option.label}
                  description={option.description}
                  onClick={() => updateObjective(option)}
                />
              ))}
            </OptionGrid>
          </AssistantStep>

          {false && answers.objective && (
            <UserReply onEdit={() => setStep(1)}>
              <strong>{getObjectiveLabel(answers.objective)}</strong>
              <span>{answers.oferta}</span>
            </UserReply>
          )}

          {answers.objective && isPropertyCampaign && (
            <AssistantStep number={2} currentStep={step} summary={stepSummaries[2]} onEdit={() => setStep(2)} message="Que tipo de imovel vamos divulgar?">
              <ChipGrid>
                {propertyTypeOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.propertyType === option}
                    onClick={() => updatePropertyType(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.propertyType && (
            <UserReply onEdit={() => setStep(2)}>
              <strong>{answers.propertyType}</strong>
              <span>Otimo. Agora ja sei qual sera o tipo de imovel.</span>
            </UserReply>
          )}

          {answers.propertyType && hasProfileStep && (
            <AssistantStep number={3} currentStep={step} summary={stepSummaries[profileStep]} onEdit={() => setStep(profileStep)} message="Qual e o perfil comercial deste imovel?">
              <ChipGrid>
                {profileOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.profile === option}
                    onClick={() => updateProfile(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.profile && hasProfileStep && (
            <UserReply onEdit={() => setStep(3)}>
              <strong>{answers.profile}</strong>
              <span>Excelente escolha. Vamos seguir com esse tom.</span>
            </UserReply>
          )}

          {hasHouseLocationStep && answers.profile && (
            <AssistantStep number={houseLocationStep} currentStep={step} summary={stepSummaries[houseLocationStep]} onEdit={() => setStep(houseLocationStep)} message="Onde o imovel esta localizado?">
              <ChipGrid>
                {HOUSE_LOCATION_OPTIONS.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.houseLocationType === option}
                    onClick={() => {
                      resetGenerationState()
                      setAnswers((current) => ({
                        ...current,
                        houseLocationType: option,
                        stage: '',
                        cta: '',
                      }))
                      setStep(hasStageStep ? stageStep : locationStep)
                    }}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.houseLocationType && (
            <UserReply onEdit={() => setStep(houseLocationStep)}>
              <strong>{answers.houseLocationType}</strong>
              <span>Perfeito. Isso ajuda a imaginar a cena.</span>
            </UserReply>
          )}

          {hasStageStep && (!hasHouseLocationStep || answers.houseLocationType) && answers.profile && (
            <AssistantStep number={stageStep} currentStep={step} summary={stepSummaries[stageStep]} onEdit={() => setStep(stageStep)} message="Qual e o estagio do imovel?">
              <ChipGrid>
                {stageOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.stage === option}
                    onClick={() => {
                      resetGenerationState()
                      setAnswers((current) => ({
                        ...current,
                        stage: option,
                        cta: '',
                      }))
                      setStep(locationStep)
                    }}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && hasStageStep && answers.stage && (
            <UserReply onEdit={() => setStep(stageStep)}>
              <strong>{answers.stage}</strong>
              <span>Perfeito. O clima do comercial fica mais claro.</span>
            </UserReply>
          )}

          {answers.objective && (isCapture || (answers.propertyType && (!hasProfileStep || answers.profile) && (!hasHouseLocationStep || answers.houseLocationType) && (!hasStageStep || answers.stage))) && (
            <AssistantStep
              number={locationStep}
              currentStep={step}
              summary={stepSummaries[locationStep]}
              onEdit={() => setStep(locationStep)}
              message={isCapture ? 'Em qual cidade deseja atuar?' : 'Qual e a UF, cidade e bairro do imovel?'}
            >
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">UF</p>
                  <ChipGrid className="mt-3">
                    {UF_OPTIONS.map((option) => (
                      <ChipButton
                        key={option}
                        active={answers.uf === option}
                        onClick={() => {
                          resetGenerationState()
                          setAnswers((current) => ({
                            ...current,
                            uf: option,
                            city: '',
                            cityOther: '',
                            district: '',
                            captureHasDistrict: '',
                            cta: '',
                            imageCount: 1,
                          }))
                        }}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </div>

                {answers.uf && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Cidade</p>
                    <ChipGrid className="mt-3">
                      {cityOptions.map((option) => (
                        <ChipButton
                          key={option}
                          active={answers.city === option}
                          onClick={() => {
                            resetGenerationState()
                            setAnswers((current) => ({
                              ...current,
                              city: option,
                              cityOther: '',
                              district: '',
                              captureHasDistrict: '',
                              cta: '',
                              imageCount: 1,
                            }))
                          }}
                        >
                          {option === OTHER_CITY_OPTION ? 'Outra cidade' : option}
                        </ChipButton>
                      ))}
                    </ChipGrid>
                  </div>
                )}

                {answers.city === OTHER_CITY_OPTION && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Nome da cidade</p>
                    <input
                      value={answers.cityOther}
                      onChange={(event) => {
                        resetGenerationState()
                        setAnswers((current) => ({ ...current, cityOther: formatDisplayText(event.target.value), district: '', captureHasDistrict: '', cta: '', imageCount: 1 }))
                      }}
                      placeholder="Digite a cidade"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                    />
                  </div>
                )}

                {cityValue && isCapture && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Deseja focar em algum bairro ou regiao?</p>
                    <ChipGrid className="mt-3">
                      <ChipButton
                        active={answers.captureHasDistrict === 'no'}
                        onClick={() => {
                          resetGenerationState()
                          setAnswers((current) => ({ ...current, captureHasDistrict: 'no', district: '', cta: '', imageCount: 1 }))
                        }}
                      >
                        Nao
                      </ChipButton>
                      <ChipButton
                        active={answers.captureHasDistrict === 'yes'}
                        onClick={() => {
                          resetGenerationState()
                          setAnswers((current) => ({ ...current, captureHasDistrict: 'yes', cta: '', imageCount: 1 }))
                        }}
                      >
                        Sim
                      </ChipButton>
                    </ChipGrid>
                  </div>
                )}

                {cityValue && (!isCapture || answers.captureHasDistrict === 'yes') && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{isCapture ? 'Bairro ou regiao' : 'Bairro'}</p>
                    <input
                      value={answers.district}
                      onChange={(event) => {
                        resetGenerationState()
                        setAnswers((current) => ({ ...current, district: formatDisplayText(event.target.value), cta: '', imageCount: 1 }))
                      }}
                      placeholder={isCapture ? 'Ex.: Moema, Zona Sul, Centro, Toda a cidade' : 'Digite o bairro'}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!answers.uf || !cityValue || (isCapture ? (!answers.captureHasDistrict || (answers.captureHasDistrict === 'yes' && !districtValue)) : !districtValue)}
                    onClick={() => setStep(isCapture ? captureTypeStep : differentialsStep)}
                  >
                    Confirmar localizacao
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {isCapture && cityValue && answers.captureHasDistrict && step >= captureTypeStep && (
            <AssistantStep
              number={captureTypeStep}
              currentStep={step}
              summary={stepSummaries[captureTypeStep]}
              onEdit={() => setStep(captureTypeStep)}
              message={isPropertyCapture ? 'Que tipo de imovel deseja captar?' : 'Qual profissional deseja atrair?'}
            >
              {isBrokerCapture && (
                <p className="mb-4 text-sm font-bold text-slate-500">
                  Vamos criar uma mensagem focada no profissional certo.
                </p>
              )}
              <ChipGrid>
                {propertyTypeOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.propertyType === option}
                    onClick={() => updatePropertyType(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && cityValue && districtValue && step >= differentialsStep && (
            <UserReply onEdit={() => setStep(locationStep)}>
              <strong>{normalizedLocation}</strong>
              <span>Localizacao normalizada para o comercial.</span>
            </UserReply>
          )}

          {(isCapture ? (cityValue && answers.captureHasDistrict) : (cityValue && districtValue)) && (!isCapture || answers.propertyType) && step >= differentialsStep && (
            <AssistantStep
              number={differentialsStep}
              currentStep={step}
              summary={stepSummaries[differentialsStep]}
              onEdit={() => setStep(differentialsStep)}
              message="Qual palavra de impacto deseja usar na abertura do comercial?"
            >
              <div className="space-y-4">
                <p className="text-sm font-black text-slate-600">Escolha uma palavra curta para criar o impacto inicial do vídeo.</p>
                <ChipGrid>
                  {differentialOptions.map((option) => {
                    const selected = answers.differentials.includes(option)
                    const maxSelections = MAX_DIFFERENTIALS
                    const disabled = maxSelections > 1 && !selected && answers.differentials.length >= maxSelections
                    return (
                      <ChipButton
                        key={option}
                        active={selected}
                        disabled={disabled}
                        onClick={() => toggleDifferential(option)}
                      >
                        {option}
                      </ChipButton>
                    )
                  })}
                </ChipGrid>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-500">
                    {answers.differentials.length}/{MAX_DIFFERENTIALS} selecionado
                  </span>
                  <Button
                    type="button"
                    disabled={answers.differentials.length === 0}
                    onClick={() => setStep(propertyFeaturesStep || ctaStep)}
                  >
                    Confirmar palavra
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {isBrokerCapture && answers.differentials.length > 0 && step >= benefitQuestionStep && (
            <AssistantStep
              number={benefitQuestionStep}
              currentStep={step}
              summary={stepSummaries[benefitQuestionStep]}
              onEdit={() => setStep(benefitQuestionStep)}
              message="Existe algum beneficio que voce gostaria de destacar para atrair novos corretores?"
            >
              <ChipGrid>
                <ChipButton active={answers.brokerHasBenefits === 'no'} onClick={() => updateBrokerHasBenefits('no')}>
                  Nao
                </ChipButton>
                <ChipButton active={answers.brokerHasBenefits === 'yes'} onClick={() => updateBrokerHasBenefits('yes')}>
                  Sim
                </ChipButton>
              </ChipGrid>
            </AssistantStep>
          )}

          {hasFreeAiPropertyFeaturesStep && answers.differentials.length > 0 && step >= propertyFeaturesStep && (
            <AssistantStep
              number={propertyFeaturesStep}
              currentStep={step}
              summary={stepSummaries[propertyFeaturesStep]}
              onEdit={() => setStep(propertyFeaturesStep)}
              message="Quais caracteristicas do imovel devemos considerar?"
            >
              <div className="space-y-5">
                <p className="text-sm font-bold text-slate-500">
                  Esses dados ajudam a narrativa do comercial sem inventar informacoes.
                </p>
                {isCommercialProperty ? (
                  <OptionGroup
                    title="Área útil (m²)"
                    options={AREA_OPTIONS}
                    value={answers.area}
                    onSelect={(value) => updatePropertyCharacteristic('area', value)}
                  />
                ) : (
                  <>
                    <OptionGroup
                      title="Dormitorios"
                      options={FREE_AI_BEDROOM_OPTIONS}
                      value={answers.bedrooms}
                      onSelect={(value) => updatePropertyCharacteristic('bedrooms', value)}
                    />
                    <OptionGroup
                      title="Suites"
                      options={FREE_AI_SUITE_OPTIONS}
                      value={answers.suites}
                      onSelect={(value) => updatePropertyCharacteristic('suites', value)}
                    />
                  </>
                )}
                <OptionGroup
                  title="Vagas"
                  options={FREE_AI_PARKING_OPTIONS}
                  value={answers.parking}
                  onSelect={(value) => updatePropertyCharacteristic('parking', value)}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!hasRequiredFreeAiPropertyFeatures}
                    onClick={() => setStep(ctaStep)}
                  >
                    Confirmar caracteristicas
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {isBrokerCapture && answers.brokerHasBenefits === 'yes' && step >= benefitDetailsStep && (
            <AssistantStep
              number={benefitDetailsStep}
              currentStep={step}
              summary={stepSummaries[benefitDetailsStep]}
              onEdit={() => setStep(benefitDetailsStep)}
              message="Quais beneficios vale a pena mostrar?"
            >
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Percentual de comissao</p>
                  <div className="mt-3 flex max-w-xs items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-primary-500">
                    <input
                      value={answers.brokerCommission}
                      onChange={(event) => updateBrokerCommission(event.target.value)}
                      placeholder="3"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                    />
                    <span className="ml-2 text-sm font-black text-slate-500">%</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Outros beneficios</p>
                  <ChipGrid className="mt-3">
                    {BROKER_BENEFIT_OPTIONS.map((option) => {
                      const selected = answers.brokerBenefits.includes(option)
                      const disabled = !selected && answers.brokerBenefits.length >= MAX_BROKER_BENEFITS
                      return (
                        <ChipButton
                          key={option}
                          active={selected}
                          disabled={disabled}
                          onClick={() => toggleBrokerBenefit(option)}
                        >
                          {option}
                        </ChipButton>
                      )
                    })}
                  </ChipGrid>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {answers.brokerBenefits.length}/{MAX_BROKER_BENEFITS} selecionados
                  </p>
                </div>

                {answers.brokerBenefits.includes('OUTRO') && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Qual outro beneficio?</p>
                    <input
                      value={answers.brokerBenefitOther}
                      onChange={(event) => {
                        resetGenerationState()
                        setAnswers((current) => ({ ...current, brokerBenefitOther: normalizeFreeText(event.target.value), cta: '', imageCount: 1 }))
                      }}
                      placeholder="DIGITE O BENEFICIO"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="button" onClick={() => setStep(ctaStep)}>
                    Continuar
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {false && answers.differentials.length > 0 && step >= ctaStep && (
            <UserReply onEdit={() => setStep(differentialsStep)}>
              <strong>{answers.differentials.join(', ')}</strong>
              <span>Esses dados orientam o tom visual, mas nao aparecem todos no video.</span>
            </UserReply>
          )}

          {answers.differentials.length > 0 && hasRequiredFreeAiPropertyFeatures && (!isBrokerCapture || answers.brokerHasBenefits) && step >= ctaStep && (
            <AssistantStep
              number={ctaStep}
              currentStep={step}
              summary={stepSummaries[ctaStep]}
              onEdit={() => setStep(ctaStep)}
              message={isCapture ? 'Como deseja encerrar este comercial?' : 'Qual chamada final deseja usar?'}
            >
              <ChipGrid>
                {ctaOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.cta === option}
                    onClick={() => updateCtaLabel(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.cta && (
            <UserReply onEdit={() => setStep(ctaStep)}>
              <strong>{answers.cta}</strong>
              <span>Essa sera a chamada final preparada pelo SmartCorretorAI.</span>
            </UserReply>
          )}

          {!isFreeAiMode && answers.cta && step >= furnishingStep && (
            <AssistantStep
              number={furnishingStep}
              currentStep={step}
              summary={stepSummaries[furnishingStep]}
              onEdit={() => setStep(furnishingStep)}
              eyebrow={isBrokerCapture ? 'Identidade da campanha' : undefined}
              message={isBrokerCapture ? 'Qual imagem você deseja utilizar para representar sua empresa?' : 'A imagem escolhida já possui mobiliário?'}
            >
              {isBrokerCapture && (
                <p className="mb-4 text-sm font-bold text-slate-500">
                  Escolha a imagem que melhor representa sua marca nesta campanha.
                </p>
              )}
              <ChipGrid>
                {(isBrokerCapture ? BROKER_CAMPAIGN_IMAGE_OPTIONS : FURNISHING_OPTIONS).map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.furnishingStatus === option}
                    onClick={() => updateFurnishingStatus(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {!isFreeAiMode && answers.furnishingStatus && step >= decorationStep && (
            <AssistantStep
              number={decorationStep}
              currentStep={step}
              summary={stepSummaries[decorationStep]}
              onEdit={() => setStep(decorationStep)}
              message={isBrokerCapture ? 'Deseja permitir ajustes visuais na imagem escolhida?' : 'Você quer permitir que a IA sugira decoração ou pequenos ajustes visuais na imagem?'}
            >
              <ChipGrid>
                {(isBrokerCapture ? BROKER_IMAGE_ADJUSTMENT_OPTIONS : DECORATION_POLICY_OPTIONS).map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.decorationPolicy === option}
                    onClick={() => updateDecorationPolicy(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isFreeAiMode && answers.cta && step >= visualStyleStep && (
            <AssistantStep
              number={visualStyleStep}
              currentStep={step}
              summary={stepSummaries[visualStyleStep]}
              onEdit={() => setStep(visualStyleStep)}
              message="Qual estilo visual voce imagina para este comercial?"
            >
              <ChipGrid>
                {FREE_AI_VISUAL_STYLE_OPTIONS.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.visualStyle === option}
                    onClick={() => updateFreeAiAnswer('visualStyle', option, atmosphereStep)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isFreeAiMode && answers.visualStyle && step >= atmosphereStep && (
            <AssistantStep
              number={atmosphereStep}
              currentStep={step}
              summary={stepSummaries[atmosphereStep]}
              onEdit={() => setStep(atmosphereStep)}
              message="Qual atmosfera combina melhor com este comercial?"
            >
              <ChipGrid>
                {FREE_AI_ATMOSPHERE_OPTIONS.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.atmosphere === option}
                    onClick={() => updateFreeAiAnswer('atmosphere', option, paceStep)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isFreeAiMode && answers.atmosphere && step >= paceStep && (
            <AssistantStep
              number={paceStep}
              currentStep={step}
              summary={stepSummaries[paceStep]}
              onEdit={() => setStep(paceStep)}
              message="Como voce imagina o ritmo deste comercial?"
            >
              <ChipGrid>
                {FREE_AI_PACE_OPTIONS.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.pace === option}
                    onClick={() => updateFreeAiAnswer('pace', option, creativeFreedomStep)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isFreeAiMode && answers.pace && step >= creativeFreedomStep && (
            <AssistantStep
              number={creativeFreedomStep}
              currentStep={step}
              summary={stepSummaries[creativeFreedomStep]}
              onEdit={() => setStep(creativeFreedomStep)}
              message="Qual nivel de liberdade criativa deseja permitir?"
            >
              <div className="space-y-4">
                <p className="text-sm font-bold text-slate-500">
                  Isso ajuda a definir quanto o comercial pode explorar cenas criadas pela IA.
                </p>
                <ChipGrid>
                  {FREE_AI_FREEDOM_OPTIONS.map((option) => (
                    <ChipButton
                      key={option}
                      active={answers.creativeFreedom === option}
                      onClick={() => updateFreeAiAnswer('creativeFreedom', option, uploadStep)}
                    >
                      {option}
                    </ChipButton>
                  ))}
                </ChipGrid>
              </div>
            </AssistantStep>
          )}

          {isFreeAiMode && answers.creativeFreedom && step >= uploadStep && (
            <AssistantStep
              number={uploadStep}
              currentStep={step}
              summary={stepSummaries[uploadStep]}
              onEdit={() => setStep(uploadStep)}
              message="Perfeito. O comercial livre ja esta preparado para a proxima etapa."
            >
              <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
                {isGenerating && !videoUrl ? (
                  <LoadingCard generationMessage={generationMessage} />
                ) : videoUrl ? (
                  <ResultPanel
                    videoUrl={videoUrl}
                    answers={answers}
                    cityValue={cityValue}
                    districtValue={districtValue}
                    onReset={resetFlow}
                  />
                ) : (
                  <StudioChecklist
                    answers={answers}
                    cityValue={cityValue}
                    districtValue={districtValue}
                    configuration={configuration}
                    files={files}
                    studioHeroAccess={studioHeroAccess}
                    canGenerate={canGenerate}
                    isGenerating={isGenerating}
                    status={status}
                    message={message}
                    generationMessage={generationMessage}
                    videoUrl={videoUrl}
                    propertyFeaturesSummary={propertyFeaturesSummary}
                    onEdit={setStep}
                    onEditImages={goToUploadStep}
                    onGenerate={handleGenerate}
                    mode="free_ai"
                  />
                )}
              </div>
            </AssistantStep>
          )}

          {!isFreeAiMode && answers.decorationPolicy && step >= uploadStep && (
            <AssistantStep
              number={uploadStep}
              currentStep={step}
              summary={stepSummaries[uploadStep]}
              onEdit={() => setStep(uploadStep)}
              message={isBrokerCapture ? 'Envie a imagem escolhida para representar sua empresa.' : 'Envie a melhor imagem do imóvel. O SmartCorretorAI adiciona automaticamente o encerramento profissional do vídeo.'}
            >
              <div ref={uploadSectionRef} className="space-y-5 scroll-mt-8">
                {isGenerating && !videoUrl ? (
                  <LoadingCard generationMessage={generationMessage} />
                ) : videoUrl ? (
                  <ResultPanel
                    videoUrl={videoUrl}
                    answers={answers}
                    cityValue={cityValue}
                    districtValue={districtValue}
                    onReset={resetFlow}
                  />
                ) : (
                  <>
                    {status === 'failed' && message && (
                      <ErrorCard message={message} imageErrorTarget={imageErrorTarget} onEditImages={goToUploadStep} />
                    )}
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-1">
                        {IMAGE_SLOTS.map((slot) => (
                          <FilePicker
                            key={slot.key}
                            slot={slot}
                            file={files[slot.key]}
                            error={imageErrorTarget === slot.key || imageErrorTarget === 'all'}
                            onChange={(file) => handleImageChange(slot.key, file)}
                          />
                        ))}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold leading-5 text-slate-500">
                        {isBrokerCapture
                          ? 'Escolha a imagem que melhor representa sua empresa nesta campanha. O encerramento profissional é aplicado automaticamente pelo SmartCorretorAI.'
                          : 'Escolha a foto que melhor representa o imóvel. Ela abre o comercial; o encerramento profissional é aplicado automaticamente pelo SmartCorretorAI.'}
                      </div>
                    </div>

                    <UploadReadyPanel
                      answers={answers}
                      cityValue={cityValue}
                      districtValue={districtValue}
                      files={files}
                      studioHeroAccess={studioHeroAccess}
                      canGenerate={canGenerate}
                      isGenerating={isGenerating}
                      onGenerate={handleGenerate}
                      onEdit={setStep}
                    />
                  </>
                )}
              </div>
            </AssistantStep>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFlow}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar conversa
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function MultiImageTourMode({ user, onBack }) {
  const studioHeroAccess = getStudioHeroAccess(user)
  const [answers, setAnswers] = useState({
    imageCount: 1,
  })
  const [files, setFiles] = useState({})
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0)

  const isGenerating = ['uploading', 'generating'].includes(status)
  const generationMessage = GENERATION_MESSAGES[generationMessageIndex % GENERATION_MESSAGES.length]
  const imageCount = 1
  const selectedSlots = MULTI_IMAGE_TOUR_IMAGE_SLOTS.slice(0, 1).map((slot) => ({
    ...slot,
    label: 'Sua imagem',
    helper: 'Escolha a foto que deseja transformar.',
  }))
  const selectedFiles = selectedSlots.map((slot) => files[slot.key]).filter(Boolean)
  const hasRequiredImages = selectedFiles.length === 1
  const canGenerate = studioHeroAccess.canGenerate && hasRequiredImages
  const progressPercent = Math.min(100, Math.max(20, Math.round((selectedFiles.length / imageCount) * 100)))

  useEffect(() => {
    if (!isGenerating) {
      setGenerationMessageIndex(0)
      return undefined
    }
    const timer = window.setInterval(() => {
      setGenerationMessageIndex((current) => (current + 1) % GENERATION_MESSAGES.length)
    }, 3200)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  const resetGeneration = () => {
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
  }

  const resetFlow = () => {
    resetGeneration()
    setAnswers({
      imageCount: 1,
    })
    setFiles({})
  }

  const updateFile = (slot, file) => {
    resetGeneration()
    setFiles((current) => ({ ...current, [slot.key]: file }))
  }

  const uploadTourImage = async (slot, file, jobDraftId) => {
    const contentType = getUploadContentType(file)

    if (!contentType) {
      throw new Error(`${slot.label}: Para este teste, envie imagens JPG ou PNG.`)
    }

    const extension = getFileExtensionFromContentType(contentType)
    const path = `${user.id}/${jobDraftId}/${slot.fileName}.${extension}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType,
        upsert: true,
      })

    if (error) {
      throw new Error(`Falha no upload de ${slot.label}. Para este teste, envie imagens JPG ou PNG.`)
    }

    return path
  }

  const handleGenerate = async () => {
    if (!user?.id || !canGenerate) return

    setStatus('uploading')
    setMessage('Preparando sua animação...')
    setVideoUrl('')

    try {
      const draftId = crypto.randomUUID()
      const imagePaths = []
      for (const slot of selectedSlots) {
        imagePaths.push(await uploadTourImage(slot, files[slot.key], draftId))
      }

      setStatus('generating')
      setMessage('Criando sua animação...')

      const payload = {
        mode: 'studio_hero_motion',
        variant: 'clean',
        includeTexts: false,
        imagePaths,
        jobId: draftId,
        fidelityMode: 'high_fidelity',
        movement: 'smooth cinematic camera movement',
        lighting: 'soft premium natural light',
        atmosphere: 'clean cinematic real estate atmosphere',
        rhythm: 'calm balanced motion',
        cinematicEffects: 'subtle depth reflections and light sweep',
      }

      logStudioHero('info', 'studio_hero_multi_image_payload_ready', {
        jobId: draftId,
        variant: payload.variant,
        imageCount: imagePaths.length,
      })

      const result = await invokeStudioFunction('criar-video-ia-multi', payload)
      const data = result.body

      if (!result.ok || (!data?.ok && !data?.success)) {
        throw new Error(data?.error || 'Não foi possível iniciar a animação.')
      }

      const nextVideoUrl = data.signedVideoUrl || data.signed_url || data.signedUrl || data.videoUrl || data.video_url || ''
      if (nextVideoUrl) {
        setVideoUrl(nextVideoUrl)
        setStatus('completed')
        setMessage(data.message || 'Sua imagem animada está pronta.')
        return
      }

      setStatus('planned')
      setMessage(data.message || 'Sua animação foi preparada para processamento.')
    } catch (error) {
      logStudioHero('error', 'studio_hero_multi_image_generate_error', {
        message: error instanceof Error ? error.message : String(error),
        error: sanitizeStudioHeroDiagnostic(error),
      })
      setStatus('failed')
      setMessage(error instanceof Error && /JPG|PNG|imagem/i.test(error.message)
        ? error.message
        : 'Não foi possível preparar esta animação neste ambiente. Tente novamente mais tarde.')
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7fb_44%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_52%,#075985_100%)] text-white shadow-2xl shadow-sky-950/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.22),transparent_32%),radial-gradient(circle_at_86%_24%,rgba(56,189,248,0.16),transparent_34%)]" />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-sky-100">
                <Film className="h-4 w-4" />
                Animar uma imagem
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Dê vida à sua melhor imagem.
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black leading-8 text-sky-50">
                Transforme uma foto em um vídeo curto com movimentos e efeitos visuais criados por nossa IA.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
              >
                <RotateCcw className="h-4 w-4" />
                Voltar aos modos
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-black text-white">Progresso</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-sky-200 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-sky-50">
                {selectedFiles.length ? 'Tudo pronto! Agora é só criar seu vídeo.' : 'Escolha sua imagem para começar.'}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-4">
            <section className="rounded-3xl border border-cyan-100 bg-white/95 p-4 shadow-sm sm:p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                  <ImagePlus className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-cyan-800">
                      1 imagem
                    </span>
                    <span className="text-xs font-bold text-slate-400">Imagem em movimento</span>
                  </div>
                  <h2 className="mt-2 text-xl font-black text-slate-950">Escolha a imagem que deseja transformar.</h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                    Quanto melhor a imagem, melhor será o resultado final. O vídeo terá 8 segundos, sem textos, sem música, sem narração, sem marca e sem chamada final.
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {selectedSlots.map((slot) => (
                      <FilePicker
                        key={slot.key}
                        slot={slot}
                        file={files[slot.key]}
                        onChange={(file) => updateFile(slot, file)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700">Resumo</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Animar uma imagem</h2>
              <div className="mt-4 grid gap-2">
                {[
                  ['Resultado', 'Imagem em movimento'],
                  ['Imagens', '1 imagem'],
                  ['Status', selectedFiles.length ? 'Tudo pronto! Agora é só criar seu vídeo.' : 'Pronto para criar'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>

              {hasRequiredImages && !studioHeroAccess.canGenerate && (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-sky-800">
                  Disponivel para assinantes ou usuarios com Smart Tokens suficientes.
                </div>
              )}

              {hasRequiredImages && (
                <Button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="mt-4 w-full justify-center py-4 text-base">
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando animação
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      Animar imagem
                    </>
                  )}
                </Button>
              )}
            </section>

            {isGenerating && <LoadingCard generationMessage={generationMessage} />}
            {status === 'failed' && (
              <ErrorCard message={message} imageErrorTarget={getImageErrorTarget(message)} onEditImages={() => {}} />
            )}
            {status === 'planned' && (
              <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5 text-sm font-semibold leading-6 text-sky-900 shadow-sm">
                <p className="text-base font-black text-sky-950">Animação preparada</p>
                <p className="mt-2">{message}</p>
              </section>
            )}
            {videoUrl && (
              <AnimationResultPanel videoUrl={videoUrl} onReset={resetFlow} />
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}

function AnimationPremiumMode({ user, onBack }) {
  const pollTimerRef = useRef(null)
  const studioHeroAccess = getStudioHeroAccess(user)
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({
    variant: '',
    purpose: '',
    status: '',
    location: '',
    uf: '',
    ufOther: '',
    bedrooms: '',
    suites: '',
    parking: '',
    area: '',
    cta: '',
    phone: '',
    imageCount: 0,
  })
  const [files, setFiles] = useState({})
  const [renderMeta, setRenderMeta] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0)

  const isGenerating = ['uploading', 'generating'].includes(status)
  const generationMessage = GENERATION_MESSAGES[generationMessageIndex % GENERATION_MESSAGES.length]
  const variant = ANIMATION_TEMPLATE_VARIANTS[answers.variant] || null
  const isWithTexts = answers.variant === 'with_texts'
  const imageCount = Number(answers.imageCount || 0)
  const uploadStep = isWithTexts ? 10 : 3
  const totalSteps = isWithTexts ? 10 : 3
  const progressPercent = Math.min(100, Math.max(10, Math.round((Math.min(step, uploadStep) / totalSteps) * 100)))
  const statusOptions = answers.purpose === 'Locacao' ? ANIMATION_RENT_STATUS_OPTIONS : ANIMATION_SALE_STATUS_OPTIONS
  const selectedSlots = ANIMATION_IMAGE_SLOTS.slice(0, imageCount || 0)
  const selectedFiles = selectedSlots.map((slot) => files[slot.key]).filter(Boolean)
  const hasRequiredImages = imageCount >= 1 && imageCount <= 4 && selectedFiles.length === imageCount
  const normalizedAnimationDistrict = normalizeAnimationDistrict(answers.location)
  const normalizedAnimationUf = normalizeAnimationUf(answers.uf === ANIMATION_OTHER_UF_OPTION ? answers.ufOther : answers.uf)
  const normalizedAnimationLocation = buildAnimationLocation(answers)
  const animationPropertyDetails = buildAnimationPropertyDetails(answers)
  const animationDescription = buildAnimationDescription(answers)
  const hasRequiredTextFields = !isWithTexts || Boolean(answers.purpose && answers.status && normalizedAnimationLocation && answers.cta)
  const canGenerate = studioHeroAccess.canGenerate && hasRequiredTextFields && hasRequiredImages
  const animationPreviewAnswers = {
    objective: answers.purpose === 'Locacao' ? 'rent' : 'sale',
    propertyType: 'Imovel',
    cta: answers.cta || 'Saiba Mais',
    differentials: answers.status ? [answers.status] : [],
    uf: '',
  }
  const stepSummaries = {
    1: variant?.label || '',
    2: isWithTexts ? answers.purpose : (imageCount ? `${imageCount} imagem${imageCount > 1 ? 's' : ''}` : ''),
    3: isWithTexts ? answers.status : (hasRequiredImages ? `${selectedFiles.length} imagem${selectedFiles.length > 1 ? 's' : ''}` : ''),
    4: normalizedAnimationDistrict,
    5: normalizedAnimationUf || '',
    6: animationPropertyDetails || 'Sem dados adicionais',
    7: answers.cta,
    8: answers.phone || 'Sem telefone',
    9: imageCount ? `${imageCount} imagem${imageCount > 1 ? 's' : ''}` : '',
    10: hasRequiredImages ? `${selectedFiles.length} imagem${selectedFiles.length > 1 ? 's' : ''}` : '',
  }

  const clearAnimationPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => clearAnimationPolling(), [])

  useEffect(() => {
    if (!isGenerating) {
      setGenerationMessageIndex(0)
      return undefined
    }
    const timer = window.setInterval(() => {
      setGenerationMessageIndex((current) => (current + 1) % GENERATION_MESSAGES.length)
    }, 3200)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  const resetAnimationGeneration = () => {
    clearAnimationPolling()
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
    setRenderMeta(null)
  }

  const resetAnimationFlow = () => {
    resetAnimationGeneration()
    setAnswers({
      variant: '',
      purpose: '',
      status: '',
      location: '',
      uf: '',
      ufOther: '',
      bedrooms: '',
      suites: '',
      parking: '',
      area: '',
      cta: '',
      phone: '',
      imageCount: 0,
    })
    setFiles({})
    setStep(1)
  }

  const updateAnimationAnswer = (field, value, nextStep) => {
    resetAnimationGeneration()
    setAnswers((current) => ({ ...current, [field]: value }))
    if (nextStep) setStep(nextStep)
  }

  const selectAnimationVariant = (nextVariant) => {
    resetAnimationGeneration()
    setFiles({})
    setAnswers({
      variant: nextVariant,
      purpose: '',
      status: '',
      location: '',
      uf: '',
      ufOther: '',
      bedrooms: '',
      suites: '',
      parking: '',
      area: '',
      cta: '',
      phone: '',
      imageCount: 0,
    })
    setStep(nextVariant === 'with_texts' ? 2 : 2)
  }

  const handleAnimationImageChange = (slotKey, file) => {
    resetAnimationGeneration()
    setFiles((current) => ({ ...current, [slotKey]: file }))
  }

  const uploadAnimationImage = async (slot, file, jobId) => {
    const contentType = getUploadContentType(file)
    if (!contentType) {
      throw new Error(`${slot.label}: Para este teste, envie imagens JPG ou PNG.`)
    }

    const extension = getFileExtensionFromContentType(contentType)
    const path = `${user.id}/${jobId}/animacao-premium/${slot.fileName}.${extension}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType,
        upsert: true,
      })

    if (error) {
      throw new Error(`Falha no upload de ${slot.label}. Para este teste, envie imagens JPG ou PNG.`)
    }

    return path
  }

  const pollAnimationRenderStatus = async (renderId, storedRender = renderMeta) => {
    if (!renderId) return
    try {
      const result = await invokeStudioFunction('get-render-status', {
        render_ids: [renderId],
        renders: storedRender ? [storedRender] : [],
      })
      const data = result.body
      if (!result.ok) throw new Error(data?.error || 'Falha ao consultar animacao.')
      const render = Array.isArray(data?.renders) ? data.renders[0] : null
      const renderStatus = normalizeAnimationRenderStatus(render?.status)
      const nextVideoUrl = getAnimationVideoUrl(render)
      logStudioHero('debug', 'studio_hero_animation_poll_response', {
        httpStatus: result.status,
        render: getSafeAnimationRenderLog(render),
      })

      if (ANIMATION_READY_STATUSES.has(renderStatus) && isAnimationMp4Url(nextVideoUrl)) {
        clearAnimationPolling()
        setVideoUrl(nextVideoUrl)
        setStatus('completed')
        setMessage('Sua animacao premium esta pronta.')
        setRenderMeta(render)
        return
      }

      if (ANIMATION_READY_STATUSES.has(renderStatus) && !isAnimationMp4Url(nextVideoUrl)) {
        clearAnimationPolling()
        setStatus('failed')
        setMessage('O render foi finalizado, mas o Creatomate nao retornou uma URL MP4 valida.')
        setRenderMeta(render)
        return
      }

      if (ANIMATION_FAILED_STATUSES.has(renderStatus)) {
        clearAnimationPolling()
        setStatus('failed')
        setMessage(render?.error_message || render?.erro || 'Nao foi possivel criar a animacao neste momento.')
        setRenderMeta(render)
        return
      }

      setStatus('generating')
      setMessage('Animacao em processamento...')
      setRenderMeta(render || storedRender)
      pollTimerRef.current = setTimeout(() => pollAnimationRenderStatus(renderId, render || storedRender), 7000)
    } catch (error) {
      clearAnimationPolling()
      logStudioHero('error', 'studio_hero_animation_status_error', {
        renderId,
        message: error instanceof Error ? error.message : String(error),
      })
      setStatus('failed')
      setMessage('Nao foi possivel acompanhar a animacao neste momento.')
    }
  }

  const handleGenerateAnimation = async () => {
    if (!user?.id || !canGenerate || !variant) return

    clearAnimationPolling()
    setStatus('uploading')
    setMessage('Enviando imagens...')
    setVideoUrl('')

    try {
      const jobId = crypto.randomUUID()
      const imagePaths = []
      for (const slot of selectedSlots) {
        const file = files[slot.key]
        if (!file) throw new Error(`${slot.label}: selecione a imagem antes de gerar.`)
        imagePaths.push(await uploadAnimationImage(slot, file, jobId))
      }

      setStatus('generating')
      setMessage('Criando animacao premium...')

      const result = await invokeStudioFunction('criar-animacao-premium', {
        mode: 'animation_premium',
        jobId,
        variant: answers.variant,
        imageCount,
        imagePaths,
        fields: isWithTexts
          ? {
            finalidade: answers.purpose,
            status: answers.status,
            localizacao: normalizedAnimationLocation,
            description: animationDescription,
            dormitorios: answers.bedrooms,
            bedrooms: answers.bedrooms,
            suites: answers.suites,
            vagas: answers.parking,
            parking: answers.parking,
            area: answers.area,
            cta: answers.cta,
            telefone: answers.phone,
          }
          : {},
      })
      const data = result.body
      logStudioHero('debug', 'studio_hero_animation_function_response', {
        httpStatus: result.status,
        ok: result.ok,
        body: getSafeAnimationRenderLog(data),
      })
      if (!result.ok || (!data?.ok && !data?.success)) {
        throw new Error(data?.error || 'Falha ao iniciar animacao.')
      }

      const renderId = data.render_id || data.renderId
      if (!renderId) throw new Error('Creatomate nao retornou render_id.')
      const nextRenderMeta = {
        render_id: renderId,
        template_id: data.template_id || null,
        template_nome: variant.title,
        status: data.status || 'planned',
      }
      setRenderMeta(nextRenderMeta)

      const initialStatus = normalizeAnimationRenderStatus(data.status)
      const initialVideoUrl = getAnimationVideoUrl(data)
      if (ANIMATION_READY_STATUSES.has(initialStatus) && isAnimationMp4Url(initialVideoUrl)) {
        setVideoUrl(initialVideoUrl)
        setStatus('completed')
        setMessage('Sua animacao premium esta pronta.')
        return
      }

      setMessage('Animacao em processamento...')
      pollTimerRef.current = setTimeout(() => pollAnimationRenderStatus(renderId, nextRenderMeta), 7000)
    } catch (error) {
      logStudioHero('error', 'studio_hero_animation_generate_error', {
        message: error instanceof Error ? error.message : String(error),
      })
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a animacao neste momento.')
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_46%,#eef7fb_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#064e3b_0%,#0f172a_52%,#047857_100%)] text-white shadow-2xl shadow-emerald-950/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(110,231,183,0.24),transparent_30%),radial-gradient(circle_at_84%_28%,rgba(52,211,153,0.18),transparent_34%)]" />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-100">
                <ImagePlus className="h-4 w-4" />
                Animacao Premium
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Transforme fotos em videos animados.
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black text-white">
                Transforme suas fotos em videos animados profissionais para divulgar seus imoveis.
              </p>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200">
                Escolha uma versao com informacoes na tela ou uma versao clean, destacando apenas a beleza das imagens.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-6 rounded-2xl border border-white/15 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-white/10"
              >
                Escolher outro tipo de criacao
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-200" />
                <p className="font-black">Como vamos conduzir?</p>
              </div>
              <ul className="mt-5 space-y-4 text-sm font-bold leading-6 text-slate-100">
                {STUDIO_GUIDE_ITEMS_BY_MODE.smart_carousel.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-5 pb-12">
          <div className="rounded-3xl border border-emerald-100 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Animacao Premium</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Voce pode animar de 1 a 4 imagens por geracao.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                <ImagePlus className="h-4 w-4" />
                {progressPercent}%
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary-700 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <AssistantStep
            number={1}
            currentStep={step}
            summary={stepSummaries[1]}
            onEdit={() => setStep(1)}
            message="Voce quer animar e melhorar suas imagens para divulgacao com inclusao de textos no video ou sem textos?"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {ANIMATION_VARIANT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectAnimationVariant(option.id)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    answers.variant === option.id
                      ? 'border-emerald-600 bg-emerald-950 text-white shadow-lg shadow-emerald-100'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                  }`}
                >
                  <div className="mx-auto max-w-[160px] rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-lg shadow-slate-200/70">
                    <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.35rem] bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_52%,#047857_100%)]">
                      <div className="relative px-3 text-center text-white">
                        <PlayCircle className="mx-auto h-8 w-8 opacity-90" />
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{option.title}</p>
                      </div>
                    </div>
                  </div>
                  <p className={`mt-4 text-base font-black ${answers.variant === option.id ? 'text-white' : 'text-slate-950'}`}>{option.title}</p>
                  <p className={`mt-2 text-sm font-semibold leading-6 ${answers.variant === option.id ? 'text-emerald-100' : 'text-slate-500'}`}>{option.description}</p>
                </button>
              ))}
            </div>
          </AssistantStep>

          {isWithTexts && step >= 2 && (
            <AssistantStep number={2} currentStep={step} summary={stepSummaries[2]} onEdit={() => setStep(2)} message="Qual e a finalidade?">
              <ChipGrid>
                {ANIMATION_PURPOSE_OPTIONS.map((option) => (
                  <ChipButton key={option} active={answers.purpose === option} onClick={() => updateAnimationAnswer('purpose', option, 3)}>
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isWithTexts && answers.purpose && step >= 3 && (
            <AssistantStep number={3} currentStep={step} summary={stepSummaries[3]} onEdit={() => setStep(3)} message="Qual status deve aparecer no video?">
              <ChipGrid>
                {statusOptions.map((option) => (
                  <ChipButton key={option} active={answers.status === option} onClick={() => updateAnimationAnswer('status', option, 4)}>
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isWithTexts && answers.status && step >= 4 && (
            <AssistantStep number={4} currentStep={step} summary={stepSummaries[4]} onEdit={() => setStep(4)} message="Qual bairro deve aparecer no video?">
              <div className="space-y-3">
                <input
                  value={answers.location}
                  onChange={(event) => updateAnimationAnswer('location', cleanAnimationLocationInput(event.target.value), null)}
                  placeholder="Ex.: Moema"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!normalizedAnimationDistrict}
                    onClick={() => {
                      resetAnimationGeneration()
                      setAnswers((current) => ({
                        ...current,
                        location: normalizedAnimationDistrict,
                        uf: '',
                        ufOther: '',
                        cta: '',
                        phone: '',
                        imageCount: 0,
                      }))
                      setStep(5)
                    }}
                  >
                    Confirmar bairro
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {isWithTexts && answers.location && step >= 5 && (
            <AssistantStep number={5} currentStep={step} summary={stepSummaries[5]} onEdit={() => setStep(5)} message="Qual estado/UF?">
              <div className="space-y-4">
                <ChipGrid>
                  {ANIMATION_UF_OPTIONS.map((option) => (
                    <ChipButton
                      key={option}
                      active={answers.uf === option}
                      onClick={() => {
                        resetAnimationGeneration()
                        setAnswers((current) => ({
                          ...current,
                          uf: option,
                          ufOther: option === ANIMATION_OTHER_UF_OPTION ? '' : current.ufOther,
                        }))
                        if (option !== ANIMATION_OTHER_UF_OPTION) setStep(6)
                      }}
                    >
                      {option === ANIMATION_OTHER_UF_OPTION ? 'Outro' : option}
                    </ChipButton>
                  ))}
                </ChipGrid>
                {answers.uf === ANIMATION_OTHER_UF_OPTION && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={answers.ufOther}
                      onChange={(event) => updateAnimationAnswer('ufOther', normalizeAnimationUf(event.target.value), null)}
                      placeholder="UF"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold uppercase outline-none focus:border-primary-500 sm:max-w-[140px]"
                    />
                    <Button type="button" disabled={!normalizedAnimationUf} onClick={() => setStep(6)}>
                      Confirmar UF
                    </Button>
                  </div>
                )}
                {normalizedAnimationLocation && (
                  <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
                    {normalizedAnimationLocation}
                  </p>
                )}
              </div>
            </AssistantStep>
          )}

          {isWithTexts && normalizedAnimationLocation && step >= 6 && (
            <AssistantStep number={6} currentStep={step} summary={stepSummaries[6]} onEdit={() => setStep(6)} message="Deseja incluir dados do imovel?">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {ANIMATION_FEATURE_FIELDS.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">{field.label}</span>
                      <input
                        value={answers[field.key]}
                        onChange={(event) => updateAnimationAnswer(field.key, cleanAnimationNumber(event.target.value), null)}
                        placeholder={field.placeholder}
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                      />
                    </label>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Description</p>
                  <p className="mt-1 whitespace-pre-line text-sm font-black leading-6 text-slate-950">{animationDescription || 'A descricao sera montada com a localizacao e os dados disponiveis.'}</p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setStep(7)}>
                    Continuar
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {isWithTexts && normalizedAnimationLocation && step >= 7 && (
            <AssistantStep number={7} currentStep={step} summary={stepSummaries[7]} onEdit={() => setStep(7)} message="Qual chamada final deseja usar?">
              <ChipGrid>
                {ANIMATION_CTA_OPTIONS.map((option) => (
                  <ChipButton key={option} active={answers.cta === option} onClick={() => updateAnimationAnswer('cta', option, 8)}>
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {isWithTexts && answers.cta && step >= 8 && (
            <AssistantStep number={8} currentStep={step} summary={stepSummaries[8]} onEdit={() => setStep(8)} message="Deseja incluir telefone?">
              <div className="space-y-3">
                <input
                  value={answers.phone}
                  onChange={(event) => updateAnimationAnswer('phone', formatAnimationPhone(event.target.value), null)}
                  placeholder="Opcional"
                  inputMode="tel"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => updateAnimationAnswer('phone', '', 9)}>
                    Continuar sem telefone
                  </Button>
                  <Button type="button" onClick={() => setStep(9)}>
                    Confirmar telefone
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {answers.variant === 'clean' && step >= 2 && (
            <AssistantStep number={2} currentStep={step} summary={stepSummaries[2]} onEdit={() => setStep(2)} message="Quantas imagens voce quer animar nesta geracao?">
              <div className="space-y-4">
                <p className="text-sm font-bold leading-6 text-slate-500">
                  Vou criar uma animacao clean, valorizando suas imagens com movimentos profissionais, sem adicionar textos na tela.
                </p>
                <ChipGrid>
                  {ANIMATION_IMAGE_COUNT_OPTIONS.map((count) => (
                    <ChipButton key={count} active={imageCount === count} onClick={() => updateAnimationAnswer('imageCount', count, 3)}>
                      {count} imagem{count > 1 ? 's' : ''}
                    </ChipButton>
                  ))}
                </ChipGrid>
              </div>
            </AssistantStep>
          )}

          {isWithTexts && answers.cta && step >= 9 && (
            <AssistantStep number={9} currentStep={step} summary={stepSummaries[9]} onEdit={() => setStep(9)} message="Quantas imagens voce quer animar nesta geracao?">
              <ChipGrid>
                {ANIMATION_IMAGE_COUNT_OPTIONS.map((count) => (
                  <ChipButton key={count} active={imageCount === count} onClick={() => updateAnimationAnswer('imageCount', count, 10)}>
                    {count} imagem{count > 1 ? 's' : ''}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {imageCount > 0 && step >= uploadStep && (
            <AssistantStep number={uploadStep} currentStep={step} summary={stepSummaries[uploadStep]} onEdit={() => setStep(uploadStep)} message="Envie as imagens que deseja animar.">
              <div className="space-y-5">
                {isGenerating && !videoUrl ? (
                  <LoadingCard generationMessage={generationMessage} />
                ) : videoUrl ? (
                  <AnimationResultPanel videoUrl={videoUrl} onReset={resetAnimationFlow} />
                ) : (
                  <>
                    {status === 'failed' && message && (
                      <ErrorCard message={message} imageErrorTarget="all" onEditImages={() => setStep(uploadStep)} />
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      {selectedSlots.map((slot) => (
                        <FilePicker
                          key={slot.key}
                          slot={slot}
                          file={files[slot.key]}
                          onChange={(file) => handleAnimationImageChange(slot.key, file)}
                        />
                      ))}
                    </div>
                    <AnimationReadyPanel
                      variant={variant}
                      answers={answers}
                      selectedCount={selectedFiles.length}
                      requiredCount={imageCount}
                      canGenerate={canGenerate}
                      isGenerating={isGenerating}
                      studioHeroAccess={studioHeroAccess}
                      onGenerate={handleGenerateAnimation}
                    />
                  </>
                )}
              </div>
            </AssistantStep>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetAnimationFlow}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar conversa
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function AnimationReadyPanel({ variant, answers, selectedCount, requiredCount, canGenerate, isGenerating, studioHeroAccess, onGenerate }) {
  const ready = selectedCount === requiredCount
  const animationDescription = buildAnimationDescription(answers)
  const summaryItems = [
    ['Versao', variant?.title || 'Pendente'],
    ['Imagens', `${selectedCount}/${requiredCount || 0}`],
    ...(answers.variant === 'with_texts'
      ? [
        ['Status', answers.status],
        ['Description', animationDescription],
        ['CTA', [answers.cta, answers.phone].filter(Boolean).join(' - ')],
      ]
      : [['Textos', 'Sem textos']]),
  ]

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {ready ? 'Tudo pronto para animar.' : `Envie ${requiredCount} imagem${requiredCount > 1 ? 's' : ''}.`}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            O Creatomate usa os elementos Video-1, Video-2, Video-3 e Video-4 conforme as imagens enviadas.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
          {selectedCount}/{requiredCount || 0} imagens
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {summaryItems.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 line-clamp-2 text-xs font-black leading-relaxed text-slate-950">{value || 'Pendente'}</p>
          </div>
        ))}
      </div>

      {ready && !studioHeroAccess?.canGenerate && (
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
          Disponivel para assinantes ou usuarios com Smart Tokens suficientes.
        </div>
      )}

      {ready && (
        <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="mt-4 w-full justify-center py-4 text-base">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Criando animacao
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Gerar video animado
            </>
          )}
        </Button>
      )}
    </div>
  )
}

function AnimationResultPanel({ videoUrl, onReset }) {
  const hasPlayableVideo = isAnimationMp4Url(videoUrl)
  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-xl shadow-emerald-100/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Resultado</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Sua animacao premium esta pronta</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Voce recebeu um video animado pronto para divulgar.
          </p>
        </div>
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
      </div>
      <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-2xl shadow-slate-200/70">
        <div className="mx-auto flex aspect-[9/16] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-100">
          {hasPlayableVideo ? (
            <video id="studio-hero-animation-video" src={videoUrl} controls className="h-full w-full object-contain" />
          ) : (
            <div className="px-6 text-center">
              <p className="text-sm font-black text-slate-950">Video final ainda indisponivel.</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                Aguarde o processamento retornar uma URL MP4 valida.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => {
            const playResult = document.getElementById('studio-hero-animation-video')?.play?.()
            if (playResult?.catch) playResult.catch(() => {})
          }}
          disabled={!hasPlayableVideo}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-900"
        >
          <PlayCircle className="h-4 w-4" />
          Assistir
        </button>
        {hasPlayableVideo ? (
          <a
            href={videoUrl}
            download="studio-hero-animacao-premium.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-800"
          >
            <Download className="h-4 w-4" />
            Baixar
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-500">
            <Download className="h-4 w-4" />
            Baixar
          </span>
        )}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" />
          Criar nova versao
        </button>
      </div>
    </section>
  )
}

function StudioPossibilitiesShowcase() {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-100 bg-white p-5 shadow-xl shadow-cyan-100/50 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">Possibilidades Studio Hero</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            ✨ Descubra o que você pode criar
          </h2>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
            Cada conversa com a IA gera um resultado único.
          </p>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
            Escolha um objetivo e veja algumas das possibilidades que o Studio Hero pode criar para você.
          </p>
          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
            <p className="text-sm font-black text-cyan-950">Nenhum vídeo é igual ao outro.</p>
            <p className="mt-2 text-xs font-bold leading-5 text-cyan-900">
              Cada criação é gerada exclusivamente a partir da conversa realizada com a IA.
            </p>
            <p className="mt-4 text-sm font-black text-cyan-950">✨ Cada campanha é única.</p>
            <p className="mt-2 text-xs font-bold leading-5 text-cyan-900">
              A IA cria uma nova campanha a cada geração. As imagens são ilustrativas, criadas para chamar a atenção e representar o conceito da campanha, podendo ser diferentes do imóvel real.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {STUDIO_POSSIBILITY_EXAMPLES.map((example, index) => (
            <article key={example.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
              <div className="rounded-[1.6rem] border border-slate-200 bg-slate-950 p-2 shadow-lg shadow-slate-200/70">
                <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.15rem] bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_52%,#0e7490_100%)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(103,232,249,0.22),transparent_36%)]" />
                  <div className="relative px-4 text-center text-white">
                    <PlayCircle className="mx-auto h-9 w-9 opacity-90" />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                      Espaço para vídeo
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-1 pb-1 pt-4">
                <p className="text-xs font-black uppercase tracking-wide text-primary-700">Exemplo {index + 1}</p>
                <h3 className="mt-2 text-base font-black leading-tight text-slate-950">{example.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{example.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function AssistantStep({ number, currentStep, summary, onEdit, message, eyebrow = 'Direcao criativa', children }) {
  if (number > currentStep) return null

  const answered = Boolean(summary) && number < currentStep
  const active = number === currentStep || !answered

  if (answered) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50/70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-950">{summary}</span>
            <span className="block text-[11px] font-black uppercase tracking-wide text-slate-400">Etapa {number}</span>
          </span>
        </span>
        <Pencil className="h-4 w-4 shrink-0 text-cyan-700" />
      </button>
    )
  }

  return (
    <section className="rounded-3xl border border-cyan-100 bg-white/95 p-4 shadow-sm transition duration-300 ease-out animate-in fade-in slide-in-from-bottom-2 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-cyan-800">
              Etapa {number}
            </span>
            <span className="text-xs font-bold text-slate-400">{eyebrow}</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            <TypewriterText text={message} active={active} />
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{getAssistantHint(number)}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function UserReply({ children, onEdit }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="max-w-xl rounded-3xl border border-cyan-100 bg-cyan-50/90 px-4 py-3 text-left text-primary-950 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
      >
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {children}
          <span className="mt-1 text-xs font-black uppercase tracking-wide text-cyan-700">Editar resposta</span>
        </div>
      </button>
    </div>
  )
}

function OptionGrid({ children, className = '' }) {
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${className}`}>
      {children}
    </div>
  )
}

function ChipGrid({ children, className = '' }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>
}

function ChoiceButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-cyan-700 bg-primary-950 text-white shadow-lg shadow-cyan-100' : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
      }`}
    >
      <p className={`text-sm font-black ${active ? 'text-white' : 'text-slate-950'}`}>{title}</p>
      <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-slate-200' : 'text-slate-500'}`}>{description}</p>
    </button>
  )
}

function ChipButton({ active, disabled = false, children, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-cyan-700 bg-primary-950 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50'
      }`}
    >
      {children}
    </button>
  )
}

function OptionGroup({ title, options, value, onSelect }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ChipGrid className="mt-3">
        {options.map((option) => (
          <ChipButton
            key={option}
            active={value === option}
            onClick={() => onSelect(option)}
          >
            {option}
          </ChipButton>
        ))}
      </ChipGrid>
    </div>
  )
}

function FilePicker({ slot, file, error = false, onChange }) {
  return (
    <label
      className={`group flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed p-4 shadow-sm transition ${
        error
          ? 'border-red-300 bg-red-50 hover:border-red-400'
          : 'border-primary-200 bg-white hover:border-primary-400 hover:bg-primary-50/40'
      }`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={(event) => {
          event.currentTarget.blur()
          onChange(event.target.files?.[0] || null)
        }}
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-950">{slot.label}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{slot.helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-950 text-cyan-100">
          <ImagePlus className="h-5 w-5" />
        </div>
      </div>
      <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-52 lg:h-56 2xl:h-64">
        {file ? (
          <img
            src={URL.createObjectURL(file)}
            alt={`${slot.label} selecionada`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <UploadCloud className="h-8 w-8" />
            <span className="text-xs font-bold">Selecionar imagem</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="min-h-4 truncate text-xs font-bold text-slate-500">{file?.name || ' '}</p>
        {file && (
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">
            Clique no card para trocar a imagem
          </p>
        )}
        {error && (
          <p className="text-xs font-black text-red-600">
            Revise esta imagem. Para este teste, use JPG ou PNG.
          </p>
        )}
      </div>
    </label>
  )
}

function UploadReadyPanel({
  answers,
  cityValue,
  districtValue,
  files,
  studioHeroAccess,
  canGenerate,
  isGenerating,
  onGenerate,
}) {
  const selectedCount = IMAGE_SLOTS.filter((slot) => files[slot.key]).length
  const ready = selectedCount === IMAGE_SLOTS.length
  const displayLocation = getDisplayLocation({
    district: districtValue,
    city: cityValue,
    uf: answers.uf,
    isCapture: isCaptureObjective(answers.objective),
  })
  const summaryItems = [
    ['Localizacao', displayLocation],
    ['Abertura', answers.differentials[0] || getCommercialImpactWord(answers)],
    ['Encerramento', answers.cta],
  ]

  return (
    <div className="rounded-3xl border border-cyan-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {ready ? 'Tudo pronto para criar.' : 'Envie a melhor imagem do imovel.'}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {ready
              ? 'Revise a imagem e crie o comercial quando estiver tudo certo.'
              : 'A foto escolhida abre o comercial. O encerramento profissional entra automaticamente no final.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {IMAGE_SLOTS.map((slot) => {
            const selected = Boolean(files[slot.key])
            return (
              <span
                key={slot.key}
                className={`rounded-full border px-3 py-1.5 text-xs font-black ${selected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
              >
                {slot.label}: {selected ? 'OK' : 'pendente'}
              </span>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {summaryItems.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 line-clamp-2 text-xs font-black leading-relaxed text-slate-950">{value || 'Pendente'}</p>
              </div>
            ))}
      </div>

      <p className="mt-3 text-xs font-bold text-slate-500">
        {selectedCount}/{IMAGE_SLOTS.length} imagem selecionada.
      </p>

      {ready && (
        <>
          {!studioHeroAccess?.canGenerate && (
            <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold leading-6 text-primary-800">
              Disponivel para assinantes ou usuarios com Smart Tokens suficientes. Veja exemplos e ative quando quiser.
            </div>
          )}

          <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="mt-4 w-full justify-center py-4 text-base">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando comercial
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Criar comercial
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}

function TypewriterText({ text, active }) {
  const [visibleText, setVisibleText] = useState(active ? '' : text)
  const [showCursor, setShowCursor] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisibleText(text)
      setShowCursor(false)
      return undefined
    }

    let index = 0
    let intervalId = null
    let finalTimerId = null
    setVisibleText('')
    setShowCursor(true)

    const startTimerId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1
        setVisibleText(text.slice(0, index))
        if (index >= text.length) {
          window.clearInterval(intervalId)
          finalTimerId = window.setTimeout(() => setShowCursor(false), TYPEWRITER_FINAL_CURSOR_MS)
        }
      }, TYPEWRITER_CHAR_DELAY_MS)
    }, TYPEWRITER_INITIAL_DELAY_MS)

    return () => {
      window.clearTimeout(startTimerId)
      if (intervalId) window.clearInterval(intervalId)
      if (finalTimerId) window.clearTimeout(finalTimerId)
    }
  }, [active, text])

  return (
    <>
      {visibleText}
      {showCursor && <span className="ml-1 inline-block h-5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-cyan-700" />}
    </>
  )
}

function StudioChecklist({ answers, cityValue, districtValue, configuration, files, studioHeroAccess, canGenerate, isGenerating, status, message, generationMessage, videoUrl, propertyFeaturesSummary = '', onEdit, onEditImages, onGenerate, mode = 'cinematic' }) {
  const isSale = answers.objective === 'sale'
  const isFreeAiMode = mode === 'free_ai'
  const isPropertyCampaign = isPropertyCampaignObjective(answers.objective)
  const isCapture = isCaptureObjective(answers.objective)
  const isPropertyCapture = answers.objective === 'property_capture'
  const isBrokerCapture = answers.objective === 'broker_capture'
  const hasProfileStep = isPropertyCampaign && isResidentialType(answers.propertyType)
  const hasHouseLocationStep = isPropertyCampaign && answers.propertyType === 'CASA'
  const hasStageStep = false
  const hasFreeAiPropertyFeaturesStep = isFreeAiMode && isPropertyCampaign
  const profileStep = 3
  const houseLocationStep = profileStep + (hasProfileStep ? 1 : 0)
  const stageStep = houseLocationStep + (hasHouseLocationStep ? 1 : 0)
  const locationStep = isCapture ? 2 : stageStep + (hasStageStep ? 1 : 0)
  const captureTypeStep = isCapture ? 3 : null
  const differentialsStep = isCapture ? 4 : locationStep + 1
  const benefitQuestionStep = isBrokerCapture ? differentialsStep + 1 : null
  const benefitDetailsStep = isBrokerCapture && answers.brokerHasBenefits === 'yes' ? benefitQuestionStep + 1 : null
  const propertyFeaturesStep = hasFreeAiPropertyFeaturesStep ? differentialsStep + 1 : null
  const ctaStep = isBrokerCapture
    ? benefitQuestionStep + (answers.brokerHasBenefits === 'yes' ? 2 : 1)
    : differentialsStep + (hasFreeAiPropertyFeaturesStep ? 2 : 1)
  const furnishingStep = isFreeAiMode ? null : ctaStep + 1
  const decorationStep = isFreeAiMode ? null : ctaStep + 2
  const visualStyleStep = isFreeAiMode ? ctaStep + 1 : null
  const atmosphereStep = isFreeAiMode ? ctaStep + 2 : null
  const paceStep = isFreeAiMode ? ctaStep + 3 : null
  const creativeFreedomStep = isFreeAiMode ? ctaStep + 4 : null
  const imageCountStep = null
  const uploadStep = isFreeAiMode ? ctaStep + 5 : ctaStep + 3
  const imageErrorTarget = getImageErrorTarget(message)
  const displayLocation = getDisplayLocation({ district: districtValue, city: cityValue, uf: answers.uf, isCapture })
  const visibleTextPreview = [
    ['Localizacao', displayLocation],
    ['Abertura', answers.differentials[0] || getCommercialImpactWord(answers)],
    ['Encerramento', answers.cta],
  ]
  const rows = [
    ['Objetivo', getObjectiveSummaryLabel(answers.objective), 1],
    ...(isPropertyCampaign ? [[isCommercialType(answers.propertyType) ? 'Tipo comercial' : 'Imovel', answers.propertyType, 2]] : []),
    ...(isPropertyCapture ? [['Tipo desejado', answers.propertyType, captureTypeStep]] : []),
    ...(isBrokerCapture ? [['Profissional', answers.propertyType, captureTypeStep]] : []),
    ...(hasProfileStep ? [['Perfil', answers.profile, profileStep]] : []),
    ...(hasHouseLocationStep ? [['Localizacao da casa', answers.houseLocationType, houseLocationStep]] : []),
    ...(hasStageStep ? [['Estagio', answers.stage, stageStep]] : []),
    [isCapture ? 'Area de atuacao' : 'Localizacao', displayLocation, locationStep],
    ['Abertura', answers.differentials.join(', '), differentialsStep],
    ...(isBrokerCapture ? [['Beneficios', answers.brokerHasBenefits === 'yes' ? 'Sim' : answers.brokerHasBenefits === 'no' ? 'Nao' : '', benefitQuestionStep]] : []),
    ...(isBrokerCapture && answers.brokerHasBenefits === 'yes' && answers.brokerCommission ? [['Comissao', `${answers.brokerCommission}%`, benefitDetailsStep]] : []),
    ...(isBrokerCapture && answers.brokerHasBenefits === 'yes' && (answers.brokerBenefits.length > 0 || answers.brokerBenefitOther)
      ? [['Beneficios destacados', [
        ...answers.brokerBenefits.filter((item) => item !== 'OUTRO'),
        answers.brokerBenefitOther,
      ].filter(Boolean).join(', '), benefitDetailsStep]]
      : []),
    ...(hasFreeAiPropertyFeaturesStep ? [['Caracteristicas', propertyFeaturesSummary, propertyFeaturesStep]] : []),
    ['Encerramento', answers.cta, ctaStep],
    ...(isFreeAiMode ? [
      ['Modo', 'Criacao livre com IA', uploadStep],
      ['Estilo visual', answers.visualStyle, visualStyleStep],
      ['Atmosfera', answers.atmosphere, atmosphereStep],
      ['Ritmo', answers.pace, paceStep],
      ['Liberdade criativa', answers.creativeFreedom, creativeFreedomStep],
    ] : [
      [isBrokerCapture ? 'Imagem da campanha' : 'Mobiliário', answers.furnishingStatus, furnishingStep],
      [isBrokerCapture ? 'Ajustes visuais' : 'Ambientação', answers.decorationPolicy, decorationStep],
      [isBrokerCapture ? 'Imagem da campanha' : 'Imagem do imóvel', files.image1?.name, uploadStep],
    ]),
  ].filter((row) => row[2])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfeff_100%)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {videoUrl ? 'Comercial criado com sucesso.' : 'Seu comercial sera criado com:'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {videoUrl
              ? 'Voce recebeu video, download e textos prontos para divulgar.'
              : isFreeAiMode
                ? 'Tudo pronto. Revise suas escolhas e crie o comercial livre quando estiver tudo certo.'
                : 'Tudo pronto. Revise sua imagem e crie o comercial quando estiver tudo certo.'}
          </p>
          <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-slate-500">
            {isFreeAiMode
              ? 'Este modo usa a conversa para imaginar o comercial sem depender de imagens enviadas.'
              : 'Cada comercial e criado de forma unica. Novas versoes podem apresentar cenas, movimentos e resultados diferentes.'}
          </p>
        </div>
      </div>

      {status === 'failed' && message && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{message}</span>
          {imageErrorTarget && (
            <Button type="button" variant="secondary" onClick={onEditImages}>
              Voltar para imagens
            </Button>
          )}
        </div>
      )}

      {!videoUrl && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-primary-800">Textos conceituais do comercial</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {visibleTextPreview.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/70 bg-white px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-primary-900">
            O encerramento final e controlado pelo SmartCorretorAI para manter consistencia de campanha.
          </p>
        </div>
      )}

      {!isFreeAiMode && !studioHeroAccess?.canGenerate && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold leading-6 text-primary-800">
          Disponivel para assinantes ou usuarios com Smart Tokens suficientes. Veja exemplos e ative quando quiser.
        </div>
      )}

      <div className={`rounded-2xl border p-4 ${isFreeAiMode ? 'border-violet-100 bg-violet-50/70' : 'border-cyan-100 bg-cyan-50/70'}`}>
        <p className={`text-xs font-black uppercase tracking-wide ${isFreeAiMode ? 'text-violet-800' : 'text-cyan-800'}`}>Pacote de entrega</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DELIVERY_PACKAGE_ITEMS.map((item) => (
            <span key={item} className="rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        {rows.map(([label, value, editStep]) => (
          <button
            key={label}
            type="button"
            onClick={() => (label.startsWith('Imagem') ? onEditImages() : onEdit(editStep))}
            className="group rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/50"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 line-clamp-2 text-xs font-black leading-relaxed text-slate-950">{value || 'Pendente'}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-cyan-700">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {!videoUrl && (
        <div className="rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_100%)] p-4 shadow-sm">
          <p className="text-sm font-black text-slate-950">
            Tudo pronto.
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {isFreeAiMode
              ? 'Revise o resumo e a direcao criativa. Quando estiver tudo certo, crie seu comercial livre.'
              : 'Revise o resumo e a imagem selecionada. Quando estiver tudo certo, crie seu comercial.'}
          </p>
          <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="mt-4 w-full justify-center py-4 text-base">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando comercial
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                {isFreeAiMode ? 'Criar comercial livre' : 'Criar comercial'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function LoadingCard({ generationMessage }) {
  const Icon = generationMessage?.Icon || Loader2
  const text = generationMessage?.text || 'Estamos criando seu comercial.'

  return (
    <div className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black text-slate-950">Estamos criando seu comercial</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            {text}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
            O video aparecera aqui quando estiver pronto.
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorCard({ message, imageErrorTarget, onEditImages }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {imageErrorTarget && (
        <Button type="button" variant="secondary" onClick={onEditImages}>
          Voltar para imagens
        </Button>
      )}
    </div>
  )
}

function ResultPanel({ videoUrl, answers, cityValue, districtValue, compact = false, onReset }) {
  const completed = Boolean(videoUrl)
  const deliveryTexts = completed ? buildDeliveryTexts({ answers, districtValue, cityValue }) : []
  if (!completed) return null

  return (
    <section className={`rounded-3xl border border-cyan-100 bg-white shadow-xl shadow-cyan-100/40 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Resultado</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Seu comercial esta pronto</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Voce recebeu video, download e textos prontos para divulgar.
          </p>
        </div>
        {completed ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
        ) : (
          <Film className="h-6 w-6 shrink-0 text-slate-300" />
        )}
      </div>
      {completed && (
        <div className={`${compact ? 'mt-4' : 'mt-5'} overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-2xl shadow-slate-200/70`}>
          <div className={`mx-auto flex aspect-[9/16] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-100 ${compact ? 'max-h-[72vh]' : 'max-h-[820px]'}`}>
            <div className="relative h-full w-full">
              <video id="studio-hero-result-video" src={videoUrl} controls className="h-full w-full object-contain" />
            </div>
          </div>
        </div>
      )}
      {completed && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => document.getElementById('studio-hero-result-video')?.play?.()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-900"
          >
            <PlayCircle className="h-4 w-4" />
            Assistir
          </button>
          <a
            href={videoUrl}
            download="studio-hero-video.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-800"
          >
            <Download className="h-4 w-4" />
            Baixar
          </a>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Criar nova versao
          </button>
        </div>
      )}
      {completed && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">📦 CAMPANHA PRONTA PARA PUBLICAR</p>
          <div className="mt-4 grid gap-3">
            {deliveryTexts.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{item.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(item.text)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
