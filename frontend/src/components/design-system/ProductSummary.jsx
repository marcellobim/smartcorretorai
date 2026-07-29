import { CheckCircle2 } from 'lucide-react'
export default function ProductSummary({ title = 'Resumo da criação', items = [], emptyText = 'Suas escolhas aparecerão aqui durante a criação.', onEdit, editDisabled = false }) {
  return <aside className="rounded-3xl bg-white/80 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70 backdrop-blur-sm">
    <h3 className="text-base font-black text-slate-900">{title}</h3>
    {items.length ? <div className="mt-4 space-y-2 rounded-2xl bg-slate-50/90 p-2">{items.map(item => {
      const content = <><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" /><span>{item.label}</span></>
      return onEdit
        ? <button key={item.id} type="button" disabled={editDisabled} onClick={() => onEdit(item.id)} className="flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold leading-5 text-slate-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60">{content}</button>
        : <div key={item.id} className="flex items-start gap-2 rounded-xl px-2 py-2 text-sm font-bold leading-5 text-slate-700">{content}</div>
    })}</div> : <p className="mt-4 text-sm font-medium leading-6 text-slate-500">{emptyText}</p>}
  </aside>
}
