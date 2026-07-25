import type { PropertyContext, SmartTourGenerationConfig, SupportedLanguage } from './types.ts'
import { buildSmartTourNarration } from './build-prompt.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
import { normalizeGeneration } from './validation.ts'

export type SmartTourOrchestration = {
  configuracoes: {
    modo: SmartTourGenerationConfig['mode']
    apresentador: 'corretora' | 'corretor' | 'nenhum'
    narracaoAtiva: boolean
    legendasAtivas: boolean
    ctaAtivo: boolean
    idioma: SupportedLanguage
    duracao: '10s'
    quantidadeImagens: number
  }
  cenas: Array<{ numero: number; imagem: string }>
  legendas: Array<{ cena: number; texto: string }>
  narracao: string
  cta: string
  telefone: string
}

export type SmartTourOrchestrationExpectation = {
  configuracoes: SmartTourOrchestration['configuracoes']
  imagePaths: string[]
  captionCandidates: string[]
  captionCount: number
  narracao: string
  cta: string
  telefone: string
}

export const SMART_TOUR_ORCHESTRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    configuracoes: {
      type: 'object',
      additionalProperties: false,
      properties: {
        modo: { type: 'string', enum: ['guided_tour', 'narrated_tour', 'smart_staging', 'cinematic_tour'] },
        apresentador: { type: 'string', enum: ['corretora', 'corretor', 'nenhum'] },
        narracaoAtiva: { type: 'boolean' },
        legendasAtivas: { type: 'boolean' },
        ctaAtivo: { type: 'boolean' },
        idioma: { type: 'string', enum: ['pt-BR', 'en-US', 'es'] },
        duracao: { type: 'string', enum: ['10s'] },
        quantidadeImagens: { type: 'integer', minimum: 1, maximum: 5 },
      },
      required: ['modo', 'apresentador', 'narracaoAtiva', 'legendasAtivas', 'ctaAtivo', 'idioma', 'duracao', 'quantidadeImagens'],
    },
    cenas: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { numero: { type: 'integer', minimum: 1, maximum: 5 }, imagem: { type: 'string' } },
        required: ['numero', 'imagem'],
      },
    },
    legendas: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { cena: { type: 'integer', minimum: 1, maximum: 5 }, texto: { type: 'string' } },
        required: ['cena', 'texto'],
      },
    },
    narracao: { type: 'string' },
    cta: { type: 'string' },
    telefone: { type: 'string' },
  },
  required: ['configuracoes', 'cenas', 'legendas', 'narracao', 'cta', 'telefone'],
} as const

const uniqueLiterals = (values: unknown[]) => [...new Set(values.map(removeNonOfficialPhoneNumbers).filter(Boolean))]

const presenter = (config: SmartTourGenerationConfig): SmartTourOrchestration['configuracoes']['apresentador'] => {
  if (config.presenterGender === 'female') return 'corretora'
  if (config.presenterGender === 'male') return 'corretor'
  return 'nenhum'
}

export function buildSmartTourOrchestrationInput(input: {
  generation: SmartTourGenerationConfig
  property: PropertyContext
  selectedCta: string
  phone?: string
  imagePaths: string[]
  language: SupportedLanguage
  briefing: string
}) {
  const config = normalizeGeneration(input.generation)
  const cta = removeNonOfficialPhoneNumbers(input.selectedCta)
  const phone = cta ? input.phone || '' : ''
  const narracao = config.narration === 'enabled' ? buildSmartTourNarration(input.property) : ''
  const captionCandidates = uniqueLiterals([
    input.property.stage,
    ...(input.property.highlights || []),
    input.property.price,
  ])
  const captionCount = config.captions === 'enabled'
    ? Math.min(5, input.imagePaths.length, captionCandidates.length)
    : 0
  const configuracoes: SmartTourOrchestration['configuracoes'] = {
    modo: config.mode,
    apresentador: presenter(config),
    narracaoAtiva: config.narration === 'enabled',
    legendasAtivas: config.captions === 'enabled',
    ctaAtivo: Boolean(cta),
    idioma: input.language,
    duracao: '10s',
    quantidadeImagens: input.imagePaths.length,
  }
  const source = {
    dadosDoImovel: input.property,
    dadosDoCorretor: { telefone: phone },
    opcoesDoChat: { ...config, selectedCta: cta, includeProfessionalPhone: Boolean(phone) },
    imagens: [...input.imagePaths],
    idioma: input.language,
    valoresDeterministicos: { narracao, cta, telefone: phone, legendasAutorizadas: captionCandidates },
  }
  const prompt = [
    'FASE 1 — ORQUESTRAÇÃO DO SMART TOUR',
    'Organize as informações recebidas. Não gere vídeo, roteiro livre, explicações ou texto fora do JSON.',
    'Retorne somente o objeto JSON definido pelo schema. Copie todos os textos literalmente, sem corrigir, completar, traduzir, resumir ou reescrever nenhum caractere.',
    'Use todas as imagens exatamente uma vez e na ordem recebida. Crie uma cena por imagem.',
    `Quando legendasAtivas for true, retorne exatamente ${captionCount} legendas comerciais, uma por cena, usando somente valores de legendasAutorizadas sem repetição. Quando for false, retorne legendas vazias.`,
    'A narração, o CTA e o telefone devem ser idênticos aos valoresDeterministicos. Não invente contato, e-mail, URL ou frase.',
    `ENTRADAS CONTROLADAS\n${JSON.stringify(source)}`,
    `BRIEFING BASE COMPILADO — REGRAS DE ORGANIZAÇÃO\n${input.briefing}`,
  ].join('\n\n')
  const expectation: SmartTourOrchestrationExpectation = {
    configuracoes,
    imagePaths: [...input.imagePaths],
    captionCandidates,
    captionCount,
    narracao,
    cta,
    telefone: phone,
  }
  return { source, prompt, expectation }
}

const exactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

export function validateSmartTourOrchestration(value: unknown, expected: SmartTourOrchestrationExpectation): SmartTourOrchestration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('smart_tour_orchestration_invalid')
  const plan = value as SmartTourOrchestration
  if (!exactKeys(plan as unknown as Record<string, unknown>, ['configuracoes', 'cenas', 'legendas', 'narracao', 'cta', 'telefone'])) throw new Error('smart_tour_orchestration_invalid')
  if (!plan.configuracoes || !exactKeys(plan.configuracoes as unknown as Record<string, unknown>, ['modo', 'apresentador', 'narracaoAtiva', 'legendasAtivas', 'ctaAtivo', 'idioma', 'duracao', 'quantidadeImagens'])) throw new Error('smart_tour_orchestration_invalid')
  for (const key of Object.keys(expected.configuracoes) as Array<keyof SmartTourOrchestration['configuracoes']>) {
    if (plan.configuracoes[key] !== expected.configuracoes[key]) throw new Error('smart_tour_orchestration_configuration_mismatch')
  }
  if (!Array.isArray(plan.cenas) || plan.cenas.length !== expected.imagePaths.length) throw new Error('smart_tour_orchestration_scene_mismatch')
  for (let index = 0; index < expected.imagePaths.length; index += 1) {
    const scene = plan.cenas[index]
    if (!scene || !exactKeys(scene as unknown as Record<string, unknown>, ['numero', 'imagem']) || scene.numero !== index + 1 || scene.imagem !== expected.imagePaths[index]) throw new Error('smart_tour_orchestration_scene_mismatch')
  }
  if (plan.narracao !== expected.narracao || plan.cta !== expected.cta || plan.telefone !== expected.telefone) throw new Error('smart_tour_orchestration_literal_mismatch')
  if (!Array.isArray(plan.legendas) || plan.legendas.length !== expected.captionCount) throw new Error('smart_tour_orchestration_caption_mismatch')
  const usedScenes = new Set<number>()
  const usedTexts = new Set<string>()
  for (let index = 0; index < plan.legendas.length; index += 1) {
    const caption = plan.legendas[index]
    if (!caption || !exactKeys(caption as unknown as Record<string, unknown>, ['cena', 'texto'])) throw new Error('smart_tour_orchestration_caption_mismatch')
    if (caption.cena !== index + 1 || usedScenes.has(caption.cena) || usedTexts.has(caption.texto) || !expected.captionCandidates.includes(caption.texto)) throw new Error('smart_tour_orchestration_caption_mismatch')
    usedScenes.add(caption.cena)
    usedTexts.add(caption.texto)
  }
  return plan
}
