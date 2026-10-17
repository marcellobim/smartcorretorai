import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Facebook,
  FileText,
  Hash,
  Home,
  Instagram,
  Linkedin,
  Mail,
  PlayCircle,
  Send,
  Share2,
} from 'lucide-react'
import { buildCampaignPackage } from './buildCampaignPackage'
import { buildCampaignPackageShareProps } from './campaignPackageShare'
import { downloadFileFromPrivateUrl, getDownloadErrorMessage } from '../../lib/download-file'
import SharePublishActions from '../share/SharePublishActions'
import TestimonialInvite from '../testimonials/TestimonialInvite'
import BannerPublishDialog from './BannerPublishDialog'
import { buildBannerPublicationIntent, canBuildBannerPublicationIntent, restorePendingBannerPublication } from '../../lib/banner-social-publish'
import { buildSmartTourPublicationIntent, restorePendingSmartTourPublication } from '../../lib/smart-tour-social-publish'
import { buildStudioPublicationIntent, restorePendingStudioPublication } from '../../lib/studio-social-publish'
import { buildSmartSpaceCampaignPublicationIntent, restorePendingSmartSpaceCampaignPublication } from '../../lib/smart-space-social-publish'
import { useLocale } from '../../i18n/useLocale'

function WhatsAppIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.895 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

const sectionIcons = {
  instagram: { Icon: Instagram, iconClass: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white' },
  social: { Icon: Instagram, iconClass: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white' },
  whatsapp: { Icon: WhatsAppIcon, iconClass: 'bg-[#25D366] text-white' },
  facebook: { Icon: Facebook, iconClass: 'bg-[#1877F2] text-white' },
  email: { Icon: Mail, iconClass: 'bg-slate-700 text-white' },
  linkedin: { Icon: Linkedin, iconClass: 'bg-[#0A66C2] text-white' },
  hashtags: { Icon: Hash, iconClass: 'bg-emerald-600 text-white' },
  portal: { Icon: Home, iconClass: 'bg-primary-800 text-cyan-100' },
}

const replaceLabelToken = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template)
const campaignModuleLabel = (module, uiLabels) => uiLabels?.delivery?.modules?.[module.id] ?? module.title
const campaignFieldLabel = (module, field, index, uiLabels) => {
  const labels = uiLabels?.delivery
  if (['social', 'instagram', 'whatsapp', 'facebook', 'linkedin'].includes(module.id) && labels?.textOption) return replaceLabelToken(labels.textOption, { n: index + 1 })
  return labels?.fieldLabels?.[field.id] ?? field.label
}
const campaignContactLabel = (item, uiLabels) => uiLabels?.delivery?.contact?.[item.id] ?? item.label

function campaignPackageLabels(t) {
  return {
    preview: { loading: t('campaignPackage.preview.loading'), unavailable: t('campaignPackage.preview.unavailable'), retry: t('campaignPackage.preview.retry'), enlarge: t('campaignPackage.preview.enlarge') },
    media: { generated: t('campaignPackage.media.generated'), campaignArts: t('campaignPackage.media.campaignArts'), art: t('campaignPackage.media.art'), unavailable: t('campaignPackage.media.unavailable'), waiting: t('campaignPackage.media.waiting'), rendering: t('campaignPackage.media.rendering') },
    result: { temporarilyUnavailable: t('campaignPackage.result.temporarilyUnavailable'), reloadInstruction: t('campaignPackage.result.reloadInstruction'), generatedMedia: t('campaignPackage.result.generatedMedia'), presentation: t('campaignPackage.result.presentation'), play: t('campaignPackage.result.play') },
    download: { loading: t('campaignPackage.download.loading'), image: t('campaignPackage.download.image'), video: t('campaignPackage.download.video'), errors: ['download_url_missing', 'download_url_invalid', 'download_url_expired', 'download_request_blocked', 'download_request_failed', 'download_unexpected_content', 'download_empty_file', 'download_timeout'].reduce((errors, code) => ({ ...errors, [code]: t(`campaignPackage.download.errors.${code}`) }), {}) },
    actions: { copy: t('campaignPackage.actions.copy'), copied: t('campaignPackage.actions.copied'), publish: t('campaignPackage.actions.publish'), creationError: t('campaignPackage.actions.creationError'), createNew: t('campaignPackage.actions.createNew') },
    campaign: { packageTitle: t('campaignPackage.campaign.packageTitle'), ready: t('campaignPackage.campaign.ready'), description: t('campaignPackage.campaign.description'), promotionTexts: t('campaignPackage.campaign.promotionTexts'), chooseChannel: t('campaignPackage.campaign.chooseChannel'), ctaContact: t('campaignPackage.campaign.ctaContact'), usedInformation: t('campaignPackage.campaign.usedInformation'), promotionTips: t('campaignPackage.campaign.promotionTips'), nextSteps: t('campaignPackage.campaign.nextSteps') },
    delivery: { modules: ['social', 'instagram', 'whatsapp', 'facebook', 'email', 'linkedin', 'hashtags', 'portal', 'google-ads'].reduce((modules, id) => ({ ...modules, [id]: t(`campaignPackage.delivery.modules.${id}`) }), {}), textOption: t('campaignPackage.delivery.textOption'), fieldLabels: ['email-subject', 'email-body', 'google-ads-headlines', 'google-ads-long-headline', 'google-ads-descriptions', 'google-ads-cta', 'google-ads-keywords'].reduce((fieldLabels, id) => ({ ...fieldLabels, [id]: t(`campaignPackage.delivery.fieldLabels.${id}`) }), {}), contact: { cta: t('campaignPackage.delivery.contact.cta'), copyCta: t('campaignPackage.delivery.contact.copyCta'), phone: t('campaignPackage.delivery.contact.phone') }, strategy: [t('campaignPackage.delivery.strategy.first'), t('campaignPackage.delivery.strategy.second'), t('campaignPackage.delivery.strategy.third')] },
    social: { freePublication: t('virtualStaging.social.freePublication'), confirm: t('virtualStaging.social.confirm'), chooseDestination: t('virtualStaging.social.chooseDestination'), checkingConnections: t('virtualStaging.social.checkingConnections'), cancel: t('virtualStaging.social.cancel'), publish: t('virtualStaging.social.publish'), creationPreparationError: t('virtualStaging.social.creationPreparationError'), multipleAccounts: t('virtualStaging.social.multipleAccounts'), connectMetaHelp: t('virtualStaging.social.connectMetaHelp'), connectMeta: t('virtualStaging.social.connectMeta'), caption: { label: t('virtualStaging.social.caption.label'), help: t('virtualStaging.social.caption.help'), limit: t('virtualStaging.social.caption.limit') }, progress: ['publishing', 'published', 'confirming', 'failed', 'cancelled', 'waitingConfirmation', 'finishing', 'completed', 'partialActive', 'partialFailed', 'failedNotice'].reduce((progress, key) => ({ ...progress, [key]: t(`virtualStaging.social.progress.${key}`) }), {}) },
    accessibility: { cancelPublish: t('virtualStaging.accessibility.cancelPublish'), resultByDestination: t('virtualStaging.accessibility.resultByDestination') },
  }
}

function mergeCampaignPackageLabels(defaults, overrides = {}) {
  return {
    ...defaults,
    ...overrides,
    preview: { ...defaults.preview, ...overrides.preview },
    media: { ...defaults.media, ...overrides.media },
    result: { ...defaults.result, ...overrides.result },
    download: { ...defaults.download, ...overrides.download, errors: { ...defaults.download.errors, ...overrides.download?.errors } },
    actions: { ...defaults.actions, ...overrides.actions },
    campaign: { ...defaults.campaign, ...overrides.campaign },
    delivery: { ...defaults.delivery, ...overrides.delivery, modules: { ...defaults.delivery.modules, ...overrides.delivery?.modules }, fieldLabels: { ...defaults.delivery.fieldLabels, ...overrides.delivery?.fieldLabels }, contact: { ...defaults.delivery.contact, ...overrides.delivery?.contact } },
    social: { ...defaults.social, ...overrides.social, caption: { ...defaults.social.caption, ...overrides.social?.caption }, progress: { ...defaults.social.progress, ...overrides.social?.progress } },
    accessibility: { ...defaults.accessibility, ...overrides.accessibility },
  }
}

function CopyButton({ value, label = 'Copiar', copiedLabel = 'Copiado!', copyKey, copiedKey, onCopy }) {
  const copied = copiedKey === copyKey
  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyKey)}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
      aria-label={label}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </button>
  )
}

const READY_MEDIA_STATUSES = new Set(['succeeded', 'completed', 'concluída'])
const FAILED_MEDIA_STATUSES = new Set(['failed', 'error', 'canceled', 'timeout'])
const normalizeMediaStatus = value => String(value || 'planned').toLocaleLowerCase('pt-BR')

export function getVideoDownloadTelemetry({ src = '', downloadUrl = '', protectDownload = false } = {}) {
  return {
    player_download_control_enabled: !protectDownload,
    explicit_download_available: Boolean(downloadUrl),
    same_source_as_download: Boolean(downloadUrl) && src === downloadUrl,
  }
}

export function blockVideoContextMenu(event) {
  event.preventDefault()
}

function VideoPreview({ src, downloadUrl = '', renderId = '', videoRef, className = '', onRefresh, protectDownload = false, uiLabels }) {
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setStatus('loading')
    videoRef?.current?.load?.()
    console.info('[renders] preview load', { render_id: renderId || null, status: 'succeeded', at: new Date().toISOString(), ...getVideoDownloadTelemetry({ src, downloadUrl, protectDownload }) })
  }, [src, downloadUrl, attempt, renderId, videoRef, protectDownload])

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video key={`${src}-${attempt}`} ref={videoRef} src={src} controls playsInline preload="metadata" controlsList={protectDownload ? 'nodownload noremoteplayback' : undefined} disablePictureInPicture={protectDownload} onContextMenu={protectDownload ? blockVideoContextMenu : undefined} onLoadedData={() => setStatus('ready')} onCanPlay={() => setStatus('ready')} onError={() => setStatus('error')} className={className} />
      {status === 'loading' && <span className="absolute rounded-full bg-slate-900/80 px-4 py-2 text-xs font-black text-white">{uiLabels?.preview?.loading ?? 'Carregando prévia...'}</span>}
      {status === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 text-center text-white"><p className="text-sm font-bold">{uiLabels?.preview?.unavailable ?? 'Não foi possível carregar a prévia.'}</p><button type="button" onClick={async () => { try { await onRefresh?.(); setAttempt(value => value + 1) } catch { setStatus('error') } }} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950">{uiLabels?.preview?.retry ?? 'Tentar novamente'}</button></div>}
    </div>
  )
}

function ImagePreview({ src, alt, renderId = '', onRefresh, onOpen, uiLabels }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setFailed(false)
    console.info('[renders] preview load', { render_id: renderId || null, status: 'succeeded', at: new Date().toISOString(), download_enabled: true, same_source_as_download: true })
  }, [src, attempt, renderId])
  if (failed) return <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-100 p-4 text-center"><p className="text-xs font-bold text-slate-600">{uiLabels?.preview?.unavailable ?? 'Não foi possível carregar a prévia.'}</p><button type="button" onClick={async () => { try { await onRefresh?.(); setAttempt(value => value + 1) } catch { setFailed(true) } }} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">{uiLabels?.preview?.retry ?? 'Tentar novamente'}</button></div>
  const image = <img key={`${src}-${attempt}`} src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-contain" />
  if (!onOpen) return image
  return <button type="button" onClick={(event) => onOpen({ src, alt }, event.currentTarget)} className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary-300" aria-label={(uiLabels?.preview?.enlarge ?? 'Ampliar {alt}').replace('{alt}', alt)}>{image}</button>
}

function MediaPanel({ campaign, videoRef, downloadingKey, onDownload, onRefreshMedia, onOpenImage, mediaPresentation, protectVideoDownload, uiLabels }) {
  if (campaign.mediaType === 'images') {
    if (!campaign.files.length) return null
    return (
      <section aria-labelledby="campaign-media-title" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{uiLabels?.media?.generated ?? 'Mídias geradas'}</p>
          <h3 id="campaign-media-title" className="mt-1 text-lg font-black text-slate-950">{uiLabels?.media?.campaignArts ?? 'Artes da campanha'}</h3>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaign.files.map((file, index) => {
            const status = normalizeMediaStatus(file.status)
            const ready = READY_MEDIA_STATUSES.has(status)
            const failed = FAILED_MEDIA_STATUSES.has(status)
            const assetUrl = ready ? (file.downloadUrl || file.url) : ''
            const isVideo = file.type === 'video' || /\.(mp4|webm|mov)(?:$|\?)/i.test(assetUrl)
            const refresh = () => onRefreshMedia?.(file)
            return (
              <article key={file.id || `${file.name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-100">
                  {ready && assetUrl ? (isVideo ? <VideoPreview src={assetUrl} downloadUrl={assetUrl} renderId={file.renderId} onRefresh={refresh} className="h-full w-full object-contain" uiLabels={uiLabels} /> : <ImagePreview src={assetUrl} renderId={file.renderId} alt={file.name || (uiLabels?.media?.art ?? 'Arte {n}').replace('{n}', index + 1)} onRefresh={refresh} onOpen={onOpenImage} uiLabels={uiLabels} />) : <span className="px-4 text-center text-xs font-bold text-slate-400">{failed ? (uiLabels?.media?.unavailable ?? 'Arquivo indisponível') : status === 'planned' ? (uiLabels?.media?.waiting ?? 'Aguardando renderização') : (uiLabels?.media?.rendering ?? 'Renderizando...')}</span>}
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-black text-slate-900">{file.name || (uiLabels?.media?.art ?? 'Arte {n}').replace('{n}', index + 1)}</p>
                  {file.status && <p className="mt-1 text-xs font-bold text-slate-500">{file.status}</p>}
                  {ready && assetUrl && (
                    <button
                      type="button"
                      disabled={Boolean(downloadingKey)}
                      onClick={() => onDownload(assetUrl, file.downloadName || file.name || `smartcorretorai-arte-${index + 1}`, `image-${file.id || index}`, file)}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {downloadingKey === `image-${file.id || index}` ? (uiLabels?.download?.loading ?? 'Baixando...') : (uiLabels?.download?.image ?? 'Baixar')}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    )
  }
  if (!campaign.previewUrl) {
    return (
      <section role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm sm:p-6">
        <p className="text-sm font-black text-amber-900">{uiLabels?.result?.temporarilyUnavailable ?? 'Resultado temporariamente indisponível.'}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-amber-800">{uiLabels?.result?.reloadInstruction ?? 'Consulte novamente em instantes para carregar o vídeo concluído.'}</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="campaign-media-title" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{uiLabels?.result?.generatedMedia ?? 'Mídia gerada'}</p>
          <h3 id="campaign-media-title" className="mt-1 text-lg font-black text-slate-950">{uiLabels?.result?.presentation ?? 'Sua apresentação'}</h3>
        </div>
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <div className={`mt-5 overflow-hidden rounded-[1.5rem] bg-slate-950 shadow-xl shadow-slate-200/60 ${mediaPresentation === 'mobile' ? 'mx-auto aspect-[9/16] max-h-[680px] w-full max-w-[383px]' : 'p-2'}`}>
        <VideoPreview src={campaign.previewUrl} downloadUrl={campaign.downloadUrl} videoRef={videoRef} protectDownload={protectVideoDownload} uiLabels={uiLabels} className={mediaPresentation === 'mobile' ? 'smart-presentation-media' : 'mx-auto max-h-[680px] w-full rounded-2xl object-contain'} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => videoRef.current?.play?.()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">
          <PlayCircle className="h-5 w-5" />{uiLabels?.result?.play ?? 'Reproduzir'}
        </button>
        {campaign.downloadUrl && (
          <button type="button" disabled={Boolean(downloadingKey)} onClick={() => onDownload(campaign.downloadUrl, campaign.downloadName || 'smartcorretorai-apresentacao', 'video')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
            <Download className="h-5 w-5" />{downloadingKey === 'video' ? (uiLabels?.download?.loading ?? 'Baixando...') : (uiLabels?.download?.video ?? 'Baixar vídeo')}
          </button>
        )}
      </div>
    </section>
  )
}

export function CampaignPackage({ data, className = '', onCreateNew, createNewLabel, preserveExistingContent = false, onRefreshMedia, onOpenImage, mediaPresentation = 'default', protectVideoDownload = false, onWithdrawDownload, onRequireAccount, sharePublish, bannerPublish, videoPublish, studioPublish, smartSpacePublish, uiLabels, children }) {
  const { t } = useLocale()
  const labels = useMemo(() => mergeCampaignPackageLabels(campaignPackageLabels(t), uiLabels), [t, uiLabels])
  const campaign = useMemo(() => buildCampaignPackage(data), [data])
  const deliveryStrategy =
    Array.isArray(data?.strategy) && data.strategy.length > 0
      ? campaign.strategy
      : labels.delivery.strategy
  const sharePublishProps = useMemo(() => buildCampaignPackageShareProps(campaign, sharePublish), [campaign, sharePublish])
  const [copiedKey, setCopiedKey] = useState('')
  const [downloadingKey, setDownloadingKey] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [bannerPublishIntent, setBannerPublishIntent] = useState(null)
  const resumedBannerPublishRef = useRef('')
  const captionDraftsRef = useRef(new Map())
  const videoRef = useRef(null)
  const localizedDownloadError = error => labels.download.errors[error?.code || error?.message] || getDownloadErrorMessage(error)

  useEffect(() => {
    if (bannerPublishIntent || !bannerPublish?.resumeIntent) return
    const resumeKey = `${bannerPublish.resumeIntent.sourceId}:${bannerPublish.resumeIntent.mediaAssetId}:${bannerPublish.resumeIntent.optionId}`
    if (resumedBannerPublishRef.current === resumeKey) return
    const restored = restorePendingBannerPublication({ campaign, pending: bannerPublish.resumeIntent })
    if (!restored) return
    resumedBannerPublishRef.current = resumeKey
    setBannerPublishIntent(restored)
    bannerPublish.onResumed?.(restored)
  }, [bannerPublish, bannerPublishIntent, campaign])

  useEffect(() => {
    if (bannerPublishIntent || !videoPublish?.resumeIntent) return
    const resumeKey = `${videoPublish.resumeIntent.sourceId}:${videoPublish.resumeIntent.mediaAssetId}:${videoPublish.resumeIntent.optionId}`
    if (resumedBannerPublishRef.current === resumeKey) return
    const restored = restorePendingSmartTourPublication({ campaign, pending: videoPublish.resumeIntent })
    if (!restored) return
    resumedBannerPublishRef.current = resumeKey
    setBannerPublishIntent(restored)
    videoPublish.onResumed?.(restored)
  }, [bannerPublishIntent, campaign, videoPublish])

  useEffect(() => {
    if (bannerPublishIntent || !studioPublish?.resumeIntent) return
    const resumeKey = `${studioPublish.resumeIntent.sourceId}:${studioPublish.resumeIntent.mediaAssetId}:${studioPublish.resumeIntent.optionId}`
    if (resumedBannerPublishRef.current === resumeKey) return
    const restored = restorePendingStudioPublication({ campaign, pending: studioPublish.resumeIntent })
    if (!restored) return
    resumedBannerPublishRef.current = resumeKey
    setBannerPublishIntent(restored)
    studioPublish.onResumed?.(restored)
  }, [bannerPublishIntent, campaign, studioPublish])

  useEffect(() => {
    if (bannerPublishIntent || !smartSpacePublish?.resumeIntent) return
    const resumeKey = `${smartSpacePublish.resumeIntent.sourceId}:${smartSpacePublish.resumeIntent.mediaAssetId}`
    if (resumedBannerPublishRef.current === resumeKey) return
    const restored = restorePendingSmartSpaceCampaignPublication({ campaign, pending: smartSpacePublish.resumeIntent })
    if (!restored) return
    resumedBannerPublishRef.current = resumeKey
    setBannerPublishIntent(restored)
    smartSpacePublish.onResumed?.(restored)
  }, [bannerPublishIntent, campaign, smartSpacePublish])

  const copy = async (value, key) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => current === key ? '' : current), 1800)
  }

  const download = async (url, filename, key, file) => {
    if(onRequireAccount){onRequireAccount();return}
    setDownloadError('')
    setDownloadingKey(key)
    try {
      const withdrawsVideo = campaign.mediaType === 'video' && key === 'video' && url === campaign.downloadUrl
      const withdrawsImage = campaign.mediaType === 'images' && key.startsWith('image-')
      if (typeof onWithdrawDownload === 'function' && (withdrawsVideo || withdrawsImage)) {
        await onWithdrawDownload(filename, file)
      } else {
        await downloadFileFromPrivateUrl(url, filename)
      }
    } catch (error) {
      const refreshable = ['download_url_expired', 'download_request_blocked', 'download_url_invalid'].includes(error?.code || error?.message)
      if (refreshable && onRefreshMedia) {
        try {
          const renewedUrl = await onRefreshMedia(file)
          if (!renewedUrl) throw error
          await downloadFileFromPrivateUrl(renewedUrl, filename)
        } catch (refreshError) {
          setDownloadError(localizedDownloadError(refreshError))
        }
      } else {
        setDownloadError(localizedDownloadError(error))
      }
    } finally {
      setDownloadingKey('')
    }
  }

  const downloadSharedMedia = (item) => {
    if (typeof sharePublish?.onDownload === 'function') return sharePublish.onDownload(item)
    const url = item?.url || item?.downloadUrl
    const filename = item?.filename || item?.downloadName || campaign.downloadName
    return download(url, filename, `share-${item?.id || 'media'}`, item?.sourceFile || item)
  }

  const openBannerPublish = (field, optionIndex) => {
    if(onRequireAccount){onRequireAccount();return}
    try {
      const intent = smartSpacePublish?.enabled
        ? buildSmartSpaceCampaignPublicationIntent({ campaign, field })
        : studioPublish?.enabled
        ? buildStudioPublicationIntent({ campaign, field, optionIndex })
        : campaign.sourceType === 'video_imobiliario'
        ? buildSmartTourPublicationIntent({ campaign, field, optionIndex })
        : buildBannerPublicationIntent({ campaign, field, optionIndex })
      const captionKey = `${intent.sourceId}:${intent.mediaAssetId}:${intent.optionId}`
      setBannerPublishIntent({ ...intent, captionSnapshot: captionDraftsRef.current.has(captionKey) ? captionDraftsRef.current.get(captionKey) : intent.captionSnapshot })
    } catch {
      setDownloadError(labels.actions.creationError)
    }
  }

  return (
    <section className={`space-y-5 ${className}`} aria-labelledby="campaign-package-title">
      <header className="overflow-hidden rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#f0fdfa_100%)] p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{labels.campaign.packageTitle}</p>
            <h2 id="campaign-package-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{labels.campaign.ready}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">{labels.campaign.description}</p>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200"><Share2 className="h-6 w-6" /></span>
        </div>
      </header>

      {preserveExistingContent ? children : <MediaPanel campaign={campaign} videoRef={videoRef} downloadingKey={downloadingKey} onDownload={download} onRefreshMedia={onRefreshMedia} onOpenImage={onOpenImage} mediaPresentation={mediaPresentation} protectVideoDownload={protectVideoDownload} uiLabels={labels} />}

      {sharePublishProps && <SharePublishActions {...sharePublishProps} onDownload={downloadSharedMedia} />}

      {downloadError && (
        <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {downloadError}
        </p>
      )}

      {!preserveExistingContent && campaign.modules.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="campaign-copy-title">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{labels.campaign.promotionTexts}</p>
            <h3 id="campaign-copy-title" className="mt-1 text-lg font-black text-slate-950">{labels.campaign.chooseChannel}</h3>
          </div>
          <div className="mt-5 space-y-3">
            {campaign.modules.map((module, index) => {
              const { Icon, iconClass } = sectionIcons[module.id] || { Icon: FileText, iconClass: 'bg-slate-200 text-slate-700' }
              return (
                <details key={module.id} open={index === 0} className="group rounded-2xl border border-slate-200 bg-slate-50/70 open:bg-white">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-emerald-100">
                    <span className="flex items-center gap-3 text-sm font-black text-slate-900"><span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${iconClass}`}><Icon className="h-5 w-5" /></span>{campaignModuleLabel(module, labels)}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 p-4">
                    {module.fields ? (
                      <div className="space-y-4">{module.fields.map((field, fieldIndex) => <div key={field.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{campaignFieldLabel(module, field, fieldIndex, labels)}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{field.text}</p><div className="mt-4 flex flex-wrap gap-2"><CopyButton value={field.text} label={labels.actions.copy} copiedLabel={labels.actions.copied} copyKey={field.id} copiedKey={copiedKey} onCopy={copy} />{((bannerPublish?.enabled && campaign.sourceProduct === 'Banner Imobiliário' && canBuildBannerPublicationIntent({ campaign, field })) || (videoPublish?.enabled && campaign.sourceType === 'video_imobiliario') || studioPublish?.enabled || smartSpacePublish?.enabled) && module.id === 'social' && <button type="button" onClick={() => openBannerPublish(field, fieldIndex)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"><Send className="h-4 w-4" />{labels.actions.publish}</button>}</div></div>)}</div>
                    ) : (
                      <><p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{module.text}</p><div className="mt-4"><CopyButton value={module.text} label={labels.actions.copy} copiedLabel={labels.actions.copied} copyKey={module.id} copiedKey={copiedKey} onCopy={copy} /></div></>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      )}

      {!preserveExistingContent && campaign.contact.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="campaign-contact-title">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{labels.campaign.ctaContact}</p>
          <h3 id="campaign-contact-title" className="mt-1 text-lg font-black text-slate-950">{labels.campaign.usedInformation}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{campaign.contact.map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{campaignContactLabel(item, labels)}</p><p className="mt-2 text-sm font-black text-slate-800">{item.value}</p><div className="mt-3"><CopyButton value={item.value} label={item.id === 'cta' ? labels.delivery.contact.copyCta : labels.actions.copy} copiedLabel={labels.actions.copied} copyKey={`contact-${item.id}`} copiedKey={copiedKey} onCopy={copy} /></div></div>)}</div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="campaign-strategy-title">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{labels.campaign.promotionTips}</p>
        <h3 id="campaign-strategy-title" className="mt-1 text-lg font-black text-slate-950">{labels.campaign.nextSteps}</h3>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">{deliveryStrategy.map((item, index) => <li key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">{index + 1}</span>{item}</li>)}</ol>
      </section>

      <TestimonialInvite />

      {onCreateNew && <button type="button" onClick={onCreateNew} className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50">{createNewLabel || labels.actions.createNew}</button>}
      {bannerPublishIntent && <BannerPublishDialog uiLabels={labels} intent={bannerPublishIntent} loadConnection={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.loadConnection} onConnect={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.onConnect} onPublish={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.onPublish} onRecover={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.onRecover} onConfirmed={smartSpacePublish?.onConfirmed} onTerminalClose={smartSpacePublish?.onTerminalClose} onCaptionChange={caption => captionDraftsRef.current.set(`${bannerPublishIntent.sourceId}:${bannerPublishIntent.mediaAssetId}:${bannerPublishIntent.optionId}`, caption)} captionEditable={smartSpacePublish?.enabled === true || bannerPublish?.captionEditable === true || videoPublish?.captionEditable === true || studioPublish?.captionEditable === true} captionPlaceholder={bannerPublishIntent.captionPlaceholder || smartSpacePublish?.captionPlaceholder || ''} onClose={() => setBannerPublishIntent(null)} />}
    </section>
  )
}

export default CampaignPackage
