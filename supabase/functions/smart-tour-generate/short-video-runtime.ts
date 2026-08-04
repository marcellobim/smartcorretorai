export type ShortVideoPipelineStage =
  | 'google_file_upload'
  | 'google_file_active'
  | 'openai_briefing'
  | 'gemini_interaction'

type PipelineDependencies<Prepared, Briefing, Started> = {
  persistStage(stage: ShortVideoPipelineStage): Promise<void>
  prepareVideo(): Promise<Prepared>
  cleanupInput(): Promise<void>
  prepareOpenAi(): Promise<Briefing>
  persistBriefing(briefing: Briefing): Promise<void>
  startGemini(prepared: Prepared, briefing: Briefing): Promise<Started>
  persistProvider(started: Started): Promise<void>
  persistFailure(stage: ShortVideoPipelineStage, error: unknown): Promise<void>
  onCleanupError?(stage: ShortVideoPipelineStage): void
  onFailurePersistError?(stage: ShortVideoPipelineStage): void
}

export async function runShortVideoPipeline<Prepared, Briefing, Started>(
  dependencies: PipelineDependencies<Prepared, Briefing, Started>,
) {
  let stage: ShortVideoPipelineStage = 'google_file_upload'
  let cleanupAttempted = false
  const cleanupOnce = async () => {
    if (cleanupAttempted) return
    cleanupAttempted = true
    try {
      await dependencies.cleanupInput()
    } catch {
      dependencies.onCleanupError?.(stage)
    }
  }

  try {
    await dependencies.persistStage(stage)
    const prepared = await dependencies.prepareVideo()
    stage = 'google_file_active'
    await dependencies.persistStage(stage)
    await cleanupOnce()

    stage = 'openai_briefing'
    const briefing = await dependencies.prepareOpenAi()
    await dependencies.persistBriefing(briefing)

    stage = 'gemini_interaction'
    const started = await dependencies.startGemini(prepared, briefing)
    await dependencies.persistProvider(started)
    return { prepared, briefing, started }
  } catch (error) {
    try {
      await dependencies.persistFailure(stage, error)
    } catch {
      dependencies.onFailurePersistError?.(stage)
    }
    await cleanupOnce()
    throw error
  }
}
