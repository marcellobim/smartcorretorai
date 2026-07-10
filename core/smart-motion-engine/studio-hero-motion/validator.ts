import type {
  StudioHeroBrainSmartMotionContract,
  StudioHeroMotionCut,
  StudioHeroMotionValidationResult,
} from './contract.ts'

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validateCut(cut: StudioHeroMotionCut, path: string, errors: string[]) {
  if (!hasText(cut?.id)) errors.push(`${path}.id_required`)
  if (typeof cut?.sourceStartSeconds !== 'number' || cut.sourceStartSeconds < 0) {
    errors.push(`${path}.source_start_seconds_required`)
  }
  if (!hasPositiveNumber(cut?.sourceEndSeconds)) {
    errors.push(`${path}.source_end_seconds_required`)
  }
  if (
    typeof cut?.sourceStartSeconds === 'number'
    && typeof cut?.sourceEndSeconds === 'number'
    && cut.sourceEndSeconds <= cut.sourceStartSeconds
  ) {
    errors.push(`${path}.source_end_must_be_after_start`)
  }
}

export function validateStudioHeroMotionContract(input: unknown): StudioHeroMotionValidationResult {
  const errors: string[] = []
  const contract = input as StudioHeroBrainSmartMotionContract

  if (!contract || typeof contract !== 'object') {
    return { ok: false, errors: ['contract_required'] }
  }

  if (contract.contractVersion !== 'studio_hero_motion.v1') errors.push('contract_version_invalid')
  if (!hasText(contract.requestId)) errors.push('request_id_required')
  if (contract.source !== 'studio_hero_brain') errors.push('source_invalid')
  if (contract.target !== 'smart_motion_engine') errors.push('target_invalid')
  if (!hasText(contract.sourceVideo?.id)) errors.push('source_video.id_required')
  if (!hasText(contract.sourceVideo?.fileName)) errors.push('source_video.file_name_required')
  if (!hasText(contract.campaignBrief?.objective)) errors.push('campaign_brief.objective_required')
  if (!hasText(contract.mainReel?.id)) errors.push('main_reel.id_required')
  if (!hasText(contract.mainReel?.title)) errors.push('main_reel.title_required')
  if (!hasPositiveNumber(contract.mainReel?.targetDurationSeconds)) {
    errors.push('main_reel.target_duration_seconds_required')
  }
  if (!hasText(contract.mainReel?.ctaFinal?.text)) errors.push('main_reel.cta_final.text_required')
  if (contract.mainReel?.finishing?.backgroundMusic?.enabled) {
    const music = contract.mainReel.finishing.backgroundMusic
    if (!['internal_placeholder', 'file'].includes(music.source)) {
      errors.push('main_reel.finishing.background_music.source_invalid')
    }
    if (!['auto', 'fixed'].includes(music.volumeMode)) {
      errors.push('main_reel.finishing.background_music.volume_mode_invalid')
    }
    if (music.source === 'file' && !hasText(music.filePath)) {
      errors.push('main_reel.finishing.background_music.file_path_required')
    }
  }
  if (contract.mainReel?.finishing?.cta?.enabled && contract.mainReel.finishing.cta.renderNow !== false) {
    errors.push('main_reel.finishing.cta.render_now_must_be_false')
  }
  if (contract.mainReel?.finishing?.captions?.enabled && contract.mainReel.finishing.captions.renderNow !== false) {
    errors.push('main_reel.finishing.captions.render_now_must_be_false')
  }
  if (contract.mainReel?.finishing?.commercialCommunication?.enabled) {
    const communication = contract.mainReel.finishing.commercialCommunication
    if (!['À VENDA', 'PARA LOCAÇÃO'].includes(communication.dealType)) {
      errors.push('main_reel.finishing.commercial_communication.deal_type_invalid')
    }
    if (!hasText(communication.propertyType)) {
      errors.push('main_reel.finishing.commercial_communication.property_type_required')
    }
    if (Array.isArray(communication.highlights) && communication.highlights.length > 4) {
      errors.push('main_reel.finishing.commercial_communication.highlights_max_4')
    }
    if (!hasText(communication.cta)) {
      errors.push('main_reel.finishing.commercial_communication.cta_required')
    }
  }
  if (!Array.isArray(contract.mainReel?.cuts) || contract.mainReel.cuts.length < 1) {
    errors.push('main_reel.cuts_required')
  } else {
    contract.mainReel.cuts.forEach((cut, index) => validateCut(cut, `main_reel.cuts.${index}`, errors))
  }
  if (!Array.isArray(contract.smartClips)) errors.push('smart_clips_required')
  if (!hasText(contract.campaignTexts?.headline)) errors.push('campaign_texts.headline_required')
  if (!hasText(contract.campaignTexts?.shortCaption)) errors.push('campaign_texts.short_caption_required')
  if (!Array.isArray(contract.campaignTexts?.hashtags)) errors.push('campaign_texts.hashtags_required')
  if (!hasText(contract.campaignTexts?.cta)) errors.push('campaign_texts.cta_required')

  return {
    ok: errors.length === 0,
    errors,
  }
}

export function assertValidStudioHeroMotionContract(input: unknown): asserts input is StudioHeroBrainSmartMotionContract {
  const result = validateStudioHeroMotionContract(input)
  if (!result.ok) {
    throw new Error(`studio_hero_motion_contract_invalid:${result.errors.join(',')}`)
  }
}
