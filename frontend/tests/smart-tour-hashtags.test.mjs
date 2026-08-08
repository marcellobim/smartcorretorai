import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  mergeSmartTourCampaignHashtags,
  normalizeGeneratedHashtags,
} from '../src/lib/smart-tour-hashtags.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const smartTourPath = path.join(testDir, '../src/pages/SmartTourAI.jsx')

const packageFixture = () => ({
  id: 'package-1',
  title: 'Campanha preservada',
  metadata: { source: 'smart-tour' },
  aiCampaigns: [
    { id: 'instagram', caption: 'Legenda original', hashtags: ['#Anterior'] },
    { id: 'facebook', caption: 'Outra legenda' },
  ],
})

test('normalizes generated hashtags and removes duplicates without changing order', () => {
  assert.deepEqual(
    normalizeGeneratedHashtags([' #Imovel ', '#SmartCorretorAI', '#imovel', '', null]),
    ['#Imovel', '#SmartCorretorAI'],
  )
})

test('merges generated hashtags while preserving package and campaign fields', () => {
  const campaignPackage = packageFixture()
  const merged = mergeSmartTourCampaignHashtags(campaignPackage, ['#Novo', '#NOVO', '#TourVirtual'])

  assert.notEqual(merged, campaignPackage)
  assert.equal(merged.id, campaignPackage.id)
  assert.equal(merged.metadata, campaignPackage.metadata)
  assert.deepEqual(merged.aiCampaigns.map(({ id, caption }) => ({ id, caption })), [
    { id: 'instagram', caption: 'Legenda original' },
    { id: 'facebook', caption: 'Outra legenda' },
  ])
  assert.deepEqual(merged.aiCampaigns[0].hashtags, ['#Novo', '#TourVirtual'])
  assert.deepEqual(merged.aiCampaigns[1].hashtags, ['#Novo', '#TourVirtual'])
})

test('keeps the previous package when hashtags are absent or empty', () => {
  const campaignPackage = packageFixture()
  assert.equal(mergeSmartTourCampaignHashtags(campaignPackage), campaignPackage)
  assert.equal(mergeSmartTourCampaignHashtags(campaignPackage, []), campaignPackage)
  assert.equal(mergeSmartTourCampaignHashtags(campaignPackage, [' ', null]), campaignPackage)
})

test('preserves a legacy package without aiCampaigns', () => {
  const legacyPackage = { id: 'legacy', caption: 'Pacote antigo' }
  assert.equal(mergeSmartTourCampaignHashtags(legacyPackage, ['#Novo']), legacyPackage)
})

test('Smart Tour persists generated hashtags for the current images flow', async () => {
  const source = await readFile(smartTourPath, 'utf8')
  const imagesFlow = source.slice(source.indexOf('const orderedImages = images.slice()'), source.indexOf('const reset = () =>'))

  assert.match(imagesFlow, /buildSmartTourCampaignPackage\(\{[^}]*hashtags:data\.hashtags/)
  assert.match(imagesFlow, /inputFlow:'images'/)
})

test('Smart Tour restores status hashtags after reload through the shared merge', async () => {
  const source = await readFile(smartTourPath, 'utf8')

  assert.match(source, /campaignPackage: mergeSmartTourCampaignHashtags\(activeJob\?\.campaignPackage \|\| \{\}, data\.hashtags\)/)
  assert.match(source, /inputFlow: activeJob\?\.inputFlow \|\| 'images'/)
})
