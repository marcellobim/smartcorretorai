import { Sparkles } from 'lucide-react'
import { SMART_UI } from '../../design-system/tokens'

export default function ProductHero({ id, eyebrow, title, highlight, description, secondaryDescription, visual, className = '' }) {
  return <section aria-labelledby={id} className={`relative isolate grid items-center gap-10 overflow-hidden px-7 py-10 sm:px-10 lg:min-h-[305px] lg:px-8 lg:py-8 xl:px-10 ${visual ? 'lg:grid-cols-[.96fr_1.04fr]' : ''} ${className}`}>
    <div className="absolute -left-24 -top-24 -z-10 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" aria-hidden="true" />
    <div className="absolute -right-20 bottom-0 -z-10 h-64 w-64 rounded-full bg-cyan-100/40 blur-3xl" aria-hidden="true" />
    <div className="relative z-10 max-w-2xl">
      {eyebrow && <p className={`${SMART_UI.eyebrow} inline-flex items-center gap-2`}><Sparkles className="h-4 w-4" />{eyebrow}</p>}
      <h1 id={id} className="mt-4 max-w-2xl text-4xl font-black leading-[1.06] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[3rem] xl:text-[3.25rem]">
        {title}{highlight && <span className="mt-1 block text-primary-600">{highlight}</span>}
      </h1>
      {description && <p className="mt-7 max-w-xl text-base font-medium leading-[1.75] text-slate-600 sm:text-lg">{description}</p>}
      {secondaryDescription && <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-slate-500">{secondaryDescription}</p>}
    </div>
    {visual && <div className="relative z-10 min-h-[290px] min-w-0 lg:min-h-[275px]">{visual}</div>}
  </section>
}
