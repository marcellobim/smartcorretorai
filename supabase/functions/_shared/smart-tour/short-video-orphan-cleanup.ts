export const SHORT_VIDEOS_INPUT_BUCKET = 'short-videos-inputs'
export const SHORT_VIDEO_ORPHAN_MIN_AGE_MS = 6 * 60 * 60 * 1000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed'])

export type ShortVideoInputObject = {
  bucketId: string
  name: string
  createdAt: string
}

export type ShortVideoJob = { status: string } | null

export type ShortVideoInputIdentity = {
  userId: string
  requestId: string
}

export function parseShortVideoInputPath(name: string): ShortVideoInputIdentity | null {
  const match = String(name || '').match(/^([^/]+)\/short-videos\/([^/]+)\/input\.mp4$/)
  if (!match || !UUID_PATTERN.test(match[1]) || !UUID_PATTERN.test(match[2])) return null
  return { userId: match[1], requestId: match[2] }
}

export function shouldRemoveShortVideoInput(
  object: ShortVideoInputObject,
  job: ShortVideoJob,
  nowMs = Date.now(),
): boolean {
  if (object.bucketId !== SHORT_VIDEOS_INPUT_BUCKET) return false
  if (!parseShortVideoInputPath(object.name)) return false
  const createdAtMs = Date.parse(object.createdAt)
  if (!Number.isFinite(createdAtMs) || nowMs - createdAtMs < SHORT_VIDEO_ORPHAN_MIN_AGE_MS) return false
  if (!job) return true
  return TERMINAL_JOB_STATUSES.has(job.status)
}

type CleanupDependencies = {
  objects: ShortVideoInputObject[]
  nowMs?: number
  getJob(identity: ShortVideoInputIdentity): Promise<ShortVideoJob>
  removeObject(name: string): Promise<void>
  log?(event: 'database_lookup_failed' | 'storage_remove_failed'): void
}

export async function runShortVideoOrphanCleanup(dependencies: CleanupDependencies) {
  const summary = { scanned: 0, removed: 0, preserved: 0, ignored: 0, failed: 0 }

  for (const object of dependencies.objects) {
    summary.scanned += 1
    const identity = object.bucketId === SHORT_VIDEOS_INPUT_BUCKET
      ? parseShortVideoInputPath(object.name)
      : null
    const createdAtMs = Date.parse(object.createdAt)
    const oldEnough = Number.isFinite(createdAtMs)
      && (dependencies.nowMs ?? Date.now()) - createdAtMs >= SHORT_VIDEO_ORPHAN_MIN_AGE_MS

    if (!identity || !oldEnough) {
      summary.ignored += 1
      continue
    }

    let job: ShortVideoJob
    try {
      job = await dependencies.getJob(identity)
    } catch {
      summary.failed += 1
      dependencies.log?.('database_lookup_failed')
      continue
    }

    if (!shouldRemoveShortVideoInput(object, job, dependencies.nowMs)) {
      summary.preserved += 1
      continue
    }

    try {
      await dependencies.removeObject(object.name)
      summary.removed += 1
    } catch {
      summary.failed += 1
      dependencies.log?.('storage_remove_failed')
    }
  }

  return summary
}
