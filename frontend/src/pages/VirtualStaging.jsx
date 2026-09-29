import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BRAND } from '../config/brand'
import { ArrowDown, ArrowUp, Download, Expand, Instagram, Loader2, PlayCircle, Sparkles, Trash2, UploadCloud, Video, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import CampaignPackage from '../components/campaign/CampaignPackage'
import BannerPublishDialog from '../components/campaign/BannerPublishDialog'
import { useAnalytics } from '../components/analytics/AnalyticsProvider'
import SmartTokenEstimate from '../components/economy/SmartTokenEstimate'
import { buildVirtualStagingCampaignPackage, mergeVirtualStagingCampaignHashtags } from '../components/campaign/buildVirtualStagingCampaignPackage'
import SmartCarouselCitySelect, { SmartCarouselStateSelect } from '../components/location/SmartCarouselCitySelect'
import GuidedConversation from '../components/conversation/GuidedConversation'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, ProductSteps } from '../components/design-system'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useProductDraft } from '../hooks/useProductDraft'
import { useAccountAnalytics } from '../hooks/useAccountAnalytics'
import { useLocale } from '../i18n/useLocale'
import { useAuth } from '../lib/auth-context'
import { ACCOUNT_ANALYTICS_PRODUCTS as PRODUCTS, ACCOUNT_ANALYTICS_STEPS as STEPS } from '../lib/account-analytics'
import { toFileMetadata } from '../lib/product-draft'
import { downloadFileFromPrivateUrl, getDownloadErrorMessage } from '../lib/download-file'
import { supabase } from '../lib/supabase'
import { getSmartTokenErrorMessage, SMART_TOKEN_COSTS } from '../lib/smart-tokens'
import { VIRTUAL_STAGING_MAX_IMAGES, VIRTUAL_STAGING_PRODUCT_NAME } from '../config/virtualStaging'
import { buildFurnishRenovateReviewItems, canAddFurnishRenovateImages, furnishRenovateRequiresStyle, FURNISH_RENOVATE_COPY, FURNISH_RENOVATE_JOURNEY_ID, FURNISH_RENOVATE_MAX_IMAGES, FURNISH_RENOVATE_QUESTIONS, FURNISH_RENOVATE_STYLE_OPTIONS, FURNISH_RENOVATE_TRANSFORMATION_OPTIONS, getFurnishRenovateStyleLabel, getFurnishRenovateTransformationLabel, getSmartSpaceQuote, getSmartSpaceUnitCost, isAvailableFurnishRenovateTransformation } from '../config/virtualStagingFurnish'
import { getRecoverableVirtualStagingJourneyId, getVirtualStagingJourney, getVirtualStagingJourneySessionKey, isUsableVirtualStagingVideoUrl, parseVirtualStagingJobRecord, VIRTUAL_STAGING_JOURNEYS } from '../config/virtualStagingJourneys'
import { buildLifeInPropertyGenerationPayload, getLifeSceneLabel, LIFE_IN_PROPERTY_JOURNEY_ID, LIFE_RENTAL_STAGE_OPTIONS, LIFE_SCENE_OPTIONS } from '../config/virtualStagingLife'
import { BROKER_CUSTOM_SPEECH_MAX_WORDS, BROKER_PRESENTATION_JOURNEY_ID, BROKER_REFERENCE_OPTIONS, BROKER_SPEECH_OPTIONS, buildBrokerPresentationFilePayload, buildBrokerPresentationGenerationPayload, validatePresenterReferenceSelection } from '../config/virtualStagingBroker'
import { getVirtualStagingNextQuestion, getVirtualStagingReviewEditNext } from '../config/virtualStagingConversation'
import { formatVirtualStagingCurrency, formatVirtualStagingLocation, getVirtualStagingHighlightGroups, getVirtualStagingMeasureFields, normalizeVirtualStagingDistrict, VIRTUAL_STAGING_MEASURE_OPTIONS, VIRTUAL_STAGING_PROPERTY_TYPES } from '../config/virtualStagingForm'
import { getVirtualStagingHighlightGroupLabel, getVirtualStagingHighlightLabel, isVirtualStagingHighlightAvailableForMarket } from '../config/virtualStagingHighlightLabels'
import { getCountiesByState, getStatesForMarket, isValidUsZipCode, normalizeUsZipCode } from '../config/locations'
import { formatPhone } from '../utils/phoneFormatters'
import { buildSmartSpaceRecovery, getSmartSpaceRecoveryKey, normalizeSmartSpaceResult, normalizeSmartSpaceVideo, parseSmartSpaceRecovery, readSmartSpaceRecoveryClientRequestId, resolveSmartSpaceRecoveryInputs } from '../lib/smart-space-results'
import { getMetaConnectionStatus, redirectToMetaOAuth } from '../lib/meta-oauth-connection'
import { buildSmartSpaceImagePublicationIntent, buildSmartSpaceVideoPublicationIntent, clearPendingSmartSpacePublication, preservePendingSmartSpacePublication, publishSmartSpacePublication, readPendingSmartSpacePublication, recoverSmartSpacePublication, restorePendingSmartSpacePublication } from '../lib/smart-space-social-publish'
import { runVirtualStagingInitialDiscovery, VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE } from '../lib/virtual-staging-discovery'
const VIRTUAL_STAGING_BEFORE_IMAGE = '/virtual-staging/virtual-staging-before.jpg'
const VIRTUAL_STAGING_AFTER_IMAGE = '/virtual-staging/virtual-staging-after.png'

const BUCKET = 'studio-videos'
const STAGES = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
const CTAS = ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']
const initialProperty = { purpose: '', stage: '', type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', state: '', county: '', city: '', district: '', neighborhood: '', zipCode: '', neighborhoodCommunity: '', price: '', condominium: '', iptu: '', highlights: [], description: '' }
const initialGeneration = { mode: 'guided_tour', narration: '', captions: '', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }
const ANALYTICS_PRODUCT_BY_JOURNEY = Object.freeze({
  [FURNISH_RENOVATE_JOURNEY_ID]: 'virtual_staging',
  [LIFE_IN_PROPERTY_JOURNEY_ID]: 'vida_no_imovel',
  [BROKER_PRESENTATION_JOURNEY_ID]: 'apresentacao_corretor',
})
const formatUsLocation = ({ neighborhoodCommunity = '', city = '', county = '', state = '', zipCode = '' }) => [neighborhoodCommunity, city, county, state, zipCode].filter(Boolean).join(', ')
const normalizeLocale = value => value === 'en-US' ? 'en-US' : 'pt-BR'
const normalizeMarket = value => value === 'US' ? 'US' : 'BR'
const VIRTUAL_STAGING_OPTION_KEYS = Object.freeze({ 'Pré-lançamento': 'preLaunch', 'Lançamento': 'launch', 'Em obras': 'underConstruction', 'Pronto para morar': 'moveInReady', 'Disponível já': 'availableNow', Vago: 'vacant', Apartamento: 'apartment', Casa: 'house', Cobertura: 'penthouse', 'Studio / Loft': 'studioLoft', 'Terreno / Lote': 'landLot', Comercial: 'commercial', 'Agende sua visita': 'schedule', 'Saiba mais': 'learn', 'Entre em contato agora': 'contact', 'Fale comigo': 'talk' })
const getVirtualStagingOptionLabel = (value, t) => VIRTUAL_STAGING_OPTION_KEYS[value] ? t(`virtualStaging.options.${VIRTUAL_STAGING_OPTION_KEYS[value]}`) : value
const isLifeOrBrokerJourney = journeyId => journeyId === LIFE_IN_PROPERTY_JOURNEY_ID || journeyId === BROKER_PRESENTATION_JOURNEY_ID
const getJourneyPresentation = (journey, t) => {
  if (journey.id === LIFE_IN_PROPERTY_JOURNEY_ID) return { ...journey, title: t('virtualStaging.journey.life.title'), description: t('virtualStaging.journey.life.description') }
  if (journey.id === BROKER_PRESENTATION_JOURNEY_ID) return { ...journey, title: t('virtualStaging.journey.broker.title'), description: t('virtualStaging.journey.broker.description') }
  return journey
}
const interpolate = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template)
function questionsFor(journeyId) {
  if (journeyId === FURNISH_RENOVATE_JOURNEY_ID) return FURNISH_RENOVATE_QUESTIONS
  const sharedQuestions = [
    ['images', 1, 'Envie até 5 fotos na ordem em que deseja apresentá-las.'], ['purpose', 2, 'Qual é a finalidade do imóvel?'],
    ['stage', 2, 'Qual é o estado atual do imóvel?'], ['type', 2, 'Que tipo de imóvel vamos apresentar?'],
    ['facts', 2, 'Quais são as principais medidas?'], ['location', 2, 'Onde fica o imóvel?'],
    ['commercial', 2, 'Quais informações comerciais deseja incluir?'], ['highlights', 2, 'Quais são os principais destaques?'],
  ]
  if (journeyId === LIFE_IN_PROPERTY_JOURNEY_ID) return [
    ...sharedQuestions,
    ['life_scene', 3, 'Quem deseja incluir para valorizar ainda mais a apresentação do seu imóvel?'],
    ['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo?'],
    ['cta', 4, 'Qual chamada deseja usar no final?'],
    ['phone', 4, 'Deseja divulgar seu telefone profissional?'],
    ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.'],
  ]
  if (journeyId === BROKER_PRESENTATION_JOURNEY_ID) return [
    ['presenter_reference', 1, 'Deseja utilizar sua própria imagem como referência para apresentar o imóvel?'],
    ['presenter_photo', 1, 'Envie uma foto com o rosto visível.'],
    ...sharedQuestions.filter(([id]) => id !== 'highlights'),
    ['presenter_speech_mode', 3, 'Como deseja criar a fala do vídeo?'],
    ['presenter_custom_speech', 3, 'Escreva a fala do vídeo.'],
    ['highlights', 3, 'Quais são os principais destaques?'],
    ['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo?'],
    ['cta_enabled', 4, 'Deseja uma chamada para ação no final do vídeo?'],
    ['cta', 4, 'Qual chamada deseja usar no final?'],
    ['phone', 4, 'Deseja divulgar seu telefone profissional?'],
    ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.'],
    ['presenter_reference_required', 1, 'Este módulo utiliza uma foto sua como referência para criar o apresentador. Sem uma foto de referência, utilize o Vídeo Imobiliário para criar sua apresentação.'],
  ]
  return sharedQuestions
}

function virtualStagingConfirmation(id, answer, journeyId, { t, locale = 'pt-BR', answerId = '' } = {}) {
  if (journeyId === FURNISH_RENOVATE_JOURNEY_ID) {
    if (id === 'images') return 'Ótimo! As fotografias serão usadas na ordem escolhida.'
  }
  const isLifeOrBroker = journeyId === LIFE_IN_PROPERTY_JOURNEY_ID || journeyId === BROKER_PRESENTATION_JOURNEY_ID
  if (isLifeOrBroker && t) {
    const history = key => t(`virtualStaging.history.${key}`)
    const interpolate = (key, value) => history(key).replace('{value}', value)
    const confirmations = {
      images: interpolate('images', answer),
      purpose: history(answerId === 'rent' ? 'purposeRent' : 'purposeSale'),
      stage: interpolate('stage', answer),
      type: interpolate('type', answer),
      facts: history('facts'),
      location: interpolate('location', answer),
      commercial: answerId === 'empty' ? history('commercialEmpty') : history('commercial'),
      highlights: interpolate('highlights', answer),
      life_scene: interpolate('lifeScene', answer.toLocaleLowerCase(locale)),
      presenter_reference: answerId === 'yes' ? history('presenterReferenceYes') : history('presenterReferenceNo'),
      presenter_photo: history('presenterPhoto'),
      narration: answerId === 'enabled' ? history('narrationOn') : history('narrationOff'),
      captions: answerId === 'enabled' ? history('captionsOn') : history('captionsOff'),
      cta_enabled: answerId === 'yes' ? history('ctaEnabledOn') : history('ctaEnabledOff'),
      cta: interpolate('cta', answer),
      phone: answerId === 'yes' ? history('phoneOn') : history('phoneOff'),
    }
    return confirmations[id] || history('default')
  }
  if (id === 'purpose') return answer === 'Locação' ? 'Perfeito! Vamos criar uma apresentação para divulgar a locação desse imóvel.' : 'Perfeito! Vamos criar uma apresentação para apoiar a venda desse imóvel.'
  const confirmations = {
    images: `Ótimo! ${answer} serão usadas exatamente na ordem escolhida.`,
    stage: `Perfeito! Vamos considerar o imóvel como “${answer}”.`,
    type: `Ótimo! O tipo “${answer}” já está registrado.`,
    facts: 'Perfeito! As principais medidas do imóvel foram registradas.',
    location: `Ótimo! A localização em ${answer} foi registrada.`,
    commercial: answer === 'Sem informações comerciais' ? 'Tudo bem! Seguiremos sem exibir valores comerciais.' : 'Perfeito! As informações comerciais foram registradas.',
    highlights: `Excelente! ${answer} foram selecionados para valorizar o imóvel.`,
    life_scene: `Perfeito! Vamos criar cenas com ${answer.toLocaleLowerCase('pt-BR')} utilizando o imóvel naturalmente.`,
    presenter_reference: answer === 'Sim' ? 'Perfeito! Agora envie a foto que será usada como referência do apresentador.' : 'Tudo certo. Você pode continuar sua criação no produto Vídeo Imobiliário.',
    presenter_photo: 'Foto do apresentador confirmada para esta criação.',
    narration: answer === 'Sim' ? 'Perfeito! A apresentação terá narração profissional.' : 'Tudo certo! A apresentação seguirá sem narração.',
    captions: answer === 'Sim' ? 'Ótimo! Uma seleção curta de destaques poderá aparecer no vídeo.' : 'Tudo certo! As informações continuarão na campanha, mas não aparecerão no vídeo.',
    cta_enabled: answer === 'Sim' ? 'Perfeito! Agora escolha a chamada final.' : 'Tudo certo! O vídeo terminará naturalmente na última cena, sem chamada final.',
    cta: `Ótimo! A chamada final será “${answer}”.`,
    phone: answer === 'Telefone profissional' ? 'Perfeito! Seu telefone profissional será incluído.' : 'Tudo certo! A apresentação seguirá sem telefone.',
  }
  return confirmations[id] || 'Perfeito! Informação registrada.'
}

async function downloadFurnishRenovateResult(result, stage) {
  const safeStage = String(stage.kind || 'resultado').replace(/[^a-z0-9_-]/gi, '-')
  const fallbackName = `smart-space-${String(result.originalIndex + 1).padStart(2, '0')}-${safeStage}.jpg`
  await downloadFileFromPrivateUrl(stage.url, fallbackName)
}

async function materializeSmartSpaceResult({ rawResult, inputPath, originalIndex, id, clientRequestId }) {
  const normalized = normalizeSmartSpaceResult(rawResult)
  if (!normalized || !inputPath) throw new Error('invalid_smart_space_result')
  const paths = [inputPath, ...normalized.stages.map(stage => stage.outputPath)]
  const signed = await Promise.all(paths.map(async path => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
    if (error || !data?.signedUrl) throw new Error('result_unavailable')
    return data.signedUrl
  }))
  return {
    id,
    clientRequestId,
    originalIndex,
    inputPath,
    originalPreview: signed[0],
    status: 'completed',
    action: normalized.action,
    deliveryStatus: normalized.deliveryStatus,
    partialFailureCode: normalized.partialFailureCode,
    stages: normalized.stages.map((stage, index) => ({ ...stage, url: signed[index + 1] })),
    error: '',
  }
}

function FurnishRenovateResultCard({ result, publication }) {
  const [downloading, setDownloading] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [publishIntent, setPublishIntent] = useState(null)
  const dismissedPublicationRef = useRef('')

  useEffect(() => {
    if (publishIntent || !publication?.resumeIntent) return
    const resumeKey = `${publication.resumeIntent.sourceId}:${publication.resumeIntent.mediaAssetId}`
    if (dismissedPublicationRef.current === resumeKey) return
    const restored = restorePendingSmartSpacePublication({ result, pending: publication.resumeIntent })
    if (!restored) return
    setPublishIntent(restored)
    publication.onResumed?.(restored)
  }, [publication, publishIntent, result])

  const download = async stage => {
    setDownloadError('')
    setDownloading(stage.kind)
    try {
      await downloadFurnishRenovateResult(result, stage)
    } catch (error) {
      setDownloadError(getDownloadErrorMessage(error))
    } finally {
      setDownloading('')
    }
  }
  const downloadVideo = async () => {
    setDownloading('video')
    setDownloadError('')
    try {
      await downloadFileFromPrivateUrl(result.video?.signedUrl, `smart-space-${String(result.originalIndex + 1).padStart(2, '0')}-transformacao.mp4`)
    } catch (error) {
      setDownloadError(getDownloadErrorMessage(error))
    } finally {
      setDownloading('')
    }
  }
  const openVideoPublication = () => {
    try {
      setPublishIntent(buildSmartSpaceVideoPublicationIntent({
        clientRequestId: result.clientRequestId,
        itemIndex: result.originalIndex,
        previewUrl: result.video?.signedUrl,
      }))
    } catch {
      setDownloadError('Não foi possível identificar o vídeo da transformação com segurança.')
    }
  }
  const openImagePublication = stage => {
    try {
      setPublishIntent(buildSmartSpaceImagePublicationIntent({
        clientRequestId: result.clientRequestId,
        itemIndex: result.originalIndex,
        stageKind: stage.kind,
        stageLabel: stage.label,
        previewUrl: stage.url,
      }))
    } catch {
      setDownloadError('Não foi possível identificar a imagem com segurança.')
    }
  }

  return <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label={`Resultado da imagem ${result.originalIndex + 1}`}>
    <h3 className="text-base font-black text-slate-900">Imagem {result.originalIndex + 1}</h3>
    {result.deliveryStatus === 'partial' && <p role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Conseguimos criar o espaço livre, mas não foi possível concluir a nova decoração.</p>}
    <div className={`mt-4 grid gap-4 ${result.stages.length > 1 ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
      {[{ label: 'Original', src: result.originalPreview, alt: `Imagem original ${result.originalIndex + 1}`, kind: 'original' }, ...result.stages.map(stage => ({ label: stage.label, src: stage.url, alt: `${stage.label} da imagem ${result.originalIndex + 1}`, kind: stage.kind }))].map(item => <figure key={item.kind} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <span className="absolute left-6 top-6 z-10 rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">{item.label}</span>
            <img src={item.src} alt={item.alt} className="max-h-[34rem] w-full rounded-2xl object-contain" />
            <a href={item.src} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><Expand className="h-4 w-4" />Ampliar</a>
          </figure>)}</div>
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{result.stages.flatMap(stage => [
      <ProductButton key={`download-${stage.kind}`} type="button" size="lg" variant="success" loading={downloading === stage.kind} onClick={() => download(stage)} className="w-full sm:w-auto">
        {downloading !== stage.kind && <Download className="h-5 w-5" />}Baixar {stage.label.toLocaleLowerCase('pt-BR')}
      </ProductButton>,
      publication?.enabled ? <ProductButton key={`publish-${stage.kind}`} type="button" size="lg" variant="secondary" onClick={() => openImagePublication(stage)} className="w-full sm:w-auto">
        <Instagram className="h-5 w-5" />Publicar {stage.label.toLocaleLowerCase('pt-BR')}
      </ProductButton> : null,
    ].filter(Boolean))}</div>
    {result.video?.state === 'completed' && result.video.signedUrl && <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-950 p-3" aria-label="Vídeo da transformação">
      <div className="mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Recomendado</p><p className="mt-1 text-sm font-bold">Mostre o antes e depois em um vídeo curto, ideal para Instagram e Facebook.</p></div>
      <video src={result.video.signedUrl} controls playsInline preload="metadata" className="mx-auto max-h-[38rem] w-full rounded-2xl bg-black object-contain" />
      <ProductButton type="button" size="lg" variant="success" loading={downloading === 'video'} onClick={downloadVideo} className="mt-3 w-full sm:w-auto">
        {downloading !== 'video' && <Download className="h-5 w-5" />}Baixar vídeo da transformação
      </ProductButton>
      {publication?.enabled && <ProductButton type="button" size="lg" variant="secondary" onClick={openVideoPublication} className="mt-3 w-full sm:ml-3 sm:w-auto">
        <Instagram className="h-5 w-5" />Publicar vídeo da transformação
      </ProductButton>}
    </section>}
    {['submitting', 'rendering'].includes(result.video?.state) && <p role="status" className="mt-4 rounded-2xl border border-primary-200 bg-primary-50 p-3 text-sm font-bold text-primary-900">Suas imagens estão prontas. Estamos finalizando o vídeo da transformação.</p>}
    {['failed_retryable', 'failed_unknown'].includes(result.video?.state) && <p role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">As imagens estão disponíveis, mas o vídeo da transformação não pôde ser concluído.</p>}
    {downloadError && <p role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{downloadError}</p>}
    {publishIntent && <BannerPublishDialog intent={publishIntent} loadConnection={publication?.loadConnection} onConnect={publication?.onConnect} onPublish={publication?.onPublish} onRecover={publication?.onRecover} onConfirmed={publication?.onConfirmed} onTerminalClose={publication?.onTerminalClose} captionEditable captionPlaceholder={publishIntent.captionPlaceholder} onClose={() => { dismissedPublicationRef.current = `${publishIntent.sourceId}:${publishIntent.mediaAssetId}`; setPublishIntent(null) }} />}
  </article>
}

function FurnishRenovateDelivery({ results, onCreateNew, onRetryMaterialization, publication }) {
  const completedResults = results.filter(result => result.status === 'completed')
  const failedResults = results.filter(result => result.status === 'failed')
  const unavailableResults = results.filter(result => result.status === 'result_unavailable')

  return (
    <section className="mt-10 space-y-5" aria-labelledby="virtual-staging-result-title">
      <ProductCard className="p-5 sm:p-7">
        <h2 id="virtual-staging-result-title" className="text-3xl font-black tracking-tight text-slate-950">Seu Smart Space está pronto</h2>
        {failedResults.length > 0 && <p className="mt-3 text-sm font-bold text-amber-800">Algumas imagens não puderam ser concluídas.</p>}
        {unavailableResults.length > 0 && <p className="mt-3 text-sm font-bold text-primary-800">Alguns resultados foram criados e estão sendo carregados novamente.</p>}
        <div className="mt-6 space-y-6">
          {results.map(result => result.status === 'completed'
            ? <FurnishRenovateResultCard key={result.id} result={result} publication={publication} />
            : result.status === 'result_unavailable'
              ? <article key={result.id} className="rounded-3xl border border-primary-200 bg-primary-50 p-4 sm:p-5" aria-label={`Resultado da imagem ${result.originalIndex + 1} aguardando carregamento`}><h3 className="font-black text-primary-950">Imagem {result.originalIndex + 1}</h3>{result.originalPreview && <img src={result.originalPreview} alt={`Imagem original ${result.originalIndex + 1}`} className="mt-3 max-h-80 w-full rounded-2xl object-contain" />}<p className="mt-3 text-sm font-bold text-primary-900">A transformação foi concluída, mas o resultado ainda não pôde ser carregado.</p><ProductButton type="button" size="lg" variant="secondary" onClick={() => onRetryMaterialization(result.id)} className="mt-4 w-full sm:w-auto">Tentar carregar resultado novamente</ProductButton></article>
              : <article key={result.id} className="rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-5" aria-label={`Falha na imagem ${result.originalIndex + 1}`}><h3 className="font-black text-amber-950">Imagem {result.originalIndex + 1}</h3><img src={result.originalPreview} alt={`Imagem original ${result.originalIndex + 1} não concluída`} className="mt-3 max-h-80 w-full rounded-2xl object-contain" /><p className="mt-3 text-sm font-bold text-amber-900">Não foi possível transformar esta imagem.</p></article>)}
        </div>
        <p className="mt-5 text-sm font-semibold leading-6 text-slate-600">Você poderá usar estes resultados em outros produtos do {BRAND.name} para criar vídeos, banners, carrosséis e campanhas.</p>
        {completedResults.length === 0 && unavailableResults.length === 0 && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">Nenhuma imagem pôde ser concluída.</p>}
        <ProductButton type="button" size="lg" variant="secondary" onClick={onCreateNew} className="mt-5 w-full sm:w-auto">Criar novo projeto</ProductButton>
      </ProductCard>
    </section>
  )
}

function FurnishRenovateProcessing({ results }) {
  const statusLabels = { pending: 'Aguardando', uploading: 'Enviando', generating: 'Criando', stage_1_completed: 'Espaço livre pronto', completed: 'Pronta', result_unavailable: 'Resultado pronto', failed: 'Não concluída' }
  const activeIndex = Math.max(0, results.findIndex(result => ['uploading', 'generating'].includes(result.status)))
  return <section className="mt-10" aria-labelledby="virtual-staging-processing-title">
    <ProductCard className="p-6 sm:p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      <h2 id="virtual-staging-processing-title" className="mt-4 text-3xl font-black tracking-tight text-slate-950">Criando seu Smart Space</h2>
      <p className="mt-3 text-base font-semibold text-slate-600">Estamos analisando e transformando cada ambiente.</p>
      <p className="mt-2 text-sm font-black text-primary-800">Processando imagem {Math.min(activeIndex + 1, results.length)} de {results.length}</p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {results.map(result => <li key={result.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black ${['uploading', 'generating', 'stage_1_completed'].includes(result.status) ? 'border-primary-300 bg-primary-50 text-primary-900' : result.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : result.status === 'failed' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-500'}`}><img src={result.originalPreview} alt="" className="h-12 w-12 rounded-xl object-cover" /><span>Imagem {result.originalIndex + 1}<span className="block text-xs">{statusLabels[result.status]}</span></span></li>)}
      </ol>
    </ProductCard>
  </section>
}

function getInitialVirtualStagingJourneyId() {
  if (readSmartSpaceRecoveryClientRequestId(globalThis.location?.search || '')) return FURNISH_RENOVATE_JOURNEY_ID
  const recoveredJourneyId = getRecoverableVirtualStagingJourneyId(globalThis.sessionStorage)
  return recoveredJourneyId === FURNISH_RENOVATE_JOURNEY_ID ? '' : recoveredJourneyId
}

export default function VirtualStagingAI() {
  const { user } = useAuth()
  const { t } = useLocale()
  const { trackEvent } = useAnalytics()
  const selectionDraft = useProductDraft({ productKey: 'virtual-staging:selection', schemaVersion: 1, userId: user?.id })
  const [selectedJourneyId, setSelectedJourneyId] = useState(getInitialVirtualStagingJourneyId)
  const modulesRef = useRef(null)
  const chatRef = useRef(null)
  const selectedJourney = getVirtualStagingJourney(selectedJourneyId)

  const selectJourney = useCallback(journeyId => {
    if (journeyId === selectedJourneyId) return
    setSelectedJourneyId(journeyId)
    trackEvent('product_opened', { product_name: ANALYTICS_PRODUCT_BY_JOURNEY[journeyId] })
  }, [selectedJourneyId, trackEvent])

  useEffect(() => {
    if (selectedJourney) chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedJourney])

  useEffect(() => {
    if (selectedJourneyId) selectionDraft.save({ selectedJourneyId })
    else selectionDraft.clear()
  }, [selectedJourneyId, selectionDraft])

  useEffect(() => {
    if (!selectedJourneyId && selectionDraft.restoredDraft?.selectedJourneyId) {
      setSelectedJourneyId(selectionDraft.restoredDraft.selectedJourneyId)
    }
  }, [selectedJourneyId, selectionDraft.restoredDraft])

  const chooseAnotherJourney = () => {
    selectionDraft.clear()
    setSelectedJourneyId(null)
    requestAnimationFrame(() => modulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return <>
    <Header title={VIRTUAL_STAGING_PRODUCT_NAME} subtitle="Experiências imobiliárias com inteligência artificial." />
    <main className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
      <ProductHero
        id="virtual-space-title"
        title="Smart Space"
        description="Transforme ambientes, mostre novas possibilidades e apresente seus imóveis de forma mais envolvente com inteligência artificial."
        visual={<VirtualSpaceHeroVisual t={t} />}
      />

      <ProductCard ref={modulesRef} className="mt-8 scroll-mt-6 p-5 sm:p-7">
        <ProductSectionHeading
          eyebrow="Três experiências em um só espaço"
          title="Escolha como deseja apresentar seu imóvel"
          description="Cada módulo cria uma experiência diferente, preservando a mesma jornada simples e guiada."
        />
        <VirtualStagingModules selectedJourneyId={selectedJourneyId} onSelect={selectJourney} t={t} />
      </ProductCard>

      {selectedJourney && <div ref={chatRef} className="scroll-mt-6">
        <VirtualStagingJourney
          key={selectedJourney.id}
          journey={selectedJourney}
          onChooseAnother={chooseAnotherJourney}
        />
      </div>}
    </main>
  </>
}

function VirtualStagingJourney({ journey, onChooseAnother }) {
  const { user, reloadProfile } = useAuth()
  const { locale, market, t } = useLocale()
  const journeyDraft = useProductDraft({ productKey: `virtual-staging:${journey.id}`, schemaVersion: 1, userId: user?.id })
  const restoredJourneyDraft = journeyDraft.restoredDraft || {}
  const supportsLocaleMarket = journey.id === LIFE_IN_PROPERTY_JOURNEY_ID || journey.id === BROKER_PRESENTATION_JOURNEY_ID
  const draftLocale = supportsLocaleMarket ? normalizeLocale(restoredJourneyDraft.locale || locale) : 'pt-BR'
  const draftMarket = supportsLocaleMarket ? normalizeMarket(restoredJourneyDraft.market || market) : 'BR'
  const lifeBrokerCopy = key => t(`virtualStaging.lifeBroker.${key}`)
  const restoredConversation = journey.id === FURNISH_RENOVATE_JOURNEY_ID && restoredJourneyDraft.conversation
    ? {
        ...restoredJourneyDraft.conversation,
        activeQuestionId: restoredJourneyDraft.conversation.activeQuestionId === 'image_destinations' ? 'review' : restoredJourneyDraft.conversation.activeQuestionId,
        history: (restoredJourneyDraft.conversation.history || []).filter(turn => turn.questionId !== 'image_destinations'),
      }
    : restoredJourneyDraft.conversation
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const presenterInputRef = useRef(null)
  const presenterReferenceRef = useRef(null)
  const pollRef = useRef(null)
  const activeJobIdRef = useRef('')
  const recoveryStartedJobIdRef = useRef('')
  const reviewEditRef = useRef(null)
  const furnishGenerationInFlightRef = useRef(false)
  const furnishRecoveryPollRef = useRef(null)
  const furnishVideoPollsRef = useRef(new Map())
  const furnishRecoveryStartedRef = useRef(false)
  const [hasStartedFurnish, setHasStartedFurnish] = useState(() => restoredJourneyDraft.hasStartedFurnish === true)
  const [images, setImages] = useState([])
  const [missingImageMetadata, setMissingImageMetadata] = useState(() => restoredJourneyDraft.imageMetadata || [])
  const [property, setProperty] = useState(() => restoredJourneyDraft.property || initialProperty)
  const [generation, setGeneration] = useState(() => restoredJourneyDraft.generation || initialGeneration)
  const [lifeScene, setLifeScene] = useState(() => restoredJourneyDraft.lifeScene || '')
  const [transformationType, setTransformationType] = useState(() => isAvailableFurnishRenovateTransformation(restoredJourneyDraft.transformationType) ? restoredJourneyDraft.transformationType : '')
  const [decorationStyle, setDecorationStyle] = useState(() => restoredJourneyDraft.decorationStyle || '')
  const [presenterReferenceDecision, setPresenterReferenceDecision] = useState(() => restoredJourneyDraft.presenterReferenceDecision ?? null)
  const [presenterSpeechMode, setPresenterSpeechMode] = useState(() => restoredJourneyDraft.presenterSpeechMode || 'generated')
  const [presenterCustomSpeech, setPresenterCustomSpeech] = useState(() => restoredJourneyDraft.presenterCustomSpeech || '')
  const [presenterReference, setPresenterReference] = useState(null)
  const [missingPresenterMetadata, setMissingPresenterMetadata] = useState(() => restoredJourneyDraft.presenterMetadata || null)
  const [presenterReferenceMessage, setPresenterReferenceMessage] = useState(() => restoredJourneyDraft.presenterMetadata ? lifeBrokerCopy('restoredPresenter') : '')
  const [ctaEnabled, setCtaEnabled] = useState(() => restoredJourneyDraft.ctaEnabled ?? null)
  const [cta, setCta] = useState(() => restoredJourneyDraft.cta || '')
  const [includePhone, setIncludePhone] = useState(() => restoredJourneyDraft.includePhone ?? null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState(() => restoredJourneyDraft.imageMetadata?.length ? `Rascunho restaurado. Selecione novamente ${restoredJourneyDraft.imageMetadata.length} ${restoredJourneyDraft.imageMetadata.length === 1 ? 'imagem' : 'imagens'} para continuar.` : '')
  const [result, setResult] = useState(null)
  const [furnishResults, setFurnishResults] = useState([])
  const [hasAttemptedFurnishGeneration, setHasAttemptedFurnishGeneration] = useState(false)
  const [conversationSnapshot, setConversationSnapshot] = useState(() => restoredConversation || null)
  const syncSmartSpaceVideo = useCallback(async ({ clientRequestId, itemIndex, action = 'video_status' }) => {
    const key = `${clientRequestId}:${itemIndex}`
    const { data, error } = await supabase.functions.invoke('virtual-staging-image-test', { body: {
      action, client_request_id: clientRequestId, item_index: itemIndex,
    } })
    if (error || !data?.ok) {
      setFurnishResults(current => current.map(item => Number(item.originalIndex) === Number(itemIndex)
        ? { ...item, video: { ...(item.video || {}), state: 'failed_unknown', failureReason: data?.code || 'video_unavailable' } }
        : item))
      return
    }
    const video = normalizeSmartSpaceVideo(data.video)
    setFurnishResults(current => current.map(item => Number(item.originalIndex) === Number(itemIndex) ? { ...item, video } : item))
    if (data.pending || ['submitting', 'rendering', 'planned'].includes(video.state)) {
      const currentTimer = furnishVideoPollsRef.current.get(key)
      if (currentTimer) clearTimeout(currentTimer)
      const timer = setTimeout(() => {
        furnishVideoPollsRef.current.delete(key)
        void syncSmartSpaceVideo({ clientRequestId, itemIndex, action: 'video_status' })
      }, 5000)
      furnishVideoPollsRef.current.set(key, timer)
    }
  }, [])
  const activeJobKey = getVirtualStagingJourneySessionKey(journey.id)
  const isFurnishRenovate = journey.id === FURNISH_RENOVATE_JOURNEY_ID
  const isLifeInProperty = journey.id === LIFE_IN_PROPERTY_JOURNEY_ID
  const isBrokerPresentation = journey.id === BROKER_PRESENTATION_JOURNEY_ID
  const videoUiLabels = {
    download: { loading: t('virtualStaging.download.loading'), image: t('virtualStaging.download.image'), video: t('virtualStaging.download.video') },
    preview: { loading: t('virtualStaging.preview.loading'), unavailable: t('virtualStaging.preview.unavailable'), retry: t('virtualStaging.preview.retry'), enlarge: t('virtualStaging.preview.enlarge') },
    media: { generated: t('virtualStaging.media.generated'), campaignArts: t('virtualStaging.media.campaignArts'), unavailable: t('virtualStaging.media.unavailable'), waiting: t('virtualStaging.media.waiting'), rendering: t('virtualStaging.media.rendering'), art: t('virtualStaging.media.art') },
    result: { temporarilyUnavailable: t('virtualStaging.result.temporarilyUnavailable'), reloadInstruction: t('virtualStaging.result.reloadInstruction'), generatedMedia: t('virtualStaging.result.generatedMedia'), presentation: t('virtualStaging.result.presentation'), play: t('virtualStaging.result.play') },
    actions: { copy: t('virtualStaging.actions.copy'), copied: t('virtualStaging.actions.copied'), publish: t('virtualStaging.actions.publish'), creationError: t('virtualStaging.actions.creationError') },
    campaign: { packageTitle: t('virtualStaging.campaign.packageTitle'), ready: t('virtualStaging.campaign.ready'), description: t('virtualStaging.campaign.description'), promotionTexts: t('virtualStaging.campaign.promotionTexts'), chooseChannel: t('virtualStaging.campaign.chooseChannel'), ctaContact: t('virtualStaging.campaign.ctaContact'), usedInformation: t('virtualStaging.campaign.usedInformation'), promotionTips: t('virtualStaging.campaign.promotionTips'), nextSteps: t('virtualStaging.campaign.nextSteps') },
    social: { freePublication: t('virtualStaging.social.freePublication'), confirm: t('virtualStaging.social.confirm'), chooseDestination: t('virtualStaging.social.chooseDestination'), checkingConnections: t('virtualStaging.social.checkingConnections'), cancel: t('virtualStaging.social.cancel'), publish: t('virtualStaging.social.publish'), creationPreparationError: t('virtualStaging.social.creationPreparationError'), multipleAccounts: t('virtualStaging.social.multipleAccounts'), connectMetaHelp: t('virtualStaging.social.connectMetaHelp'), connectMeta: t('virtualStaging.social.connectMeta'), caption: { label: t('virtualStaging.social.caption.label'), help: t('virtualStaging.social.caption.help'), limit: t('virtualStaging.social.caption.limit') }, progress: { publishing: t('virtualStaging.social.progress.publishing'), published: t('virtualStaging.social.progress.published'), confirming: t('virtualStaging.social.progress.confirming'), failed: t('virtualStaging.social.progress.failed'), cancelled: t('virtualStaging.social.progress.cancelled'), waitingConfirmation: t('virtualStaging.social.progress.waitingConfirmation'), finishing: t('virtualStaging.social.progress.finishing'), completed: t('virtualStaging.social.progress.completed'), partialActive: t('virtualStaging.social.progress.partialActive'), partialFailed: t('virtualStaging.social.progress.partialFailed'), failedNotice: t('virtualStaging.social.progress.failedNotice') } },
    accessibility: { cancelPublish: t('virtualStaging.accessibility.cancelPublish'), resultByDestination: t('virtualStaging.accessibility.resultByDestination') },
  }
  const furnishRecoveryKey = getSmartSpaceRecoveryKey(user?.id)
  const explicitFurnishRecoveryId = readSmartSpaceRecoveryClientRequestId(globalThis.location?.search || '')
  const questions = useMemo(() => {
    const journeyQuestions = questionsFor(journey.id)
    if (journey.id !== FURNISH_RENOVATE_JOURNEY_ID || !transformationType || furnishRenovateRequiresStyle(transformationType)) return journeyQuestions
    return journeyQuestions.filter(([questionId]) => questionId !== 'decoration_style')
  }, [journey.id, transformationType])
  const questionOrder = useMemo(() => questions.map(item => item[0]), [questions])
  const furnishProject = useMemo(() => ({
    transformation_type: transformationType,
    decoration_style: decorationStyle,
    property_images: images,
  }), [transformationType, decorationStyle, images])
  const furnishGenerationBusy = isFurnishRenovate && ['uploading', 'generating', 'preparing_result'].includes(status)
  const canGenerateFurnish = isFurnishRenovate
    && images.length >= 1
    && images.length <= FURNISH_RENOVATE_MAX_IMAGES
    && isAvailableFurnishRenovateTransformation(transformationType)
    && (!furnishRenovateRequiresStyle(transformationType) || Boolean(decorationStyle))
    && !furnishGenerationBusy
    && !hasAttemptedFurnishGeneration
  const rawPhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const phone = formatPhone(rawPhone, draftMarket)
  const setPropertyField = (field, value) => setProperty(current => ({ ...current, [field]: value }))
  const setGenerationField = (field, value) => setGeneration(current => ({ ...current, [field]: value }))
  const clearPresenterReference = () => {
    if (presenterReferenceRef.current?.preview) URL.revokeObjectURL(presenterReferenceRef.current.preview)
    presenterReferenceRef.current = null
    setPresenterReference(null)
    setMissingPresenterMetadata(null)
    setPresenterReferenceMessage('')
  }
  const addPresenterReference = files => {
    const { file, error } = validatePresenterReferenceSelection(files)
    if (error) { setPresenterReferenceMessage(lifeBrokerCopy(error)); return }
    if (presenterReferenceRef.current?.preview) URL.revokeObjectURL(presenterReferenceRef.current.preview)
    const nextReference = { file, preview: URL.createObjectURL(file) }
    presenterReferenceRef.current = nextReference
    setPresenterReference(nextReference)
    setMissingPresenterMetadata(null)
    setPresenterReferenceMessage('')
  }

  const resetTourFromQuestion = (questionId) => {
    if (reviewEditRef.current) {
      if (questionId === 'presenter_reference') { setPresenterReferenceDecision(null); clearPresenterReference() }
      if (questionId === 'presenter_photo') clearPresenterReference()
      if (questionId === 'images') setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
      if (questionId === 'transformation_type') setTransformationType('')
      if (questionId === 'decoration_style') setDecorationStyle('')
      if (questionId === 'purpose') setProperty(current => ({ ...current, purpose: '', stage: '' }))
      if (questionId === 'stage') setProperty(current => ({ ...current, stage: '' }))
      if (questionId === 'type') setProperty(current => ({ ...current, type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [] }))
      if (questionId === 'facts') setProperty(current => ({ ...current, bedrooms: '', suites: '', parkingSpaces: '', area: '' }))
      if (questionId === 'location') setProperty(current => ({ ...current, state: '', county: '', city: '', district: '', zipCode: '', neighborhoodCommunity: '', ...(isFurnishRenovate ? { neighborhood: '' } : {}) }))
      if (questionId === 'commercial') setProperty(current => ({ ...current, price: '', condominium: '', iptu: '' }))
      if (questionId === 'highlights') setProperty(current => ({ ...current, highlights: [] }))
      if (questionId === 'presenter_speech_mode') { setPresenterSpeechMode('generated'); setPresenterCustomSpeech('') }
      if (questionId === 'presenter_custom_speech') setPresenterCustomSpeech('')
      if (['state', 'city', 'neighborhood', 'bedrooms', 'suites', 'parkingSpaces', 'area'].includes(questionId)) setProperty(current => ({ ...current, [questionId]: '', ...(questionId === 'state' ? { city: '' } : {}) }))
      if (questionId === 'life_scene') setLifeScene('')
      if (questionId === 'narration') setGeneration(current => ({ ...current, narration: '' }))
      if (questionId === 'captions') setGeneration(current => ({ ...current, captions: '' }))
      if (questionId === 'cta_enabled') { setCtaEnabled(null); setCta('') }
      if (questionId === 'cta') setCta('')
      if (questionId === 'phone') setIncludePhone(null)
      setStatus('idle')
      setMessage('')
      return
    }
    const targetIndex = questionOrder.indexOf(questionId)
    const shouldReset = id => questionOrder.indexOf(id) >= targetIndex
    if (shouldReset('presenter_reference')) setPresenterReferenceDecision(null)
    if (shouldReset('presenter_photo')) clearPresenterReference()
    if (shouldReset('images')) setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
    if (shouldReset('transformation_type')) setTransformationType('')
    if (shouldReset('decoration_style')) setDecorationStyle('')
    const propertyFields = [['purpose', 'purpose'], ['stage', 'stage'], ['type', 'type'], ['facts', 'bedrooms'], ['facts', 'suites'], ['facts', 'parkingSpaces'], ['facts', 'area'], ['location', 'state'], ['location', 'county'], ['location', 'city'], ['location', 'district'], ['location', 'neighborhood'], ['location', 'zipCode'], ['location', 'neighborhoodCommunity'], ['bedrooms', 'bedrooms'], ['suites', 'suites'], ['parkingSpaces', 'parkingSpaces'], ['area', 'area'], ['commercial', 'price'], ['commercial', 'condominium'], ['commercial', 'iptu'], ['highlights', 'highlights']]
    setProperty(current => propertyFields.reduce((nextProperty, [questionKey, field]) => shouldReset(questionKey) ? { ...nextProperty, [field]: field === 'highlights' ? [] : '' } : nextProperty, current))
    setGeneration(current => ({
      ...current,
      ...(shouldReset('narration') ? { narration: '' } : {}),
      ...(shouldReset('captions') ? { captions: '' } : {}),
      furniture: 'original', stagingPresentation: 'final_only',
    }))
    if (shouldReset('life_scene')) setLifeScene('')
    if (shouldReset('presenter_speech_mode')) { setPresenterSpeechMode('generated'); setPresenterCustomSpeech('') }
    else if (shouldReset('presenter_custom_speech')) setPresenterCustomSpeech('')
    if (shouldReset('cta_enabled')) setCtaEnabled(null)
    if (shouldReset('cta')) setCta('')
    if (shouldReset('phone')) setIncludePhone(null)
    if (pollRef.current) clearTimeout(pollRef.current)
    setStatus('idle')
    setMessage('')
    setResult(null)
  }
  const conversation = useGuidedConversation({ initialQuestionId: isBrokerPresentation ? 'presenter_reference' : isFurnishRenovate ? 'transformation_type' : 'images', initialState: restoredConversation, onEdit: resetTourFromQuestion, onStateChange: setConversationSnapshot })
  const questionIndex = Math.max(0, questions.findIndex(item => item[0] === conversation.activeQuestionId))

  useEffect(() => {
    if (!['idle', 'error'].includes(status)) return
    const imageMetadata = images.length
      ? images.map((item, order) => ({ ...toFileMetadata(item.file, order) })).filter(item => item.name)
      : missingImageMetadata
    const presenterMetadata = presenterReference?.file
      ? toFileMetadata(presenterReference.file, 0)
      : missingPresenterMetadata
    const draft = { hasStartedFurnish, property, generation, lifeScene, transformationType, decorationStyle, presenterReferenceDecision, presenterSpeechMode, presenterCustomSpeech, ctaEnabled, cta, includePhone, ...(supportsLocaleMarket ? { locale: draftLocale, market: draftMarket } : {}), imageMetadata, presenterMetadata, conversation: conversationSnapshot }
    const meaningful = conversationSnapshot?.history?.length || hasStartedFurnish || imageMetadata.length || presenterMetadata || transformationType || decorationStyle || Object.values(property).some(value => Array.isArray(value) ? value.length : Boolean(value))
    if (!meaningful) { journeyDraft.clear(); return }
    journeyDraft.save(draft)
  }, [conversationSnapshot, cta, ctaEnabled, decorationStyle, draftLocale, draftMarket, generation, hasStartedFurnish, images, includePhone, journeyDraft, lifeScene, missingImageMetadata, missingPresenterMetadata, presenterCustomSpeech, presenterReference, presenterReferenceDecision, presenterSpeechMode, property, status, supportsLocaleMarket, transformationType])
  const question = questions[questionIndex] || questions[0]
  const localizedQuestionKey = {
    images: 'images', purpose: 'purpose', stage: 'stage', type: 'type', facts: 'facts', location: 'location', commercial: 'commercial', highlights: 'highlights', life_scene: 'lifeScene', captions: 'captions', cta: 'cta', phone: 'phone', review: 'review', presenter_reference: 'presenterReference', presenter_photo: 'presenterPhoto', presenter_speech_mode: 'speech', presenter_custom_speech: 'customSpeech', cta_enabled: 'ctaEnabled',
  }[question[0]]
  const localizedQuestion = localizedQuestionKey ? t(`virtualStaging.questions.${localizedQuestionKey}`) : question[2]
  const reachedStep = isFurnishRenovate && !hasStartedFurnish
    ? null
    : question[0] === 'review' ? STEPS.REVIEW
      : conversation.history.length ? STEPS.DETAILS : STEPS.FLOW_STARTED
  const { trackStep, trackGenerationClicked } = useAccountAnalytics(PRODUCTS.SMART_SPACE, reachedStep)
  useEffect(() => {
    if (images.length || presenterReference?.file) trackStep(STEPS.UPLOAD)
  }, [images.length, presenterReference?.file, trackStep])
  const answerQuestion = ({ answer, answerId = '', nextQuestionId = getVirtualStagingNextQuestion({ questionId: question[0], answerId, mode: generation.mode, journeyId: journey.id }), apply }) => {
    let resolvedNextQuestionId = nextQuestionId
    if (reviewEditRef.current) {
      resolvedNextQuestionId = getVirtualStagingReviewEditNext({ originQuestionId: reviewEditRef.current, questionId: question[0], answerId, mode: generation.mode, journeyId: journey.id })
      if (resolvedNextQuestionId === 'review') reviewEditRef.current = null
    }
    const accepted = conversation.submitAnswer({ questionId: question[0], question: localizedQuestion, answer, confirmation: virtualStagingConfirmation(question[0], answer, journey.id, { t, locale: draftLocale, answerId }), nextQuestionId: resolvedNextQuestionId })
    if (accepted) apply?.()
    return accepted
  }
  const editConversationAnswer = questionId => {
    if (question[0] === 'review') reviewEditRef.current = questionId
    conversation.editAnswer(questionId)
  }

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current)
    if (furnishRecoveryPollRef.current) clearTimeout(furnishRecoveryPollRef.current)
    for (const timer of furnishVideoPollsRef.current.values()) clearTimeout(timer)
    furnishVideoPollsRef.current.clear()
    if (presenterReferenceRef.current?.preview) URL.revokeObjectURL(presenterReferenceRef.current.preview)
  }, [])
  useEffect(() => {
    if (isFurnishRenovate) return
    const storedValue = sessionStorage.getItem(activeJobKey)
    const stored = parseVirtualStagingJobRecord(storedValue)
    if (!stored) {
      if (storedValue) sessionStorage.removeItem(activeJobKey)
      const discoveryStyle = isLifeInProperty ? 'narrated_tour' : isBrokerPresentation ? 'guided_tour' : ''
      if (!discoveryStyle || recoveryStartedJobIdRef.current) return
      recoveryStartedJobIdRef.current = `discover:${discoveryStyle}`
      setStatus('generating')
      setMessage(lifeBrokerCopy('discovering'))
      void (async () => {
        let recoveryStarted = false
        let recoveryMessage = ''
        try {
          const outcome = await runVirtualStagingInitialDiscovery({
            style: discoveryStyle,
            invokeDiscovery: (body, signal) => supabase.functions.invoke('virtual-staging-status', { body, signal }),
            buildRecovery: data => {
              const selectedCta = isLifeInProperty || ctaEnabled === true ? cta : ''
              const includeProfessionalPhone = includePhone === true
              const campaignPackage = buildVirtualStagingCampaignPackage({ property, language: draftLocale, cta: selectedCta, phone: includeProfessionalPhone ? phone : '', hashtags: data.hashtags || [], journeyId: journey.id, lifeScene: isLifeInProperty ? lifeScene : '' })
              return { jobId: data.jobId, status: data.status || 'generating', campaignPackage, updatedAt: Date.now() }
            },
            persistRecovery: recovery => sessionStorage.setItem(activeJobKey, JSON.stringify(recovery)),
            clearRecovery: () => sessionStorage.removeItem(activeJobKey),
            startPolling: jobId => {
              recoveryStartedJobIdRef.current = jobId
              setMessage(lifeBrokerCopy('resuming'))
              poll(jobId)
            },
          })
          recoveryStarted = outcome.state === 'started'
          recoveryMessage = outcome.state === 'failed' ? VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE : ''
        } catch {
          recoveryMessage = VIRTUAL_STAGING_DISCOVERY_FAILURE_MESSAGE
        } finally {
          if (!recoveryStarted) {
            recoveryStartedJobIdRef.current = ''
            setStatus('idle')
            setMessage(recoveryMessage)
          }
        }
      })()
      return
    }
    if (recoveryStartedJobIdRef.current === stored.jobId) return
    recoveryStartedJobIdRef.current = stored.jobId
    setStatus('generating')
    setMessage(lifeBrokerCopy('resuming'))
    poll(stored.jobId)
  }, [activeJobKey, cta, ctaEnabled, includePhone, isBrokerPresentation, isFurnishRenovate, isLifeInProperty, phone, property])

  useEffect(() => {
    if (!isFurnishRenovate || !furnishRecoveryKey || furnishRecoveryStartedRef.current) return
    const persistedRecovery = parseSmartSpaceRecovery(sessionStorage.getItem(furnishRecoveryKey))
    const recovery = persistedRecovery || (explicitFurnishRecoveryId ? {
      clientRequestId: explicitFurnishRecoveryId,
      inputs: [],
    } : null)
    if (!recovery) return
    const isExplicitRecovery = !persistedRecovery && Boolean(explicitFurnishRecoveryId)
    furnishRecoveryStartedRef.current = true
    setHasStartedFurnish(true)

    const recover = async () => {
      setStatus('generating')
      setMessage('Recuperando seu Smart Space...')
      const { data, error } = await supabase.functions.invoke('virtual-staging-image-test', { body: {
        action: 'recover', client_request_id: recovery.clientRequestId,
      } })
      if (error || !data?.ok) {
        setStatus('error')
        setMessage(data?.error || 'Não foi possível recuperar esta criação agora.')
        return
      }
      const byIndex = new Map((data.items || []).map(item => [Number(item.item_index), item]))
      const recoveryInputs = resolveSmartSpaceRecoveryInputs(data.items, recovery.inputs)
      if (!recoveryInputs.length) {
        setStatus('error')
        setMessage('O resultado existe, mas os arquivos desta criação não estão disponíveis.')
        return
      }
      for (const item of isExplicitRecovery ? [] : (data.items || [])) {
        if (['awaiting_processing', 'free_space_completed'].includes(item.stage_state)
          || (item.stage_state === 'redecorating' && item.result?.delivery_status === 'completed')) {
          const recoveryInput = recoveryInputs.find(input => Number(input.itemIndex) === Number(item.item_index))
          void supabase.functions.invoke('virtual-staging-image-test', { body: {
            action: 'resume', client_request_id: recovery.clientRequestId, item_index: Number(item.item_index),
            ...(item.stage_state === 'awaiting_processing' ? { input_path: recoveryInput?.inputPath || '' } : {}),
          } })
        }
      }
      const recoveredResults = await Promise.all(recoveryInputs.map(async input => {
        const item = byIndex.get(Number(input.itemIndex))
        const base = { id: `recovered-${input.itemIndex}`, clientRequestId: recovery.clientRequestId, originalIndex: Number(input.itemIndex), inputPath: input.inputPath, originalPreview: '', stages: [], status: item?.status || 'pending', deliveryStatus: '', video: normalizeSmartSpaceVideo(item ? {
          state: item.video_state, renderer: item.video_renderer, render_id: item.video_render_id,
          output_path: item.video_output_path, failure_reason: item.video_failure_reason,
        } : null), error: '' }
        if (item?.status === 'completed' || (item?.status === 'processing' && Array.isArray(item?.result?.stages) && item.result.stages.length > 0)) {
          try {
            const materialized = await materializeSmartSpaceResult({ rawResult: item.result, inputPath: input.inputPath, originalIndex: Number(input.itemIndex), id: base.id, clientRequestId: recovery.clientRequestId })
            const recoveredResult = item.status === 'processing' ? { ...materialized, video: base.video, status: 'stage_1_completed' } : { ...materialized, video: base.video }
            if (item.status === 'completed' && item.result?.delivery_status === 'completed') {
              const videoAction = item.video_state === 'not_requested' && !isExplicitRecovery ? 'start_video' : 'video_status'
              void syncSmartSpaceVideo({ clientRequestId: recovery.clientRequestId, itemIndex: Number(input.itemIndex), action: videoAction })
            }
            return recoveredResult
          } catch {
            return { ...base, status: 'result_unavailable', rawResult: item.result, error: 'result_unavailable' }
          }
        }
        return item?.status === 'failed' ? { ...base, status: 'failed', error: item.failure_reason || 'generation_failed' } : base
      }))
      setFurnishResults(recoveredResults)
      if (['completed', 'failed'].includes(data.request?.status)) {
        setStatus('completed')
        setMessage('')
        await reloadProfile()
        return
      }
      setMessage('Sua transformação continua em andamento...')
      furnishRecoveryPollRef.current = setTimeout(recover, 5000)
    }
    void recover()
  }, [explicitFurnishRecoveryId, furnishRecoveryKey, isFurnishRenovate, reloadProfile, syncSmartSpaceVideo])

  const addImages = files => {
    const imageLimit = isFurnishRenovate ? FURNISH_RENOVATE_MAX_IMAGES : VIRTUAL_STAGING_MAX_IMAGES
    const selectedInSystemOrder = Array.from(files)
    if (selectedInSystemOrder.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024)) return setMessage(supportsLocaleMarket ? lifeBrokerCopy('invalidImages') : 'Envie imagens JPG ou PNG de até 15 MB.')
    setImages(current => {
      const known = new Set(current.map(item => item.key))
      const uniqueInSystemOrder = selectedInSystemOrder.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
      const exceedsLimit = isFurnishRenovate ? !canAddFurnishRenovateImages(current.length, uniqueInSystemOrder.length) : current.length + uniqueInSystemOrder.length > imageLimit
      if (exceedsLimit) { setMessage(supportsLocaleMarket ? lifeBrokerCopy('imageLimit').replace('{limit}', imageLimit) : `Você pode enviar no máximo ${imageLimit} imagens.`); return current }
      setMessage('')
      return [...current, ...uniqueInSystemOrder.map(file => ({ file, key: `${file.name}:${file.size}:${file.lastModified}`, preview: URL.createObjectURL(file) }))]
    })
    setMissingImageMetadata([])
  }
  const move = (position, offset) => setImages(current => { const target = position + offset; if (target < 0 || target >= current.length) return current; const nextImages = [...current]; [nextImages[position], nextImages[target]] = [nextImages[target], nextImages[position]]; return nextImages })
  const remove = position => setImages(current => current.filter((item, itemIndex) => { if (itemIndex === position) URL.revokeObjectURL(item.preview); return itemIndex !== position }))
  const toggleHighlight = value => setPropertyField('highlights', property.highlights.includes(value) ? property.highlights.filter(item => item !== value) : property.highlights.length < 10 ? [...property.highlights, value] : property.highlights)

  async function poll(jobId) {
    activeJobIdRef.current = jobId
    try {
      const { data, error } = await supabase.functions.invoke('virtual-staging-status', { body: { jobId } })
      if (error || !data?.ok) throw new Error(data?.error || 'Não foi possível consultar a criação.')
      if (data.status === 'completed') {
        const stored = parseVirtualStagingJobRecord(sessionStorage.getItem(activeJobKey)) || { jobId }
        sessionStorage.removeItem(activeJobKey)
        if (!isUsableVirtualStagingVideoUrl(data.signedVideoUrl)) {
          setStatus('result_unavailable')
          setMessage(lifeBrokerCopy('unavailable'))
          return
        }
        const campaignPackage = mergeVirtualStagingCampaignHashtags(stored.campaignPackage || {}, data.hashtags)
        const completedResult = { ...data, campaignPackage }
        setResult(completedResult)
        setStatus('completed')
        void reloadProfile()
        return
      }
      if (data.status === 'failed') {
        sessionStorage.removeItem(activeJobKey)
        throw new Error(data.error)
      }
      setMessage(data.message || lifeBrokerCopy('generating')); pollRef.current = setTimeout(() => poll(jobId), 9000)
    } catch (error) { setStatus('error'); setMessage(getSmartTokenErrorMessage(error, lifeBrokerCopy('completeFailed'))); void reloadProfile() }
  }

  const retryResultStatus = () => {
    const stored = parseVirtualStagingJobRecord(sessionStorage.getItem(activeJobKey))
    const jobId = activeJobIdRef.current || stored?.jobId
    if (!jobId) {
      setStatus('error')
      setMessage(lifeBrokerCopy('recoveryFailed'))
      return
    }
    if (pollRef.current) clearTimeout(pollRef.current)
    setStatus('generating')
    setMessage(lifeBrokerCopy('checking'))
    poll(jobId)
  }

  const createFurnishRenovateImage = async () => {
    trackGenerationClicked()
    if (!isFurnishRenovate || furnishGenerationInFlightRef.current) return
    if (!canGenerateFurnish) {
      setMessage('Revise as escolhas e envie de uma a cinco imagens para continuar.')
      return
    }

    furnishGenerationInFlightRef.current = true
    setHasAttemptedFurnishGeneration(true)
    setStatus('uploading')
    setMessage('')

    const orderedImages = images.slice()
    const initialResults = orderedImages.map((image, originalIndex) => ({
      id: image.key,
      originalIndex,
      key: image.key,
      originalPreview: image.preview,
      inputPath: '',
      outputPath: '',
      afterUrl: '',
      stages: [],
      deliveryStatus: '',
      video: normalizeSmartSpaceVideo(null),
      status: 'pending',
      width: null,
      height: null,
      mimeType: '',
      sizeBytes: null,
      error: '',
    }))
    setFurnishResults(initialResults)
    const updateResult = (id, changes) => setFurnishResults(current => current.map(result => result.id === id ? { ...result, ...changes } : result))
    let preparedSessionId = ''
    let economyPrepared = false
    const recoveryInputs = orderedImages.map((_, itemIndex) => ({ itemIndex, inputPath: '' }))

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      const authenticatedUser = authData?.user
      if (authError || !authenticatedUser?.id) throw new Error('auth_required')

      const sessionId = crypto.randomUUID()
      preparedSessionId = sessionId
      const { data: prepared, error: prepareError } = await supabase.functions.invoke('virtual-staging-image-test', { body: {
        action: 'prepare',
        client_request_id: sessionId,
        image_count: orderedImages.length,
        transformation_type: transformationType,
        decoration_style: furnishRenovateRequiresStyle(transformationType) ? decorationStyle : null,
      } })
      if (prepareError || !prepared?.ok) throw new Error(prepared?.error || 'Não foi possível reservar os Smart Tokens desta criação.')
      economyPrepared = true
      if (furnishRecoveryKey) sessionStorage.setItem(furnishRecoveryKey, JSON.stringify(buildSmartSpaceRecovery({ clientRequestId: sessionId, transformationType, decorationStyle, inputs: recoveryInputs })))
      const failReservedItem = async (itemIndex, reason) => {
        await supabase.functions.invoke('virtual-staging-image-test', { body: {
          action: 'fail_item', client_request_id: sessionId, item_index: itemIndex, reason,
        } })
      }
      for (let imageIndex = 0; imageIndex < orderedImages.length; imageIndex += 1) {
        const image = orderedImages[imageIndex]
        const file = image?.file
        if (!file || !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024) {
          updateResult(image.key, { status: 'failed', error: 'invalid_image' })
          await failReservedItem(imageIndex, 'invalid_image')
          continue
        }

        const extension = file.type === 'image/png' ? 'png' : 'jpg'
        const inputPath = `${authenticatedUser.id}/virtual-staging-images/inputs/${sessionId}/${String(imageIndex + 1).padStart(2, '0')}.${extension}`
        updateResult(image.key, { status: 'uploading', inputPath })
        setStatus('uploading')
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(inputPath, file, { contentType: file.type, upsert: false })
        if (uploadError) {
          updateResult(image.key, { status: 'failed', error: 'upload_failed' })
          await failReservedItem(imageIndex, 'input_upload_failed')
          continue
        }
        recoveryInputs[imageIndex] = { itemIndex: imageIndex, inputPath }
        if (furnishRecoveryKey) sessionStorage.setItem(furnishRecoveryKey, JSON.stringify(buildSmartSpaceRecovery({ clientRequestId: sessionId, transformationType, decorationStyle, inputs: recoveryInputs })))

        updateResult(image.key, { status: 'generating' })
        setStatus('generating')
        const generateBody = {
          action: 'generate',
          client_request_id: sessionId,
          item_index: imageIndex,
          module: FURNISH_RENOVATE_JOURNEY_ID,
          input_path: inputPath,
          transformation_type: transformationType,
          expected_count: orderedImages.length,
          ...(furnishRenovateRequiresStyle(transformationType) ? { decoration_style: decorationStyle } : {}),
        }
        const { data, error } = await supabase.functions.invoke('virtual-staging-image-test', { body: generateBody })
        if (error || !data?.ok) {
          updateResult(image.key, { status: 'failed', error: 'generation_failed' })
          continue
        }

        setStatus('preparing_result')
        let materialized
        try {
          materialized = await materializeSmartSpaceResult({ rawResult: data.result, inputPath, originalIndex: imageIndex, id: image.key, clientRequestId: sessionId })
        } catch {
          updateResult(image.key, { clientRequestId: sessionId, status: 'result_unavailable', rawResult: data.result, outputPath: data?.result?.output_path || '', error: 'result_unavailable' })
          continue
        }

        updateResult(image.key, materialized)
        if (materialized.deliveryStatus === 'completed') {
          void syncSmartSpaceVideo({ clientRequestId: sessionId, itemIndex: imageIndex, action: 'start_video' })
        }
      }
      setStatus('completed')
      await reloadProfile()
    } catch (error) {
      if (economyPrepared && preparedSessionId) {
        await Promise.allSettled(orderedImages.map((_, itemIndex) => supabase.functions.invoke('virtual-staging-image-test', { body: {
          action: 'fail_item', client_request_id: preparedSessionId, item_index: itemIndex, reason: 'client_operation_aborted',
        } })))
      }
      setStatus('error')
      setMessage(getSmartTokenErrorMessage(error, 'Não foi possível iniciar seu Smart Space. Crie um novo projeto para tentar novamente.'))
      await reloadProfile()
    }
  }

  const retryFurnishResultMaterialization = async id => {
    const pendingResult = furnishResults.find(result => result.id === id)
    if (!pendingResult?.rawResult || !pendingResult.inputPath) return
    setFurnishResults(current => current.map(result => result.id === id ? { ...result, error: '' } : result))
    try {
      const materialized = await materializeSmartSpaceResult({
        rawResult: pendingResult.rawResult,
        inputPath: pendingResult.inputPath,
        originalIndex: pendingResult.originalIndex,
        id: pendingResult.id,
        clientRequestId: pendingResult.clientRequestId,
      })
      setFurnishResults(current => current.map(result => result.id === id
        ? { ...materialized, video: result.video, rawResult: undefined }
        : result))
    } catch {
      setFurnishResults(current => current.map(result => result.id === id
        ? { ...result, status: 'result_unavailable', error: 'result_unavailable' }
        : result))
    }
  }

  const createTour = async () => {
    if (isFurnishRenovate) return createFurnishRenovateImage()
    if (isBrokerPresentation && !presenterReference?.file) return setMessage(lifeBrokerCopy('presenterRequired'))
    trackGenerationClicked()
    setStatus('uploading'); setMessage(lifeBrokerCopy('uploading'))
    try {
      const requestId = crypto.randomUUID()
      let presenterReferencePath = ''
      if (isBrokerPresentation) {
        const presenterFile = presenterReference.file
        presenterReferencePath = `${user.id}/virtual-staging/${requestId}/presenter-reference.${presenterFile.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(presenterReferencePath, presenterFile, { contentType: presenterFile.type })
        if (error) throw new Error(lifeBrokerCopy('presenterUploadFailed'))
      }
      const orderedImages = images.slice()
      const imagePaths = new Array(orderedImages.length)
      for (let imageIndex = 0; imageIndex < orderedImages.length; imageIndex += 1) {
        const file = orderedImages[imageIndex].file
        const path = `${user.id}/virtual-staging/${requestId}/${String(imageIndex + 1).padStart(2, '0')}.${file.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
        if (error) throw new Error(lifeBrokerCopy('propertyUploadFailed'))
        imagePaths[imageIndex] = path
      }
      setStatus('generating'); setMessage(lifeBrokerCopy('generating'))
      const apiGeneration = isLifeInProperty
        ? buildLifeInPropertyGenerationPayload({ lifeScene, captions: generation.captions, language: draftLocale })
        : buildBrokerPresentationGenerationPayload({ captions: generation.captions, presenterSpeechMode, presenterCustomSpeech, language: draftLocale })
      const selectedCta = isLifeInProperty || ctaEnabled === true ? cta : ''
      const includeProfessionalPhone = includePhone === true
      const brokerFiles = isBrokerPresentation ? buildBrokerPresentationFilePayload({ presenterReferencePath, propertyImagePaths: imagePaths }) : {}
      const requestBody = { journeyId: journey.id, clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property, generation: apiGeneration, selectedCta, includeProfessionalPhone, language: draftLocale, ...brokerFiles }
      const { data, error } = await supabase.functions.invoke('virtual-staging-generate', { body: requestBody })
      if (error || !data?.ok || !data?.jobId) throw new Error(data?.error || lifeBrokerCopy('startFailed'))
      const campaignPackage = buildVirtualStagingCampaignPackage({ property, language: draftLocale, cta:requestBody.selectedCta, phone:requestBody.includeProfessionalPhone ? phone : '', hashtags:data.hashtags, journeyId: journey.id, lifeScene: isLifeInProperty ? lifeScene : '' })
      sessionStorage.setItem(activeJobKey, JSON.stringify({ jobId:data.jobId, status:'generating', campaignPackage, updatedAt:Date.now() })); poll(data.jobId)
    } catch (error) { setStatus('error'); setMessage(getSmartTokenErrorMessage(error, lifeBrokerCopy('createFailed'))); void reloadProfile() }
  }

  const reset = () => { sessionStorage.removeItem(activeJobKey); if (furnishRecoveryKey) sessionStorage.removeItem(furnishRecoveryKey); clearPendingSmartSpacePublication(window.sessionStorage, user?.id); activeJobIdRef.current = ''; recoveryStartedJobIdRef.current = ''; furnishRecoveryStartedRef.current = false; if (furnishRecoveryPollRef.current) clearTimeout(furnishRecoveryPollRef.current); for (const timer of furnishVideoPollsRef.current.values()) clearTimeout(timer); furnishVideoPollsRef.current.clear(); journeyDraft.clear(); furnishGenerationInFlightRef.current = false; images.forEach(item => URL.revokeObjectURL(item.preview)); clearPresenterReference(); reviewEditRef.current = null; setHasStartedFurnish(false); setImages([]); setMissingImageMetadata([]); setMissingPresenterMetadata(null); setProperty(initialProperty); setGeneration(initialGeneration); setLifeScene(''); setTransformationType(''); setDecorationStyle(''); setPresenterReferenceDecision(null); setPresenterSpeechMode('generated'); setPresenterCustomSpeech(''); setCtaEnabled(null); setCta(''); setIncludePhone(null); conversation.resetConversation(); setStatus('idle'); setMessage(''); setResult(null); setFurnishResults([]); setHasAttemptedFurnishGeneration(false) }
  const smartSpacePublication = user?.id ? {
    enabled: true,
    loadConnection: () => getMetaConnectionStatus(supabase),
    resumeIntent: readPendingSmartSpacePublication(window.sessionStorage, user.id),
    onPublish: (intent, destinations) => publishSmartSpacePublication(supabase, intent, destinations),
    onRecover: (intent, destinations) => recoverSmartSpacePublication(supabase, intent, destinations),
    onConfirmed: intent => {
      if (!preservePendingSmartSpacePublication(window.sessionStorage, user.id, intent)) throw new Error('smart_space_publication_pending_not_saved')
    },
    onTerminalClose: () => clearPendingSmartSpacePublication(window.sessionStorage, user.id),
    onConnect: async intent => {
      if (!preservePendingSmartSpacePublication(window.sessionStorage, user.id, intent)) throw new Error('smart_space_publication_pending_not_saved')
      await redirectToMetaOAuth(supabase, url => window.location.assign(url))
    },
  } : undefined
  if (furnishGenerationBusy) return <FurnishRenovateProcessing results={furnishResults} />
  if (isFurnishRenovate && status === 'completed' && furnishResults.length > 0) return <FurnishRenovateDelivery results={furnishResults} onCreateNew={reset} onRetryMaterialization={retryFurnishResultMaterialization} publication={smartSpacePublication} />
  if (result) {
    const sourceType = isLifeInProperty ? 'smart_space_life' : 'smart_space_broker'
    return <section className="mt-10"><CampaignPackage data={{ ...result.campaignPackage, sourceProduct: getJourneyPresentation(journey, t).title, sourceType, sourceId: result.jobId, mediaAssetId: result.jobId, mediaType: 'video', previewUrl: result.signedVideoUrl, downloadUrl: result.signedVideoUrl, unifiedSocialPublishing: true }} smartSpacePublish={smartSpacePublication} mediaPresentation="mobile" onCreateNew={reset} createNewLabel={t('virtualStaging.lifeBroker.newProject')} uiLabels={videoUiLabels} /></section>
  }
  if (status === 'result_unavailable') return <section role="alert" className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm sm:p-7"><p className="text-sm font-black text-amber-900">{message}</p><div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><Button type="button" onClick={retryResultStatus}>{lifeBrokerCopy('checkResult')}</Button><button type="button" onClick={reset} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-black text-amber-900">{lifeBrokerCopy('newProject')}</button></div></section>

  const measureFields = getVirtualStagingMeasureFields(property.type)
  const measuresSummary = measureFields.map(field => property[field] && `${property[field]} ${field === 'area' ? 'm²' : t(`virtualStaging.measures.${field}`).toLocaleLowerCase(draftLocale)}`).filter(Boolean).join(' · ')
  const valuesSummary = [property.price && `${property.purpose === 'rent' ? t('virtualStaging.ui.rent') : t('virtualStaging.ui.price')} ${property.price}`, property.condominium && `${t('virtualStaging.ui.condominium')} ${property.condominium}`, property.iptu && `${t('virtualStaging.ui.tax')} ${property.iptu}`].filter(Boolean).join(' · ')
  const selectedHighlightLabels = property.highlights
    .map(value => getVirtualStagingHighlightLabel(value, { locale: draftLocale, market: draftMarket }))
    .join(' · ')
  const isReviewContext = question[0] === 'review' || Boolean(reviewEditRef.current)
  const furnishSummary = [
    { id: 'transformation_type', label: getFurnishRenovateTransformationLabel(transformationType) },
    { id: 'decoration_style', label: getFurnishRenovateStyleLabel(decorationStyle) },
    { id: 'images', label: images.length === 1 ? '1 imagem' : images.length > 1 ? `${images.length} imagens` : '' },
  ].filter(item => Boolean(item.label))
  const furnishReviewItems = buildFurnishRenovateReviewItems({ imagesCount: furnishProject.property_images.length, transformationType: furnishProject.transformation_type, decorationStyle: furnishProject.decoration_style })
  const standardSummary = [
    { id: 'images', label: images.length && interpolate(t(images.length === 1 ? 'virtualStaging.photos.one' : 'virtualStaging.photos.many'), { count: images.length }) },
    { id: 'purpose', label: property.purpose && t(`virtualStaging.purpose.${property.purpose}`) },
    { id: 'stage', label: getVirtualStagingOptionLabel(property.stage, t) },
    { id: 'type', label: getVirtualStagingOptionLabel(property.type, t) },
    { id: 'facts', label: measuresSummary },
    { id: 'location', label: draftMarket === 'US' ? formatUsLocation(property) : formatVirtualStagingLocation(property) },
    { id: 'commercial', label: valuesSummary || (isReviewContext ? t('virtualStaging.ui.noCommercialInfo') : '') },
    { id: 'highlights', label: selectedHighlightLabels || (isReviewContext ? t('virtualStaging.highlights.none') : '') },
    ...(isBrokerPresentation
      ? [
          { id: 'presenter_reference', label: presenterReferenceDecision === true ? `${t('virtualStaging.lifeBroker.presentation')}: ${t('virtualStaging.lifeBroker.ownImage')}` : '' },
          { id: 'presenter_photo', label: presenterReference ? `${t('virtualStaging.presenter.photo')}: ${t('virtualStaging.lifeBroker.temporaryImage')}` : '' },
          { id: 'presenter_speech_mode', label: t(`virtualStaging.speech.${presenterSpeechMode}`) },
          ...(presenterSpeechMode === 'custom' ? [{ id: 'presenter_custom_speech', label: presenterCustomSpeech }] : []),
        ]
      : isLifeInProperty
        ? [{ id: 'life_scene', label: lifeScene ? `${t('virtualStaging.lifeBroker.life')}: ${getLifeSceneLabel(lifeScene, { t })}` : '' }]
        : [{ id: 'narration', label: generation.narration === 'enabled' ? t('virtualStaging.yes') : generation.narration === 'disabled' ? t('virtualStaging.no') : '' }]),
    { id: 'captions', label: generation.captions === 'enabled' ? t('virtualStaging.yes') : generation.captions === 'disabled' ? t('virtualStaging.no') : '' },
    ...(!isLifeInProperty ? [{ id: 'cta_enabled', label: ctaEnabled === true ? t('virtualStaging.yes') : ctaEnabled === false ? t('virtualStaging.no') : '' }] : []),
    { id: 'cta', label: isLifeInProperty || ctaEnabled === true ? getVirtualStagingOptionLabel(cta, t) : '' },
    { id: 'phone', label: includePhone === true ? phone : includePhone === false ? t('virtualStaging.cta.phoneNone') : '' },
  ].filter(item => Boolean(item.label))
  const summary = isFurnishRenovate ? furnishSummary : standardSummary
  const furnishHasStyleStep = !transformationType || furnishRenovateRequiresStyle(transformationType)
  const furnishStepByQuestion = furnishHasStyleStep
    ? { transformation_type: 1, decoration_style: 2, images: 3, review: 4 }
    : { transformation_type: 1, images: 2, review: 3 }
  const visualStep = status === 'idle'
    ? (isFurnishRenovate ? (furnishStepByQuestion[question[0]] || 1) : question[1])
    : (isFurnishRenovate ? (furnishHasStyleStep ? 4 : 3) : 5)
  const isLocalizedJourney = isLifeOrBrokerJourney(journey.id)
  const presentedJourney = getJourneyPresentation(journey, t)
  const chooseAnotherButton = <ProductButton type="button" variant="secondary" onClick={onChooseAnother}>{isLocalizedJourney ? t('virtualStaging.journey.chooseAnother') : 'Escolher outro módulo'}</ProductButton>
  const journeySteps = isFurnishRenovate
    ? [
        { title: 'Transformação', subtitle: 'Tipo' },
        ...(furnishHasStyleStep ? [{ title: 'Estilo', subtitle: 'Decoração' }] : []),
        { title: 'Imagens', subtitle: 'Upload' },
        { title: 'Revisão', subtitle: 'Projeto' },
      ]
    : (isBrokerPresentation ? ['reference', 'property', 'style', 'review', 'create'] : ['photos', 'property', 'style', 'review', 'create'])
        .map(key => ({ title: t(`virtualStaging.steps.${key}`), subtitle: '' }))
  return <section aria-labelledby={`virtual-staging-chat-${journey.id}`} className="mt-10 space-y-8">
      <ProductSectionHeading
        id={`virtual-staging-chat-${journey.id}`}
        eyebrow={isLocalizedJourney ? interpolate(t('virtualStaging.journey.selected'), { title: presentedJourney.title }) : `Jornada selecionada · ${journey.title}`}
        title={isLocalizedJourney ? t('virtualStaging.journey.heading') : 'Agora, conte como deseja transformar seu imóvel'}
        description={isLocalizedJourney ? t('virtualStaging.journey.description') : 'Responda uma pergunta por vez. Suas escolhas ficam organizadas no resumo ao lado.'}
        action={chooseAnotherButton}
      />
    <ProductSteps steps={journeySteps} activeStep={visualStep} accent="emerald" />
    <GuidedConversation
      history={conversation.history}
      phase={conversation.phase}
      questionId={question[0]}
      question={localizedQuestion}
      questionNumber={questionIndex + 1}
      totalQuestions={questions.length}
      onEdit={editConversationAnswer}
      summaryItems={summary}
      review={question[0] === 'review'}
      editDisabled={['uploading', 'generating', 'preparing_result'].includes(status)}
      designSystem
      accent="emerald"
    >
      <Question id={question[0]} {...{ journeyId: journey.id, locale: draftLocale, market: draftMarket, lifeScene, transformationType, decorationStyle, presenterReferenceDecision, presenterSpeechMode, presenterCustomSpeech, presenterReference, presenterReferenceMessage, images, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, presenterInputRef, message, status, canGenerateFurnish, furnishGenerationBusy, addPresenterReference, clearPresenterReference, addImages, move, remove, answerQuestion, setLifeScene, setTransformationType, setDecorationStyle, setPresenterReferenceDecision, setPresenterSpeechMode, setPresenterCustomSpeech, setPropertyField, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, createTour, resetCreation: reset, reviewItems: isFurnishRenovate ? furnishReviewItems : summary, onReviewEdit: editConversationAnswer, navigateToVideoProduct: () => navigate('/smart-tour-ai') }} />
    </GuidedConversation>
  </section>
}

function VirtualSpaceHeroVisual({ t }) {
  return <div aria-label="Os três módulos do Smart Space" className="relative flex min-h-[290px] items-center justify-center overflow-hidden lg:min-h-[275px]">
    <div className="absolute inset-y-2 right-0 w-[88%] opacity-30 [background-image:radial-gradient(circle_at_center,#3b82f6_1.5px,transparent_1.5px)] [background-size:18px_18px]" aria-hidden="true" />
    <div className="relative grid w-full grid-cols-3 items-end gap-2 px-1 sm:gap-3 sm:px-4">
      {VIRTUAL_STAGING_JOURNEYS.map((journey, index) => { const presentedJourney = getJourneyPresentation(journey, t); return <article key={journey.id} className={`min-w-0 ${index === 1 ? '-translate-y-4' : ''}`}>
        <div className="mx-auto w-full max-w-[132px] rounded-[1.65rem] border border-slate-700 bg-slate-950 p-1.5 shadow-[0_22px_48px_-18px_rgba(15,23,42,0.68)] ring-2 ring-white">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[1.25rem] bg-slate-900">
            {journey.id === FURNISH_RENOVATE_JOURNEY_ID
              ? <VirtualStagingBeforeAfterPhone initialIndex={0} roundedClass="rounded-[1.25rem]" />
              : <video src={journey.demoVideo} aria-label={isLifeOrBrokerJourney(journey.id) ? interpolate(t('virtualStaging.demo.example'), { title: presentedJourney.title }) : `Exemplo do módulo ${journey.title}`} autoPlay muted loop playsInline controls={false} preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="smart-phone-media absolute inset-0 bg-black" />}
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-[132px] text-center text-[10px] font-black leading-4 text-slate-700 sm:text-xs">{presentedJourney.title}</p>
      </article> })}
    </div>
  </div>
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ))

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = event => setPrefersReducedMotion(event.matches)
    setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  return prefersReducedMotion
}

const VIRTUAL_STAGING_COMPARISON_SLIDES = Object.freeze([
  Object.freeze({ src: VIRTUAL_STAGING_BEFORE_IMAGE, label: 'Antes', alt: 'Ambiente antes do Smart Space' }),
  Object.freeze({ src: VIRTUAL_STAGING_AFTER_IMAGE, label: 'Depois', alt: 'Ambiente depois do Smart Space' }),
])

function VirtualStagingBeforeAfterPhone({ initialIndex, roundedClass }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const prefersReducedMotion = usePrefersReducedMotion()
  const advance = useCallback(() => setActiveIndex(current => (current + 1) % VIRTUAL_STAGING_COMPARISON_SLIDES.length), [])

  useEffect(() => {
    if (prefersReducedMotion) return undefined
    const intervalId = window.setInterval(advance, 2500)
    return () => window.clearInterval(intervalId)
  }, [advance, prefersReducedMotion])

  const activeSlide = VIRTUAL_STAGING_COMPARISON_SLIDES[activeIndex]
  return <button type="button" onClick={advance} aria-label={`Exibir ${activeIndex === 0 ? 'Depois' : 'Antes'} no Smart Space`} className={`group absolute inset-0 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${roundedClass}`}>
    {VIRTUAL_STAGING_COMPARISON_SLIDES.map((slide, index) => <img key={slide.label} src={slide.src} alt={slide.alt} draggable={false} loading="eager" decoding="async" className={`absolute inset-0 h-full w-full object-cover object-center ${prefersReducedMotion ? 'transition-none' : 'transition-opacity duration-500 ease-out'} ${index === activeIndex ? 'opacity-100' : 'opacity-0'}`} />)}
    <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm sm:text-[10px]">{activeSlide.label}</span>
    <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-slate-950/50 px-2 py-1 backdrop-blur-sm" aria-hidden="true">{VIRTUAL_STAGING_COMPARISON_SLIDES.map((slide, index) => <span key={slide.label} className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? 'bg-white' : 'bg-white/45'}`} />)}</span>
    <span className={`pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 transition group-hover:ring-white/35 motion-reduce:transition-none ${roundedClass}`} aria-hidden="true" />
  </button>
}

function VirtualStagingModules({ selectedJourneyId, onSelect, t }) {
  const [activeDemo, setActiveDemo] = useState(null)
  const modalVideoRef = useRef(null)
  const closeButtonRef = useRef(null)
  const closeDemo = () => {
    modalVideoRef.current?.pause()
    setActiveDemo(null)
  }

  useEffect(() => {
    if (!activeDemo) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        modalVideoRef.current?.pause()
        setActiveDemo(null)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeDemo])

  return <>
    <div className="mt-7 grid gap-5 md:grid-cols-3">
      {VIRTUAL_STAGING_JOURNEYS.map(journey => {
      const isSelected = selectedJourneyId === journey.id
      const isLocalizedJourney = isLifeOrBrokerJourney(journey.id)
      const presentedJourney = getJourneyPresentation(journey, t)
      const hasOfficialDemo = journey.demoAssetStatus === 'official'
      const isVirtualStagingDemo = journey.id === FURNISH_RENOVATE_JOURNEY_ID
      const preview = <div className="mx-auto w-full max-w-[190px] rounded-[2rem] border border-slate-700 bg-slate-950 p-2 shadow-xl shadow-slate-200/70">
        <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.45rem] bg-slate-900">
          {isVirtualStagingDemo ? <VirtualStagingBeforeAfterPhone initialIndex={1} roundedClass="rounded-[1.45rem]" /> : <video
            src={journey.demoVideo}
            aria-label={isLocalizedJourney ? interpolate(t('virtualStaging.demo.preview'), { title: presentedJourney.title }) : `Demonstração: ${journey.title}`}
            autoPlay
            muted
            loop
            playsInline
            controls={false}
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noremoteplayback"
            onContextMenu={event => event.preventDefault()}
            className="smart-phone-media pointer-events-none absolute inset-0 bg-black"
          />}
          <span className="pointer-events-none absolute inset-0 rounded-[1.45rem] ring-1 ring-inset ring-white/10 transition group-hover:ring-primary-300/60" />
        </div>
      </div>
      return <article
        key={journey.id}
        className={`group flex min-w-0 flex-col rounded-3xl bg-white p-4 text-left transition-all duration-200 ${isSelected ? 'shadow-[0_20px_45px_-24px_rgba(30,64,175,0.65)] ring-2 ring-primary-500' : 'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-26px_rgba(15,23,42,0.5)] hover:ring-primary-200'}`}
      >
        {hasOfficialDemo && !isVirtualStagingDemo ? <button type="button" onClick={() => setActiveDemo(journey)} aria-label={isLocalizedJourney ? interpolate(t('virtualStaging.demo.enlarge'), { title: presentedJourney.title }) : `Ampliar demonstração: ${journey.title}`} className="mx-auto block w-full rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">{preview}</button> : preview}
        <h3 className="mt-4 text-center text-base font-black text-slate-950">{presentedJourney.title}</h3>
        <p className="mt-2 text-center text-sm font-semibold leading-6 text-slate-600">{presentedJourney.description}</p>
        {hasOfficialDemo && !isVirtualStagingDemo && <ProductButton type="button" variant="secondary" size="sm" onClick={() => setActiveDemo(journey)} className="mx-auto mt-4"><PlayCircle className="h-4 w-4" aria-hidden="true" />{isLocalizedJourney ? t('virtualStaging.demo.view') : 'Ver exemplo'}</ProductButton>}
        <ProductButton type="button" variant={isSelected ? 'primary' : 'secondary'} aria-pressed={isSelected} aria-controls={isSelected ? `virtual-staging-chat-${journey.id}` : undefined} onClick={() => onSelect(journey.id)} className="mx-auto mt-4 w-fit">
          {isLocalizedJourney ? (isSelected ? t('virtualStaging.journey.selectedModule') : t('virtualStaging.journey.chooseModule')) : (isSelected ? 'Módulo selecionado' : 'Escolher módulo')}
        </ProductButton>
      </article>
      })}
    </div>
    {activeDemo && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={interpolate(t('virtualStaging.demo.expanded'), { title: getJourneyPresentation(activeDemo, t).title })} onMouseDown={event => { if (event.target === event.currentTarget) closeDemo() }}>
      <div className="relative flex max-h-full w-full max-w-4xl flex-col items-center">
        <div className="mb-3 flex w-full items-center justify-between gap-3 text-white">
          <p className="truncate text-lg font-black">{getJourneyPresentation(activeDemo, t).title}</p>
          <button ref={closeButtonRef} type="button" onClick={closeDemo} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70" aria-label={t('virtualStaging.demo.close')}><X className="h-5 w-5" /></button>
        </div>
        <div className="relative h-[min(calc(100dvh-9rem),calc(177.778vw-2.667rem),760px)] w-auto max-w-full aspect-[9/16] overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-2xl">
          <video key={activeDemo.id} ref={modalVideoRef} src={activeDemo.demoVideo} aria-label={interpolate(t('virtualStaging.demo.expanded'), { title: getJourneyPresentation(activeDemo, t).title })} autoPlay playsInline controls preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="smart-presentation-media bg-black" />
        </div>
      </div>
    </div>}
  </>
}

function Question(props) {
  const { id, journeyId, locale, market, lifeScene, transformationType, decorationStyle, presenterReferenceDecision, presenterSpeechMode, presenterCustomSpeech, presenterReference, presenterReferenceMessage, images, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, presenterInputRef, message, status, canGenerateFurnish, furnishGenerationBusy, addPresenterReference, clearPresenterReference, addImages, move, remove, answerQuestion, setLifeScene, setTransformationType, setDecorationStyle, setPresenterReferenceDecision, setPresenterSpeechMode, setPresenterCustomSpeech, setPropertyField, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, createTour, resetCreation, reviewItems, onReviewEdit, navigateToVideoProduct } = props
  const isFurnishRenovate = journeyId === FURNISH_RENOVATE_JOURNEY_ID
  const isLifeInProperty = journeyId === LIFE_IN_PROPERTY_JOURNEY_ID
  const isBrokerPresentation = journeyId === BROKER_PRESENTATION_JOURNEY_ID
  const { t } = useLocale()
  const optionLabel = value => getVirtualStagingOptionLabel(value, t)
  const choices = (items, value, select) => <div className="grid gap-3 sm:grid-cols-2">{items.map(raw => { const item = typeof raw === 'string' ? { id: raw, label: raw } : raw; return <button key={item.id} type="button" onClick={() => select(item.id, item.label)} className={`rounded-smart-control border p-4 text-left font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${value === item.id ? (isFurnishRenovate ? 'border-primary-500 bg-primary-50 text-primary-950 ring-2 ring-primary-100' : 'border-emerald-400 bg-emerald-50') : `border-slate-200 bg-white ${isFurnishRenovate ? 'hover:border-primary-300 focus:ring-primary-500' : ''}`}`}><b className="text-sm">{item.label}</b>{item.description && <span className="mt-1 block text-xs text-slate-500">{item.description}</span>}</button>})}</div>
  const explainedChoices = (explanation, items, value, select) => <><p className="mb-3 text-xs font-semibold leading-5 text-slate-500">{explanation}</p>{choices(items, value, select)}</>
  const cont = (disabled, answer, nextQuestionId, apply, answerId = '') => <Button type="button" disabled={disabled} onClick={() => answerQuestion({ answer, answerId, nextQuestionId, apply })} className="mt-5">{t('virtualStaging.continue')}</Button>
  if (id === 'transformation_type' && isFurnishRenovate) return choices(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS, transformationType, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { setTransformationType(value); if (!furnishRenovateRequiresStyle(value)) setDecorationStyle('') } }))
  if (id === 'decoration_style' && isFurnishRenovate) return choices(FURNISH_RENOVATE_STYLE_OPTIONS, decorationStyle, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setDecorationStyle(value) }))
  if (id === 'presenter_reference') return choices(BROKER_REFERENCE_OPTIONS.map(option => ({ ...option, label: option.id === 'yes' ? t('common.yes') : t('common.no') })), presenterReferenceDecision === true ? 'yes' : presenterReferenceDecision === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { setPresenterReferenceDecision(value === 'yes'); if (value === 'no') clearPresenterReference() } }))
  if (id === 'presenter_speech_mode') return choices(BROKER_SPEECH_OPTIONS.map(option => ({ ...option, label: t(`virtualStaging.speech.${option.id}`) })), presenterSpeechMode, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { setPresenterSpeechMode(value); if (value !== 'custom') setPresenterCustomSpeech('') } }))
  if (id === 'presenter_custom_speech') { const words = presenterCustomSpeech.trim().split(/\s+/).filter(Boolean); return <><textarea value={presenterCustomSpeech} onChange={event => setPresenterCustomSpeech(event.target.value)} placeholder={t('virtualStaging.speech.placeholder')} className="min-h-32 w-full rounded-xl border p-3" /><p className="mt-2 text-xs text-slate-500">{t('virtualStaging.speech.limit').replace('{count}', BROKER_CUSTOM_SPEECH_MAX_WORDS)}</p>{cont(!words.length || words.length > BROKER_CUSTOM_SPEECH_MAX_WORDS, presenterCustomSpeech.trim(), 'captions')}</> }
  if (id === 'presenter_photo') return <>
    <p className="text-sm font-semibold leading-6 text-slate-600">{t('virtualStaging.presenter.notice')}</p>
    <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm font-semibold leading-6 text-cyan-950">{t('virtualStaging.presenter.similarity')}</div>
    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{t('virtualStaging.presenter.photo')}</p>
    <input ref={presenterInputRef} type="file" accept="image/jpeg,image/png" aria-label={t('virtualStaging.presenter.select')} hidden onChange={event => { addPresenterReference(event.target.files); event.target.value = '' }} />
    {!presenterReference ? <button type="button" aria-label={t('virtualStaging.presenter.select')} onClick={() => presenterInputRef.current?.click()} className="mt-3 flex min-h-36 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 px-4 text-center"><UploadCloud className="text-emerald-600" /><b className="mt-2 text-sm">{t('virtualStaging.presenter.select')}</b><span className="mt-1 text-xs text-slate-500">{t('virtualStaging.presenter.format')}</span></button> : <div className="mt-3 overflow-hidden rounded-3xl border border-emerald-200 bg-white p-3 shadow-sm"><img src={presenterReference.preview} alt={t('virtualStaging.presenter.photo')} className="mx-auto aspect-square max-h-72 w-full rounded-2xl object-cover sm:max-w-72" /><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center"><button type="button" aria-label={t('virtualStaging.presenter.replace')} onClick={() => presenterInputRef.current?.click()} className="min-h-11 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-50">{t('virtualStaging.presenter.replace')}</button><button type="button" aria-label={t('virtualStaging.presenter.remove')} onClick={clearPresenterReference} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50">{t('virtualStaging.presenter.remove')}</button></div></div>}
    {presenterReferenceMessage && <p className="mt-3 text-sm font-bold text-red-600">{presenterReferenceMessage}</p>}
    {presenterReference && cont(false, '1 foto do apresentador', 'images')}
  </>
  if (id === 'presenter_reference_required') return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-semibold leading-6 text-amber-950">{t('virtualStaging.lifeBroker.presenterRequiredNotice')}</p><Button type="button" onClick={navigateToVideoProduct} className="mt-5">{t('virtualStaging.lifeBroker.goToVideo')}</Button></div>
  if (id === 'images') {
    const imageLimit = isFurnishRenovate ? FURNISH_RENOVATE_MAX_IMAGES : VIRTUAL_STAGING_MAX_IMAGES
    const copy = key => t(`virtualStaging.lifeBroker.${key}`)
    return <>{isFurnishRenovate && <p className="mb-3 text-sm font-semibold leading-6 text-slate-600">{FURNISH_RENOVATE_COPY.uploadDescription}</p>}{!isFurnishRenovate && <p className="mb-3 text-sm font-semibold leading-6 text-slate-600">{copy('uploadInstruction')}</p>}{isBrokerPresentation && <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{t('virtualStaging.ui.images')}</p>}<input ref={inputRef} type="file" multiple accept="image/jpeg,image/png" aria-label={isBrokerPresentation ? copy('selectPropertyPhotos') : copy('selectPhotos')} hidden onChange={event => { addImages(event.target.files); event.target.value = '' }} /><button type="button" aria-label={isBrokerPresentation ? copy('selectPropertyPhotos') : copy('selectPhotos')} onClick={() => inputRef.current?.click()} className={`flex min-h-32 w-full flex-col items-center justify-center rounded-smart-card border-2 border-dashed px-4 text-center transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${isFurnishRenovate ? 'border-primary-200 bg-primary-50/60 hover:border-primary-400 focus:ring-primary-500' : 'border-emerald-200 bg-emerald-50/50'}`}><UploadCloud className={isFurnishRenovate ? 'text-primary-600' : 'text-emerald-600'} /><b className="mt-2 text-sm">{isFurnishRenovate ? 'Selecionar imagens' : isBrokerPresentation ? copy('selectPropertyPhotos') : copy('selectPhotos')}</b>{isFurnishRenovate ? <span className="text-xs text-slate-500">JPG ou PNG · até 15 MB cada</span> : <><span className="text-xs text-slate-500">{copy('uploadInstruction')}</span><span className="mt-1 text-xs text-slate-400">{copy('photoFormat')}</span></>}</button>{isFurnishRenovate && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{FURNISH_RENOVATE_COPY.uploadHint}</p>}<p className="mt-3 text-xs font-bold">{isFurnishRenovate ? `${images.length} de ${imageLimit} imagens adicionadas` : copy('photoCount').replace('{count}', images.length).replace('{limit}', imageLimit)}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{images.map((item, position) => <div key={item.key} className="flex items-center gap-2 rounded-xl border p-2"><img src={item.preview} alt={isFurnishRenovate ? `Foto ${position + 1}` : copy('photo').replace('{count}', position + 1)} className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{position + 1}. {item.file.name}</span>{[-1,1].map(offset => <button key={offset} type="button" aria-label={(offset < 0 ? copy('moveUp') : copy('moveDown')).replace('{count}', position + 1)} disabled={position + offset < 0 || position + offset >= images.length} onClick={() => move(position, offset)}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}<button type="button" aria-label={copy('remove').replace('{count}', position + 1)} onClick={() => remove(position)}><Trash2 className="h-4 w-4" /></button></div>)}</div>{message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}{images.length > 0 && cont(false, images.length === 1 ? copy('oneImageSelected') : copy('imagesSelected').replace('{count}', images.length))}</>
  }
  if (id === 'purpose') return choices([{id:'sale',label:t('virtualStaging.purpose.sale')},{id:'rent',label:t('virtualStaging.purpose.rent')}], property.purpose, (value, label) => answerQuestion({ answer: label, answerId: value, nextQuestionId: isFurnishRenovate ? 'type' : 'stage', apply: () => setPropertyField('purpose', value) }))
  if (id === 'stage') { const stageOptions = property.purpose === 'rent' ? LIFE_RENTAL_STAGE_OPTIONS : STAGES; return choices(stageOptions.map(value => ({ id: value, label: optionLabel(value) })), property.stage, (value, label) => answerQuestion({ answer: label, answerId: value, nextQuestionId: 'type', apply: () => setPropertyField('stage', value) })) }
  if (id === 'type') return <>{choices(VIRTUAL_STAGING_PROPERTY_TYPES.map(value => ({ id: value, label: optionLabel(value) })), property.type, value => setPropertyField('type', value))}{cont(!property.type, optionLabel(property.type), 'facts')}</>
  if (['bedrooms', 'suites', 'parkingSpaces'].includes(id)) {
    const labels = { bedrooms: t('virtualStaging.measures.bedrooms').toLocaleLowerCase(locale), suites: t('virtualStaging.measures.suites').toLocaleLowerCase(locale), parkingSpaces: t('virtualStaging.measures.parkingSpaces').toLocaleLowerCase(locale) }
    return choices(VIRTUAL_STAGING_MEASURE_OPTIONS[id], property[id], value => answerQuestion({ answer: `${value} ${labels[id]}`, answerId: value, apply: () => setPropertyField(id, value) }))
  }
  if (id === 'area') return <><label className="text-xs font-black">{t('virtualStaging.lifeBroker.areaLabel')}<div className="mt-1 flex items-center rounded-smart-control border bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100"><input aria-label={t('virtualStaging.lifeBroker.areaLabel')} value={property.area} onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 6); setPropertyField('area', Number(digits) > 0 ? String(Number(digits)) : '') }} inputMode="numeric" placeholder={t('virtualStaging.lifeBroker.areaPlaceholder')} className="min-w-0 flex-1 rounded-smart-control border-0 p-3 outline-none" /><span className="pr-3 text-sm font-black text-slate-500">m²</span></div></label>{cont(Number(property.area) <= 0, `${property.area} m²`, 'location')}</>
  if (id === 'facts') {
    const fields = getVirtualStagingMeasureFields(property.type)
    const fieldLabels = { bedrooms:t('virtualStaging.measures.bedrooms'), suites:t('virtualStaging.measures.suites'), parkingSpaces:t('virtualStaging.measures.parkingSpaces'), area:t('virtualStaging.measures.area') }
    const answer = fields.filter(field => property[field] !== '').map(field => `${fieldLabels[field]}: ${property[field]}${field === 'area' ? ' m²' : ''}`).join(' · ') || t('virtualStaging.lifeBroker.noMeasures')
    const isIncomplete = fields.some(field => field === 'area' ? (!isFurnishRenovate && Number(property.area) <= 0) : property[field] === '')
    return <>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => field === 'area' ? (
          <label key={field} className="text-xs font-black">
            {fieldLabels[field]}
            <div className="mt-1 flex items-center rounded-xl border bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <input
                aria-label={t('virtualStaging.lifeBroker.areaLabel')}
                value={property.area}
                onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 6); setPropertyField('area', Number(digits) > 0 ? String(Number(digits)) : '') }}
                inputMode="numeric"
                placeholder={t('virtualStaging.lifeBroker.areaPlaceholder')}
                className="min-w-0 flex-1 rounded-xl border-0 p-3 outline-none"
              />
              <span className="pr-3 text-sm font-black text-slate-500">m²</span>
            </div>
          </label>
        ) : (
          <fieldset key={field} className="min-w-0">
            <legend className="text-xs font-black">{fieldLabels[field]}</legend>
            <div className="mt-1 flex flex-wrap gap-2" aria-label={t('virtualStaging.lifeBroker.measureOptions').replace('{label}', fieldLabels[field].toLocaleLowerCase(locale))}>
              {VIRTUAL_STAGING_MEASURE_OPTIONS[field].map(option => <button key={option} type="button" onClick={() => setPropertyField(field, option)} className={`min-w-11 rounded-xl border px-3 py-2 text-sm font-black transition ${property[field] === option ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'}`}>{option}</button>)}
            </div>
          </fieldset>
        ))}
      </div>
      {cont(isIncomplete, answer, 'location')}
    </>
  }
  if (id === 'location') {
    if (market === 'US') {
      const states = getStatesForMarket('US'); const counties = getCountiesByState(property.state); const zipCode = normalizeUsZipCode(property.zipCode); const location = formatUsLocation({ ...property, zipCode })
      return <div className="space-y-3"><label className="block text-xs font-black">State<select aria-label="State" value={property.state} onChange={event => { setPropertyField('state', event.target.value); setPropertyField('county', '') }} className="mt-1 w-full rounded-xl border p-3"><option value="">Select state</option>{states.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="block text-xs font-black">County<select aria-label="County" value={property.county} disabled={!property.state} onChange={event => setPropertyField('county', event.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">{property.state ? 'Select county' : 'Select state first'}</option>{counties.map(option => <option key={option.countyFips} value={option.value}>{option.label}</option>)}</select></label><label className="block text-xs font-black">City<input aria-label="City" value={property.city} onChange={event => setPropertyField('city', event.target.value)} placeholder="City" className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-xs font-black">ZIP Code<input aria-label="ZIP Code" value={property.zipCode} onChange={event => setPropertyField('zipCode', normalizeUsZipCode(event.target.value))} inputMode="numeric" placeholder="12345" className="mt-1 w-full rounded-xl border p-3" />{property.zipCode && !isValidUsZipCode(zipCode) && <span className="mt-1 block text-xs text-red-600">Use a valid ZIP Code.</span>}</label><label className="block text-xs font-black">Neighborhood / Community <span className="font-normal">(optional)</span><input aria-label="Neighborhood / Community" value={property.neighborhoodCommunity} onChange={event => setPropertyField('neighborhoodCommunity', event.target.value)} placeholder="Neighborhood or community" className="mt-1 w-full rounded-xl border p-3" /></label>{cont(!property.state || !property.county || !property.city.trim() || !isValidUsZipCode(zipCode), location, 'commercial', () => setPropertyField('zipCode', zipCode))}</div>
    }
    const normalizedDistrict = normalizeVirtualStagingDistrict(property.district); const location = formatVirtualStagingLocation({ ...property, district: normalizedDistrict }); return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state',value); setPropertyField('city','') }} />{property.state && <SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city',value)} />}<input value={property.district} onChange={event => setPropertyField('district',event.target.value)} placeholder={t('virtualStaging.location.neighborhood')} className="w-full rounded-xl border p-3" />{cont(!property.state || !property.city || !normalizedDistrict, location, 'commercial', () => setPropertyField('district', normalizedDistrict))}</div> }
  if (id === 'commercial') { const commercialAnswer = [property.price, property.condominium, property.iptu].filter(Boolean).join(' · ') || t('virtualStaging.lifeBroker.noCommercial'); const commercialFields = [['price', property.purpose === 'rent' ? t('virtualStaging.lifeBroker.rent') : t('virtualStaging.lifeBroker.price')], ['condominium',t('virtualStaging.lifeBroker.condominium')], ['iptu',t('virtualStaging.lifeBroker.tax')]]; return <><div className="grid gap-3 sm:grid-cols-3">{commercialFields.map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input aria-label={label} value={property[field]} onChange={event => setPropertyField(field, formatVirtualStagingCurrency(event.target.value))} inputMode="numeric" placeholder={t('virtualStaging.lifeBroker.currencyPlaceholder')} className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(false, commercialAnswer, 'highlights', undefined, commercialAnswer === t('virtualStaging.lifeBroker.noCommercial') ? 'empty' : 'provided')}</> }
  if (id === 'highlights') { const highlightGroups = getVirtualStagingHighlightGroups(property.type).map(group => ({ ...group, items: group.items.filter(item => isVirtualStagingHighlightAvailableForMarket(item, market)) })).filter(group => group.items.length); const selectedLabels = property.highlights.map(value => getVirtualStagingHighlightLabel(value, { locale, market })).join(' · '); const nextQuestionId = isLifeInProperty ? 'life_scene' : 'captions'; return <><p className="mb-3 text-xs font-bold text-slate-500">{t('virtualStaging.highlights.instruction')}</p><div className="space-y-4">{highlightGroups.map(group => <section key={group.title}><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">{getVirtualStagingHighlightGroupLabel(group.title, { locale })}</h4><div className="flex flex-wrap gap-2">{group.items.map(item => <button key={item} type="button" disabled={!property.highlights.includes(item) && property.highlights.length >= 10} onClick={() => toggleHighlight(item)} className={`rounded-full border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45 ${property.highlights.includes(item) ? 'border-emerald-400 bg-emerald-50' : ''}`}>{getVirtualStagingHighlightLabel(item, { locale, market })}</button>)}</div></section>)}</div>{cont(false, selectedLabels || t('virtualStaging.highlights.none'), nextQuestionId)}</> }
  if (id === 'life_scene') return choices(LIFE_SCENE_OPTIONS.map(option => ({ ...option, label: t(`virtualStaging.lifeScene.${option.id}`) })), lifeScene, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setLifeScene(value) }))
  if (id === 'narration') return explainedChoices('Uma narração em português do Brasil apresentará o imóvel de forma natural e sincronizada com as imagens.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.narration, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('narration', value) }))
  if (id === 'captions') return explainedChoices(t('virtualStaging.lifeBroker.captionsHelp'), [{id:'enabled',label:t('virtualStaging.yes')},{id:'disabled',label:t('virtualStaging.no')}], generation.captions, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('captions', value) }))
  if (id === 'cta_enabled') return explainedChoices(t('virtualStaging.lifeBroker.ctaHelp'), [{id:'yes',label:t('virtualStaging.yes')},{id:'no',label:t('virtualStaging.no')}], ctaEnabled === true ? 'yes' : ctaEnabled === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { const enabled = value === 'yes'; setCtaEnabled(enabled); if (!enabled) setCta('') } }))
  if (id === 'cta') return choices(CTAS.map(value => ({ id: value, label: optionLabel(value) })), cta, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setCta(value) }))
  if (id === 'phone') return choices([{id:'yes',label:t('virtualStaging.yes'),description:phone || t('virtualStaging.cta.phoneMissing')},{id:'no',label:t('virtualStaging.no')}], includePhone === true ? 'yes' : includePhone === false ? 'no' : '', value => { if (value === 'yes' && !phone) return; answerQuestion({ answer: value === 'yes' ? t('virtualStaging.history.phoneProfessional') : t('virtualStaging.history.phoneNone'), answerId: value, apply: () => setIncludePhone(value === 'yes') }) })
  if (isFurnishRenovate) {
    return <>
      <div className="rounded-2xl bg-primary-50 p-4 text-sm font-semibold leading-6 text-primary-950">
        <p className="text-lg font-black">Revise seu projeto</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-primary-100 bg-white px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-wide text-primary-700">{item.displayLabel || reviewLabel(item.id)}</p><p className="mt-1 text-sm font-black text-slate-800">{item.label}</p>{item.id === 'images' && <div className="mt-3 flex flex-wrap gap-2">{images.map((image, index) => <img key={image.key} src={image.preview} alt={`Imagem ${index + 1} na ordem do projeto`} className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />)}</div>}</div><button type="button" onClick={() => onReviewEdit(item.id)} className="rounded-xl px-3 py-2 text-xs font-black text-primary-700 hover:bg-primary-50">Editar</button></div></div>)}</div>
        <p className="mt-5 rounded-2xl border border-primary-100 bg-white/80 p-4 font-bold">{FURNISH_RENOVATE_COPY.reviewNotice}</p>
        <p className="mt-3 text-sm font-black text-primary-900">{getSmartSpaceUnitCost(transformationType)} ST por imagem · Total da seleção: {getSmartSpaceQuote(transformationType, images.length)} ST</p>
      </div>
      {status === 'error' && message && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><Button type="button" disabled={!canGenerateFurnish || furnishGenerationBusy} aria-disabled={!canGenerateFurnish || furnishGenerationBusy} onClick={createTour} className="w-full"><Sparkles className="mr-2 h-4 w-4" />Transformar espaço</Button><button type="button" disabled={furnishGenerationBusy} onClick={resetCreation} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Refazer projeto</button></div>
    </>
  }
  const finalChoiceItems = [
    ...(isBrokerPresentation
      ? [
          { label: t('virtualStaging.lifeBroker.presentation'), value: t('virtualStaging.lifeBroker.ownImage') },
          { label: t('virtualStaging.presenter.photo'), value: t('virtualStaging.lifeBroker.temporaryImage') },
        ]
      : isLifeInProperty
      ? [{ label: t('virtualStaging.lifeBroker.life'), value: getLifeSceneLabel(lifeScene, { t }) }]
      : [{ label: 'Narração', value: generation.narration === 'enabled' ? 'Sim' : 'Não' }]),
    { label: t('virtualStaging.lifeBroker.texts'), value: generation.captions === 'enabled' ? t('virtualStaging.yes') : t('virtualStaging.no') },
    { label: t('virtualStaging.lifeBroker.cta'), value: isLifeInProperty ? cta : ctaEnabled === true ? cta : t('virtualStaging.lifeBroker.noCta') },
    ...(isLifeInProperty || isBrokerPresentation ? [{ label: t('virtualStaging.lifeBroker.phone'), value: includePhone === true ? phone : t('virtualStaging.lifeBroker.noPhone') }] : ctaEnabled === true ? [{ label: t('virtualStaging.lifeBroker.phone'), value: includePhone === true ? phone : t('virtualStaging.lifeBroker.noPhone') }] : []),
  ]
  return <>
    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-950">
      <p className="text-lg font-black">{t('virtualStaging.lifeBroker.reviewTitle')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {finalChoiceItems.map(item => <div key={item.label} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{item.label}</p><p className="mt-1 text-sm font-black text-slate-800">{item.value}</p></div>)}
      </div>
      <p className="mt-4 font-black">{t('virtualStaging.lifeBroker.reviewConfirm')}</p>
    </div>
    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{t('virtualStaging.lifeBroker.allChoices')}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{reviewLabel(item.id, { t, journeyId })}</p><p className="mt-1 break-words text-sm font-bold leading-6 text-slate-700">{item.label}</p></div><button type="button" aria-label={`${t('virtualStaging.lifeBroker.edit')}: ${reviewLabel(item.id, { t, journeyId })}`} onClick={() => onReviewEdit(item.id)} className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50">{t('virtualStaging.lifeBroker.edit')}</button></div></div>)}
    </div>
    {message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-emerald-600" />}<b className="text-sm">{message}</b></div>}
    <SmartTokenEstimate cost={SMART_TOKEN_COSTS.geminiVideo} />
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Button type="button" disabled={['uploading','generating'].includes(status)} onClick={createTour} className="w-full"><Video className="mr-2 h-4 w-4" />{status === 'error' ? t('virtualStaging.lifeBroker.retry') : t('virtualStaging.lifeBroker.createVideo')}</Button>
      <button type="button" disabled={['uploading','generating'].includes(status)} onClick={resetCreation} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">{t('virtualStaging.lifeBroker.remake')}</button>
    </div>
  </>
}

function reviewLabel(id, { t, journeyId } = {}) {
  const labels = {
    transformation_type: 'Tipo de transformação', decoration_style: 'Estilo', images: 'Fotografias', purpose: 'Finalidade', stage: 'Estado', type: 'Tipo', facts: 'Medidas', area: 'Área', state: 'Estado', city: 'Cidade', district: 'Bairro', neighborhood: 'Bairro', bedrooms: 'Dormitórios', suites: 'Suítes', parkingSpaces: 'Vagas',
    location: 'Localização', commercial: 'Valores', highlights: 'Destaques',
    presenter_reference: 'Apresentação pelo Corretor', presenter_photo: 'Foto do apresentador', life_scene: 'Vida no Imóvel', narration: 'Narração', captions: 'Destaques no vídeo', cta_enabled: 'CTA final', cta: 'Chamada escolhida', phone: 'Telefone',
  }
  if ((journeyId === LIFE_IN_PROPERTY_JOURNEY_ID || journeyId === BROKER_PRESENTATION_JOURNEY_ID) && t) return t(`virtualStaging.review.${id}`)
  return labels[id] || id
}
