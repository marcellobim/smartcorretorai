import { useMemo, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  PlayCircle,
  Share2,
} from 'lucide-react'
import { buildCampaignPackage } from './buildCampaignPackage'

const sectionIcons = {
  instagram: '📷',
  social: '📷',
  whatsapp: '📱',
  facebook: '📘',
  email: '✉️',
  linkedin: '💼',
  hashtags: '🏷️',
  portal: '🏠',
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

function MediaPanel({ campaign, videoRef }) {
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
                  {downloadUrl && <a href={downloadUrl} download className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Baixar</a>}
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
          <a href={campaign.downloadUrl} download={campaign.downloadName} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
            <Download className="h-5 w-5" />Baixar vídeo
          </a>
        )}
      </div>
    </section>
  )
}

export function CampaignPackage({ data, className = '', onCreateNew, createNewLabel = 'Criar nova campanha', preserveExistingContent = false, children }) {
  const campaign = useMemo(() => buildCampaignPackage(data), [data])
  const [copiedKey, setCopiedKey] = useState('')
  const videoRef = useRef(null)

  const copy = async (value, key) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => current === key ? '' : current), 1800)
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

      {preserveExistingContent ? children : <MediaPanel campaign={campaign} videoRef={videoRef} />}

      {!preserveExistingContent && campaign.modules.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="campaign-copy-title">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Textos para divulgação</p>
            <h3 id="campaign-copy-title" className="mt-1 text-lg font-black text-slate-950">Escolha o canal e publique</h3>
          </div>
          <div className="mt-5 space-y-3">
            {campaign.modules.map((module, index) => {
              const icon = sectionIcons[module.id] || '📄'
              return (
                <details key={module.id} open={index === 0} className="group rounded-2xl border border-slate-200 bg-slate-50/70 open:bg-white">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-emerald-100">
                    <span className="flex items-center gap-3 text-sm font-black text-slate-900"><span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg">{icon}</span>{module.title}</span>
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
