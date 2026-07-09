import type {
  StudioHeroBrainSmartMotionContract,
  StudioHeroMotionMockExecutionResult,
  StudioHeroMotionValidationResult,
} from './contract.ts'
import { executeStudioHeroMotionMockPlan } from './mock-executor.ts'
import { validateStudioHeroMotionContract } from './validator.ts'

export const studioHeroMotionSampleCampaign = {
  contractVersion: 'studio_hero_motion.v1',
  requestId: 'studio-hero-motion-sample-campaign-001',
  source: 'studio_hero_brain',
  target: 'smart_motion_engine',
  sourceVideo: {
    id: 'broker-video-sample-001',
    fileName: 'video-corretor-apartamento-varanda.mp4',
    mimeType: 'video/mp4',
    durationSeconds: 67,
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
    cuts: [
      {
        id: 'cut-vista-livre',
        label: 'Abertura com vista livre',
        sourceStartSeconds: 4,
        sourceEndSeconds: 11,
        outputStartSeconds: 0,
        outputEndSeconds: 6,
        textTags: [
          {
            id: 'tag-vista-livre',
            label: 'VISTA LIVRE',
            text: 'VISTA LIVRE',
            startSeconds: 0.4,
            endSeconds: 3.2,
            style: 'headline',
          },
        ],
        effects: [
          {
            id: 'fx-vista-zoom',
            kind: 'zoom',
            targetCutId: 'cut-vista-livre',
            intensity: 'low',
            params: { direction: 'in', reason: 'destacar profundidade da vista' },
          },
        ],
      },
      {
        id: 'cut-sala-integrada',
        label: 'Sala integrada',
        sourceStartSeconds: 14,
        sourceEndSeconds: 24,
        outputStartSeconds: 6,
        outputEndSeconds: 14,
        textTags: [
          {
            id: 'tag-sala-integrada',
            label: 'SALA INTEGRADA',
            text: 'SALA INTEGRADA',
            startSeconds: 6.4,
            endSeconds: 9.6,
            style: 'badge',
          },
        ],
        effects: [
          {
            id: 'fx-sala-stabilize',
            kind: 'stabilize',
            targetCutId: 'cut-sala-integrada',
            intensity: 'medium',
          },
        ],
      },
      {
        id: 'cut-cozinha',
        label: 'Cozinha planejada',
        sourceStartSeconds: 29,
        sourceEndSeconds: 38,
        outputStartSeconds: 14,
        outputEndSeconds: 21,
        textTags: [
          {
            id: 'tag-cozinha',
            label: 'COZINHA',
            text: 'COZINHA',
            startSeconds: 14.5,
            endSeconds: 17.2,
            style: 'badge',
          },
        ],
        effects: [
          {
            id: 'fx-cozinha-color',
            kind: 'color_grade',
            targetCutId: 'cut-cozinha',
            intensity: 'medium',
            params: { look: 'clean_real_estate' },
          },
        ],
      },
      {
        id: 'cut-varanda',
        label: 'Varanda',
        sourceStartSeconds: 43,
        sourceEndSeconds: 53,
        outputStartSeconds: 21,
        outputEndSeconds: 27,
        textTags: [
          {
            id: 'tag-varanda',
            label: 'VARANDA',
            text: 'VARANDA',
            startSeconds: 21.2,
            endSeconds: 24.2,
            style: 'badge',
          },
        ],
        effects: [
          {
            id: 'fx-varanda-speed-ramp',
            kind: 'speed_ramp',
            targetCutId: 'cut-varanda',
            intensity: 'low',
            params: { pacing: 'reels_dynamic' },
          },
        ],
      },
      {
        id: 'cut-cta-final',
        label: 'Chamada final',
        sourceStartSeconds: 58,
        sourceEndSeconds: 64,
        outputStartSeconds: 27,
        outputEndSeconds: 30,
        textTags: [
          {
            id: 'tag-agende-sua-visita',
            label: 'AGENDE SUA VISITA',
            text: 'AGENDE SUA VISITA',
            startSeconds: 27,
            endSeconds: 30,
            style: 'cta',
          },
        ],
      },
    ],
    ctaFinal: {
      text: 'AGENDE SUA VISITA',
      startSeconds: 27,
      endSeconds: 30,
      visualStyle: 'direct',
    },
    effects: [
      {
        id: 'fx-main-reel-transition-pack',
        kind: 'transition',
        intensity: 'medium',
        params: { preset: 'fast_clean_cuts' },
      },
    ],
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
    originalDurationSeconds: 67,
    estimatedFinalDurationSeconds: 30,
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
