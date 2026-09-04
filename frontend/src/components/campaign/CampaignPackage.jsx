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

function CopyButton({ value, label = 'Copiar', copyKey, copiedKey, onCopy }) {
  const copied = copiedKey === copyKey
  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyKey)}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
      aria-label={label}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copiado!' : label}
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

function VideoPreview({ src, downloadUrl = '', renderId = '', videoRef, className = '', onRefresh, protectDownload = false }) {
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
      {status === 'loading' && <span className="absolute rounded-full bg-slate-900/80 px-4 py-2 text-xs font-black text-white">Carregando prévia...</span>}
      {status === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 text-center text-white"><p className="text-sm font-bold">Não foi possível carregar a prévia.</p><button type="button" onClick={async () => { try { await onRefresh?.(); setAttempt(value => value + 1) } catch { setStatus('error') } }} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950">Tentar novamente</button></div>}
    </div>
  )
}

function ImagePreview({ src, alt, renderId = '', onRefresh, onOpen }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setFailed(false)
    console.info('[renders] preview load', { render_id: renderId || null, status: 'succeeded', at: new Date().toISOString(), download_enabled: true, same_source_as_download: true })
  }, [src, attempt, renderId])
  if (failed) return <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-100 p-4 text-center"><p className="text-xs font-bold text-slate-600">Não foi possível carregar a prévia.</p><button type="button" onClick={async () => { try { await onRefresh?.(); setAttempt(value => value + 1) } catch { setFailed(true) } }} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Tentar novamente</button></div>
  const image = <img key={`${src}-${attempt}`} src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-contain" />
  if (!onOpen) return image
  return <button type="button" onClick={(event) => onOpen({ src, alt }, event.currentTarget)} className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary-300" aria-label={`Ampliar ${alt}`}>{image}</button>
}

function MediaPanel({ campaign, videoRef, downloadingKey, onDownload, onRefreshMedia, onOpenImage, mediaPresentation, protectVideoDownload }) {
  if (campaign.mediaType === 'images') {
    if (!campaign.files.length) return null
    return (
      <section aria-labelledby="campaign-media-title" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Mídias geradas</p>
          <h3 id="campaign-media-title" className="mt-1 text-lg font-black text-slate-950">Artes da campanha</h3>
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
                  {ready && assetUrl ? (isVideo ? <VideoPreview src={assetUrl} downloadUrl={assetUrl} renderId={file.renderId} onRefresh={refresh} className="h-full w-full object-contain" /> : <ImagePreview src={assetUrl} renderId={file.renderId} alt={file.name || `Arte ${index + 1}`} onRefresh={refresh} onOpen={onOpenImage} />) : <span className="px-4 text-center text-xs font-bold text-slate-400">{failed ? 'Arquivo indisponível' : status === 'planned' ? 'Aguardando renderização' : 'Renderizando...'}</span>}
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-black text-slate-900">{file.name || `Arte ${index + 1}`}</p>
                  {file.status && <p className="mt-1 text-xs font-bold text-slate-500">{file.status}</p>}
                  {ready && assetUrl && (
                    <button
                      type="button"
                      disabled={Boolean(downloadingKey)}
                      onClick={() => onDownload(assetUrl, file.downloadName || file.name || `smartcorretorai-arte-${index + 1}`, `image-${file.id || index}`, file)}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {downloadingKey === `image-${file.id || index}` ? 'Baixando...' : 'Baixar'}
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
        <p className="text-sm font-black text-amber-900">Resultado temporariamente indisponível.</p>
        <p className="mt-2 text-xs font-bold leading-5 text-amber-800">Consulte novamente em instantes para carregar o vídeo concluído.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="campaign-media-title" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Mídia gerada</p>
          <h3 id="campaign-media-title" className="mt-1 text-lg font-black text-slate-950">Sua apresentação</h3>
        </div>
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <div className={`mt-5 overflow-hidden rounded-[1.5rem] bg-slate-950 shadow-xl shadow-slate-200/60 ${mediaPresentation === 'mobile' ? 'mx-auto aspect-[9/16] max-h-[680px] w-full max-w-[383px]' : 'p-2'}`}>
        <VideoPreview src={campaign.previewUrl} downloadUrl={campaign.downloadUrl} videoRef={videoRef} protectDownload={protectVideoDownload} className={mediaPresentation === 'mobile' ? 'smart-presentation-media' : 'mx-auto max-h-[680px] w-full rounded-2xl object-contain'} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => videoRef.current?.play?.()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">
          <PlayCircle className="h-5 w-5" />Reproduzir
        </button>
        {campaign.downloadUrl && (
          <button type="button" disabled={Boolean(downloadingKey)} onClick={() => onDownload(campaign.downloadUrl, campaign.downloadName || 'smartcorretorai-apresentacao', 'video')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
            <Download className="h-5 w-5" />{downloadingKey === 'video' ? 'Baixando...' : 'Baixar vídeo'}
          </button>
        )}
      </div>
    </section>
  )
}

export function CampaignPackage({ data, className = '', onCreateNew, createNewLabel = 'Criar nova campanha', preserveExistingContent = false, onRefreshMedia, onOpenImage, mediaPresentation = 'default', protectVideoDownload = false, onWithdrawDownload, sharePublish, bannerPublish, videoPublish, studioPublish, smartSpacePublish, children }) {
  const campaign = useMemo(() => buildCampaignPackage(data), [data])
  const sharePublishProps = useMemo(() => buildCampaignPackageShareProps(campaign, sharePublish), [campaign, sharePublish])
  const [copiedKey, setCopiedKey] = useState('')
  const [downloadingKey, setDownloadingKey] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [bannerPublishIntent, setBannerPublishIntent] = useState(null)
  const resumedBannerPublishRef = useRef('')
  const videoRef = useRef(null)

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
          setDownloadError(getDownloadErrorMessage(refreshError))
        }
      } else {
        setDownloadError(getDownloadErrorMessage(error))
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
    try {
      setBannerPublishIntent(smartSpacePublish?.enabled
        ? buildSmartSpaceCampaignPublicationIntent({ campaign, field })
        : studioPublish?.enabled
        ? buildStudioPublicationIntent({ campaign, field, optionIndex })
        : campaign.sourceType === 'video_imobiliario'
        ? buildSmartTourPublicationIntent({ campaign, field, optionIndex })
        : buildBannerPublicationIntent({ campaign, field, optionIndex }))
    } catch {
      setDownloadError('Não foi possível identificar a criação e o texto selecionado com segurança.')
    }
  }

  return (
    <section className={`space-y-5 ${className}`} aria-labelledby="campaign-package-title">
      <header className="overflow-hidden rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#f0fdfa_100%)] p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Pacote da Campanha</p>
            <h2 id="campaign-package-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Sua campanha está pronta.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Mídia e textos organizados para você divulgar com mais agilidade.</p>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200"><Share2 className="h-6 w-6" /></span>
        </div>
      </header>

      {preserveExistingContent ? children : <MediaPanel campaign={campaign} videoRef={videoRef} downloadingKey={downloadingKey} onDownload={download} onRefreshMedia={onRefreshMedia} onOpenImage={onOpenImage} mediaPresentation={mediaPresentation} protectVideoDownload={protectVideoDownload} />}

      {sharePublishProps && <SharePublishActions {...sharePublishProps} onDownload={downloadSharedMedia} />}

      {downloadError && (
        <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {downloadError}
        </p>
      )}

      {!preserveExistingContent && campaign.modules.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="campaign-copy-title">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Textos para divulgação</p>
            <h3 id="campaign-copy-title" className="mt-1 text-lg font-black text-slate-950">Escolha o canal e publique</h3>
          </div>
          <div className="mt-5 space-y-3">
            {campaign.modules.map((module, index) => {
              const { Icon, iconClass } = sectionIcons[module.id] || { Icon: FileText, iconClass: 'bg-slate-200 text-slate-700' }
              return (
                <details key={module.id} open={index === 0} className="group rounded-2xl border border-slate-200 bg-slate-50/70 open:bg-white">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-emerald-100">
                    <span className="flex items-center gap-3 text-sm font-black text-slate-900"><span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${iconClass}`}><Icon className="h-5 w-5" /></span>{module.title}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 p-4">
                    {module.fields ? (
                      <div className="space-y-4">{module.fields.map((field, fieldIndex) => <div key={field.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{field.label}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{field.text}</p><div className="mt-4 flex flex-wrap gap-2"><CopyButton value={field.text} label={field.copyLabel} copyKey={field.id} copiedKey={copiedKey} onCopy={copy} />{((bannerPublish?.enabled && campaign.sourceProduct === 'Banner Imobiliário' && canBuildBannerPublicationIntent({ campaign, field })) || (videoPublish?.enabled && campaign.sourceType === 'video_imobiliario') || studioPublish?.enabled || smartSpacePublish?.enabled) && module.id === 'social' && <button type="button" onClick={() => openBannerPublish(field, fieldIndex)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"><Send className="h-4 w-4" />Publicar</button>}</div></div>)}</div>
                    ) : (
                      <><p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{module.text}</p><div className="mt-4"><CopyButton value={module.text} label={module.copyLabel} copyKey={module.id} copiedKey={copiedKey} onCopy={copy} /></div></>
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
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">CTA e contato</p>
          <h3 id="campaign-contact-title" className="mt-1 text-lg font-black text-slate-950">Informações utilizadas</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{campaign.contact.map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</p><p className="mt-2 text-sm font-black text-slate-800">{item.value}</p><div className="mt-3"><CopyButton value={item.value} label={item.copyLabel} copyKey={`contact-${item.id}`} copiedKey={copiedKey} onCopy={copy} /></div></div>)}</div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="campaign-strategy-title">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Dicas para divulgar</p>
        <h3 id="campaign-strategy-title" className="mt-1 text-lg font-black text-slate-950">Próximos passos</h3>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">{campaign.strategy.map((item, index) => <li key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">{index + 1}</span>{item}</li>)}</ol>
      </section>

      <TestimonialInvite />

      {onCreateNew && <button type="button" onClick={onCreateNew} className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50">{createNewLabel}</button>}
      {bannerPublishIntent && <BannerPublishDialog intent={bannerPublishIntent} loadConnection={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.loadConnection} onConnect={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.onConnect} onPublish={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.onPublish} onRecover={(smartSpacePublish?.enabled ? smartSpacePublish : studioPublish?.enabled ? studioPublish : campaign.sourceType === 'video_imobiliario' ? videoPublish : bannerPublish)?.onRecover} onConfirmed={smartSpacePublish?.onConfirmed} onTerminalClose={smartSpacePublish?.onTerminalClose} captionEditable={smartSpacePublish?.enabled === true || bannerPublish?.captionEditable === true || videoPublish?.captionEditable === true || studioPublish?.captionEditable === true} captionPlaceholder={bannerPublishIntent.captionPlaceholder || smartSpacePublish?.captionPlaceholder || ''} onClose={() => setBannerPublishIntent(null)} />}
    </section>
  )
}

export default CampaignPackage
