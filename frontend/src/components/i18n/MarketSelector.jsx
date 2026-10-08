import { useLocale } from '../../i18n/useLocale'

export default function MarketSelector({ className = '', compact = false }) {
  const { market, setMarket } = useLocale()
  const labelClass = compact ? 'px-2 py-1.5 text-[11px]' : 'px-2 py-2 text-xs'

  return (
    <div className={`grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 ${className}`} aria-label="Market and language">
      <button type="button" onClick={() => setMarket('BR')} aria-pressed={market === 'BR'} className={`rounded-lg font-bold ${labelClass} ${market === 'BR' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Brasil · Português</button>
      <button type="button" onClick={() => setMarket('US')} aria-pressed={market === 'US'} className={`rounded-lg font-bold ${labelClass} ${market === 'US' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>United States · English</button>
    </div>
  )
}
