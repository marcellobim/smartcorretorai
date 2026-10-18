import { useLocale } from '../../i18n/useLocale'

export default function MarketSelector({ className = '', compact = false }) {
  const { market, setMarket } = useLocale()
  const label = market === 'US' ? '🌐 Language & Region' : '🌐 Idioma e região'
  const labelClass = compact ? 'px-2 py-1.5 text-[11px]' : 'px-2 py-2 text-xs'

  if (compact) {
    return (
      <details className={`group relative ${className}`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 marker:hidden transition hover:border-primary-200 hover:bg-primary-50 [&::-webkit-details-marker]:hidden">
          <span>{label}</span>
          <span aria-hidden="true" className="text-xs text-slate-400 group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-1 grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-lg">
          <button type="button" onClick={() => setMarket('BR')} aria-pressed={market === 'BR'} className={`rounded-lg text-left font-bold ${labelClass} ${market === 'BR' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-white'}`}>Brasil · Português</button>
          <button type="button" onClick={() => setMarket('US')} aria-pressed={market === 'US'} className={`rounded-lg text-left font-bold ${labelClass} ${market === 'US' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-white'}`}>United States · English</button>
        </div>
      </details>
    )
  }

  return (
    <div className={`grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 ${className}`} aria-label="Market and language">
      <button type="button" onClick={() => setMarket('BR')} aria-pressed={market === 'BR'} className={`rounded-lg font-bold ${labelClass} ${market === 'BR' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Brasil · Português</button>
      <button type="button" onClick={() => setMarket('US')} aria-pressed={market === 'US'} className={`rounded-lg font-bold ${labelClass} ${market === 'US' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>United States · English</button>
    </div>
  )
}
