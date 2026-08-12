import { MessageSquareText } from 'lucide-react'
import { ProductCard } from '../design-system'
import BrandMark from '../brand/BrandMark'

const accents = {
  primary: {
    soft: 'bg-primary-50 text-primary-700 ring-primary-100',
    label: 'text-primary-700',
    border: 'border-smart-border',
    confirmation: 'border-primary-100 bg-primary-50/70 text-primary-950',
  },
  emerald: {
    soft: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    label: 'text-emerald-700',
    border: 'border-emerald-100',
    confirmation: 'border-emerald-100 bg-emerald-50/70 text-emerald-950',
  },
  cyan: {
    soft: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    label: 'text-cyan-700',
    border: 'border-cyan-100',
    confirmation: 'border-cyan-100 bg-cyan-50/70 text-cyan-950',
  },
}

const getAccent = accent => accents[accent] || accents.primary

export function ConversationHeader({ eyebrow, title, description, accent = 'primary', trailing }) {
  const palette = getAccent(accent)
  return <div className="flex items-start justify-between gap-4">
    <div className="flex min-w-0 items-start gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${palette.soft}`}>
        <MessageSquareText className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={`text-xs font-black uppercase tracking-[0.18em] ${palette.label}`}>{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
        {description && <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>}
      </div>
    </div>
    {trailing}
  </div>
}

export function ConversationAssistantBubble({ children, accent = 'primary', confirmation = false, className = '' }) {
  const palette = getAccent(accent)
  return <div className={`flex items-start gap-3 ${className}`}>
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1 ${palette.soft}`}>
      <BrandMark size={20} alt="SmartCorretorAI" />
    </span>
    <div className={`max-w-2xl rounded-2xl rounded-tl-md border px-4 py-3 text-sm font-bold leading-6 shadow-sm ${confirmation ? palette.confirmation : `${palette.border} bg-white text-slate-700`}`}>
      {children}
    </div>
  </div>
}

export function ConversationUserBubble({ children, actions, className = '' }) {
  return <div className={`ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white shadow-sm sm:max-w-[78%] ${className}`}>
    {children}
    {actions}
  </div>
}

export function ConversationQuestionCard({ label, labelTrailing, title, accent = 'primary', description, children, className = '' }) {
  const palette = getAccent(accent)
  return <ProductCard className={`p-5 sm:p-6 ${className}`}>
    <div className="flex gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${palette.soft}`}>
        <BrandMark size={24} alt="SmartCorretorAI" />
      </span>
      <div className="min-w-0 flex-1">
        {(label || labelTrailing) && <div className="flex flex-wrap items-center gap-2">
          {label && <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${palette.soft}`}>{label}</span>}
          {labelTrailing && <span className="text-xs font-bold text-slate-400">{labelTrailing}</span>}
        </div>}
        <h3 className="mt-3 text-xl font-black leading-tight tracking-[-0.02em] text-slate-950 sm:text-2xl">{title}</h3>
        {description && <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  </ProductCard>
}
