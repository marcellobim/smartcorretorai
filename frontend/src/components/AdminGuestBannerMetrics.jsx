import { useEffect, useState } from 'react'
import { adminRequest } from '../lib/admin-api'

const FIELDS = [
  ['landingStarts', 'Entradas pela chamada grátis'],
  ['bannerStarts', 'Aberturas do teste'],
  ['requests', 'Pedidos de geração'],
  ['completed', 'Concluídos'],
  ['failed', 'Com falha'],
  ['reserved', 'Aguardando envio'],
  ['dispatching', 'Enviados para geração'],
  ['unknown', 'Estado a confirmar'],
  ['cancelled', 'Cancelados'],
]

export default function AdminGuestBannerMetrics({ period, revision }) {
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setResult(null)
    adminRequest('guest_banner_metrics', { period })
      .then(data => { if (active) setResult({ period, revision, metrics: data?.metrics || {} }) })
      .catch(() => { if (active) setResult({ period, revision, metrics: {} }) })
    return () => { active = false }
  }, [period, revision, retry])

  const loading = !result || result.period !== period || result.revision !== revision
  const validCount = value => Number.isSafeInteger(value) && value >= 0
  const unavailable = !loading && FIELDS.some(([key]) => !validCount(result.metrics[key]))
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="guest-banner-title" aria-busy={loading}>
      <h2 id="guest-banner-title" className="text-lg font-semibold text-slate-950">Banner Imobiliário — teste grátis</h2>
      <p className="mt-1 text-sm text-slate-600">Uso sem cadastro registrado pelo servidor, no período selecionado.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FIELDS.map(([key, label]) => (
          <div key={key} className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{loading ? 'Carregando…' : validCount(result.metrics[key]) ? result.metrics[key].toLocaleString('pt-BR') : 'Indisponível'}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">Entradas e aberturas são eventos registrados, não visitantes únicos. Os pedidos são filtrados pela data de criação e agrupados pelo estado atual. Conclusão não comprova download nem assinatura. Não há recuperação retroativa de acessos que não foram registrados.</p>
      {unavailable && <div className="mt-3 text-sm text-amber-900" role="status">Parte das métricas não está disponível. Isso não significa ausência de uso. <button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
    </section>
  )
}
