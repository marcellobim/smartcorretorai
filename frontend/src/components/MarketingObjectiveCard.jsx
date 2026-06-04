import { useState } from 'react'
import { CheckCircle2, Maximize2, X } from 'lucide-react'

export default function MarketingObjectiveCard({ objective, selected = false, onToggle }) {
  const [showDetails, setShowDetails] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  return (
    <>
      <article
        className={`rounded-2xl border overflow-hidden transition-all flex flex-col ${
          selected
            ? 'border-primary-400 bg-gray-950 text-white shadow-lg shadow-primary-950/20 ring-2 ring-primary-100'
            : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-md'
        }`}
      >
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="relative aspect-[16/9] bg-gray-100 overflow-hidden text-left group"
          aria-label={`Ampliar preview de ${objective.publicName}`}
        >
          {objective.previewType === 'video' ? (
            <video src={objective.previewUrl} muted loop playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={objective.previewUrl} alt={`Preview ${objective.publicName}`} className="w-full h-full object-cover" />
          )}
          <span className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white opacity-90 transition-opacity group-hover:opacity-100">
            <Maximize2 className="w-4 h-4" />
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/75 to-transparent">
            <div className="flex flex-wrap gap-1.5">
              {objective.badges.map((badge) => (
                <span key={badge} className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-gray-900">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </button>

        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black">{objective.publicName}</h3>
              <p className={`mt-1 text-xs leading-relaxed ${selected ? 'text-gray-300' : 'text-gray-500'}`}>
                {objective.description}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
              selected ? 'bg-amber-300 text-gray-950' : 'bg-amber-100 text-amber-700'
            }`}>
              {objective.credits} cr{"\u00e9"}ditos
            </span>
          </div>

          <div className={`mt-4 space-y-2 rounded-xl border p-3 ${selected ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
            <InfoLine label="Onde usar" value={objective.useWhere} selected={selected} />
            <InfoLine label="Resultado esperado" value={objective.expectedResult} selected={selected} strong />

            {showDetails && (
              <div className="space-y-2 border-t border-current/10 pt-2">
                <InfoLine label={`Onde n${"\u00e3"}o usar`} value={objective.avoidWhere} selected={selected} />
                <InfoLine label="Objetivo" value={objective.objective} selected={selected} />
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className={`text-xs font-black ${selected ? 'text-amber-200 hover:text-amber-100' : 'text-primary-600 hover:text-primary-800'}`}
            >
              {showDetails ? 'Ocultar detalhes' : 'Saiba mais'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onToggle(objective)}
            className={`mt-4 w-full rounded-xl px-3 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              selected
                ? 'bg-white text-gray-950 hover:bg-gray-100'
                : 'bg-gray-950 text-white hover:bg-gray-800'
            }`}
          >
            {selected && <CheckCircle2 className="w-4 h-4" />}
            {selected ? 'Desmarcar produto' : 'Selecionar produto'}
          </button>
        </div>
      </article>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-2xl bg-white overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-primary-600">Preview fixo</p>
                <h3 className="text-lg font-black text-gray-900">{objective.publicName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Fechar preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-950 p-4">
              {objective.previewType === 'video' ? (
                <video src={objective.previewUrl} muted loop controls playsInline className="mx-auto max-h-[70vh] w-full rounded-xl object-contain" />
              ) : (
                <img src={objective.previewUrl} alt={`Preview ampliado ${objective.publicName}`} className="mx-auto max-h-[70vh] w-full rounded-xl object-contain" />
              )}
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">{objective.expectedResult}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoLine({ label, value, selected, strong = false }) {
  return (
    <div>
      <p className={`text-[11px] font-black ${selected ? 'text-amber-200' : 'text-gray-700'}`}>{label}</p>
      <p className={`text-xs leading-relaxed ${selected ? 'text-gray-300' : 'text-gray-500'} ${strong ? 'font-semibold' : ''}`}>
        {value}
      </p>
    </div>
  )
}
