import type {
  StudioHeroBrainSmartMotionContract,
  StudioHeroMotionMockExecutionResult,
  StudioHeroMotionValidationResult,
} from './contract.ts'
import { selectStudioHeroMotionMomentsV2, type StudioHeroMotionCandidateMoment } from './brain-v2.ts'
import { executeStudioHeroMotionMockPlan } from './mock-executor.ts'
import { validateStudioHeroMotionContract } from './validator.ts'

export const studioHeroMotionSampleMomentsV2: StudioHeroMotionCandidateMoment[] = [
  {
    id: 'sala-principal',
    environmentId: 'sala',
    environmentType: 'sala',
    label: 'Sala principal',
    sourceStartSeconds: 4,
    sourceEndSeconds: 12,
    visualInterestScore: 95,
    openingStrength: 100,
    closingStrength: 58,
  },
  {
    id: 'corredor-entrada',
    environmentId: 'circulacao',
    environmentType: 'outro',
    label: 'Corredor de entrada',
    sourceStartSeconds: 12.2,
    sourceEndSeconds: 16,
    visualInterestScore: 28,
    openingStrength: 12,
    closingStrength: 8,
    hasLongCorridor: true,
  },
  {
    id: 'cozinha-planejada',
    environmentId: 'cozinha',
    environmentType: 'cozinha',
    label: 'Cozinha planejada',
    sourceStartSeconds: 18,
    sourceEndSeconds: 27,
    visualInterestScore: 89,
    openingStrength: 68,
    closingStrength: 52,
  },
  {
    id: 'porta-cozinha',
    environmentId: 'transicao',
    environmentType: 'outro',
    label: 'Passagem para cozinha',
    sourceStartSeconds: 27.2,
    sourceEndSeconds: 31.5,
    visualInterestScore: 34,
    openingStrength: 10,
    closingStrength: 12,
    hasDoorTransition: true,
    isEnvironmentTransition: true,
  },
  {
    id: 'sala-repetida',
    environmentId: 'sala',
    environmentType: 'sala',
    label: 'Sala em angulo repetido',
    sourceStartSeconds: 31,
    sourceEndSeconds: 37,
    visualInterestScore: 70,
    openingStrength: 45,
    closingStrength: 40,
  },
  {
    id: 'quarto-principal',
    environmentId: 'quarto',
    environmentType: 'quarto',
    label: 'Dormitório principal',
    sourceStartSeconds: 40,
    sourceEndSeconds: 49,
    visualInterestScore: 87,
    openingStrength: 60,
    closingStrength: 64,
  },
  {
    id: 'banheiro',
    environmentId: 'banheiro',
    environmentType: 'banheiro',
    label: 'Banheiro',
    sourceStartSeconds: 56,
    sourceEndSeconds: 64,
    visualInterestScore: 78,
    openingStrength: 42,
    closingStrength: 48,
  },
  {
    id: 'lavanderia',
    environmentId: 'lavanderia',
    environmentType: 'lavanderia',
    label: 'Lavanderia e serviço',
    sourceStartSeconds: 72,
    sourceEndSeconds: 80,
    visualInterestScore: 72,
    openingStrength: 32,
    closingStrength: 38,
  },
  {
    id: 'varanda',
    environmentId: 'varanda',
    environmentType: 'varanda',
    label: 'Varanda',
    sourceStartSeconds: 88,
    sourceEndSeconds: 98,
    visualInterestScore: 92,
    openingStrength: 74,
    closingStrength: 86,
  },
  {
    id: 'vista-livre',
    environmentId: 'vista',
    environmentType: 'vista',
    label: 'Vista livre',
    sourceStartSeconds: 99,
    sourceEndSeconds: 106,
    visualInterestScore: 86,
    openingStrength: 55,
    closingStrength: 80,
  },
  {
    id: 'cta-final',
    environmentId: 'encerramento',
    environmentType: 'encerramento',
    label: 'Chamada final',
    sourceStartSeconds: 106,
    sourceEndSeconds: 113,
    visualInterestScore: 84,
    openingStrength: 45,
    closingStrength: 100,
  },
]

export const studioHeroMotionBrainV2Selection = selectStudioHeroMotionMomentsV2(studioHeroMotionSampleMomentsV2, {
  sourceDurationSeconds: 190,
  targetDurationRangeSeconds: { min: 40, max: 55 },
  maxDurationPerEnvironmentSeconds: 7,
})

export const studioHeroMotionSampleCampaign = {
  contractVersion: 'studio_hero_motion.v1',
  requestId: 'studio-hero-motion-sample-campaign-001',
  source: 'studio_hero_brain',
  target: 'smart_motion_engine',
  sourceVideo: {
    id: 'broker-video-sample-001',
    fileName: 'video-corretor-apartamento-varanda.mp4',
    mimeType: 'video/mp4',
    durationSeconds: 190,
  },
  campaignBrief: {
    objective: 'sale',
    propertyType: 'Apartamento',
    city: 'São Paulo',
    district: 'Vila Mariana',
    keyFeatures: ['Vista livre', 'Sala integrada', 'Cozinha planejada', 'Varanda'],
    tone: 'social',
  },
  mainReel: {
    id: 'main-reel-venda-apartamento',
    title: 'Reels principal - Apartamento com vista livre',
    aspectRatio: '9:16',
    targetDurationSeconds: 30,
    cuts: studioHeroMotionBrainV2Selection.cuts,
    ctaFinal: {
      text: 'AGENDE SUA VISITA',
      startSeconds: 42,
      endSeconds: 49,
      visualStyle: 'direct',
    },
    effects: [],
  },
  smartClips: [
    {
      id: 'smart-clip-vista',
      title: 'Vista',
      aspectRatio: '9:16',
      targetDurationSeconds: 7,
      cuts: [
        {
          id: 'clip-cut-vista',
          label: 'Vista livre',
          sourceStartSeconds: 4,
          sourceEndSeconds: 11,
        },
      ],
      tags: ['VISTA LIVRE'],
      ctaFinal: { text: 'Veja mais detalhes', visualStyle: 'clean' },
    },
    {
      id: 'smart-clip-sala',
      title: 'Sala',
      aspectRatio: '9:16',
      targetDurationSeconds: 8,
      cuts: [
        {
          id: 'clip-cut-sala',
          label: 'Sala integrada',
          sourceStartSeconds: 14,
          sourceEndSeconds: 24,
        },
      ],
      tags: ['SALA INTEGRADA'],
      ctaFinal: { text: 'Agende sua visita', visualStyle: 'direct' },
    },
    {
      id: 'smart-clip-cozinha',
      title: 'Cozinha',
      aspectRatio: '9:16',
      targetDurationSeconds: 7,
      cuts: [
        {
          id: 'clip-cut-cozinha',
          label: 'Cozinha planejada',
          sourceStartSeconds: 29,
          sourceEndSeconds: 38,
        },
      ],
      tags: ['COZINHA'],
      ctaFinal: { text: 'Conheça o imóvel', visualStyle: 'clean' },
    },
    {
      id: 'smart-clip-varanda',
      title: 'Varanda',
      aspectRatio: '9:16',
      targetDurationSeconds: 7,
      cuts: [
        {
          id: 'clip-cut-varanda',
          label: 'Varanda',
          sourceStartSeconds: 43,
          sourceEndSeconds: 53,
        },
      ],
      tags: ['VARANDA'],
      ctaFinal: { text: 'Chame para visitar', visualStyle: 'direct' },
    },
  ],
  campaignTexts: {
    headline: 'Apartamento com vista livre e varanda na Vila Mariana',
    shortCaption: 'Vista livre, sala integrada, cozinha planejada e varanda em um apartamento pronto para encantar.',
    longCaption: 'Conheça este apartamento na Vila Mariana com ambientes integrados, ótima iluminação natural, cozinha planejada e uma varanda perfeita para aproveitar a vista livre. Uma campanha pronta para Reels, WhatsApp e portais imobiliários.',
    whatsappMessage: 'Olá! Tenho um apartamento com vista livre, sala integrada, cozinha planejada e varanda na Vila Mariana. Quer receber mais detalhes ou agendar uma visita?',
    portalDescription: 'Apartamento à venda na Vila Mariana com vista livre, sala integrada, cozinha planejada e varanda. Imóvel com apresentação dinâmica ideal para quem busca praticidade, boa iluminação e localização valorizada.',
    hashtags: ['#VistaLivre', '#ApartamentoAVenda', '#VilaMariana', '#ImoveisSP', '#AgendeSuaVisita'],
    cta: 'AGENDE SUA VISITA',
  },
  metadata: {
    sample: true,
    phase: 'studio_hero_motion_phase_2',
    originalDurationSeconds: 190,
    estimatedFinalDurationSeconds: 49,
    brainVersion: 'studio_hero_motion_brain_v2_1',
    brainRulesApplied: studioHeroMotionBrainV2Selection.rulesApplied,
    rejectedMomentIds: studioHeroMotionBrainV2Selection.rejectedMomentIds,
    renderer: 'not_implemented',
  },
} satisfies StudioHeroBrainSmartMotionContract

export type StudioHeroMotionSampleCampaignDemoResult = {
  validation: StudioHeroMotionValidationResult
  execution: StudioHeroMotionMockExecutionResult
}

export function runStudioHeroMotionSampleCampaignDemo(): StudioHeroMotionSampleCampaignDemoResult {
  const validation = validateStudioHeroMotionContract(studioHeroMotionSampleCampaign)
  if (!validation.ok) {
    return {
      validation,
      execution: {
        requestId: studioHeroMotionSampleCampaign.requestId,
        engine: 'smart_motion_engine',
        mode: 'mock_plan_only',
        actions: [],
      },
    }
  }

  return {
    validation,
    execution: executeStudioHeroMotionMockPlan(studioHeroMotionSampleCampaign),
  }
}
