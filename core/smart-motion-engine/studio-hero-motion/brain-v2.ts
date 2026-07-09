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
  maxDurationPerEnvironmentSeconds: 7,
  maxMainReelDurationSeconds: 45,
  minMoments: 6,
} as const

const RULES_APPLIED = [
  'brain_version_2_1',
  'show_complete_property_before_highlights',
  'include_each_important_environment_once',
  'view_is_optional_not_default_opening',
  'target_40_to_55_seconds_for_long_source_videos',
  'limit_view_to_two_appearances',
  'limit_environment_dominance',
  'avoid_long_corridors',
  'avoid_doors_and_room_transitions',
  'avoid_repeated_environment',
  'prioritize_visually_interesting_rooms',
  'guarantee_strong_opening',
  'guarantee_strong_closing',
  'limit_duration_per_environment',
  'keep_smart_motion_contract_shape',
] as const

const IMPORTANT_ENVIRONMENT_TYPES = ['sala', 'cozinha', 'quarto', 'banheiro', 'lavanderia', 'varanda'] as const

function getDuration(moment: Pick<StudioHeroMotionCandidateMoment, 'sourceStartSeconds' | 'sourceEndSeconds'>) {
  return Math.max(0, moment.sourceEndSeconds - moment.sourceStartSeconds)
}

function trimMomentToMaxDuration(
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

function isUsableMoment(moment: StudioHeroMotionCandidateMoment) {
  return !moment.hasLongCorridor && !moment.hasDoorTransition && !moment.isEnvironmentTransition
}

function getEnvironmentType(moment: StudioHeroMotionCandidateMoment) {
  return moment.environmentType || moment.environmentId
}

function getTargetDurationRange(options: StudioHeroMotionBrainV2Options) {
  if (options.targetDurationRangeSeconds) return options.targetDurationRangeSeconds
  if ((options.sourceDurationSeconds || 0) > 120) return { min: 40, max: 55 }
  return { min: Math.min(36, options.maxMainReelDurationSeconds || DEFAULT_OPTIONS.maxMainReelDurationSeconds), max: options.maxMainReelDurationSeconds || DEFAULT_OPTIONS.maxMainReelDurationSeconds }
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
  const minMoments = options.minMoments || DEFAULT_OPTIONS.minMoments
  const rejectedMomentIds: string[] = []

  const usableMoments = candidates
    .filter((moment) => {
      const usable = isUsableMoment(moment)
      if (!usable) rejectedMomentIds.push(moment.id)
      return usable
    })
    .map((moment) => trimMomentToMaxDuration(moment, maxDurationPerEnvironmentSeconds))

  if (!usableMoments.length) {
    return { cuts: [], rejectedMomentIds, rulesApplied: [...RULES_APPLIED] }
  }

  const viewCountByType = new Map<string, number>()
  const nonViewMoments = usableMoments.filter((moment) => !['vista'].includes(getEnvironmentType(moment)))
  const openingPool = nonViewMoments.length ? nonViewMoments : usableMoments
  const opening = [...openingPool].sort((a, b) => b.openingStrength - a.openingStrength || b.visualInterestScore - a.visualInterestScore)[0]
  const closing = [...usableMoments].sort((a, b) => b.closingStrength - a.closingStrength || b.visualInterestScore - a.visualInterestScore)[0]
  const selected = [opening]
  const usedEnvironmentIds = new Set([opening.environmentId])

  const addMoment = (moment: StudioHeroMotionCandidateMoment) => {
    const environmentType = getEnvironmentType(moment)
    if (environmentType === 'vista') {
      const currentViewCount = viewCountByType.get(environmentType) || 0
      if (currentViewCount >= 2) {
        rejectedMomentIds.push(moment.id)
        return false
      }
      viewCountByType.set(environmentType, currentViewCount + 1)
    }
    if (!selected.some((item) => item.id === moment.id)) selected.push(moment)
    usedEnvironmentIds.add(moment.environmentId)
    return true
  }

  viewCountByType.set(getEnvironmentType(opening), getEnvironmentType(opening) === 'vista' ? 1 : 0)

  const bestMomentByEnvironmentType = new Map<string, StudioHeroMotionCandidateMoment>()
  for (const moment of usableMoments) {
    const environmentType = getEnvironmentType(moment)
    const current = bestMomentByEnvironmentType.get(environmentType)
    if (!current || moment.visualInterestScore > current.visualInterestScore) {
      bestMomentByEnvironmentType.set(environmentType, moment)
    }
  }

  for (const environmentType of IMPORTANT_ENVIRONMENT_TYPES) {
    const moment = bestMomentByEnvironmentType.get(environmentType)
    if (!moment || selected.some((item) => item.id === moment.id)) continue
    if (usedEnvironmentIds.has(moment.environmentId)) continue
    addMoment(moment)
  }

  const middleCandidates = usableMoments
    .filter((moment) => moment.id !== opening.id && moment.id !== closing.id)
    .sort((a, b) => b.visualInterestScore - a.visualInterestScore || a.sourceStartSeconds - b.sourceStartSeconds)

  for (const moment of middleCandidates) {
    const selectedDuration = selected.reduce((sum, item) => sum + getDuration(item), 0)
    if (selected.length >= minMoments && selectedDuration >= targetDurationRange.min && selected.some((item) => item.id === closing.id)) break
    if (selected.some((item) => item.id === moment.id)) continue
    if (usedEnvironmentIds.has(moment.environmentId)) {
      rejectedMomentIds.push(moment.id)
      continue
    }
    addMoment(moment)
  }

  if (!selected.some((moment) => moment.id === closing.id)) {
    if (usedEnvironmentIds.has(closing.environmentId) && closing.id !== opening.id) {
      const repeated = selected.find((moment) => moment.environmentId === closing.environmentId && moment.id !== opening.id)
      if (repeated) {
        selected.splice(selected.indexOf(repeated), 1)
        rejectedMomentIds.push(repeated.id)
      }
    }
    addMoment(closing)
  }

  let totalDurationSeconds = 0
  const ordered = selected
    .filter((moment, index, list) => list.findIndex((item) => item.id === moment.id) === index)
    .sort((a, b) => {
      if (a.id === opening.id) return -1
      if (b.id === opening.id) return 1
      if (a.id === closing.id) return 1
      if (b.id === closing.id) return -1
      return a.sourceStartSeconds - b.sourceStartSeconds
    })
    .filter((moment) => {
      const nextDuration = getDuration(moment)
      if (totalDurationSeconds + nextDuration > maxMainReelDurationSeconds) {
        rejectedMomentIds.push(moment.id)
        return false
      }
      totalDurationSeconds += nextDuration
      return true
    })

  let outputStartSeconds = 0
  const cuts = ordered.map((moment) => {
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
