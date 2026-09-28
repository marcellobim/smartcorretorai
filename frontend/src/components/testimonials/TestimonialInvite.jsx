import { useEffect, useState } from 'react'
import { BRAND } from '../../config/brand'
import { CheckCircle2, MessageSquareQuote, Send } from 'lucide-react'
import { useOptionalAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import ProductButton from '../design-system/ProductButton'
import { Modal } from '../ui/Modal'
import {
  TESTIMONIAL_BODY_MAX_LENGTH,
  TESTIMONIAL_PROFESSION_MAX_LENGTH,
  TestimonialFormError,
  buildTestimonialPayload,
  canShowTestimonialInvite,
} from './testimonial-invite-runtime'

const dismissedInviteUsers = new Set()

export default function TestimonialInvite() {
  const auth = useOptionalAuth()
  const userId = auth?.user?.id || ''
  const isAuthenticated = auth?.isAuthenticated === true
  const [statusState, setStatusState] = useState({ loaded: false, hasSubmitted: false })
  const [dismissed, setDismissed] = useState(() => Boolean(userId && dismissedInviteUsers.has(userId)))
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [professionLabel, setProfessionLabel] = useState('')
  const [publicationConsent, setPublicationConsent] = useState(false)
  const [attributionConsent, setAttributionConsent] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [submissionState, setSubmissionState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    if (!isAuthenticated || !userId || dismissedInviteUsers.has(userId)) {
      setDismissed(Boolean(userId && dismissedInviteUsers.has(userId)))
      setStatusState({ loaded: false, hasSubmitted: false })
      return () => { active = false }
    }
    setStatusState({ loaded: false, hasSubmitted: false })
    void supabase.functions.invoke('testimonial-api', { body: { action: 'status' } })
      .then(({ data, error }) => {
        if (!active) return
        if (error || data?.error || typeof data?.hasSubmitted !== 'boolean') {
          setStatusState({ loaded: false, hasSubmitted: false })
          return
        }
        setStatusState({ loaded: true, hasSubmitted: data.hasSubmitted })
      })
      .catch(() => {
        if (active) setStatusState({ loaded: false, hasSubmitted: false })
      })
    return () => { active = false }
  }, [isAuthenticated, userId])

  const suppressForSession = () => {
    if (userId) dismissedInviteUsers.add(userId)
    setDismissed(true)
    setOpen(false)
  }

  const openForm = () => {
    setRequestId(current => current || crypto.randomUUID())
    setErrorMessage('')
    setSubmissionState('idle')
    setOpen(true)
  }

  const closeForm = () => {
    if (submissionState === 'sending') return
    suppressForSession()
  }

  const submit = async event => {
    event.preventDefault()
    if (submissionState === 'sending') return
    setErrorMessage('')
    let payload
    try {
      payload = buildTestimonialPayload({ body, professionLabel, publicationConsent, attributionConsent }, requestId)
    } catch (error) {
      setErrorMessage(error instanceof TestimonialFormError ? error.message : 'Revise o formulário.')
      return
    }

    setSubmissionState('sending')
    try {
      const { data, error } = await supabase.functions.invoke('testimonial-api', { body: payload })
      if (error || data?.error || !data?.testimonial_id) throw new Error('testimonial_submission_failed')
      setSubmissionState('success')
      setStatusState({ loaded: true, hasSubmitted: true })
    } catch {
      setSubmissionState('error')
      setErrorMessage('Não foi possível enviar seu depoimento agora. Tente novamente.')
    }
  }

  const visible = canShowTestimonialInvite({
    isAuthenticated,
    dismissed,
    statusLoaded: statusState.loaded,
    hasSubmitted: statusState.hasSubmitted,
  })
  if (!visible && !open) return null

  return <>
    {visible && !open && (
      <section className="rounded-3xl border border-primary-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_58%,#ecfeff_100%)] p-5 shadow-sm sm:p-6" aria-labelledby="testimonial-invite-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-white shadow-lg shadow-primary-200"><MessageSquareQuote className="h-6 w-6" /></span>
            <div>
              <h3 id="testimonial-invite-title" className="text-lg font-black text-slate-950">Conte como foi sua experiência</h3>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Seu depoimento pode ajudar outros corretores a conhecer o {BRAND.name}.</p>
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-slate-500">Depoimentos enviados podem participar da campanha de bônus de 500 Smart Tokens, conforme análise e regras da campanha.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <ProductButton type="button" onClick={openForm}><MessageSquareQuote className="h-4 w-4" />Enviar depoimento</ProductButton>
            <button type="button" onClick={suppressForSession} className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800">Agora não</button>
          </div>
        </div>
      </section>
    )}

    <Modal open={open} onClose={closeForm} title="Conte como foi sua experiência" size="lg">
      <div className="max-h-[72vh] overflow-y-auto pr-1">
        {submissionState === 'success' ? (
          <div className="py-5 text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h3 className="mt-4 text-xl font-black text-slate-950">Depoimento recebido</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Obrigado por compartilhar sua experiência.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Se ele for aprovado conforme a campanha de bônus, avisaremos você por e-mail.</p>
            <ProductButton type="button" className="mt-6" onClick={suppressForSession}>Concluir</ProductButton>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <p className="text-sm font-semibold leading-6 text-slate-600">Compartilhe sua experiência com suas próprias palavras. O bônus não depende de avaliação positiva.</p>
            <label className="block text-sm font-black text-slate-800">Depoimento
              <textarea required maxLength={TESTIMONIAL_BODY_MAX_LENGTH} value={body} onChange={event => setBody(event.target.value)} disabled={submissionState === 'sending'} rows="7" placeholder={`Conte como o ${BRAND.name} fez parte do seu trabalho`} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium leading-6 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:bg-slate-100" />
              <span className="mt-1 block text-right text-xs font-semibold text-slate-400">{body.length}/{TESTIMONIAL_BODY_MAX_LENGTH}</span>
            </label>
            <label className="block text-sm font-black text-slate-800">Profissão <span className="font-semibold text-slate-400">(opcional)</span>
              <input maxLength={TESTIMONIAL_PROFESSION_MAX_LENGTH} value={professionLabel} onChange={event => setProfessionLabel(event.target.value)} disabled={submissionState === 'sending'} placeholder="Ex.: Corretor de imóveis" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:bg-slate-100" />
            </label>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-slate-700"><input type="checkbox" checked={publicationConsent} onChange={event => setPublicationConsent(event.target.checked)} disabled={submissionState === 'sending'} className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-800 focus:ring-primary-500" /><span>Autorizo a publicação deste depoimento nos canais do {BRAND.name}.</span></label>
              <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-slate-700"><input type="checkbox" checked={attributionConsent} onChange={event => setAttributionConsent(event.target.checked)} disabled={submissionState === 'sending'} className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-800 focus:ring-primary-500" /><span>Autorizo a exibição do meu nome e profissão junto ao depoimento.</span></label>
            </div>
            {errorMessage && <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{errorMessage}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <ProductButton type="button" variant="secondary" disabled={submissionState === 'sending'} onClick={closeForm}>Cancelar</ProductButton>
              <ProductButton type="submit" loading={submissionState === 'sending'}><Send className="h-4 w-4" />{submissionState === 'sending' ? 'Enviando' : 'Enviar depoimento'}</ProductButton>
            </div>
          </form>
        )}
      </div>
    </Modal>
  </>
}
