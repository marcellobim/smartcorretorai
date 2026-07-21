import { useMemo, useRef, useState } from 'react'
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
  Share2,
} from 'lucide-react'
import { buildCampaignPackage } from './buildCampaignPackage'
import { downloadFileFromPrivateUrl, getDownloadErrorMessage } from '../../lib/download-file'

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

function MediaPanel({ campaign, videoRef, downloadingKey, onDownload }) {
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
            const previewUrl = file.previewUrl || file.url
            const downloadUrl = file.downloadUrl || file.url
            const isVideo = file.type === 'video' || /\.(mp4|webm|mov)(?:$|\?)/i.test(previewUrl)
            return (
              <article key={file.id || `${file.name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-100">
                  {previewUrl ? (isVideo ? <video src={previewUrl} controls className="h-full w-full object-contain" /> : <img src={previewUrl} alt={file.name || `Arte ${index + 1}`} className="h-full w-full object-contain" />) : <span className="px-4 text-center text-xs font-bold text-slate-400">Prévia indisponível</span>}
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-black text-slate-900">{file.name || `Arte ${index + 1}`}</p>
                  {file.status && <p className="mt-1 text-xs font-bold text-slate-500">{file.status}</p>}
                  {downloadUrl && (
                    <button
                      type="button"
                      disabled={Boolean(downloadingKey)}
                      onClick={() => onDownload(downloadUrl, file.downloadName || file.name || `smartcorretorai-arte-${index + 1}`, `image-${file.id || index}`)}
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
  if (!campaign.previewUrl) return null

  return (
    <section aria-labelledby="campaign-media-title" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Mídia gerada</p>
          <h3 id="campaign-media-title" className="mt-1 text-lg font-black text-slate-950">Sua apresentação</h3>
        </div>
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-slate-950 p-2 shadow-xl shadow-slate-200/60">
        <video ref={videoRef} src={campaign.previewUrl} controls playsInline className="mx-auto max-h-[680px] w-full rounded-2xl object-contain" />
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

export function CampaignPackage({ data, className = '', onCreateNew, createNewLabel = 'Criar nova campanha', preserveExistingContent = false, children }) {
  const campaign = useMemo(() => buildCampaignPackage(data), [data])
  const [copiedKey, setCopiedKey] = useState('')
  const [downloadingKey, setDownloadingKey] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const videoRef = useRef(null)

  const copy = async (value, key) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => current === key ? '' : current), 1800)
  }

  const download = async (url, filename, key) => {
    setDownloadError('')
    setDownloadingKey(key)
    try {
      await downloadFileFromPrivateUrl(url, filename)
    } catch (error) {
      setDownloadError(getDownloadErrorMessage(error))
    } finally {
      setDownloadingKey('')
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

      {preserveExistingContent ? children : <MediaPanel campaign={campaign} videoRef={videoRef} downloadingKey={downloadingKey} onDownload={download} />}

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
                      <div className="space-y-4">{module.fields.map((field) => <div key={field.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{field.label}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{field.text}</p><div className="mt-4"><CopyButton value={field.text} label={field.copyLabel} copyKey={field.id} copiedKey={copiedKey} onCopy={copy} /></div></div>)}</div>
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

      {onCreateNew && <button type="button" onClick={onCreateNew} className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50">{createNewLabel}</button>}
    </section>
  )
}

export default CampaignPackage
