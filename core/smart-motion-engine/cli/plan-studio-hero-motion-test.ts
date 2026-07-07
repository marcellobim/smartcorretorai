#!/usr/bin/env node
import { createStudioHeroMotionPlan } from '../planner.ts'

const counts = [1, 2, 5, 9]

const plans = counts.map((count) => createStudioHeroMotionPlan({
  jobId: `motion-test-${count}`,
  userId: 'local-user',
  neutralFramePath: `local-user/motion-test-${count}/system-neutral-final-frame.png`,
  imagePaths: Array.from({ length: count }, (_, index) => `local-user/motion-test-${count}/input-${index + 1}.jpg`),
  fidelityMode: 'high_fidelity',
  movement: 'smooth cinematic camera movement',
  lighting: 'soft premium natural light',
  atmosphere: 'clean cinematic real estate atmosphere',
  rhythm: 'calm balanced motion',
  cinematicEffects: 'subtle depth, reflections and light sweep',
}))

console.log(JSON.stringify({
  ok: true,
  plans: plans.map((plan) => ({
    imageCount: plan.imageCount,
    totalDurationSeconds: plan.totalDurationSeconds,
    neutralFrame: plan.neutralFrame,
    jobs: plan.jobs.map((job) => ({
      index: job.index,
      role: job.role,
      from: job.from,
      to: job.to,
      durationSeconds: job.durationSeconds,
      promptPreview: job.prompt.split('\n').slice(0, 8).join('\n'),
    })),
    warnings: plan.warnings,
  })),
}, null, 2))
