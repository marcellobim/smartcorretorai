import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve('frontend/src')
const read = file => readFileSync(path.join(root, file), 'utf8')
const campaignPackage = read('components/campaign/CampaignPackage.jsx')
const publishDialog = read('components/campaign/BannerPublishDialog.jsx')
const virtualStaging = read('pages/VirtualStaging.jsx')
const captionEditor = read('components/campaign/SocialCaptionEditor.jsx')
const socialState = read('components/campaign/socialPublishUiState.js')
const ptBR = read('i18n/messages/pt-BR.js')
const enUS = read('i18n/messages/en-US.js')

test('CampaignPackage keeps download defaults and forwards optional uiLabels', () => {
  for (const text of ['Baixando...', 'Baixar', 'Baixar vídeo']) assert.match(campaignPackage, new RegExp(`uiLabels\\?\\.download[\\s\\S]*?${text}`))
  assert.match(campaignPackage, /<BannerPublishDialog uiLabels=\{uiLabels\} intent=\{bannerPublishIntent\}/)
})

test('CampaignPackage preserves all legacy visual defaults when uiLabels is absent', () => {
  for (const text of ['Carregando prévia...', 'Não foi possível carregar a prévia.', 'Tentar novamente', 'Mídias geradas', 'Artes da campanha', 'Arquivo indisponível', 'Aguardando renderização', 'Renderizando...', 'Resultado temporariamente indisponível.', 'Pacote da Campanha', 'Textos para divulgação', 'Dicas para divulgar']) assert.match(campaignPackage, new RegExp(text.replaceAll('.', '\\.')))
  for (const section of ['preview', 'media', 'result', 'actions', 'campaign']) assert.match(campaignPackage, new RegExp(`uiLabels\\?\\.${section}\\?\\.`))
})

test('BannerPublishDialog keeps literal fallbacks and accepts custom labels without changing handlers', () => {
  assert.match(publishDialog, /captionPlaceholder = '', uiLabels/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.freePublication \?\? 'Publicação gratuita'/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.confirm \?\? 'Confirmar publicação'/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.checkingConnections \?\? 'Consultando contas conectadas…'/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.cancel \?\? 'Cancelar'/)
  assert.match(publishDialog, /uiLabels\?\.social\?\.publish \?\? 'Publicar agora'/)
  assert.match(publishDialog, /uiLabels\?\.accessibility\?\.cancelPublish \?\? 'Cancelar publicação'/)
  for (const handler of ['onPublish', 'onRecover', 'onConfirmed', 'onTerminalClose', 'onClose']) assert.match(publishDialog, new RegExp(handler))
})

test('social editor and progress retain defaults while accepting optional labels', () => {
  for (const text of ['TEXTO DA PUBLICAÇÃO (OPCIONAL)', 'Você pode editar, substituir ou apagar todo o texto.', 'Limite da legenda']) assert.ok(captionEditor.includes(text), text)
  assert.match(captionEditor, /uiLabels\?\.label/)
  assert.match(publishDialog, /<SocialCaptionEditor[\s\S]*uiLabels=\{uiLabels\?\.social\?\.caption\}/)
  assert.match(publishDialog, /<SocialPublishProgress[\s\S]*uiLabels=\{uiLabels\}/)
  for (const text of ['Publicando...', 'Publicado', 'Confirmando publicação...', 'Aguardando confirmação']) assert.match(socialState, new RegExp(text.replaceAll('.', '\\.')))
  assert.match(socialState, /getSocialPublishResultLabel\(status, labels = \{\}\)/)
  assert.match(socialState, /getSocialPublishNotice\(results, \{ submissionStarted = false, confirmationPending = false \} = \{\}, labels = \{\}\)/)
})

test('Life and Broker provide complete PT-BR and EN-US visual label contracts', () => {
  for (const messages of [ptBR, enUS]) {
    for (const key of ['preview:', 'media:', 'result:', 'actions:', 'campaign:', 'creationPreparationError:', 'multipleAccounts:', 'connectMetaHelp:', 'caption:', 'progress:', 'resultByDestination:']) assert.ok(messages.includes(key), key)
  }
  for (const key of ['preview', 'media', 'result', 'actions', 'campaign']) assert.match(virtualStaging, new RegExp(`videoUiLabels = \\{[\\s\\S]*?${key}:`))
  assert.match(virtualStaging, /social: \{[\s\S]*?caption: \{[\s\S]*?progress: \{/)
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
