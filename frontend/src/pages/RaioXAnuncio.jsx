import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, ImagePlus, Link2, Radar, Search, X } from 'lucide-react'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, SMART_UI } from '../components/design-system'
import ListingXRayResult from '../components/listing-xray/ListingXRayResult'
import { prepareListingXrayImages, validateListingXrayFiles } from '../lib/listing-xray-images'
import { clearListingXrayRecovery, normalizeListingXrayResult, readListingXrayRecovery, writeListingXrayRecovery } from '../lib/listing-xray-result'
import { useAuthStore } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

const POLL_DELAY_MS = 2_000
const MAX_RECOVERY_POLLS = 45
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const newRequestId = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => { const random = Math.floor(Math.random() * 16); return (character === 'x' ? random : (random & 3) | 8).toString(16) })
async function readFunctionError(error) { const response = error?.context; if (!response || typeof response.clone !== 'function') return null; try { return await response.clone().json() } catch { return null } }
async function invokeListingXray(body) { const { data, error } = await supabase.functions.invoke('raio-x-anuncio', { body }); if (!error) return data; const payload = await readFunctionError(error); const wrapped = new Error(payload?.error || 'Não foi possível concluir o Raio-X.'); wrapped.payload = payload; throw wrapped }
function presentListingXrayFailure(payload = {}, fallback = '') {
  const code = String(payload.code || '').toUpperCase(); const sourceFailure = ['SOURCE_UNAVAILABLE', 'SOURCE_LOW_CONFIDENCE'].includes(code)
  const internalFailure = ['ANALYSIS_PROCESSING_ERROR', 'PROVIDER_ERROR', 'INVALID_RESULT'].includes(code)
  return {
    phase: sourceFailure ? code.toLowerCase() : payload.status === 'insufficient' ? 'insufficient' : internalFailure ? code.toLowerCase() : 'failed',
    message: sourceFailure ? 'Não conseguimos analisar este anúncio pelo link.' : internalFailure ? 'Não conseguimos concluir esta análise. Tente novamente.' : fallback || 'Não foi possível concluir o Raio-X.',
  }
}

export default function RaioXAnuncio() {
  const user = useAuthStore(state => state.user)
  const [mode, setMode] = useState('link'); const [url, setUrl] = useState(''); const [files, setFiles] = useState([])
  const [contentTypeHint, setContentTypeHint] = useState(null); const [classificationRequired, setClassificationRequired] = useState(false)
  const [phase, setPhase] = useState('idle'); const [result, setResult] = useState(null); const [message, setMessage] = useState('')
  const mountedRef = useRef(true); const operationRef = useRef(0); const activeRequestRef = useRef(null)

  const materialize = useCallback((payload, requestId) => { const normalized = normalizeListingXrayResult(payload?.result); if (!mountedRef.current) return; setResult(normalized); setPhase('completed'); setMessage(''); writeListingXrayRecovery(window.sessionStorage, user?.id, requestId, 'completed') }, [user?.id])
  const applyAwaitingInput = useCallback((payload, requestId) => {
    activeRequestRef.current = requestId; setMode('images'); setPhase('awaiting_input'); setMessage(payload?.continuation?.message || payload?.error || 'Envie uma captura adicional para continuar.'); setClassificationRequired(Boolean(payload?.continuation?.classification_required)); writeListingXrayRecovery(window.sessionStorage, user?.id, requestId, 'awaiting_input')
  }, [user?.id])
  const recover = useCallback(async (requestId, operation, allowPolling = true) => {
    setPhase('recovery')
    for (let attempt = 0; attempt < (allowPolling ? MAX_RECOVERY_POLLS : 1); attempt += 1) {
      const payload = await invokeListingXray({ action: 'recover', client_request_id: requestId }); if (!mountedRef.current || operation !== operationRef.current) return
      if (payload?.status === 'completed') { materialize(payload, requestId); return }
      if (payload?.status === 'awaiting_input') { applyAwaitingInput(payload, requestId); return }
      if (payload?.status !== 'processing') throw Object.assign(new Error(payload?.error || 'O resultado temporário não está disponível.'), { payload })
      await wait(POLL_DELAY_MS)
    }
    throw new Error('A análise está demorando mais que o esperado. Você poderá recuperá-la nesta tela.')
  }, [applyAwaitingInput, materialize])

  useEffect(() => {
    mountedRef.current = true; if (!user?.id) return () => { mountedRef.current = false }
    const saved = readListingXrayRecovery(window.sessionStorage, user.id); if (!saved) return () => { mountedRef.current = false }
    activeRequestRef.current = saved.clientRequestId; const operation = ++operationRef.current
    recover(saved.clientRequestId, operation).catch(error => { if (!mountedRef.current || operation !== operationRef.current) return; if (error?.payload?.status !== 'processing') clearListingXrayRecovery(window.sessionStorage, user.id); const presentation = presentListingXrayFailure(error?.payload, error.message); setMessage(presentation.message); setPhase(presentation.phase) })
    return () => { mountedRef.current = false; operationRef.current += 1 }
  }, [recover, user?.id])

  const completeRequest = async (payload, requestId, operation) => {
    if (!mountedRef.current || operation !== operationRef.current) return
    if (payload?.status === 'completed') materialize(payload, requestId)
    else if (payload?.status === 'processing') await recover(requestId, operation)
    else if (payload?.status === 'awaiting_input') applyAwaitingInput(payload, requestId)
    else throw Object.assign(new Error(payload?.error || 'Não foi possível concluir o Raio-X.'), { payload })
  }
  const handleFailure = (error, requestId, operation) => {
    if (!mountedRef.current || operation !== operationRef.current) return
    const payload = error?.payload || {}
    if (payload.status === 'awaiting_input') { applyAwaitingInput(payload, requestId); return }
    clearListingXrayRecovery(window.sessionStorage, user?.id); activeRequestRef.current = null
    const presentation = presentListingXrayFailure(payload, error.message); setPhase(presentation.phase); setMessage(presentation.message)
  }

  const analyzeLink = async event => {
    event.preventDefault(); const sourceUrl = url.trim(); if (!/^https?:\/\//i.test(sourceUrl)) { setMessage('Cole um link público completo, começando com http:// ou https://.'); setPhase('failed'); return }
    const requestId = newRequestId(); activeRequestRef.current = requestId; const operation = ++operationRef.current; setResult(null); setMessage(''); setPhase('loading'); writeListingXrayRecovery(window.sessionStorage, user.id, requestId, 'processing')
    try { await completeRequest(await invokeListingXray({ action: 'analyze_url', client_request_id: requestId, url: sourceUrl }), requestId, operation) } catch (error) { handleFailure(error, requestId, operation) }
  }
  const addFiles = event => {
    try { const incoming = validateListingXrayFiles(event.target.files); const merged = [...files]; for (const file of incoming) if (!merged.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) merged.push(file); if (merged.length > 5) throw new Error('Envie no máximo 5 imagens.'); setFiles(merged); setMessage('') } catch (error) { setMessage(error.message); setPhase('failed') } finally { event.target.value = '' }
  }
  const analyzeImages = async event => {
    event.preventDefault(); if (!files.length) { setMessage('Envie pelo menos uma captura para continuar.'); setPhase('failed'); return }
    const requestId = activeRequestRef.current || newRequestId(); activeRequestRef.current = requestId; const operation = ++operationRef.current; setResult(null); setMessage(''); setPhase('preparing_images'); writeListingXrayRecovery(window.sessionStorage, user.id, requestId, 'processing')
    try { const images = await prepareListingXrayImages(files); setPhase('loading'); await completeRequest(await invokeListingXray({ action: 'analyze_images', client_request_id: requestId, images, content_type_hint: contentTypeHint }), requestId, operation) } catch (error) { handleFailure(error, requestId, operation) }
  }
  const selectMode = next => { setMode(next); setMessage(''); if (next === 'link') { setClassificationRequired(false); setContentTypeHint(null) } }
  const reset = () => { operationRef.current += 1; activeRequestRef.current = null; clearListingXrayRecovery(window.sessionStorage, user?.id); setUrl(''); setFiles([]); setContentTypeHint(null); setClassificationRequired(false); setResult(null); setMessage(''); setPhase('idle'); setMode('link') }

  if (phase === 'completed' && result) return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><ListingXRayResult result={result} onReset={reset} /></div>
  const busy = ['loading', 'recovery', 'preparing_images'].includes(phase)
  const linkUnavailable = mode === 'link' && ['source_unavailable', 'source_low_confidence'].includes(phase)
  const internalFailure = ['analysis_processing_error', 'provider_error', 'invalid_result'].includes(phase)
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <ProductCard className="overflow-hidden"><ProductHero id="listing-xray-title" eyebrow="Análise inteligente" productName="RAIO-X" headline="Descubra o que pode melhorar na divulgação do seu imóvel." description="Analise seu anúncio, veja o que já funciona, descubra onde existe oportunidade e receba sugestões prontas para melhorar sua divulgação." visual={<div className="flex h-full min-h-[270px] items-center justify-center rounded-3xl bg-gradient-to-br from-primary-950 via-primary-800 to-cyan-600 p-8 text-white"><Radar className="h-28 w-28 text-cyan-100" /></div>} /></ProductCard>

    <div className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
      <button type="button" onClick={() => selectMode('link')} className={`rounded-3xl border p-5 text-left transition ${mode === 'link' ? 'border-primary-600 bg-primary-50 ring-4 ring-primary-100' : 'border-slate-200 bg-white hover:border-primary-300'}`}><Link2 className="h-7 w-7 text-primary-700" /><p className="mt-3 font-black text-slate-950">Analisar pelo link</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Cole o link público do anúncio para tentarmos ler as informações automaticamente.</p></button>
      <button type="button" onClick={() => selectMode('images')} className={`rounded-3xl border p-5 text-left transition ${mode === 'images' ? 'border-primary-600 bg-primary-50 ring-4 ring-primary-100' : 'border-slate-200 bg-white hover:border-primary-300'}`}><Camera className="h-7 w-7 text-primary-700" /><p className="mt-3 font-black text-slate-950">Analisar por imagens/capturas</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Envie capturas de um anúncio ou de uma publicação imobiliária.</p></button>
    </div>

    <ProductCard className="mx-auto mt-4 max-w-4xl p-5 sm:p-8">
      {mode === 'link' ? <><ProductSectionHeading eyebrow="Opção 1" title="Cole o link do seu anúncio" description="Envie o link público do anúncio do seu imóvel. A IA tentará acessar as informações disponíveis e analisar o conteúdo automaticamente." /><form className="mt-6" onSubmit={analyzeLink}><label htmlFor="listing-xray-url" className="text-sm font-black text-slate-800">Cole o link do anúncio</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Link2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input id="listing-xray-url" type="url" required disabled={busy} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." className={`h-12 w-full rounded-smart-control border border-slate-300 bg-white pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-100 disabled:opacity-60 ${SMART_UI.focus}`} /></div><ProductButton type="submit" size="lg" loading={busy} disabled={busy}><Search className="h-5 w-5" />Analisar meu anúncio</ProductButton></div><p className="mt-3 text-xs font-bold text-slate-500">A disponibilidade da leitura automática pode variar conforme o site de origem. Esta análise utiliza 10 Smart Tokens.</p></form></>
      : <><ProductSectionHeading eyebrow="Opção 2" title="Envie capturas do que você quer analisar" description="Envie capturas de tela do seu anúncio ou publicação. A IA analisará as informações e o conteúdo visível nas imagens." />
        <form className="mt-6" onSubmit={analyzeImages}>
          {classificationRequired && <fieldset className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><legend className="px-1 text-sm font-black text-amber-950">O que você quer analisar?</legend><div className="mt-2 flex flex-wrap gap-3">{[['PROPERTY_LISTING', 'Anúncio de imóvel'], ['SOCIAL_PUBLICATION', 'Publicação/divulgação']].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-800"><input type="radio" name="content-type" required checked={contentTypeHint === value} onChange={() => setContentTypeHint(value)} />{label}</label>)}</div></fieldset>}
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-primary-400"><ImagePlus className="h-7 w-7 text-primary-700" /><span className="mt-2 text-sm font-black text-slate-900">Adicionar imagens</span><span className="mt-1 text-xs font-semibold text-slate-500">1 a 5 imagens JPG, PNG ou WebP. Até 8 MB antes da otimização.</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy || files.length >= 5} onChange={addFiles} /></label>
          {files.length > 0 && <div className="mt-4 space-y-2">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"><span className="min-w-0 truncate">{index + 1}. {file.name}</span><button type="button" onClick={() => setFiles(current => current.filter(item => item !== file))} aria-label={`Remover ${file.name}`}><X className="h-4 w-4" /></button></div>)}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-slate-500">Esta análise utiliza 10 Smart Tokens, independentemente da quantidade de capturas.</p><ProductButton type="submit" size="lg" loading={busy} disabled={busy || !files.length}>{phase === 'awaiting_input' ? 'Continuar análise' : 'Analisar imagens'}</ProductButton></div>
        </form></>}

      {busy && <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5" role="status"><p className="font-black text-primary-900">{phase === 'recovery' ? 'Recuperando sua análise…' : phase === 'preparing_images' ? 'Preparando suas imagens…' : 'Analisando o conteúdo…'}</p><p className="mt-1 text-sm font-semibold leading-6 text-primary-700">O resultado só será cobrado quando uma análise válida for entregue.</p></div>}
      {!busy && message && <div className={`mt-6 flex gap-3 rounded-2xl border p-5 ${phase === 'awaiting_input' || linkUnavailable ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-rose-200 bg-rose-50 text-rose-950'}`} role="alert"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">{phase === 'awaiting_input' ? 'Precisamos de mais contexto' : linkUnavailable ? 'Não conseguimos analisar este anúncio pelo link' : internalFailure ? 'Não conseguimos concluir esta análise' : 'Não foi possível concluir'}</p><p className="mt-1 text-sm font-semibold leading-6">{message}</p>{linkUnavailable && <ProductButton type="button" variant="secondary" size="sm" className="mt-4" onClick={() => selectMode('images')}>Analisar por imagens/capturas</ProductButton>}</div></div>}
    </ProductCard>
  </div>
}
