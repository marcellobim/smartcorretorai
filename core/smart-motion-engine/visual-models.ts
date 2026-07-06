import type { SmartMotionPreset, SmartTransitionPreset, SmartVisualModelId } from './schema.ts'

export type SmartVisualModel = {
  id: SmartVisualModelId
  internalDescription: string
  averageSceneSeconds: number
  ctaSeconds: number
  transitionSeconds: number
  rhythm: 'calm' | 'balanced' | 'fast' | 'direct'
  visualIntensity: 'low' | 'medium' | 'high'
  ctaMode: 'subtle' | 'standard' | 'strong'
  captionsDefault: boolean
  allowedMotions: SmartMotionPreset[]
  allowedTransitions: SmartTransitionPreset[]
}

export const SMART_VISUAL_MODELS: Record<SmartVisualModelId, SmartVisualModel> = {
  clean_showcase: {
    id: 'clean_showcase',
    internalDescription: 'Apresentacao limpa, elegante, com movimentos suaves, boa para imoveis prontos e fotos profissionais.',
    averageSceneSeconds: 3.25,
    ctaSeconds: 2.8,
    transitionSeconds: 0.58,
    rhythm: 'balanced',
    visualIntensity: 'low',
    ctaMode: 'standard',
    captionsDefault: true,
    allowedMotions: ['zoom_in', 'pan_right', 'zoom_out', 'pan_left', 'stable'],
    allowedTransitions: ['fade', 'crossfade'],
  },
  social_impact: {
    id: 'social_impact',
    internalDescription: 'Ritmo mais rapido, cortes mais marcantes, CTA forte, boa para Instagram/Reels/WhatsApp.',
    averageSceneSeconds: 2.35,
    ctaSeconds: 2.45,
    transitionSeconds: 0.38,
    rhythm: 'fast',
    visualIntensity: 'high',
    ctaMode: 'strong',
    captionsDefault: true,
    allowedMotions: ['zoom_in', 'pan_left', 'subtle_rotate', 'pan_right', 'zoom_out', 'pan_up'],
    allowedTransitions: ['smoothleft', 'smoothup', 'fadeblack', 'crossfade'],
  },
  luxury_soft: {
    id: 'luxury_soft',
    internalDescription: 'Movimentos lentos, luz suave, CTA discreto, boa para alto padrao.',
    averageSceneSeconds: 4.15,
    ctaSeconds: 3.25,
    transitionSeconds: 0.82,
    rhythm: 'calm',
    visualIntensity: 'medium',
    ctaMode: 'subtle',
    captionsDefault: true,
    allowedMotions: ['pan_right', 'zoom_in', 'stable', 'pan_left', 'zoom_out', 'pan_down'],
    allowedTransitions: ['fade', 'crossfade', 'fadeblack'],
  },
  rental_direct: {
    id: 'rental_direct',
    internalDescription: 'Direto ao ponto, leitura rapida, bom para locacao e imoveis usados.',
    averageSceneSeconds: 2.7,
    ctaSeconds: 2.6,
    transitionSeconds: 0.44,
    rhythm: 'direct',
    visualIntensity: 'medium',
    ctaMode: 'strong',
    captionsDefault: true,
    allowedMotions: ['stable', 'pan_right', 'zoom_in', 'pan_left', 'zoom_out'],
    allowedTransitions: ['fade', 'fadeblack', 'smoothleft'],
  },
}

export const DEFAULT_VISUAL_MODEL_ID: SmartVisualModelId = 'clean_showcase'

export function normalizeVisualModelId(value: unknown): SmartVisualModelId {
  const id = String(value || '').trim()
  return Object.prototype.hasOwnProperty.call(SMART_VISUAL_MODELS, id)
    ? id as SmartVisualModelId
    : DEFAULT_VISUAL_MODEL_ID
}

export function getSmartVisualModel(value: unknown): SmartVisualModel {
  return SMART_VISUAL_MODELS[normalizeVisualModelId(value)]
}

export function getDeterministicModelItem<T>(items: T[], index: number): T {
  if (items.length === 0) throw new Error('empty_visual_model_sequence')
  return items[index % items.length]
}
