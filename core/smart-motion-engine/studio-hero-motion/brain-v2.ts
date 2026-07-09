import type { StudioHeroMotionCut } from './contract.ts'

export type StudioHeroMotionCandidateMoment = {
  id: string
  environmentId: string
  environmentType?: 'sala' | 'cozinha' | 'quarto' | 'banheiro' | 'lavanderia' | 'varanda' | 'vista' | 'encerramento' | 'outro'
  label: string
  sourceStartSeconds: number
  sourceEndSeconds: number
  visualInterestScore: number
  openingStrength: number
  closingStrength: number
  hasLongCorridor?: boolean
  hasDoorTransition?: boolean
  isEnvironmentTransition?: boolean
  hasStaticCamera?: boolean
  isRepeatedContent?: boolean
  hasLowContent?: boolean
  isLongWalk?: boolean
  shouldKeepForContinuity?: boolean
  preferredDurationSeconds?: number
  textTags?: StudioHeroMotionCut['textTags']
}

export type StudioHeroMotionBrainV2Options = {
  maxDurationPerEnvironmentSeconds?: number
  maxMainReelDurationSeconds?: number
  sourceDurationSeconds?: number
  targetDurationRangeSeconds?: {
    min: number
    max: number
  }
  minMoments?: number
}

export type StudioHeroMotionBrainV2Selection = {
  cuts: StudioHeroMotionCut[]
  rejectedMomentIds: string[]
  rulesApplied: string[]
}

const DEFAULT_OPTIONS = {
  maxDurationPerEnvironmentSeconds: 18,
  maxMainReelDurationSeconds: 125,
  minMoments: 6,
} as const

const RULES_APPLIED = [
  'brain_version_2_2_improve_original_visit',
  'preserve_original_visit_order',
  'do_not_create_new_commercial_narrative',
  'keep_realtor_guided_visit',
  'reduce_time_lost_between_rooms',
  'identify_long_walks',
  'avoid_long_corridors',
  'avoid_doors_and_room_transitions',
  'identify_static_camera_moments',
  'identify_repeated_content',
  'identify_low_content_moments',
  'shorten_transitions_instead_of_hiding_them',
  'limit_duration_per_environment',
  'keep_smart_motion_contract_shape',
] as const

function getDuration(moment: Pick<StudioHeroMotionCandidateMoment, 'sourceStartSeconds' | 'sourceEndSeconds'>) {
  return Math.max(0, moment.sourceEndSeconds - moment.sourceStartSeconds)
}

function trimMoment(
  moment: StudioHeroMotionCandidateMoment,
  maxDurationSeconds: number,
): StudioHeroMotionCandidateMoment {
  const duration = getDuration(moment)
  if (duration <= maxDurationSeconds) return moment

  return {
    ...moment,
    sourceEndSeconds: Number((moment.sourceStartSeconds + maxDurationSeconds).toFixed(2)),
  }
}

function isLowValueMoment(moment: StudioHeroMotionCandidateMoment) {
  return Boolean(moment.hasStaticCamera || moment.isRepeatedContent || moment.hasLowContent)
}

function getEnvironmentType(moment: StudioHeroMotionCandidateMoment) {
  return moment.environmentType || moment.environmentId
}

function isReducibleTransition(moment: StudioHeroMotionCandidateMoment) {
  return Boolean(
    moment.hasLongCorridor
    || moment.hasDoorTransition
    || moment.isEnvironmentTransition
    || moment.isLongWalk,
  )
}

function getTargetDurationRange(options: StudioHeroMotionBrainV2Options) {
  if (options.targetDurationRangeSeconds) return options.targetDurationRangeSeconds
  if ((options.sourceDurationSeconds || 0) > 120) return { min: 90, max: 125 }
  return { min: Math.min(36, options.maxMainReelDurationSeconds || DEFAULT_OPTIONS.maxMainReelDurationSeconds), max: options.maxMainReelDurationSeconds || DEFAULT_OPTIONS.maxMainReelDurationSeconds }
}

function getMomentMaxDuration(
  moment: StudioHeroMotionCandidateMoment,
  maxDurationPerEnvironmentSeconds: number,
) {
  if (moment.preferredDurationSeconds) return moment.preferredDurationSeconds
  if (isReducibleTransition(moment)) return moment.shouldKeepForContinuity ? 3.5 : 0
  if (getEnvironmentType(moment) === 'vista') return Math.min(10, maxDurationPerEnvironmentSeconds)
  if (getEnvironmentType(moment) === 'encerramento') return Math.min(8, maxDurationPerEnvironmentSeconds)
  return maxDurationPerEnvironmentSeconds
}

function toContractCut(moment: StudioHeroMotionCandidateMoment, outputStartSeconds: number): StudioHeroMotionCut {
  const durationSeconds = getDuration(moment)
  return {
    id: `cut-${moment.id}`,
    label: moment.label,
    sourceStartSeconds: moment.sourceStartSeconds,
    sourceEndSeconds: moment.sourceEndSeconds,
    outputStartSeconds: Number(outputStartSeconds.toFixed(2)),
    outputEndSeconds: Number((outputStartSeconds + durationSeconds).toFixed(2)),
    textTags: moment.textTags,
  }
}

export function selectStudioHeroMotionMomentsV2(
  candidates: StudioHeroMotionCandidateMoment[],
  options: StudioHeroMotionBrainV2Options = {},
): StudioHeroMotionBrainV2Selection {
  const maxDurationPerEnvironmentSeconds = options.maxDurationPerEnvironmentSeconds || DEFAULT_OPTIONS.maxDurationPerEnvironmentSeconds
  const targetDurationRange = getTargetDurationRange(options)
  const maxMainReelDurationSeconds = options.maxMainReelDurationSeconds || targetDurationRange.max
  const rejectedMomentIds: string[] = []

  const orderedMoments = [...candidates].sort((a, b) => a.sourceStartSeconds - b.sourceStartSeconds)
  const selected: StudioHeroMotionCandidateMoment[] = []
  const durationByEnvironment = new Map<string, number>()
  let totalDurationSeconds = 0

  for (const moment of orderedMoments) {
    if (isLowValueMoment(moment) && !moment.shouldKeepForContinuity) {
      rejectedMomentIds.push(moment.id)
      continue
    }

    const environmentType = getEnvironmentType(moment)
    const currentEnvironmentDuration = durationByEnvironment.get(moment.environmentId) || 0
    const momentMaxDuration = getMomentMaxDuration(moment, maxDurationPerEnvironmentSeconds)
    const environmentRemainingSeconds = Math.max(0, maxDurationPerEnvironmentSeconds - currentEnvironmentDuration)
    const allowedDurationSeconds = environmentType === 'outro'
      ? momentMaxDuration
      : Math.min(momentMaxDuration, environmentRemainingSeconds || momentMaxDuration)

    if (allowedDurationSeconds <= 0) {
      rejectedMomentIds.push(moment.id)
      continue
    }

    const trimmedMoment = trimMoment(moment, allowedDurationSeconds)
    const nextDuration = getDuration(trimmedMoment)
    if (nextDuration <= 0) {
      rejectedMomentIds.push(moment.id)
      continue
    }

    if (totalDurationSeconds + nextDuration > maxMainReelDurationSeconds) {
      rejectedMomentIds.push(moment.id)
      continue
    }

    selected.push(trimmedMoment)
    totalDurationSeconds += nextDuration
    durationByEnvironment.set(moment.environmentId, currentEnvironmentDuration + nextDuration)
  }

  if (!selected.length) {
    return { cuts: [], rejectedMomentIds, rulesApplied: [...RULES_APPLIED] }
  }

  let outputStartSeconds = 0
  const cuts = selected.map((moment) => {
    const cut = toContractCut(moment, outputStartSeconds)
    outputStartSeconds += getDuration(moment)
    return cut
  })

  return {
    cuts,
    rejectedMomentIds: [...new Set(rejectedMomentIds)],
    rulesApplied: [...RULES_APPLIED],
  }
}
