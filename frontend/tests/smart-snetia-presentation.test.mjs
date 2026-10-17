import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { VIRTUAL_STAGING_PRODUCT_DESCRIPTOR, VIRTUAL_STAGING_PRODUCT_NAME, VIRTUAL_STAGING_ROUTE } from '../src/config/virtualStaging.js'
import { FURNISH_RENOVATE_JOURNEY_ID } from '../src/config/virtualStagingFurnish.js'
import { getVirtualStagingJourney } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')

test('uses Smart Snetia and Virtual Staging across the internal presentation surfaces', () => {
  const virtualStaging = read('src/pages/VirtualStaging.jsx')
  const dashboard = read('src/pages/Dashboard.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const creations = read('src/pages/Creations.jsx')
  const metadata = read('src/components/seo/SiteMetadata.jsx')

  assert.equal(VIRTUAL_STAGING_PRODUCT_NAME, 'Smart Snetia')
  assert.equal(VIRTUAL_STAGING_PRODUCT_DESCRIPTOR, 'Virtual Staging')
  assert.match(virtualStaging, /<Header title=\{VIRTUAL_STAGING_PRODUCT_NAME\} subtitle=\{VIRTUAL_STAGING_PRODUCT_DESCRIPTOR\}/)
  assert.match(virtualStaging, /title: VIRTUAL_STAGING_PRODUCT_NAME, description: VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(virtualStaging, /smartSpaceCopy = \(t, key\) => t\(key\)\.replaceAll\('Smart Space', VIRTUAL_STAGING_PRODUCT_NAME\)/)
  assert.match(dashboard, /title: VIRTUAL_STAGING_PRODUCT_NAME,[\s\S]*description: VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(sidebar, /to: '\/virtual-staging', icon: Box, label: VIRTUAL_STAGING_PRODUCT_NAME/)
  assert.match(creations, /virtual_staging:[\s\S]*label: VIRTUAL_STAGING_PRODUCT_NAME/)
  assert.match(metadata, /'\/virtual-staging': 'Smart Snetia \| SNETIA'/)
})

test('preserves the route and persisted journey identifiers', () => {
  assert.equal(VIRTUAL_STAGING_ROUTE, '/virtual-staging')
  assert.equal(FURNISH_RENOVATE_JOURNEY_ID, 'furnish-renovate')
  assert.equal(getVirtualStagingJourney(FURNISH_RENOVATE_JOURNEY_ID)?.id, FURNISH_RENOVATE_JOURNEY_ID)
})
