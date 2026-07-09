import {
  createMainReelRenderInputFromContract,
  renderSmartMotionMainReel,
  type SmartMotionMainReelRenderResult,
} from '../video-renderer.ts'
import { studioHeroMotionSampleCampaign } from './sample-campaign.ts'
import { validateStudioHeroMotionContract } from './validator.ts'

export type StudioHeroMotionSampleMainReelRenderInput = {
  sourceVideoPath: string
  outputPath: string
}

export async function renderStudioHeroMotionSampleMainReel(
  input: StudioHeroMotionSampleMainReelRenderInput,
): Promise<SmartMotionMainReelRenderResult> {
  const validation = validateStudioHeroMotionContract(studioHeroMotionSampleCampaign)
  if (!validation.ok) {
    throw new Error(`studio_hero_motion_sample_contract_invalid:${validation.errors.join(',')}`)
  }

  return renderSmartMotionMainReel(createMainReelRenderInputFromContract({
    contract: studioHeroMotionSampleCampaign,
    sourceVideoPath: input.sourceVideoPath,
    outputPath: input.outputPath,
  }))
}
