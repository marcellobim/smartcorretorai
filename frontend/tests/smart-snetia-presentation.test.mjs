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

test('uses Snetia Space and Virtual Staging across the internal and Landing presentation surfaces', () => {
  const virtualStaging = read('src/pages/VirtualStaging.jsx')
  const dashboard = read('src/pages/Dashboard.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const creations = read('src/pages/Creations.jsx')
  const metadata = read('src/components/seo/SiteMetadata.jsx')
  const landing = read('src/pages/LandingPage.jsx')
  const localeProvider = read('src/i18n/LocaleProvider.jsx')

  assert.equal(VIRTUAL_STAGING_PRODUCT_NAME, 'Snetia Space')
  assert.equal(VIRTUAL_STAGING_PRODUCT_DESCRIPTOR, 'Virtual Staging')
  assert.match(virtualStaging, /<Header title=\{VIRTUAL_STAGING_PRODUCT_NAME\} subtitle=\{VIRTUAL_STAGING_PRODUCT_DESCRIPTOR\}/)
  assert.match(virtualStaging, /title: VIRTUAL_STAGING_PRODUCT_NAME, description: VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(virtualStaging, /smartSpaceCopy = \(t, key\) => t\(key\)\.replaceAll\('Smart Space', VIRTUAL_STAGING_PRODUCT_NAME\)/)
  assert.match(virtualStaging, /journey\.selected[\s\S]*title: VIRTUAL_STAGING_PRODUCT_NAME/)
  assert.match(virtualStaging, /smartSpaceCopy\(t, 'virtualStaging\.smartSpace\.reviewToContinue'\)/)
  assert.match(virtualStaging, /smartSpaceCopy\(t, 'virtualStaging\.smartSpace\.processingTitle'\)/)
  assert.match(virtualStaging, /smartSpaceCopy\(t, 'virtualStaging\.smartSpace\.resultReady'\)/)
  assert.match(virtualStaging, /smartSpaceCopy\(t, 'virtualStaging\.smartSpace\.recovering'\)/)
  assert.match(dashboard, /title: VIRTUAL_STAGING_PRODUCT_NAME,[\s\S]*description: VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(sidebar, /to: '\/virtual-staging', icon: Box, label: VIRTUAL_STAGING_PRODUCT_NAME/)
  assert.match(creations, /virtual_staging:[\s\S]*label: VIRTUAL_STAGING_PRODUCT_NAME/)
  assert.match(metadata, /'\/virtual-staging': 'Snetia Space \| SNETIA'/)
  assert.match(landing, /VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(localeProvider, /replaceAll\('Smart Space', 'Snetia Space'\)/)
})

test('preserves the route and persisted journey identifiers', () => {
  assert.equal(VIRTUAL_STAGING_ROUTE, '/virtual-staging')
  assert.equal(FURNISH_RENOVATE_JOURNEY_ID, 'furnish-renovate')
  assert.equal(getVirtualStagingJourney(FURNISH_RENOVATE_JOURNEY_ID)?.id, FURNISH_RENOVATE_JOURNEY_ID)
})
