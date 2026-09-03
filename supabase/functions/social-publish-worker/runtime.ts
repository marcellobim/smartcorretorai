export type SocialPlatform = 'instagram' | 'facebook'
export type SocialMediaKind = 'image' | 'video'
export type ExternalContainerStatus = 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED'

export type AutonomousSocialJob = {
  id: string
  claimToken: string
  platform: SocialPlatform
  sourceType: string
  caption: string
  status: 'queued' | 'processing' | 'publishing' | 'reconciliation_required' | 'retry_scheduled'
  containerId: string | null
  containerStatus: ExternalContainerStatus | null
  commitStartedAt: string | null
}

export type PublishedMatch = { id: string; permalink: string | null }

export type SocialPublishWorkerDependencies = {
  claimDueJobs(limit: number): Promise<AutonomousSocialJob[]>
  mediaKind(job: AutonomousSocialJob): SocialMediaKind
  prepareNewPublish(job: AutonomousSocialJob): Promise<'prepared' | 'terminal_failure'>
  getContainerStatus(job: AutonomousSocialJob): Promise<ExternalContainerStatus>
  recordContainerStatus(job: AutonomousSocialJob, status: ExternalContainerStatus): Promise<boolean>
  beginInstagramCommit(job: AutonomousSocialJob): Promise<boolean>
  publishInstagram(job: AutonomousSocialJob): Promise<PublishedMatch>
  publishFacebook(job: AutonomousSocialJob): Promise<PublishedMatch>
  findPublished(job: AutonomousSocialJob): Promise<PublishedMatch | null>
  complete(job: AutonomousSocialJob, match: PublishedMatch): Promise<boolean>
  defer(job: AutonomousSocialJob): Promise<boolean>
  fail(job: AutonomousSocialJob, code: string): Promise<boolean>
  log?(event: string, details?: Record<string, unknown>): void
}

export type WorkerSummary = {
  claimed: number
  published: number
  deferred: number
  failed: number
}

const isNew = (job: AutonomousSocialJob) => (
  job.status === 'queued' || job.status === 'processing' || job.status === 'retry_scheduled'
)

async function reconcile(job: AutonomousSocialJob, dependencies: SocialPublishWorkerDependencies) {
  const match = await dependencies.findPublished(job)
  if (!match) {
    await dependencies.defer(job)
    return 'deferred' as const
  }
  if (!await dependencies.complete(job, match)) {
    await dependencies.defer(job)
    return 'deferred' as const
  }
  return 'published' as const
}

async function processInstagram(job: AutonomousSocialJob, dependencies: SocialPublishWorkerDependencies) {
  if (job.status === 'reconciliation_required' || job.commitStartedAt) {
    return reconcile(job, dependencies)
  }

  if (isNew(job)) {
    const prepared = await dependencies.prepareNewPublish(job)
    if (prepared === 'terminal_failure') return 'failed' as const
    return 'deferred' as const
  }

  if (!job.containerId) {
    await dependencies.fail(job, 'social_publish_failed')
    return 'failed' as const
  }

  let externalStatus = job.containerStatus
  if (externalStatus !== 'FINISHED') {
    externalStatus = await dependencies.getContainerStatus(job)
    if (!await dependencies.recordContainerStatus(job, externalStatus)) return 'deferred' as const
  }

  if (externalStatus === 'IN_PROGRESS') return 'deferred' as const
  if (externalStatus === 'ERROR' || externalStatus === 'EXPIRED') return 'failed' as const

  if (!await dependencies.beginInstagramCommit(job)) {
    return reconcile({ ...job, commitStartedAt: job.commitStartedAt || new Date().toISOString() }, dependencies)
  }

  try {
    const published = await dependencies.publishInstagram(job)
    if (await dependencies.complete(job, published)) return 'published' as const
  } catch {
    // A timeout after media_publish is ambiguous. Never repeat the mutation.
  }
  await dependencies.defer(job)
  return 'deferred' as const
}

async function processFacebook(job: AutonomousSocialJob, dependencies: SocialPublishWorkerDependencies) {
  if (job.status === 'reconciliation_required' || job.commitStartedAt) {
    return reconcile(job, dependencies)
  }
  if (!isNew(job)) {
    await dependencies.defer(job)
    return 'deferred' as const
  }

  const prepared = await dependencies.prepareNewPublish(job)
  if (prepared === 'terminal_failure') return 'failed' as const
  try {
    const published = await dependencies.publishFacebook(job)
    if (await dependencies.complete(job, published)) return 'published' as const
  } catch {
    // The external POST may have succeeded even if its response was lost.
  }
  await dependencies.defer(job)
  return 'deferred' as const
}

export async function runSocialPublishWorker(
  dependencies: SocialPublishWorkerDependencies,
  limit = 4,
): Promise<WorkerSummary> {
  const jobs = await dependencies.claimDueJobs(limit)
  const summary: WorkerSummary = { claimed: jobs.length, published: 0, deferred: 0, failed: 0 }

  for (const job of jobs) {
    try {
      const outcome = job.platform === 'instagram'
        ? await processInstagram(job, dependencies)
        : await processFacebook(job, dependencies)
      summary[outcome] += 1
      dependencies.log?.('job_finished', { platform: job.platform, outcome })
    } catch {
      await dependencies.defer(job).catch(() => false)
      summary.deferred += 1
      dependencies.log?.('job_deferred', { platform: job.platform })
    }
  }
  return summary
}
