import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { CONVERSATION_PHASE } from './conversationFlow'
import { ProductCard, ProductFlowLayout, ProductSummary } from '../design-system'
import { ConversationAssistantBubble, ConversationHeader, ConversationQuestionCard, ConversationUserBubble } from './ConversationPrimitives'

const TYPEWRITER_INITIAL_DELAY_MS = 350
const TYPEWRITER_CHAR_DELAY_MS = 30
const TYPEWRITER_FINAL_CURSOR_MS = 400

export function getConversationScrollBehavior(matchMedia) {
  const resolveMatchMedia = matchMedia || (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia.bind(window)
    : null)
  if (!resolveMatchMedia) return 'smooth'
  try {
    return resolveMatchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  } catch {
    return 'smooth'
  }
}

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
  accent,
}) {
  const anchorRef = useRef(null)
  const resolvedAccent = accent || (designSystem ? 'primary' : 'emerald')
  const isEmerald = resolvedAccent === 'emerald'
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const requestFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : callback => window.setTimeout(callback, 0)
    const cancelFrame = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : window.clearTimeout.bind(window)
    const frame = requestFrame(() => anchorRef.current?.scrollIntoView({ behavior: getConversationScrollBehavior(), block: 'nearest' }))
    return () => cancelFrame(frame)
  }, [history.length, phase, questionId])

  const conversation = <div className="min-w-0 space-y-4" aria-live="polite">
    {history.map(turn => <ConversationTurn key={turn.questionId} turn={turn} onEdit={onEdit} editDisabled={editDisabled} isEmerald={isEmerald} />)}
    {phase === CONVERSATION_PHASE.TYPING && <TypingIndicator designSystem={designSystem} isEmerald={isEmerald} />}
    {phase === CONVERSATION_PHASE.QUESTION && (designSystem ? (
      <ConversationQuestionCard
        accent={isEmerald ? 'emerald' : 'primary'}
        label={review ? 'Revisão final' : `Pergunta ${questionNumber} de ${totalQuestions}`}
        title={<TypewriterText text={question} active cursorClass={isEmerald ? 'bg-emerald-700' : 'bg-cyan-700'} />}
      >
        {children}
      </ConversationQuestionCard>
    ) : (
      <div className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${isEmerald ? 'border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#f8fffb)]' : 'border-primary-100 bg-[linear-gradient(145deg,#ffffff,#f8fafc)]'}`}>
        <div className="flex gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${isEmerald ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-primary-50 text-primary-700 ring-primary-100'}`}><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${isEmerald ? 'bg-emerald-50 text-emerald-800' : 'bg-primary-50 text-primary-800'}`}>{review ? 'Revisão final' : `Pergunta ${questionNumber} de ${totalQuestions}`}</span>
            <h3 className="mt-3 text-xl font-black leading-tight text-slate-950 sm:text-2xl"><TypewriterText text={question} active /></h3>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    ))}
    <div ref={anchorRef} />
  </div>

  const summary = <ProductSummary title="Resumo da apresentação" items={summaryItems} onEdit={onEdit} editDisabled={editDisabled} emptyText="Suas escolhas aparecerão aqui durante a conversa." accent={isEmerald ? 'emerald' : 'primary'} />

  return <section data-smart-conversation className={designSystem ? 'overflow-visible' : 'overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-transparent shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] sm:rounded-[2rem]'}>
    <div className={designSystem ? 'mb-5' : 'border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6'}>
      <ConversationHeader eyebrow={eyebrow} title={title} description={description} accent={isEmerald ? 'emerald' : 'primary'} />
    </div>
    {designSystem ? <ProductFlowLayout main={conversation} aside={summary} /> : <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8">
      {conversation}
      <aside className={`rounded-3xl border p-5 lg:sticky lg:top-6 lg:self-start ${isEmerald ? 'border-emerald-100 bg-[linear-gradient(145deg,#f0fdf4,#ffffff)]' : 'border-primary-100 bg-[linear-gradient(145deg,#eff6ff,#ffffff)]'}`}>
        <p className={`text-xs font-black uppercase tracking-[0.16em] ${isEmerald ? 'text-emerald-700' : 'text-primary-700'}`}>Resumo da apresentação</p>
        {summaryItems.length ? <div className="mt-4 space-y-2">{summaryItems.map(item => <button key={item.id} type="button" disabled={editDisabled} onClick={() => onEdit(item.id)} className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-bold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${isEmerald ? 'text-emerald-600' : 'text-primary-600'}`} /><span>{item.label}</span></button>)}</div> : <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">Suas escolhas aparecerão aqui durante a conversa.</p>}
      </aside>
    </div>}
  </section>
}

function ConversationTurn({ turn, onEdit, editDisabled, isEmerald }) {
  return <div className="space-y-3">
    <ConversationAssistantBubble accent={isEmerald ? 'emerald' : 'primary'}>{turn.question}</ConversationAssistantBubble>
    <ConversationUserBubble actions={<button type="button" disabled={editDisabled} onClick={() => onEdit(turn.questionId)} className={`mt-2 inline-flex items-center gap-1 text-xs font-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${isEmerald ? 'text-emerald-200' : 'text-cyan-200'}`}><RotateCcw className="h-3.5 w-3.5" />Voltar e corrigir</button>}>
      <p>{turn.answer}</p>
    </ConversationUserBubble>
    <ConversationAssistantBubble accent={isEmerald ? 'emerald' : 'primary'} confirmation>{turn.confirmation}</ConversationAssistantBubble>
  </div>
}

function TypingIndicator({ designSystem, isEmerald }) {
  return <div className="flex items-center gap-3" aria-label="SmartCorretorAI está digitando"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isEmerald ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'}`}><Sparkles className="h-4 w-4" /></span><div className={`flex items-center gap-1 rounded-2xl rounded-tl-md border bg-white px-4 py-3 shadow-sm ${isEmerald ? 'border-emerald-100' : designSystem ? 'border-smart-border' : 'border-primary-100'}`}><Loader2 className={`mr-1 h-4 w-4 animate-spin ${isEmerald ? 'text-emerald-600' : 'text-primary-600'}`} />{[0, 1, 2].map(index => <span key={index} className={`h-1.5 w-1.5 animate-pulse rounded-full ${isEmerald ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ animationDelay: `${index * 140}ms` }} />)}</div></div>
}

function TypewriterText({ text, active, cursorClass = 'bg-cyan-700' }) {
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
  return <>{visibleText}{showCursor && <span className={`ml-1 inline-block h-5 w-1.5 translate-y-0.5 animate-pulse rounded-sm ${cursorClass}`} />}</>
}
