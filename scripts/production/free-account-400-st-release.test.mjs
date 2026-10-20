import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  deploymentMode,
  edgeScope,
  FREE_ACCOUNT_400_ST_FUNCTIONS,
  FREE_ACCOUNT_400_ST_MIGRATION,
} from './edge-scope.mjs'
import { verifyVirtualStagingTrialMigrationList } from './deploy.mjs'

const deploySource = readFileSync(new URL('./deploy.mjs', import.meta.url), 'utf8')

test('400 ST release is explicit and deploys only virtual-staging-image-test', () => {
  const args = ['--target', 'snetia', '--free-account-400-st']
  assert.equal(deploymentMode(args), '--free-account-400-st')
  assert.deepEqual(edgeScope(args), FREE_ACCOUNT_400_ST_FUNCTIONS)
  assert.deepEqual(FREE_ACCOUNT_400_ST_FUNCTIONS, ['virtual-staging-image-test'])
  assert.throws(() => edgeScope([...args, '--admin-api']))
})

test('400 ST release permits only its forward migration', () => {
  assert.equal(FREE_ACCOUNT_400_ST_MIGRATION, 'supabase/migrations/20261019010000_unify_free_account_smart_tokens.sql')
  assert.match(deploySource, /o saldo gratuito de 400 ST só pode publicar virtual-staging-image-test/)
  assert.match(deploySource, /o saldo gratuito de 400 ST só pode publicar a migration aprovada/)
  const list = [
    '   Local            | Remote           | Time (UTC)',
    '  ------------------|------------------|-----------------------',
    '   `20261017010000` | `20261017010000` | `2026-10-17 01:00:00`',
    '   `20261019010000` | ` `              | `2026-10-19 01:00:00`',
  ].join('\n')
  assert.deepEqual(verifyVirtualStagingTrialMigrationList(list, ['20261019010000']).pending, ['20261019010000'])
  assert.throws(() => verifyVirtualStagingTrialMigrationList(list.replace('`20261019010000` | ` `', '`20261019010000` | ` `\n   `20261020010000` | ` `'), ['20261019010000']), /somente a migration autorizada/)
})
