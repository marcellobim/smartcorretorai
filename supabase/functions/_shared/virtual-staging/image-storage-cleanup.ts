export const VIRTUAL_STAGING_IMAGE_BUCKET = 'studio-videos'
export const VIRTUAL_STAGING_IMAGE_NAMESPACE = 'virtual-staging-images'
export const VIRTUAL_STAGING_IMAGE_RETENTION_MS = 6 * 60 * 60 * 1000
export const VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES = 500

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type VirtualStagingImageObject = {
  bucketId: string
  name: string
  createdAt: string
}

export type VirtualStagingImageIdentity = {
  kind: 'inputs' | 'results'
  userId: string
  objectId: string
}

export function isVirtualStagingImageUuid(value: string): boolean {
  return UUID_PATTERN.test(String(value || ''))
}

export function parseVirtualStagingImagePath(name: string): VirtualStagingImageIdentity | null {
  const segments = String(name || '').split('/')
  if (segments.length !== 5) return null

  const [userId, namespace, kind, objectId, filename] = segments
  if (
    namespace !== VIRTUAL_STAGING_IMAGE_NAMESPACE
    || (kind !== 'inputs' && kind !== 'results')
    || !isVirtualStagingImageUuid(userId)
    || !isVirtualStagingImageUuid(objectId)
  ) return null

  if (kind === 'inputs' && !/^0[1-5]\.(?:jpg|png)$/i.test(filename)) return null
  if (kind === 'results' && filename !== 'generated-01.jpg') return null

  return { kind, userId, objectId }
}

export function shouldRemoveVirtualStagingImageObject(
  object: VirtualStagingImageObject,
  nowMs = Date.now(),
): boolean {
  if (object.bucketId !== VIRTUAL_STAGING_IMAGE_BUCKET) return false
  if (!parseVirtualStagingImagePath(object.name)) return false
  const createdAtMs = Date.parse(object.createdAt)
  return Number.isFinite(createdAtMs) && nowMs - createdAtMs > VIRTUAL_STAGING_IMAGE_RETENTION_MS
}

type CleanupDependencies = {
  listObjects(): Promise<VirtualStagingImageObject[]>
  removeObject(name: string): Promise<void>
  nowMs?: number
  log?(event: 'storage_list_failed' | 'storage_remove_failed'): void
}

export async function runVirtualStagingImageCleanup(dependencies: CleanupDependencies) {
  const summary = {
    scanned: 0,
    removed: 0,
    preserved: 0,
    ignored: 0,
    failed: 0,
    limited: 0,
    listingFailed: false,
  }

  let listedObjects: VirtualStagingImageObject[]
  try {
    listedObjects = await dependencies.listObjects()
  } catch {
    summary.failed = 1
    summary.listingFailed = true
    dependencies.log?.('storage_list_failed')
    return summary
  }

  const objects = listedObjects.slice(0, VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES)
  summary.limited = Math.max(0, listedObjects.length - objects.length)

  for (const object of objects) {
    summary.scanned += 1
    if (object.bucketId !== VIRTUAL_STAGING_IMAGE_BUCKET || !parseVirtualStagingImagePath(object.name)) {
      summary.ignored += 1
      continue
    }
    if (!shouldRemoveVirtualStagingImageObject(object, dependencies.nowMs)) {
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
