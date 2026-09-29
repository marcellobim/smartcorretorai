import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve('frontend/src')
const read = file => readFileSync(path.join(root, file), 'utf8')
const campaignPackage = read('components/campaign/CampaignPackage.jsx')
const publishDialog = read('components/campaign/BannerPublishDialog.jsx')
const virtualStaging = read('pages/VirtualStaging.jsx')

test('CampaignPackage keeps download defaults and forwards optional uiLabels', () => {
  for (const text of ['Baixando...', 'Baixar', 'Baixar vídeo']) assert.match(campaignPackage, new RegExp(`uiLabels\\?\\.download[\\s\\S]*?${text}`))
  assert.match(campaignPackage, /<BannerPublishDialog uiLabels=\{uiLabels\} intent=\{bannerPublishIntent\}/)
})

test('BannerPublishDialog keeps literal fallbacks and accepts custom labels without changing handlers', () => {
  assert.match(publishDialog, /captionPlaceholder = '', uiLabels/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.freePublication \?\? 'Publicação gratuita'/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.confirm \?\? 'Confirmar publicação'/)
  assert.match(publishDialog, /uiLabels\?\.accessibility\?\.cancelPublish \?\? 'Cancelar publicação'/)
  for (const handler of ['onPublish', 'onRecover', 'onConfirmed', 'onTerminalClose', 'onClose']) assert.match(publishDialog, new RegExp(handler))
})

test('only video journeys provide localized uiLabels', () => {
  assert.match(virtualStaging, /const videoUiLabels = \{[\s\S]*?t\('virtualStaging\.download\.loading'\)/)
  assert.match(virtualStaging, /uiLabels=\{videoUiLabels\}/)
  assert.match(virtualStaging, /const isLifeInProperty = journey\.id === LIFE_IN_PROPERTY_JOURNEY_ID/)
  assert.match(virtualStaging, /const isBrokerPresentation = journey\.id === BROKER_PRESENTATION_JOURNEY_ID/)
  assert.match(virtualStaging, /if \(isFurnishRenovate && status === 'completed'[\s\S]*?<FurnishRenovateDelivery[\s\S]*?\n  if \(result\)/)
  assert.match(virtualStaging, /<BannerPublishDialog intent=\{publishIntent\}/)
  assert.doesNotMatch(virtualStaging, /<BannerPublishDialog uiLabels=\{videoUiLabels\} intent=\{publishIntent\}/)
})
