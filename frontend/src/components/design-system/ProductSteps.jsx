import { CheckCircle2 } from 'lucide-react'

export default function ProductSteps({ steps, activeStep, label = 'Etapas da criação', className = '' }) {
  return <nav aria-label={label} className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
    <ol className="grid gap-2 sm:grid-cols-5">
      {steps.map((rawStep, index) => {
        const step = typeof rawStep === 'string' ? { title: rawStep, subtitle: '' } : rawStep
        const number = index + 1
        const complete = number < activeStep
        const current = number === activeStep
        return <li key={step.title} aria-current={current ? 'step' : undefined} className={`min-w-0 rounded-xl border px-3 py-3 ${current ? 'border-primary-200 bg-primary-50' : complete ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
          <div className="flex items-start gap-2.5">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${current ? 'bg-primary-700 text-white' : complete ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{complete ? <CheckCircle2 className="h-4 w-4" /> : number}</span>
            <span className="min-w-0">
              <span className="block text-xs font-black leading-4 text-slate-900">{step.title}</span>
              {step.subtitle && <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-500">{step.subtitle}</span>}
            </span>
          </div>
        </li>
      })}
    </ol>
  </nav>
}
