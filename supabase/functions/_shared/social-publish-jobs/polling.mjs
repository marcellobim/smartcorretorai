export const EXTERNAL_CONTAINER_STATES = Object.freeze([
  'IN_PROGRESS',
  'FINISHED',
  'ERROR',
  'EXPIRED',
])

const EXTERNAL_STATE_SET = new Set(EXTERNAL_CONTAINER_STATES)

const nextPollAt = (now, completedAttempts) => {
  const delaySeconds = Math.min(15 * (2 ** Math.min(completedAttempts, 5)), 300)
  return new Date(now.getTime() + delaySeconds * 1000).toISOString()
}

const requireJob = job => {
  if (!job || typeof job !== 'object') throw new Error('invalid_social_publish_job')
  if (typeof job.jobId !== 'string' || typeof job.claimToken !== 'string') {
    throw new Error('invalid_social_publish_job')
  }
  if (job.expectedStatus !== 'publishing') throw new Error('invalid_social_publish_job_state')
  if (typeof job.externalContainerId !== 'string' || !job.externalContainerId.trim()) {
    throw new Error('external_container_required')
  }
  if (!Number.isInteger(job.pollAttemptCount) || job.pollAttemptCount < 0) {
    throw new Error('invalid_poll_attempt_count')
  }
}

export async function pollSocialPublishContainer(job, dependencies, options = {}) {
  requireJob(job)
  if (!dependencies || typeof dependencies.fetchExternalContainerStatus !== 'function'
    || typeof dependencies.persistResult !== 'function'
    || typeof dependencies.persistTimeout !== 'function') {
    throw new Error('invalid_poll_dependencies')
  }

  const now = options.now instanceof Date ? options.now : new Date()
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_poll_time')

  const scheduledAt = job.nextPollAt ? Date.parse(job.nextPollAt) : Number.NaN
  if (Number.isFinite(scheduledAt) && scheduledAt > now.getTime()) {
    return {
      outcome: 'not_due',
      externalContainerId: job.externalContainerId,
      nextPollAt: job.nextPollAt,
      mediaPublishAllowed: false,
    }
  }

  const completedAttempts = job.pollAttemptCount + 1
  const deferredUntil = nextPollAt(now, completedAttempts)
  let externalStatus
  try {
    externalStatus = await dependencies.fetchExternalContainerStatus({
      externalContainerId: job.externalContainerId,
    })
  } catch {
    await dependencies.persistTimeout({
      jobId: job.jobId,
      claimToken: job.claimToken,
      expectedStatus: job.expectedStatus,
      externalContainerId: job.externalContainerId,
      nextPollAt: deferredUntil,
    })
    return {
      outcome: 'waiting',
      reason: 'ambiguous_timeout',
      externalContainerId: job.externalContainerId,
      pollAttemptCount: completedAttempts,
      nextPollAt: deferredUntil,
      mediaPublishAllowed: false,
    }
  }

  if (!EXTERNAL_STATE_SET.has(externalStatus)) externalStatus = 'ERROR'
  const scheduledNextPoll = externalStatus === 'IN_PROGRESS' ? deferredUntil : null

  await dependencies.persistResult({
    jobId: job.jobId,
    claimToken: job.claimToken,
    expectedStatus: job.expectedStatus,
    externalContainerId: job.externalContainerId,
    externalStatus,
    nextPollAt: scheduledNextPoll,
  })

  if (externalStatus === 'FINISHED') {
    return {
      outcome: 'ready_for_publish',
      externalStatus,
      externalContainerId: job.externalContainerId,
      pollAttemptCount: completedAttempts,
      nextPollAt: null,
      mediaPublishAllowed: true,
    }
  }
  if (externalStatus === 'ERROR') {
    return {
      outcome: 'failed',
      externalStatus,
      externalContainerId: job.externalContainerId,
      pollAttemptCount: completedAttempts,
      nextPollAt: null,
      errorCode: 'social_publish_failed',
      mediaPublishAllowed: false,
    }
  }
  if (externalStatus === 'EXPIRED') {
    return {
      outcome: 'failed',
      externalStatus,
      externalContainerId: job.externalContainerId,
      pollAttemptCount: completedAttempts,
      nextPollAt: null,
      errorCode: 'external_container_expired',
      mediaPublishAllowed: false,
    }
  }
  return {
    outcome: 'waiting',
    externalStatus,
    externalContainerId: job.externalContainerId,
    pollAttemptCount: completedAttempts,
    nextPollAt: deferredUntil,
    mediaPublishAllowed: false,
  }
}
