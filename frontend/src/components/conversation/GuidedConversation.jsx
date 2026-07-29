import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, MessageSquareText, RotateCcw, Sparkles } from 'lucide-react'
import { CONVERSATION_PHASE } from './conversationFlow'
import { ProductCard, ProductFlowLayout, ProductSummary } from '../design-system'

const TYPEWRITER_INITIAL_DELAY_MS = 350
const TYPEWRITER_CHAR_DELAY_MS = 30
const TYPEWRITER_FINAL_CURSOR_MS = 400

export default function GuidedConversation({
  history,
  phase,
  questionId,
  question,
  questionNumber,
  totalQuestions,
  onEdit,
  children,
  summaryItems = [],
  eyebrow = 'Criação guiada',
  title = 'Converse com a IA',
  description = 'Uma pergunta por vez para construir sua apresentação.',
  review = false,
  editDisabled = false,
  designSystem = false,
}) {
  const anchorRef = useRef(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    return () => window.cancelAnimationFrame(frame)
  }, [history.length, phase, questionId])

  const conversation = <div className="min-w-0 space-y-4" aria-live="polite">
    {history.map(turn => <ConversationTurn key={turn.questionId} turn={turn} onEdit={onEdit} editDisabled={editDisabled} designSystem={designSystem} />)}
    {phase === CONVERSATION_PHASE.TYPING && <TypingIndicator designSystem={designSystem} />}
    {phase === CONVERSATION_PHASE.QUESTION && (designSystem ? (
      <ProductCard className="p-5 sm:p-6">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-primary-800">{review ? 'Revisão final' : `Pergunta ${questionNumber} de ${totalQuestions}`}</span>
            <h3 className="mt-3 text-xl font-black leading-tight tracking-[-0.02em] text-slate-950 sm:text-2xl"><TypewriterText text={question} active /></h3>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </ProductCard>
    ) : (
      <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#f8fffb)] p-5 shadow-sm sm:p-6">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-800">{review ? 'Revisão final' : `Pergunta ${questionNumber} de ${totalQuestions}`}</span>
            <h3 className="mt-3 text-xl font-black leading-tight text-slate-950 sm:text-2xl"><TypewriterText text={question} active /></h3>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    ))}
    <div ref={anchorRef} />
  </div>

  const summary = <ProductSummary title="Resumo da apresentação" items={summaryItems} onEdit={onEdit} editDisabled={editDisabled} emptyText="Suas escolhas aparecerão aqui durante a conversa." />

  return <section className={designSystem ? 'overflow-visible' : 'overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-transparent shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] sm:rounded-[2rem]'}>
    <div className={designSystem ? 'mb-5' : 'border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6'}>
      <div className="flex items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${designSystem ? 'bg-primary-50 text-primary-700 ring-primary-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}`}><MessageSquareText className="h-5 w-5" /></span>
        <div><p className={`text-xs font-black uppercase tracking-[0.18em] ${designSystem ? 'text-primary-600' : 'text-emerald-700'}`}>{eyebrow}</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p></div>
      </div>
    </div>
    {designSystem ? <ProductFlowLayout main={conversation} aside={summary} /> : <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8">
      {conversation}
      <aside className="rounded-3xl border border-emerald-100 bg-[linear-gradient(145deg,#f0fdf4,#ffffff)] p-5 lg:sticky lg:top-6 lg:self-start">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Resumo da apresentação</p>
        {summaryItems.length ? <div className="mt-4 space-y-2">{summaryItems.map(item => <button key={item.id} type="button" disabled={editDisabled} onClick={() => onEdit(item.id)} className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-bold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{item.label}</span></button>)}</div> : <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">Suas escolhas aparecerão aqui durante a conversa.</p>}
      </aside>
    </div>}
  </section>
}

function ConversationTurn({ turn, onEdit, editDisabled, designSystem }) {
  return <div className="space-y-3">
    <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${designSystem ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}`}><Sparkles className="h-4 w-4" /></span><div className={`rounded-2xl rounded-tl-md border bg-white px-4 py-3 text-sm font-bold leading-6 text-slate-700 shadow-sm ${designSystem ? 'border-smart-border' : 'border-emerald-100'}`}>{turn.question}</div></div>
    <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white shadow-sm sm:max-w-[78%]">
      <p>{turn.answer}</p>
      <button type="button" disabled={editDisabled} onClick={() => onEdit(turn.questionId)} className={`mt-2 inline-flex items-center gap-1 text-xs font-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${designSystem ? 'text-cyan-200' : 'text-emerald-200'}`}><RotateCcw className="h-3.5 w-3.5" />Voltar e corrigir</button>
    </div>
    <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${designSystem ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}`}><Sparkles className="h-4 w-4" /></span><div className={`rounded-2xl rounded-tl-md border px-4 py-3 text-sm font-bold leading-6 ${designSystem ? 'border-primary-100 bg-primary-50/70 text-primary-950' : 'border-emerald-100 bg-emerald-50/70 text-emerald-950'}`}>{turn.confirmation}</div></div>
  </div>
}

function TypingIndicator({ designSystem }) {
  return <div className="flex items-center gap-3" aria-label="SmartCorretorAI está digitando"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${designSystem ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}`}><Sparkles className="h-4 w-4" /></span><div className={`flex items-center gap-1 rounded-2xl rounded-tl-md border bg-white px-4 py-3 shadow-sm ${designSystem ? 'border-smart-border' : 'border-emerald-100'}`}><Loader2 className={`mr-1 h-4 w-4 animate-spin ${designSystem ? 'text-primary-600' : 'text-emerald-600'}`} />{[0, 1, 2].map(index => <span key={index} className={`h-1.5 w-1.5 animate-pulse rounded-full ${designSystem ? 'bg-primary-500' : 'bg-emerald-500'}`} style={{ animationDelay: `${index * 140}ms` }} />)}</div></div>
}

function TypewriterText({ text, active }) {
  const [visibleText, setVisibleText] = useState(active ? '' : text)
  const [showCursor, setShowCursor] = useState(false)
  useEffect(() => {
    if (!active) { setVisibleText(text); setShowCursor(false); return undefined }
    let index = 0
    let intervalId = null
    let finalTimerId = null
    setVisibleText('')
    setShowCursor(true)
    const startTimerId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1
        setVisibleText(text.slice(0, index))
        if (index >= text.length) { window.clearInterval(intervalId); finalTimerId = window.setTimeout(() => setShowCursor(false), TYPEWRITER_FINAL_CURSOR_MS) }
      }, TYPEWRITER_CHAR_DELAY_MS)
    }, TYPEWRITER_INITIAL_DELAY_MS)
    return () => { window.clearTimeout(startTimerId); if (intervalId) window.clearInterval(intervalId); if (finalTimerId) window.clearTimeout(finalTimerId) }
  }, [active, text])
  return <>{visibleText}{showCursor && <span className="ml-1 inline-block h-5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-cyan-700" />}</>
}
