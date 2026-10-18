import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deploymentMode, edgeScope, VIRTUAL_STAGING_TRIAL_FUNCTIONS, VIRTUAL_STAGING_TRIAL_MIGRATION } from './edge-scope.mjs'
import { sameVirtualStagingTrialMigrationContent, verifyVirtualStagingTrialMigrationList } from './deploy.mjs'

const deploySource = readFileSync(new URL('./deploy.mjs', import.meta.url), 'utf8')

test('Virtual Staging trial release is an explicit, single-function mode', () => {
  const args = ['--target', 'snetia', '--virtual-staging-trial']
  assert.equal(deploymentMode(args), '--virtual-staging-trial')
  assert.deepEqual(edgeScope(args), VIRTUAL_STAGING_TRIAL_FUNCTIONS)
  assert.deepEqual(VIRTUAL_STAGING_TRIAL_FUNCTIONS, ['virtual-staging-image-test'])
})

test('Virtual Staging trial release accepts only its committed migration artifact', () => {
  assert.match(VIRTUAL_STAGING_TRIAL_MIGRATION, /^supabase\/migrations\/\d+_add_virtual_staging_landing_trial\.sql$/)
  assert.match(deploySource, /o trial de Virtual Staging só pode publicar virtual-staging-image-test/)
  assert.match(deploySource, /o trial de Virtual Staging só pode publicar a migration aprovada/)
  assert.match(deploySource, /\['db','push','--include-all','--project-ref',BANNER_RECOVERY_RELEASE\.projectRef,'--workdir',edgeStage\]/)
})

test('Virtual Staging trial migration gate accepts exactly one pending migration', () => {
  const list = [
    '   Local            | Remote           | Time (UTC)',
    '  ------------------|------------------|-----------------------',
    '   `20261010010000` | `20261010010000` | `2026-10-10 01:00:00`',
    '   `20261017010000` | ` `              | `2026-10-17 01:00:00`',
  ].join('\n')
  assert.deepEqual(verifyVirtualStagingTrialMigrationList(list).pending, ['20261017010000'])
  assert.throws(() => verifyVirtualStagingTrialMigrationList(list.replace('` `', '`20261016010000`')), /somente a migration autorizada/)
  assert.throws(() => verifyVirtualStagingTrialMigrationList(list.replace('`20261017010000` | ` `', '`20261017010000` | ` `\n   `20261018010000` | ` `')), /somente a migration autorizada/)
})

test('Virtual Staging trial migration gate consumes the Supabase CLI JSON comparison', () => {
  const list = JSON.stringify({
    migrations: [
      { local: '001', remote: '001', time: '2024-01-01T00:00:00Z' },
      { local: '20261016010000', remote: '20261016010000', time: '2026-10-16T01:00:00Z' },
      { local: '20261017010000', remote: '', time: '2026-10-17T01:00:00Z' },
    ],
    message: 'Migrations listed',
  })
  assert.deepEqual(verifyVirtualStagingTrialMigrationList(list), {
    applied: ['001', '20261016010000'],
    pending: ['20261017010000'],
  })
  assert.throws(() => verifyVirtualStagingTrialMigrationList(list.replace('"remote":""', '"remote":"20261016020000"')), /somente a migration autorizada/)
})

test('Virtual Staging trial migration proof permits only archive line-ending normalization', () => {
  assert.equal(sameVirtualStagingTrialMigrationContent(Buffer.from('select 1;\n'), Buffer.from('select 1;\r\n')), true)
  assert.equal(sameVirtualStagingTrialMigrationContent(Buffer.from('select 1;\n'), Buffer.from('select 2;\r\n')), false)
})
