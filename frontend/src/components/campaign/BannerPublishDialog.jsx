import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Facebook, Instagram, Send, X } from 'lucide-react'
import { getBannerConnectionDestinations } from '../../lib/banner-social-publish'
import {
  getSocialPublishNotice,
  getSocialPublishResultLabel,
  isSocialPublishSubmissionLocked,
  shouldClearSocialPublishRecoveryOnClose,
  shouldPollSocialPublishRecovery,
} from './socialPublishUiState'
import SocialCaptionEditor from './SocialCaptionEditor'
const TikTokPublish = lazy(() => import('./TikTokPublish'))
import { TIKTOK_LOGIN_KIT_ENABLED } from '../../config/tiktok'

const unavailableConnection = Object.freeze({ connected: false, status: 'unavailable', username: null, pageName: null, selectionRequired: false })
const RECOVERY_INTERVAL_MS = 4000

export function SocialPublishProgress({ results, submissionStarted = false, confirmationPending = false, uiLabels }) {
  const notice = getSocialPublishNotice(results, { submissionStarted, confirmationPending }, uiLabels?.social?.progress)
  return <>{notice && <p role="status" className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</p>}{results.length > 0 && <div className="mt-4 grid gap-2" aria-label={uiLabels?.accessibility?.resultByDestination ?? 'Resultado por destino'}>{results.map(result => <p key={result.destination} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"><span className="capitalize">{result.destination}</span>: {getSocialPublishResultLabel(result.status, uiLabels?.social?.progress)}</p>)}</div>}</>
}

export default function BannerPublishDialog({ intent, loadConnection, onConnect, onClose, onPublish, onRecover, onConfirmed, onTerminalClose, onCaptionChange, captionEditable = false, captionPlaceholder = '', uiLabels }) {
  const [connection, setConnection] = useState({ ...unavailableConnection, status: 'loading' })
  const [selected, setSelected] = useState([])
  const [results, setResults] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [definitiveError, setDefinitiveError] = useState('')
  const [submissionStarted, setSubmissionStarted] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [caption, setCaption] = useState(() => typeof intent?.captionSnapshot === 'string' ? intent.captionSnapshot : '')
  const submissionLockRef = useRef(false)
  const captionEditedRef = useRef(false)
  const updateCaption = value => { captionEditedRef.current = true; setCaption(value); onCaptionChange?.(value) }

  useEffect(() => {
    let active = true
    Promise.resolve(loadConnection?.())
      .then(value => { if (active) setConnection({ ...unavailableConnection, ...value }) })
      .catch(() => { if (active) setConnection(unavailableConnection) })
    return () => { active = false }
  }, [loadConnection])

  const destinations = useMemo(() => getBannerConnectionDestinations(connection).map(destination => ({
    ...destination,
    Icon: destination.id === 'instagram' ? Instagram : Facebook,
  })), [connection])
  const usable = destinations.length > 0

  const recover = async () => {
    const value = await onRecover?.(intent, destinations.map(destination => destination.id))
    const recovered = Array.isArray(value?.results) ? value.results.filter(result => result?.job_id) : []
    if (recovered.length) {
      const frozenCaptions = [...new Set(recovered.map(result => result.caption_snapshot).filter(value => typeof value === 'string'))]
      if (captionEditable && !captionEditedRef.current && frozenCaptions.length === 1) setCaption(frozenCaptions[0])
      submissionLockRef.current = true
      setSubmissionStarted(true)
      setConfirmationPending(false)
      setResults(recovered)
      setSelected(current => [...new Set([...current, ...recovered.map(result => result.destination).filter(Boolean)])])
    }
    return recovered
  }

  useEffect(() => {
    if (!usable || typeof onRecover !== 'function') return undefined
    let active = true
    Promise.resolve(onRecover(intent, destinations.map(destination => destination.id)))
      .then(value => {
        if (!active) return
        const recovered = Array.isArray(value?.results) ? value.results.filter(result => result?.job_id) : []
        if (recovered.length) {
          const frozenCaptions = [...new Set(recovered.map(result => result.caption_snapshot).filter(value => typeof value === 'string'))]
          if (captionEditable && !captionEditedRef.current && frozenCaptions.length === 1) setCaption(frozenCaptions[0])
          submissionLockRef.current = true
          setSubmissionStarted(true)
          setConfirmationPending(false)
          setResults(recovered)
          setSelected(recovered.map(result => result.destination).filter(Boolean))
        }
      })
      .catch(() => null)
    return () => { active = false }
  }, [destinations, intent, onRecover, usable])

  useEffect(() => {
    const awaitingFirstRecoveredJob = submissionStarted && results.length === 0
    if (!usable || typeof onRecover !== 'function' || (!awaitingFirstRecoveredJob && !shouldPollSocialPublishRecovery(results))) return undefined
    const timer = window.setInterval(() => { recover().catch(() => null) }, RECOVERY_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [destinations, intent, onRecover, results, submissionStarted, usable])

  const submissionLocked = isSocialPublishSubmissionLocked({ submissionStarted, results })
  const close = () => {
    if (shouldClearSocialPublishRecoveryOnClose(results)) onTerminalClose?.()
    onClose?.()
  }
  const toggle = id => {
    if (submissionLockRef.current || submissionLocked) return
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }
  const publish = async () => {
    if (!selected.length || submissionLockRef.current || submissionLocked) return
    submissionLockRef.current = true
    setSubmissionStarted(true)
    setConfirmationPending(false)
    setPublishing(true)
    setDefinitiveError('')
    try {
      const confirmedIntent = captionEditable ? { ...intent, captionSnapshot: caption } : intent
      await onConfirmed?.(confirmedIntent)
      const response = await onPublish?.(confirmedIntent, [...selected])
      const nextResults = Array.isArray(response?.results) ? response.results.filter(result => result?.job_id) : []
      setResults(nextResults)
    } catch (error) {
      if (intent.sourceType === 'video_imobiliario' && error?.code === 'video_publication_identity_invalid') {
        setDefinitiveError(uiLabels?.social?.creationPreparationError ?? 'Não foi possível preparar este vídeo para publicação. Sua criação está preservada.')
        setConfirmationPending(false)
        setSubmissionStarted(false)
        submissionLockRef.current = false
      } else setConfirmationPending(true)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="banner-publish-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{uiLabels?.social?.freePublication ?? 'Publicação gratuita'}</p><h2 id="banner-publish-title" className="mt-1 text-xl font-black text-slate-950">{uiLabels?.social?.confirm ?? 'Confirmar publicação'}</h2></div>
          <button type="button" onClick={close} aria-label={uiLabels?.accessibility?.cancelPublish ?? 'Cancelar publicação'} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{intent.mediaType === 'video' ? <video src={intent.mediaPreviewUrl} aria-label={intent.mediaName} controls playsInline preload="metadata" className="aspect-video h-full w-full bg-slate-950 object-contain" /> : <img src={intent.mediaPreviewUrl} alt={intent.mediaName} className="aspect-square h-full w-full object-contain" />}</div>
          <div>{captionEditable
            ? <SocialCaptionEditor value={caption} onChange={updateCaption} disabled={submissionLocked} placeholder={captionPlaceholder} uiLabels={uiLabels?.social?.caption} />
            : <><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{intent.optionLabel}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{intent.captionSnapshot}</p></>}</div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-sm font-black text-slate-950">{uiLabels?.social?.chooseDestination ?? 'Onde deseja publicar?'}</p>
          {connection.status === 'loading' && <p role="status" className="mt-3 text-sm font-semibold text-slate-500">{uiLabels?.social?.checkingConnections ?? 'Consultando contas conectadas…'}</p>}
          {usable && <div className="mt-3 grid gap-3">{destinations.map(({ id, label, Icon }) => <label key={id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-bold text-slate-800"><input type="checkbox" checked={selected.includes(id)} disabled={submissionLocked} onChange={() => toggle(id)} className="h-4 w-4 accent-emerald-600 disabled:cursor-not-allowed" /><Icon className="h-5 w-5 text-emerald-700" />{label}</label>)}</div>}
          {TIKTOK_LOGIN_KIT_ENABLED && intent.sourceType === 'video_imobiliario' && <Suspense fallback={null}><TikTokPublish intent={intent} caption={caption} /></Suspense>}
          {connection.selectionRequired && <p role="status" className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{uiLabels?.social?.multipleAccounts ?? 'Há mais de uma conta disponível. Selecione primeiro a conta desejada em Configurações.'}</p>}
          {!usable && connection.status !== 'loading' && !connection.selectionRequired && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold leading-6 text-amber-900">{uiLabels?.social?.connectMetaHelp ?? 'Conecte sua conta Meta uma única vez para publicar no Instagram e Facebook.'}</p><button type="button" onClick={() => onConnect?.(captionEditable ? { ...intent, captionSnapshot: caption } : intent)} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">{uiLabels?.social?.connectMeta ?? 'Conectar Instagram e Facebook'}</button></div>}
        </div>

        {definitiveError && <p role="alert" className="mt-5 text-sm font-semibold text-red-700">{definitiveError}</p>}
        <SocialPublishProgress results={results} submissionStarted={submissionStarted} confirmationPending={confirmationPending} uiLabels={uiLabels} />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-12 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700">{uiLabels?.social?.cancel ?? 'Cancelar'}</button>{!submissionLocked && <button type="button" disabled={!usable || selected.length === 0 || publishing} onClick={publish} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{uiLabels?.social?.publish ?? 'Publicar agora'}</button>}</div>
      </section>
    </div>
  )
}
