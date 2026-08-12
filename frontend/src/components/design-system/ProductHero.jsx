import { Sparkles } from 'lucide-react'
import { SMART_UI } from '../../design-system/tokens'

export default function ProductHero({ id, eyebrow, productName, headline, title, highlight, description, secondaryDescription, actions, visual, tone = 'light', className = '' }) {
  const usesOfficialHierarchy = Boolean(productName)
  const isDark = tone === 'dark'
  const heroLayoutClass = 'relative isolate grid items-center gap-10 overflow-hidden px-7 py-10 sm:px-10 lg:min-h-[305px] lg:px-8 lg:py-8 xl:px-10'
  const titleClass = `max-w-2xl text-4xl font-black leading-[1.06] tracking-[-0.04em] sm:text-5xl lg:text-[3rem] xl:text-[3.25rem] ${isDark ? 'text-white' : 'text-slate-950'}`
  const eyebrowClass = isDark ? 'text-xs font-black uppercase tracking-[0.16em] text-cyan-100' : SMART_UI.eyebrow

  return <section aria-labelledby={id} className={`${heroLayoutClass} ${visual ? 'lg:grid-cols-[.96fr_1.04fr]' : ''} ${className}`}>
    <div className={`absolute -left-24 -top-24 -z-10 h-64 w-64 rounded-full blur-3xl ${isDark ? 'bg-cyan-400/20' : 'bg-blue-100/60'}`} aria-hidden="true" />
    <div className={`absolute -right-20 bottom-0 -z-10 h-64 w-64 rounded-full blur-3xl ${isDark ? 'bg-blue-400/15' : 'bg-cyan-100/40'}`} aria-hidden="true" />
    <div className="relative z-10 max-w-2xl">
      {eyebrow && <p className={`${eyebrowClass} inline-flex items-center gap-2`}><Sparkles className="h-4 w-4" />{eyebrow}</p>}
      <h1 id={id} className={`${eyebrow ? 'mt-4' : ''} ${titleClass}`}>
        {usesOfficialHierarchy ? productName : title}
        {!usesOfficialHierarchy && highlight && <span className={`mt-1 block ${isDark ? 'text-cyan-300' : 'text-primary-600'}`}>{highlight}</span>}
      </h1>
      {usesOfficialHierarchy && headline && <h2 className={`mt-6 ${titleClass}`}>{headline}{highlight && <span className={`mt-1 block ${isDark ? 'text-cyan-300' : 'text-primary-600'}`}>{highlight}</span>}</h2>}
      {description && <p className={`mt-7 max-w-xl text-base font-medium leading-[1.75] sm:text-lg ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{description}</p>}
      {secondaryDescription && <p className={`mt-3 max-w-xl text-sm font-medium leading-6 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{secondaryDescription}</p>}
      {actions && <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
    {visual && <div className="relative z-10 min-h-[290px] min-w-0 lg:min-h-[275px]">{visual}</div>}
  </section>
}
