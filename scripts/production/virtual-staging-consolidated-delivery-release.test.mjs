import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deploymentMode, edgeScope, VIRTUAL_STAGING_CONSOLIDATED_DELIVERY_FUNCTIONS, VIRTUAL_STAGING_CONSOLIDATED_DELIVERY_MIGRATION } from './edge-scope.mjs'
import { sameVirtualStagingTrialMigrationContent, verifyVirtualStagingTrialMigrationList } from './deploy.mjs'

const deploySource = readFileSync(new URL('./deploy.mjs', import.meta.url), 'utf8')

test('Virtual Staging consolidated delivery is explicit and deploys only its Edge Function', () => {
 const args = ['--target', 'snetia', '--virtual-staging-consolidated-delivery']
 assert.equal(deploymentMode(args), '--virtual-staging-consolidated-delivery')
 assert.deepEqual(edgeScope(args), VIRTUAL_STAGING_CONSOLIDATED_DELIVERY_FUNCTIONS)
 assert.deepEqual(VIRTUAL_STAGING_CONSOLIDATED_DELIVERY_FUNCTIONS, ['virtual-staging-image-test'])
 assert.throws(() => edgeScope([...args, '--admin-api']))
})

test('consolidated delivery permits only its committed migration artifact', () => {
 assert.equal(VIRTUAL_STAGING_CONSOLIDATED_DELIVERY_MIGRATION, 'supabase/migrations/20261022010000_allow_smart_space_consolidated_completed_items.sql')
 assert.match(deploySource, /a entrega consolidada do Virtual Staging só pode publicar virtual-staging-image-test/)
 assert.match(deploySource, /a entrega consolidada do Virtual Staging só pode publicar a migration aprovada/)
 assert.match(deploySource, /deployVirtualStagingConsolidatedDelivery[\s\S]{0,2500}\['db','push','--include-all','--project-ref',BANNER_RECOVERY_RELEASE\.projectRef,'--workdir',edgeStage\]/)
})

test('consolidated delivery accepts exactly its pending migration and only line-ending artifact changes', () => {
 const list = JSON.stringify({migrations:[
  {local:'20261020010000',remote:'20261020010000'},
  {local:'20261021020000',remote:''},
 ],message:'Migrations listed'})
 assert.deepEqual(verifyVirtualStagingTrialMigrationList(list,['20261021020000']).pending, ['20261021020000'])
 assert.throws(() => verifyVirtualStagingTrialMigrationList(list.replace('"remote":""','"remote":"20261021010000"'),['20261021020000']), /somente a migration autorizada/)
 assert.equal(sameVirtualStagingTrialMigrationContent(Buffer.from('select 1;\n'),Buffer.from('select 1;\r\n')),true)
})
