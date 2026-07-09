import type {
  StudioHeroBrainSmartMotionContract,
  StudioHeroMotionMockAction,
  StudioHeroMotionMockExecutionResult,
} from './contract.ts'
import { assertValidStudioHeroMotionContract } from './validator.ts'

function createAction(
  actions: StudioHeroMotionMockAction[],
  type: StudioHeroMotionMockAction['type'],
  targetId: string,
  label: string,
  payload: Record<string, unknown>,
) {
  actions.push({
    order: actions.length + 1,
    type,
    targetId,
    label,
    payload,
  })
}

export function executeStudioHeroMotionMockPlan(
  contract: StudioHeroBrainSmartMotionContract,
): StudioHeroMotionMockExecutionResult {
  assertValidStudioHeroMotionContract(contract)

  const actions: StudioHeroMotionMockAction[] = []

  contract.mainReel.cuts.forEach((cut) => {
    createAction(actions, 'cut_segment', cut.id, `Cortar trecho ${cut.id}`, {
      sourceVideoId: contract.sourceVideo.id,
      startSeconds: cut.sourceStartSeconds,
      endSeconds: cut.sourceEndSeconds,
      output: 'main_reel',
    })

    cut.textTags?.forEach((tag) => {
      createAction(actions, 'apply_text', tag.id, `Aplicar texto: ${tag.label}`, {
        cutId: cut.id,
        text: tag.text,
        startSeconds: tag.startSeconds,
        endSeconds: tag.endSeconds,
        style: tag.style,
      })
    })

    cut.effects?.forEach((effect) => {
      createAction(actions, effect.kind === 'zoom' ? 'apply_zoom' : 'apply_effect', effect.id, `Aplicar efeito: ${effect.kind}`, {
        cutId: cut.id,
        kind: effect.kind,
        intensity: effect.intensity,
        params: effect.params || {},
      })
    })
  })

  contract.mainReel.effects?.forEach((effect) => {
    createAction(actions, effect.kind === 'zoom' ? 'apply_zoom' : 'apply_effect', effect.id, `Aplicar efeito no reel: ${effect.kind}`, {
      reelId: contract.mainReel.id,
      kind: effect.kind,
      targetCutId: effect.targetCutId,
      intensity: effect.intensity,
      params: effect.params || {},
    })
  })

  createAction(actions, 'generate_reel', contract.mainReel.id, 'Gerar reels principal', {
    aspectRatio: contract.mainReel.aspectRatio,
    targetDurationSeconds: contract.mainReel.targetDurationSeconds,
    ctaFinal: contract.mainReel.ctaFinal,
  })

  contract.smartClips.forEach((clip) => {
    clip.cuts.forEach((cut) => {
      createAction(actions, 'cut_segment', `${clip.id}:${cut.id}`, `Cortar trecho para smart clip ${clip.title}`, {
        sourceVideoId: contract.sourceVideo.id,
        smartClipId: clip.id,
        startSeconds: cut.sourceStartSeconds,
        endSeconds: cut.sourceEndSeconds,
        output: 'smart_clip',
      })
    })

    createAction(actions, 'generate_smart_clip', clip.id, `Gerar smart clip: ${clip.title}`, {
      aspectRatio: clip.aspectRatio,
      targetDurationSeconds: clip.targetDurationSeconds,
      tags: clip.tags || [],
      ctaFinal: clip.ctaFinal,
    })
  })

  createAction(actions, 'generate_campaign_texts', `${contract.requestId}:campaign_texts`, 'Gerar campanha de textos', {
    headline: contract.campaignTexts.headline,
    shortCaption: contract.campaignTexts.shortCaption,
    longCaption: contract.campaignTexts.longCaption,
    whatsappMessage: contract.campaignTexts.whatsappMessage,
    hashtags: contract.campaignTexts.hashtags,
    cta: contract.campaignTexts.cta,
  })

  return {
    requestId: contract.requestId,
    engine: 'smart_motion_engine',
    mode: 'mock_plan_only',
    actions,
  }
}
