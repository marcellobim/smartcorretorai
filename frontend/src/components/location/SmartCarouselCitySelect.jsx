import { useEffect, useState } from 'react'

export const SMART_CAROUSEL_STATE_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const SMART_CAROUSEL_LOCATION_SELECT_CLASS = 'w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400'

const LOCATION_CONTROL_CLASSES = {
  emerald: 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-100',
  cyan: 'border-cyan-100 focus:border-cyan-400 focus:ring-cyan-100',
  primary: 'border-primary-100 focus:border-primary-400 focus:ring-primary-100',
}

const getLocationControlClass = (accent = 'emerald') => `w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${LOCATION_CONTROL_CLASSES[accent] || LOCATION_CONTROL_CLASSES.emerald}`

export function SmartLocationSelect({ value, onChange, children, accent = 'emerald', ariaLabel, ...props }) {
  return <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} className={getLocationControlClass(accent)} {...props}>{children}</select>
}

export function SmartLocationTextInput({ value, onChange, placeholder = 'Digite o bairro', accent = 'emerald', ariaLabel = 'Bairro', ...props }) {
  return <input aria-label={ariaLabel} value={value} onChange={onChange} placeholder={placeholder} className={getLocationControlClass(accent)} {...props} />
}
export function SmartCarouselStateSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={SMART_CAROUSEL_LOCATION_SELECT_CLASS}
    >
      <option value="">Selecione o estado</option>
      {SMART_CAROUSEL_STATE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}

export default function SmartCarouselCitySelect({ uf, value, onChange }) {
  const [cities, setCities] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)

  useEffect(() => {
    if (!uf) {
      setCities([])
      setCitiesLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setCitiesLoading(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: controller.signal })
      .then((response) => response.json())
      .then((items) => setCities(Array.isArray(items) ? items.map((item) => item?.nome).filter(Boolean) : []))
      .catch((error) => {
        if (error?.name !== 'AbortError') setCities([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setCitiesLoading(false)
      })

    return () => controller.abort()
  }, [uf])

  return (
    <select
      value={value}
      disabled={!uf || citiesLoading}
      onChange={(event) => onChange(event.target.value)}
      className={SMART_CAROUSEL_LOCATION_SELECT_CLASS}
    >
      <option value="">{citiesLoading ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
      {cities.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}
