import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deploymentMode, edgeScope, VIRTUAL_STAGING_IMAGE_LIMIT_FUNCTIONS } from './edge-scope.mjs'

const deploySource = readFileSync(new URL('./deploy.mjs', import.meta.url), 'utf8')

test('Virtual Staging image-limit hotfix is explicit and deploys only its Edge Function', () => {
 const args = ['--target', 'snetia', '--virtual-staging-image-limit-hotfix']
 assert.equal(deploymentMode(args), '--virtual-staging-image-limit-hotfix')
 assert.deepEqual(edgeScope(args), VIRTUAL_STAGING_IMAGE_LIMIT_FUNCTIONS)
 assert.deepEqual(VIRTUAL_STAGING_IMAGE_LIMIT_FUNCTIONS, ['virtual-staging-image-test'])
 assert.throws(() => edgeScope([...args, '--admin-api']))
})

test('Virtual Staging image-limit hotfix rejects migrations', () => {
 assert.match(deploySource, /o hotfix de limite do Virtual Staging só pode publicar virtual-staging-image-test/)
 assert.match(deploySource, /o hotfix de limite do Virtual Staging não permite migrations/)
 assert.doesNotMatch(deploySource, /deployVirtualStagingImageLimitHotfix\)[\s\S]{0,1000}\['db','push'/)
})
