import type { StudioHeroMotionCut } from './contract.ts'

export type StudioHeroMotionCandidateMoment = {
  id: string
  environmentId: string
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
  minMoments?: number
}

export type StudioHeroMotionBrainV2Selection = {
  cuts: StudioHeroMotionCut[]
  rejectedMomentIds: string[]
  rulesApplied: string[]
}

const DEFAULT_OPTIONS = {
  maxDurationPerEnvironmentSeconds: 6,
  maxMainReelDurationSeconds: 30,
  minMoments: 4,
} as const

const RULES_APPLIED = [
  'avoid_long_corridors',
  'avoid_doors_and_room_transitions',
  'avoid_repeated_environment',
  'prioritize_visually_interesting_rooms',
  'guarantee_strong_opening',
  'guarantee_strong_closing',
  'limit_duration_per_environment',
  'keep_smart_motion_contract_shape',
] as const

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
  const maxMainReelDurationSeconds = options.maxMainReelDurationSeconds || DEFAULT_OPTIONS.maxMainReelDurationSeconds
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

  const opening = [...usableMoments].sort((a, b) => b.openingStrength - a.openingStrength || b.visualInterestScore - a.visualInterestScore)[0]
  const closing = [...usableMoments].sort((a, b) => b.closingStrength - a.closingStrength || b.visualInterestScore - a.visualInterestScore)[0]
  const selected = [opening]
  const usedEnvironmentIds = new Set([opening.environmentId])

  const middleCandidates = usableMoments
    .filter((moment) => moment.id !== opening.id && moment.id !== closing.id)
    .sort((a, b) => b.visualInterestScore - a.visualInterestScore || a.sourceStartSeconds - b.sourceStartSeconds)

  for (const moment of middleCandidates) {
    if (selected.length >= minMoments && selected.some((item) => item.id === closing.id)) break
    if (usedEnvironmentIds.has(moment.environmentId)) {
      rejectedMomentIds.push(moment.id)
      continue
    }
    selected.push(moment)
    usedEnvironmentIds.add(moment.environmentId)
  }

  if (!selected.some((moment) => moment.id === closing.id)) {
    if (usedEnvironmentIds.has(closing.environmentId) && closing.id !== opening.id) {
      const repeated = selected.find((moment) => moment.environmentId === closing.environmentId && moment.id !== opening.id)
      if (repeated) {
        selected.splice(selected.indexOf(repeated), 1)
        rejectedMomentIds.push(repeated.id)
      }
    }
    selected.push(closing)
  }

  let totalDurationSeconds = 0
  const ordered = selected
    .filter((moment, index, list) => list.findIndex((item) => item.id === moment.id) === index)
    .sort((a, b) => {
      if (a.id === opening.id) return -1
      if (b.id === opening.id) return 1
      if (a.id === closing.id) return 1
      if (b.id === closing.id) return -1
      return b.visualInterestScore - a.visualInterestScore || a.sourceStartSeconds - b.sourceStartSeconds
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
