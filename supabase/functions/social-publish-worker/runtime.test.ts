import { assertEquals } from 'jsr:@std/assert'
import {
  runSocialPublishWorker,
  type AutonomousSocialJob,
  type SocialPublishWorkerDependencies,
} from './runtime.ts'

const baseJob = (overrides: Partial<AutonomousSocialJob> = {}): AutonomousSocialJob => ({
  id: '11111111-1111-4111-8111-111111111111',
  claimToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  platform: 'instagram',
  sourceType: 'video_imobiliario',
  caption: 'Legenda exata',
  status: 'publishing',
  containerId: '18000000000000001',
  containerStatus: 'IN_PROGRESS',
  commitStartedAt: null,
  ...overrides,
})

const context = (jobs: AutonomousSocialJob[], external: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' = 'FINISHED') => {
  const calls = { prepare: 0, poll: 0, begin: 0, instagram: 0, facebook: 0, find: 0, complete: 0, defer: 0, fail: 0 }
  const dependencies: SocialPublishWorkerDependencies = {
    claimDueJobs: async () => jobs,
    mediaKind: job => job.sourceType === 'video_imobiliario' ? 'video' : 'image',
    prepareNewPublish: async () => { calls.prepare++; return 'prepared' },
    getContainerStatus: async () => { calls.poll++; return external },
    recordContainerStatus: async (_job, status) => {
      if (status === 'IN_PROGRESS') calls.defer++
      if (status === 'ERROR' || status === 'EXPIRED') calls.fail++
      return true
    },
    beginInstagramCommit: async () => { calls.begin++; return true },
    publishInstagram: async () => { calls.instagram++; return { id: '19000000000000001', permalink: 'https://www.instagram.com/reel/test/' } },
    publishFacebook: async () => { calls.facebook++; return { id: '19000000000000002', permalink: 'https://www.facebook.com/1/videos/2' } },
    findPublished: async () => { calls.find++; return { id: '19000000000000003', permalink: 'https://www.instagram.com/reel/recovered/' } },
    complete: async () => { calls.complete++; return true },
    defer: async () => { calls.defer++; return true },
    fail: async () => { calls.fail++; return true },
  }
  return { calls, dependencies }
}

Deno.test('Instagram rápido publica uma vez após FINISHED', async () => {
  const c = context([baseJob()])
  assertEquals(await runSocialPublishWorker(c.dependencies), { claimed: 1, published: 1, deferred: 0, failed: 0 })
  assertEquals(c.calls.instagram, 1)
  assertEquals(c.calls.begin, 1)
})

Deno.test('Instagram IN_PROGRESS é adiado sem media_publish', async () => {
  const c = context([baseJob()], 'IN_PROGRESS')
  assertEquals(await runSocialPublishWorker(c.dependencies), { claimed: 1, published: 0, deferred: 1, failed: 0 })
  assertEquals(c.calls.instagram, 0)
})

Deno.test('execução repetida após commit apenas reconcilia e não reposta', async () => {
  const c = context([baseJob({ status: 'reconciliation_required', commitStartedAt: '2026-09-01T12:00:00Z' })])
  assertEquals(await runSocialPublishWorker(c.dependencies), { claimed: 1, published: 1, deferred: 0, failed: 0 })
  assertEquals(c.calls.find, 1)
  assertEquals(c.calls.instagram, 0)
  assertEquals(c.calls.begin, 0)
})

Deno.test('Facebook novo publica uma vez; Facebook ambíguo só reconcilia', async () => {
  const fresh = context([baseJob({ platform: 'facebook', status: 'processing', containerId: null, containerStatus: null })])
  assertEquals((await runSocialPublishWorker(fresh.dependencies)).published, 1)
  assertEquals(fresh.calls.facebook, 1)

  const ambiguous = context([baseJob({ platform: 'facebook', status: 'reconciliation_required', containerId: null, containerStatus: null, commitStartedAt: '2026-09-01T12:00:00Z' })])
  assertEquals((await runSocialPublishWorker(ambiguous.dependencies)).published, 1)
  assertEquals(ambiguous.calls.facebook, 0)
  assertEquals(ambiguous.calls.find, 1)
})

Deno.test('falha terminal do container afeta somente Instagram', async () => {
  const jobs = [baseJob(), baseJob({ id: '22222222-2222-4222-8222-222222222222', platform: 'facebook', status: 'processing', containerId: null, containerStatus: null })]
  const c = context(jobs, 'ERROR')
  assertEquals(await runSocialPublishWorker(c.dependencies), { claimed: 2, published: 1, deferred: 0, failed: 1 })
  assertEquals(c.calls.facebook, 1)
  assertEquals(c.calls.instagram, 0)
})
